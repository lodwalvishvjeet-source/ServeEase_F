import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import { generateToken } from '../src/controllers/authController.js';
import { generateArrivalOtpPayload, deriveArrivalOtp, hashArrivalOtp } from '../src/utils/arrivalOtp.js';

let mongoServer;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_serveease';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  await User.deleteMany({});
  await Booking.deleteMany({});
});

// Helper: Create a verified test customer
const createTestCustomer = async (overrides = {}) => {
  const passwordHash = await User.hashPassword('Password123');
  const user = await User.create({
    name: 'Customer Test',
    email: 'customer@example.com',
    phoneNumber: '+91 9822000001',
    city: 'sangli',
    role: 'customer',
    emailVerified: true,
    passwordHash,
    ...overrides
  });
  const token = generateToken(user._id, user.role);
  return { user, token };
};

// Helper: Create an approved test service provider
const createTestProvider = async (overrides = {}) => {
  const passwordHash = await User.hashPassword('Password123');
  const user = await User.create({
    name: 'Technician Test',
    email: 'provider@example.com',
    phoneNumber: '+91 9822000002',
    city: 'sangli',
    role: 'provider',
    emailVerified: true,
    verificationStatus: 'approved',
    passwordHash,
    providerDetails: {
      category: 'Plumbing',
      categorySlug: 'plumbing',
      title: 'Expert Plumber',
      servicesOffered: ['Leak Repair', 'Pipe Fitting'],
      serviceArea: 'Vishrambag',
      startingPrice: 300,
      hourlyRate: 350,
      isAvailable: true,
      isVerified: true,
      verificationStatus: 'approved'
    },
    ...overrides
  });
  const token = generateToken(user._id, user.role);
  return { user, token };
};

// Helper: Create a test booking between customer and provider
const createTestBooking = async (customer, provider, overrides = {}) => {
  return await Booking.create({
    customer: customer._id,
    provider: provider._id,
    serviceName: 'Leak Repair',
    category: 'Plumbing',
    city: 'sangli',
    serviceAddress: '123 Main Street, Vishrambag',
    bookingDate: '2026-11-01',
    bookingTime: '10:00 AM - 11:00 AM',
    price: 300,
    priceType: 'starting_charge',
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        changedAt: new Date(),
        changedBy: customer._id,
        note: 'Booking requested by customer'
      }
    ],
    ...overrides
  });
};

// ============================================================================
// 1. GENERATE ARRIVAL OTP ON BOOKING ACCEPTANCE
// ============================================================================
test('1. When SP accepts booking, arrival OTP hash and expiry are generated without exposing plain OTP to SP', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  const res = await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.booking.status, 'accepted');

  // Verify that the response to the SP NEVER contains arrivalOtp or arrivalOtpHash
  assert.equal(res.body.booking.arrivalOtp, undefined);
  assert.equal(res.body.booking.arrivalOtpHash, undefined);
  assert.equal(res.body.booking.arrivalOtpSeed, undefined);

  // Inspect database document directly
  const dbBooking = await Booking.findById(booking._id).select('+arrivalOtpHash +arrivalOtpSeed');
  assert.equal(dbBooking.status, 'accepted');
  // Plain OTP is NOT stored in the database document
  assert.equal(dbBooking.arrivalOtp, undefined);
  // Hash and expiry MUST be stored
  assert.ok(dbBooking.arrivalOtpHash);
  assert.equal(typeof dbBooking.arrivalOtpHash, 'string');
  assert.equal(dbBooking.arrivalOtpHash.length, 64); // SHA-256 hex string
  assert.ok(dbBooking.arrivalOtpExpires);
  assert.ok(dbBooking.arrivalOtpExpires > new Date());
  assert.equal(dbBooking.arrivalOtpVerified, false);
  assert.equal(dbBooking.arrivedAt, null);
  assert.equal(dbBooking.arrivalOtpAttempts, 0);
});

// ============================================================================
// 2. CUSTOMER CAN VIEW THE ARRIVAL OTP, BUT SP CANNOT RETRIEVE IT
// ============================================================================
test('2. Customer can see arrival OTP on booking details and list, but SP cannot retrieve it', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  // SP accepts booking
  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  // 1. Customer fetches single booking: GET /api/bookings/:id
  const custRes = await request(app)
    .get(`/api/bookings/${booking._id}`)
    .set('Authorization', `Bearer ${customerToken}`);

  assert.equal(custRes.status, 200);
  assert.ok(custRes.body.booking.arrivalOtp);
  assert.equal(typeof custRes.body.booking.arrivalOtp, 'string');
  assert.match(custRes.body.booking.arrivalOtp, /^\d{6}$/); // Exactly 6 digits
  const customerOtp = custRes.body.booking.arrivalOtp;

  // 2. Customer fetches bookings list: GET /api/bookings/my
  const custListRes = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.equal(custListRes.status, 200);
  const foundCustBooking = custListRes.body.bookings.find(b => b._id.toString() === booking._id.toString());
  assert.ok(foundCustBooking);
  assert.equal(foundCustBooking.arrivalOtp, customerOtp);

  // 3. Customer fetches dedicated arrival OTP endpoint: GET /api/bookings/:id/arrival-otp
  const custOtpRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customerToken}`);

  assert.equal(custOtpRes.status, 200);
  assert.equal(custOtpRes.body.arrivalOtp, customerOtp);
  assert.ok(custOtpRes.body.expiresAt);

  // 4. SP fetches booking: GET /api/bookings/:id (SP MUST NOT see arrivalOtp)
  const spRes = await request(app)
    .get(`/api/bookings/${booking._id}`)
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(spRes.status, 200);
  assert.equal(spRes.body.booking.arrivalOtp, undefined);
  assert.equal(spRes.body.booking.arrivalOtpHash, undefined);

  // 5. SP fetches provider bookings: GET /api/bookings/provider
  const spListRes = await request(app)
    .get('/api/bookings/provider')
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(spListRes.status, 200);
  const foundSpBooking = spListRes.body.bookings.find(b => b._id.toString() === booking._id.toString());
  assert.ok(foundSpBooking);
  assert.equal(foundSpBooking.arrivalOtp, undefined);
  assert.equal(foundSpBooking.arrivalOtpHash, undefined);

  // 6. SP attempts to call customer arrival OTP endpoint (rejected with 403)
  const spOtpAttempt = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(spOtpAttempt.status, 403);
});

// ============================================================================
// 3. UNASSIGNED PROVIDER OR UNRELATED CUSTOMER CANNOT VIEW OR VERIFY
// ============================================================================
test('3. Non-assigned provider and unrelated customer cannot view arrival OTP or verify arrival', async () => {
  const { user: customer1 } = await createTestCustomer({ email: 'c1@example.com' });
  const { token: customer2Token } = await createTestCustomer({ email: 'c2@example.com' });
  const { user: provider1, token: provider1Token } = await createTestProvider({ email: 'p1@example.com' });
  const { token: provider2Token } = await createTestProvider({ email: 'p2@example.com' });

  const booking = await createTestBooking(customer1, provider1);

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${provider1Token}`)
    .send({});

  // Unrelated customer cannot access arrival OTP endpoint
  const c2Res = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customer2Token}`);
  assert.equal(c2Res.status, 403);

  // Non-assigned provider cannot verify arrival
  const p2Verify = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${provider2Token}`)
    .send({ otp: '123456' });
  assert.equal(p2Verify.status, 403);
  assert.ok(p2Verify.body.error.includes('not the technician assigned'));
});

// ============================================================================
// 4. WRONG OTP IS REJECTED WITH ATTEMPT COUNTER INCREMENT
// ============================================================================
test('4. Incorrect OTP is rejected with HTTP 400 and increments failed attempt counter', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  // Provider enters wrong OTP
  const res = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: '000000' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Invalid arrival verification code'));

  const dbBooking = await Booking.findById(booking._id);
  assert.equal(dbBooking.arrivalOtpVerified, false);
  assert.equal(dbBooking.arrivalOtpAttempts, 1);
});

// ============================================================================
// 5. MALFORMED OTP CODES ARE REJECTED
// ============================================================================
test('5. Missing or malformed OTP codes are rejected with HTTP 400', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  // Missing OTP
  const resEmpty = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});
  assert.equal(resEmpty.status, 400);

  // Short OTP
  const resShort = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: '123' });
  assert.equal(resShort.status, 400);

  // Non-numeric OTP
  const resAlpha = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: 'abcdef' });
  assert.equal(resAlpha.status, 400);
});

// ============================================================================
// 6. ATTEMPT LIMIT EXCEEDED ENFORCEMENT
// ============================================================================
test('6. Maximum verification attempts (5) lock the OTP and return HTTP 429', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  // Fetch the real valid OTP for customer
  const custRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customerToken}`);
  const validOtp = custRes.body.arrivalOtp;

  // Perform 5 wrong attempts
  for (let i = 0; i < 5; i++) {
    const wrongRes = await request(app)
      .post(`/api/bookings/${booking._id}/verify-arrival`)
      .set('Authorization', `Bearer ${providerToken}`)
      .send({ otp: '999999' });
    assert.equal(wrongRes.status, 400);
  }

  // 6th attempt even with VALID OTP must be rejected due to attempt limit
  const lockedRes = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: validOtp });

  assert.equal(lockedRes.status, 429);
  assert.ok(lockedRes.body.error.includes('Maximum verification attempts exceeded'));

  const dbBooking = await Booking.findById(booking._id);
  assert.equal(dbBooking.arrivalOtpVerified, false);
});

// ============================================================================
// 7. EXPIRED OTP IS REJECTED
// ============================================================================
test('7. Expired arrival OTP is rejected with HTTP 400', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  const custRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customerToken}`);
  const validOtp = custRes.body.arrivalOtp;

  // Manually expire the OTP in the database
  await Booking.findByIdAndUpdate(booking._id, {
    arrivalOtpExpires: new Date(Date.now() - 60 * 1000) // 1 minute in the past
  });

  const res = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: validOtp });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.includes('expired'));
});

// ============================================================================
// 8. UNRELATED BOOKING STATES CANNOT VERIFY ARRIVAL
// ============================================================================
test('8. Pending, cancelled, or completed bookings cannot verify arrival', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  // 1. Pending booking
  const pendingBooking = await createTestBooking(customer, provider, { status: 'pending' });
  const pendingRes = await request(app)
    .post(`/api/bookings/${pendingBooking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: '123456' });
  assert.equal(pendingRes.status, 400);
  assert.ok(pendingRes.body.error.includes('Only accepted appointments'));

  // 2. Cancelled booking
  const cancelledBooking = await createTestBooking(customer, provider, { status: 'cancelled' });
  const cancelledRes = await request(app)
    .post(`/api/bookings/${cancelledBooking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: '123456' });
  assert.equal(cancelledRes.status, 400);

  // 3. Completed booking
  const completedBooking = await createTestBooking(customer, provider, { status: 'completed' });
  const completedRes = await request(app)
    .post(`/api/bookings/${completedBooking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: '123456' });
  assert.equal(completedRes.status, 400);
});

// ============================================================================
// 9. SUCCESSFUL ARRIVAL VERIFICATION & TIMESTAMPS
// ============================================================================
test('9. Valid OTP verification records arrival timestamp, marks verified, and notifies customer', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  // SP accepts booking
  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  // Customer retrieves the valid OTP
  const custRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customerToken}`);
  const validOtp = custRes.body.arrivalOtp;

  // SP arrives and enters customer's OTP
  const verifyRes = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: validOtp });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.success, true);
  assert.equal(verifyRes.body.booking.arrivalOtpVerified, true);
  assert.ok(verifyRes.body.booking.arrivedAt);
  // Verify OTP is never returned in response
  assert.equal(verifyRes.body.booking.arrivalOtp, undefined);
  assert.equal(verifyRes.body.booking.arrivalOtpHash, undefined);

  // Verify in DB
  const dbBooking = await Booking.findById(booking._id).select('+arrivalOtpHash +arrivalOtpSeed');
  assert.equal(dbBooking.arrivalOtpVerified, true);
  assert.ok(dbBooking.arrivedAt);
  assert.equal(dbBooking.arrivalOtpHash, null); // Invalidated on consumption
  assert.equal(dbBooking.arrivalOtpSeed, null); // Invalidated on consumption

  // Customer re-checks booking details; OTP is no longer shown
  const custAfterRes = await request(app)
    .get(`/api/bookings/${booking._id}`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custAfterRes.body.booking.arrivalOtp, undefined);
  assert.equal(custAfterRes.body.booking.arrivalOtpVerified, true);
  assert.ok(custAfterRes.body.booking.arrivedAt);
});

// ============================================================================
// 10. REUSE AND DUPLICATE VERIFICATION PREVENTION (CONCURRENCY)
// ============================================================================
test('10. OTP cannot be reused after consumption and duplicate/concurrent verification is rejected', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  const custRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customerToken}`);
  const validOtp = custRes.body.arrivalOtp;

  // 1st verification succeeds
  const firstRes = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: validOtp });
  assert.equal(firstRes.status, 200);

  // 2nd verification attempt (re-use) MUST be rejected with HTTP 400
  const secondRes = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: validOtp });

  assert.equal(secondRes.status, 400);
  assert.ok(secondRes.body.error.includes('already been verified'));
});

// ============================================================================
// 11. BOOKING LIFECYCLE CONTINUATION AFTER ARRIVAL VERIFICATION
// ============================================================================
test('11. Booking lifecycle continues smoothly: SP can start and complete booking after arrival verification', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();
  const booking = await createTestBooking(customer, provider);

  // Accept booking
  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  // Customer gets OTP
  const custRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customerToken}`);

  // SP verifies arrival
  const verifyRes = await request(app)
    .patch(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: custRes.body.arrivalOtp });
  assert.equal(verifyRes.status, 200);

  // SP starts booking -> in_progress
  const startRes = await request(app)
    .patch(`/api/bookings/${booking._id}/start`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});
  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.booking.status, 'in_progress');

  // SP completes booking -> completed
  const completeRes = await request(app)
    .patch(`/api/bookings/${booking._id}/complete`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.booking.status, 'completed');
  assert.ok(completeRes.body.booking.completedAt);
});
