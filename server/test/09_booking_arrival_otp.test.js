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

test('1. Full arrival OTP flow: accept booking -> customer gets OTP -> provider verifies OTP', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  // 1. Create booking in pending status
  const booking = await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  // 2. Provider accepts booking (this generates the arrival OTP)
  const acceptRes = await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(acceptRes.status, 200);

  // 3. Customer retrieves the arrival OTP
  const otpRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(otpRes.status, 200);
  assert.equal(otpRes.body.success, true);
  assert.ok(otpRes.body.arrivalOtp);
  assert.equal(otpRes.body.arrivalOtp.length, 6);

  const otp = otpRes.body.arrivalOtp;

  // 4. Provider verifies arrival on-site using the customer's OTP
  const verifyRes = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.success, true);
  assert.equal(verifyRes.body.booking.arrivalOtpVerified, true);
});

test('2. Provider submitting invalid arrival OTP is rejected with HTTP 400', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`);

  const badVerifyRes = await request(app)
    .post(`/api/bookings/${booking._id}/verify-arrival`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({ otp: '000000' });

  assert.equal(badVerifyRes.status, 400);
  assert.equal(badVerifyRes.body.success, false);
});

test('3. Non-customer user is forbidden from viewing arrival OTP (HTTP 403)', async () => {
  const { user: customer } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'pending' } });

  await request(app)
    .patch(`/api/bookings/${booking._id}/accept`)
    .set('Authorization', `Bearer ${providerToken}`);

  // Provider cannot view the customer's arrival OTP
  const forbiddenRes = await request(app)
    .get(`/api/bookings/${booking._id}/arrival-otp`)
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(forbiddenRes.status, 403);
});
