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

test('1. Customer can update booking GPS coordinates', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'accepted' } });

  const res = await request(app)
    .patch(`/api/bookings/${booking._id}/location`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      latitude: 16.8524,
      longitude: 74.5815
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.booking.location.latitude, 16.8524);
  assert.equal(res.body.booking.location.longitude, 74.5815);
});

test('2. Assigned provider can fetch booking location', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  const booking = await createTestBooking({
    customer,
    provider,
    overrides: {
      status: 'accepted',
      location: { latitude: 16.8524, longitude: 74.5815 }
    }
  });

  const res = await request(app)
    .get(`/api/bookings/${booking._id}/location`)
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.customerLocation.latitude, 16.8524);
  assert.equal(res.body.customerLocation.longitude, 74.5815);
});

test('3. Rejects invalid coordinates with HTTP 400', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'accepted' } });

  const res = await request(app)
    .patch(`/api/bookings/${booking._id}/location`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      latitude: 999.0, // Invalid latitude
      longitude: 74.5815
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('4. Unassigned third-party user cannot view booking location (HTTP 403)', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider } = await createTestProvider();
  const { token: strangerToken } = await createTestCustomer();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'accepted' } });

  const res = await request(app)
    .get(`/api/bookings/${booking._id}/location`)
    .set('Authorization', `Bearer ${strangerToken}`);

  assert.equal(res.status, 403);
});
