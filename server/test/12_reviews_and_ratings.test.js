import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
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

test('1. Customer can submit a verified review for a completed booking', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider({
    providerDetails: { rating: 0, reviewCount: 0 }
  });

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'completed' } });

  const res = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 5,
      comment: 'Excellent wiring work, finished quickly!'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.review.rating, 5);

  // Provider's aggregated rating should update in database
  const updatedProvider = await User.findById(provider._id);
  assert.equal(updatedProvider.providerDetails.reviewCount, 1);
  assert.equal(updatedProvider.providerDetails.rating, 5);
});

test('2. Submitting review for a pending booking is rejected with HTTP 400', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  const res = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 5,
      comment: 'Cannot review before completion'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('3. Submitting duplicate review for the same booking is rejected with HTTP 409', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'completed' } });

  // First review
  await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 5,
      comment: 'First review'
    });

  // Duplicate attempt
  const dupRes = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 4,
      comment: 'Second review attempt'
    });

  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.body.success, false);
});

test('4. Authenticated user can report an inappropriate review', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'completed' } });

  const revRes = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 1,
      comment: 'Spam review content'
    });

  const reviewId = revRes.body.review._id;

  const reportRes = await request(app)
    .post(`/api/reviews/${reviewId}/report`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ reason: 'This review contains offensive language' });

  assert.equal(reportRes.status, 201);
  assert.equal(reportRes.body.success, true);
});
