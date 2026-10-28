import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, createTestCustomer, createTestProvider, createTestBooking } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

const getTomorrowDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

test('1. POST /api/bookings creates booking in pending state', async () => {
  const { token: customerToken } = await createTestCustomer({ city: 'sangli' });
  const { user: provider } = await createTestProvider({
    city: 'sangli',
    providerDetails: {
      servicesOffered: ['Electrical Wiring'],
      isVerified: true,
      verificationStatus: 'approved'
    }
  });

  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id.toString(),
      serviceName: 'Electrical Wiring',
      city: 'sangli',
      serviceAddress: 'Flat 402, Royal Residency, Vishrambag',
      bookingDate: getTomorrowDate(),
      bookingTime: '10:00 AM - 11:00 AM',
      description: 'Main fuse replacement'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.booking.status, 'pending');
  assert.equal(res.body.booking.serviceName, 'Electrical Wiring');
});

test('2. Provider can retrieve incoming bookings via GET /api/bookings/provider', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  const res = await request(app)
    .get('/api/bookings/provider')
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.bookings));
  assert.equal(res.body.bookings.length, 1);
});

test('3. Customer can retrieve their bookings via GET /api/bookings/my', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  const res = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.bookings));
  assert.equal(res.body.bookings.length, 1);
});

test('4. Full provider booking progression: accept -> start -> complete', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  // 1. Accept
  const acceptRes = await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.booking.status, 'accepted');

  // 2. Start
  const startRes = await request(app)
    .patch(`/api/bookings/${booking._id}/start`)
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.booking.status, 'in_progress');

  // 3. Complete
  const completeRes = await request(app)
    .patch(`/api/bookings/${booking._id}/complete`)
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.booking.status, 'completed');
});

test('5. Customer can cancel a pending booking', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  const cancelRes = await request(app)
    .patch(`/api/bookings/${booking._id}/cancel`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ reason: 'Plans changed' });

  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.success, true);
  assert.equal(cancelRes.body.booking.status, 'cancelled');
});
