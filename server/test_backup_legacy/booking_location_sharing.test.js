import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import { generateToken } from '../src/controllers/authController.js';

let mongoServer;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_serveease';
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
  await Notification.deleteMany({});
});

const createTestCustomer = async (overrides = {}) => {
  const unique = Math.random().toString(36).substring(7);
  const passwordHash = await User.hashPassword('Password123');
  const user = await User.create({
    name: 'Customer Anita',
    email: `customer.${Date.now()}.${unique}@serveease.test`,
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

const createTestProvider = async (overrides = {}) => {
  const unique = Math.random().toString(36).substring(7);
  const passwordHash = await User.hashPassword('Password123');
  const user = await User.create({
    name: 'Technician Rajesh',
    email: `provider.${Date.now()}.${unique}@serveease.test`,
    phoneNumber: '+91 9822000002',
    city: 'sangli',
    role: 'provider',
    emailVerified: true,
    verificationStatus: 'approved',
    passwordHash,
    providerDetails: {
      category: 'Plumbing Services',
      categorySlug: 'plumbing-services',
      title: 'Expert Plumber',
      servicesOffered: ['Leak Repair', 'Pipe Fitting'],
      serviceArea: 'Vishrambag',
      startingPrice: 350,
      hourlyRate: 400,
      isAvailable: true,
      isVerified: true,
      verificationStatus: 'approved',
      location: {
        latitude: 16.8524,
        longitude: 74.5815,
        address: 'Workshop 101, Vishrambag, Sangli'
      }
    },
    ...overrides
  });
  const token = generateToken(user._id, user.role);
  return { user, token };
};

const getTomorrowDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

test('1. Customer booking location is shared only when accepted and revoked immediately upon completion', async (t) => {
  const provider = await createTestProvider();
  const customer = await createTestCustomer();
  const otherCustomer = await createTestCustomer({ name: 'Unrelated Customer' });
  const otherProvider = await createTestProvider({ name: 'Unrelated Provider' });

  const tomorrow = getTomorrowDateString();

  // Step 1: Customer creates booking with coordinates
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({
      providerId: provider.user._id,
      serviceName: 'Leak Repair',
      city: 'sangli',
      serviceAddress: 'Flat 402, Royal Palms, Gaonbhag, Sangli',
      latitude: 16.8540,
      longitude: 74.5840,
      bookingDate: tomorrow,
      bookingTime: '11:00'
    });

  assert.equal(createRes.status, 201);
  const bookingId = createRes.body.booking._id;

  // Step 2: While pending, location endpoint should indicate sharing is pending acceptance
  const pendingLocRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${customer.token}`);
  assert.equal(pendingLocRes.status, 409);
  assert.equal(pendingLocRes.body.pending, true);

  // Step 3: Provider accepts booking
  const acceptRes = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provider.token}`);
  assert.equal(acceptRes.status, 200);

  // Step 4: Assigned provider accesses location
  const providerLocRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${provider.token}`);
  assert.equal(providerLocRes.status, 200);
  assert.equal(providerLocRes.body.success, true);
  assert.equal(providerLocRes.body.customerLocation.address, 'Flat 402, Royal Palms, Gaonbhag, Sangli');
  assert.equal(providerLocRes.body.customerLocation.latitude, 16.8540);
  assert.equal(providerLocRes.body.customerLocation.longitude, 74.5840);
  assert.equal(providerLocRes.body.providerLocation.latitude, 16.8524);

  // Step 5: Customer accesses location
  const customerLocRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${customer.token}`);
  assert.equal(customerLocRes.status, 200);
  assert.equal(customerLocRes.body.providerLocation.address, 'Workshop 101, Vishrambag, Sangli');
  assert.equal(customerLocRes.body.providerLocation.providerName, 'Technician Rajesh');

  // Step 6: Unrelated customer receives 403 Forbidden
  const unrelatedCustomerRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${otherCustomer.token}`);
  assert.equal(unrelatedCustomerRes.status, 403);
  assert.match(unrelatedCustomerRes.body.error, /not authorized/i);

  // Step 7: Unrelated provider receives 403 Forbidden
  const unrelatedProviderRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${otherProvider.token}`);
  assert.equal(unrelatedProviderRes.status, 403);
  assert.match(unrelatedProviderRes.body.error, /not authorized/i);

  // Step 8: Provider completes the service
  const completeRes = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${provider.token}`);
  assert.equal(completeRes.status, 200);

  // Step 9: Post-completion location access is immediately revoked for Provider
  const revokedProviderLocRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${provider.token}`);
  assert.equal(revokedProviderLocRes.status, 409);
  assert.equal(revokedProviderLocRes.body.revoked, true);
  assert.match(revokedProviderLocRes.body.error, /revoked/i);

  // Step 10: Post-completion location access is immediately revoked for Customer
  const revokedCustomerLocRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${customer.token}`);
  assert.equal(revokedCustomerLocRes.status, 409);
  assert.equal(revokedCustomerLocRes.body.revoked, true);

  // Step 11: Attempting to update coordinates on completed booking is rejected
  const patchLocRes = await request(app)
    .patch(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${customer.token}`)
    .send({ latitude: 16.8550, longitude: 74.5850 });
  assert.equal(patchLocRes.status, 409);

  // Step 12: General booking details endpoints sanitize coordinates for completed booking
  const singleRes = await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set('Authorization', `Bearer ${customer.token}`);
  assert.equal(singleRes.status, 200);
  assert.equal(singleRes.body.booking.location, null);
  // Service address text remains for historical invoice/receipt
  assert.equal(singleRes.body.booking.serviceAddress, 'Flat 402, Royal Palms, Gaonbhag, Sangli');
});

test('2. Cancelled booking revokes location sharing access', async (t) => {
  const provider = await createTestProvider();
  const customer = await createTestCustomer();
  const tomorrow = getTomorrowDateString();

  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({
      providerId: provider.user._id,
      serviceName: 'Leak Repair',
      city: 'sangli',
      serviceAddress: 'House 12, Market Yard, Sangli',
      latitude: 16.8510,
      longitude: 74.5820,
      bookingDate: tomorrow,
      bookingTime: '14:00'
    });
  assert.equal(createRes.status, 201);
  const bookingId = createRes.body.booking._id;

  // Accept booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provider.token}`);

  // Cancel booking
  const cancelRes = await request(app)
    .patch(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${customer.token}`)
    .send({ reason: 'Emergency came up' });
  assert.equal(cancelRes.status, 200);

  // Location access revoked
  const locRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${provider.token}`);
  assert.equal(locRes.status, 409);
  assert.equal(locRes.body.revoked, true);
  assert.match(locRes.body.error, /cancelled/i);
});

test('3. Missing coordinates handled gracefully with clear fallback address', async (t) => {
  const provider = await createTestProvider();
  const customer = await createTestCustomer();
  const tomorrow = getTomorrowDateString();

  // Create booking WITHOUT coordinates (text address only)
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customer.token}`)
    .send({
      providerId: provider.user._id,
      serviceName: 'Pipe Fitting',
      city: 'sangli',
      serviceAddress: 'Near Ganpati Temple, Station Road, Sangli',
      bookingDate: tomorrow,
      bookingTime: '16:00'
    });
  assert.equal(createRes.status, 201);
  const bookingId = createRes.body.booking._id;

  // Accept booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provider.token}`);

  // Provider calls location endpoint
  const locRes = await request(app)
    .get(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${provider.token}`);
  assert.equal(locRes.status, 200);
  assert.equal(locRes.body.customerLocation.address, 'Near Ganpati Temple, Station Road, Sangli');
  assert.equal(locRes.body.customerLocation.latitude, null);
  assert.equal(locRes.body.customerLocation.longitude, null);
});
