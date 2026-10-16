import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';

let mongoServer;
let originalEmailUser;
let originalEmailPass;
let originalEmailService;
let originalCreateTransport;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_serveease';
  process.env.NODE_ENV = 'test';
  await mongoose.connect(uri);

  originalEmailUser = process.env.EMAIL_USER;
  originalEmailPass = process.env.EMAIL_PASS;
  originalEmailService = process.env.EMAIL_SERVICE;
  originalCreateTransport = nodemailer.createTransport;
});

test.after(async () => {
  process.env.EMAIL_USER = originalEmailUser;
  process.env.EMAIL_PASS = originalEmailPass;
  process.env.EMAIL_SERVICE = originalEmailService;
  nodemailer.createTransport = originalCreateTransport;

  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.beforeEach(async () => {
  await User.deleteMany({});
  await Booking.deleteMany({});
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  delete process.env.EMAIL_SERVICE;
  delete process.env.EMAIL_HOST;
  nodemailer.createTransport = originalCreateTransport;
});

// Helper: Create a verified, available provider for booking tests
const createVerifiedProvider = async () => {
  const hash = await User.hashPassword('ProviderPass123!');
  const provider = await User.create({
    name: 'Verified Plumber',
    email: 'plumber@example.com',
    passwordHash: hash,
    role: 'provider',
    city: 'sangli',
    phoneNumber: '+91 9822100002',
    status: 'active',
    providerDetails: {
      category: 'Plumbing',
      title: 'Senior Plumber',
      servicesOffered: ['Pipe Repair', 'Tap Installation'],
      serviceArea: 'Central Sangli',
      startingPrice: 300,
      hourlyRate: 350,
      isAvailable: true,
      isVerified: true,
      verificationStatus: 'approved'
    }
  });
  return provider;
};

// =========================================================================
// 1. REGISTRATION & DEFAULT VERIFICATION STATE
// =========================================================================

test('1. Customer registration defaults to emailVerified: false and generates 6-digit OTP', async () => {
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Unverified Customer',
      email: 'unverified@example.com',
      password: 'CustomerPass123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  assert.equal(regRes.status, 201);
  assert.equal(regRes.body.success, true);
  assert.equal(regRes.body.user.emailVerified, false);
  assert.equal(regRes.body.user.emailVerificationOtp, undefined, 'OTP must never leak in API responses');

  // Verify DB state
  const inDb = await User.findOne({ email: 'unverified@example.com' }).select('+emailVerificationOtp +emailVerificationOtpExpires');
  assert.ok(inDb);
  assert.equal(inDb.emailVerified, false);
  assert.equal(typeof inDb.emailVerificationOtp, 'string');
  assert.equal(inDb.emailVerificationOtp.length, 6);
  assert.ok(/^\d{6}$/.test(inDb.emailVerificationOtp));
  assert.ok(inDb.emailVerificationOtpExpires > new Date());
});

test('2. Registration dispatches OTP email when email service is configured', async () => {
  let dispatchedMail = null;
  process.env.EMAIL_USER = 'serveease.test@gmail.com';
  process.env.EMAIL_PASS = 'abcd efgh ijkl mnop';

  nodemailer.createTransport = () => ({
    sendMail: async (mailOptions) => {
      dispatchedMail = mailOptions;
      return { messageId: 'test-msg-id-123' };
    }
  });

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Emailed Customer',
      email: 'emailed.cust@gmail.com',
      password: 'CustomerPass123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  assert.equal(regRes.status, 201);
  assert.ok(dispatchedMail);
  assert.equal(dispatchedMail.to, 'emailed.cust@gmail.com');
  assert.ok(dispatchedMail.subject.includes('Verify Your Email'));

  const inDb = await User.findOne({ email: 'emailed.cust@gmail.com' }).select('+emailVerificationOtp');
  assert.ok(dispatchedMail.text.includes(inDb.emailVerificationOtp));
});

test('3. Registration delivery failure rolls back user and prevents duplicate account conflict on retry', async () => {
  process.env.EMAIL_USER = 'serveease.test@gmail.com';
  process.env.EMAIL_PASS = 'invalid_credentials';

  nodemailer.createTransport = () => ({
    sendMail: async () => {
      const err = new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
      err.responseCode = 535;
      throw err;
    }
  });

  // Attempt 1: Delivery fails
  const failedRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Retry Customer',
      email: 'retry.cust@gmail.com',
      password: 'CustomerPass123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  assert.equal(failedRes.status, 503);
  assert.equal(failedRes.body.success, false);
  assert.ok(failedRes.body.error.includes('Unable to deliver verification email'));

  // Ensure DB rolled back
  const inDbAfterFail = await User.findOne({ email: 'retry.cust@gmail.com' });
  assert.equal(inDbAfterFail, null);

  // Attempt 2 (Retry): After SMTP fixed, registration succeeds without 409 duplicate account error
  nodemailer.createTransport = () => ({
    sendMail: async () => ({ messageId: 'retry-success-id' })
  });

  const retryRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Retry Customer',
      email: 'retry.cust@gmail.com',
      password: 'CustomerPass123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  assert.equal(retryRes.status, 201);
  assert.equal(retryRes.body.success, true);
  assert.equal(retryRes.body.user.emailVerified, false);
});

// =========================================================================
// 2. UNVERIFIED CUSTOMER LOGIN & BROWSING
// =========================================================================

test('4. Unverified customer can login, browse categories and providers, and view profile', async () => {
  const provider = await createVerifiedProvider();

  // Register customer
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Browsing Customer',
      email: 'browsing@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });
  assert.equal(regRes.status, 201);

  // Login
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'browsing@example.com',
      password: 'Password123!'
    });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.user.emailVerified, false);
  const token = loginRes.body.token;

  // Browse categories
  const catRes = await request(app).get('/api/categories');
  assert.equal(catRes.status, 200);
  assert.ok(catRes.body.categories.length > 0);

  // Browse providers in Sangli
  const provRes = await request(app).get('/api/providers?city=sangli');
  assert.equal(provRes.status, 200);
  assert.ok(provRes.body.providers.length >= 1);

  // Check profile
  const meRes = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.emailVerified, false);
});

// =========================================================================
// 3. ENFORCE VERIFICATION ON BOOKING
// =========================================================================

test('5. Unverified customer is strictly blocked from creating bookings with HTTP 403', async () => {
  const provider = await createVerifiedProvider();

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Booking Blocked Customer',
      email: 'blocked@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  const token = regRes.body.token;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const bookRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      providerId: provider._id,
      serviceName: 'Pipe Repair',
      city: 'sangli',
      serviceAddress: '123 Main Road, Sangli',
      bookingDate: tomorrowStr,
      bookingTime: '10:00 AM - 12:00 PM',
      description: 'Kitchen pipe is leaking water'
    });

  assert.equal(bookRes.status, 403);
  assert.equal(bookRes.body.success, false);
  assert.equal(bookRes.body.requiresEmailVerification, true);
  assert.ok(bookRes.body.error.includes('verify your email'));

  // Ensure no booking document was saved
  const bookingCount = await Booking.countDocuments();
  assert.equal(bookingCount, 0);
});

// =========================================================================
// 4. OTP VERIFICATION ENDPOINT
// =========================================================================

test('6. POST /api/auth/verify-email-otp rejects missing email or OTP with HTTP 400', async () => {
  const res1 = await request(app).post('/api/auth/verify-email-otp').send({});
  assert.equal(res1.status, 400);
  assert.equal(res1.body.success, false);

  const res2 = await request(app).post('/api/auth/verify-email-otp').send({ email: 'test@example.com' });
  assert.equal(res2.status, 400);
  assert.equal(res2.body.success, false);
});

test('7. POST /api/auth/verify-email-otp rejects incorrect OTP code with HTTP 400', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Wrong OTP Customer',
      email: 'wrongotp@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  const verifyRes = await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'wrongotp@example.com',
      otp: '000000'
    });

  assert.equal(verifyRes.status, 400);
  assert.equal(verifyRes.body.success, false);
  assert.ok(verifyRes.body.error.includes('Invalid verification code'));
});

test('8. POST /api/auth/verify-email-otp rejects expired OTP code with HTTP 400', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Expired OTP Customer',
      email: 'expiredotp@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  // Manually expire the OTP
  const user = await User.findOne({ email: 'expiredotp@example.com' }).select('+emailVerificationOtp +emailVerificationOtpExpires');
  const validOtp = user.emailVerificationOtp;
  user.emailVerificationOtpExpires = new Date(Date.now() - 60 * 1000); // 1 minute in the past
  await user.save();

  const verifyRes = await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'expiredotp@example.com',
      otp: validOtp
    });

  assert.equal(verifyRes.status, 400);
  assert.equal(verifyRes.body.success, false);
  assert.ok(verifyRes.body.error.includes('expired'));
});

test('9. Password reset OTP cannot be used to verify customer registration email', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Cross OTP Customer',
      email: 'crossotp@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  // Assign a password reset OTP
  const user = await User.findOne({ email: 'crossotp@example.com' }).select('+emailVerificationOtp');
  user.resetPasswordOtp = '999888';
  user.resetPasswordOtpExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  // Try using resetPasswordOtp to verify email
  const verifyRes = await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'crossotp@example.com',
      otp: '999888'
    });

  assert.equal(verifyRes.status, 400);
  assert.equal(verifyRes.body.success, false);
  assert.ok(verifyRes.body.error.includes('Invalid verification code'));

  const userAfter = await User.findOne({ email: 'crossotp@example.com' });
  assert.equal(userAfter.emailVerified, false);
});

test('10. Valid OTP successfully marks account verified, records timestamp, and invalidates OTP (single-use)', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Verify Success Customer',
      email: 'verifysuccess@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  const user = await User.findOne({ email: 'verifysuccess@example.com' }).select('+emailVerificationOtp');
  const validOtp = user.emailVerificationOtp;

  const verifyRes = await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'verifysuccess@example.com',
      otp: validOtp
    });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.success, true);
  assert.equal(verifyRes.body.user.emailVerified, true);

  // Check DB state
  const updatedUser = await User.findOne({ email: 'verifysuccess@example.com' }).select('+emailVerificationOtp +emailVerificationOtpExpires');
  assert.equal(updatedUser.emailVerified, true);
  assert.ok(updatedUser.emailVerifiedAt instanceof Date);
  assert.equal(updatedUser.emailVerificationOtp, null, 'OTP must be cleared after verification');
  assert.equal(updatedUser.emailVerificationOtpExpires, null);

  // Attempt to reuse the same OTP
  const reuseRes = await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'verifysuccess@example.com',
      otp: validOtp
    });

  // Email is already verified
  assert.equal(reuseRes.status, 200);
  assert.ok(reuseRes.body.message.includes('already verified'));
});

// =========================================================================
// 5. RESEND VERIFICATION OTP
// =========================================================================

test('11. POST /api/auth/resend-verification-otp generates new OTP and sends email', async () => {
  process.env.EMAIL_USER = 'serveease.test@gmail.com';
  process.env.EMAIL_PASS = 'abcd efgh ijkl mnop';

  let sentEmail = null;
  nodemailer.createTransport = () => ({
    sendMail: async (mailOptions) => {
      sentEmail = mailOptions;
      return { messageId: 'resend-123' };
    }
  });

  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Resend Customer',
      email: 'resend@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  const initialUser = await User.findOne({ email: 'resend@example.com' }).select('+emailVerificationOtp');
  const initialOtp = initialUser.emailVerificationOtp;

  const resendRes = await request(app)
    .post('/api/auth/resend-verification-otp')
    .send({ email: 'resend@example.com' });

  assert.equal(resendRes.status, 200);
  assert.equal(resendRes.body.success, true);

  const updatedUser = await User.findOne({ email: 'resend@example.com' }).select('+emailVerificationOtp');
  assert.ok(updatedUser.emailVerificationOtp);
  assert.notEqual(updatedUser.emailVerificationOtp, initialOtp, 'New OTP must differ from initial');
  assert.ok(sentEmail);
  assert.equal(sentEmail.to, 'resend@example.com');
  assert.ok(sentEmail.text.includes(updatedUser.emailVerificationOtp));
});

test('12. POST /api/auth/resend-verification-otp rejects already-verified accounts with HTTP 400', async () => {
  process.env.EMAIL_USER = 'serveease.test@gmail.com';
  process.env.EMAIL_PASS = 'abcd efgh ijkl mnop';

  nodemailer.createTransport = () => ({
    sendMail: async () => ({ messageId: 'resend-already-verified' })
  });

  const hash = await User.hashPassword('Password123!');
  await User.create({
    name: 'Already Verified',
    email: 'alreadyverified@example.com',
    passwordHash: hash,
    role: 'customer',
    city: 'sangli',
    emailVerified: true
  });

  const resendRes = await request(app)
    .post('/api/auth/resend-verification-otp')
    .send({ email: 'alreadyverified@example.com' });

  assert.equal(resendRes.status, 400);
  assert.equal(resendRes.body.success, false);
  assert.ok(resendRes.body.error.includes('already verified'));
});

// =========================================================================
// 6. BOOKING SUCCEEDS ONCE VERIFIED
// =========================================================================

test('13. Verified customer can create bookings successfully with HTTP 201', async () => {
  const provider = await createVerifiedProvider();

  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Verified Customer Booking',
      email: 'bookingok@example.com',
      password: 'Password123!',
      city: 'sangli',
      phoneNumber: '+91 9822100001',
      role: 'customer'
    });

  const user = await User.findOne({ email: 'bookingok@example.com' }).select('+emailVerificationOtp');
  const otp = user.emailVerificationOtp;

  // Verify email
  await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'bookingok@example.com',
      otp
    });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const bookRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${regRes.body.token}`)
    .send({
      providerId: provider._id,
      serviceName: 'Pipe Repair',
      city: 'sangli',
      serviceAddress: '456 College Road, Sangli',
      bookingDate: tomorrowStr,
      bookingTime: '10:00 AM - 12:00 PM',
      description: 'Need leak repair'
    });

  assert.equal(bookRes.status, 201);
  assert.equal(bookRes.body.success, true);
  assert.equal(bookRes.body.booking.status, 'pending');
  assert.equal(bookRes.body.booking.serviceName, 'Pipe Repair');
});
