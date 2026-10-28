import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, sentEmails, createTestCustomer } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. POST /api/auth/forgot-password dispatches 6-digit OTP code to registered user', async () => {
  await createTestCustomer({ email: 'recover@serveease.test' });

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'recover@serveease.test' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.message.includes('verification code has been sent'));

  // Ensure OTP was persisted on user
  const user = await User.findOne({ email: 'recover@serveease.test' }).select('+resetPasswordOtp');
  assert.ok(user.resetPasswordOtp);
  assert.equal(user.resetPasswordOtp.length, 6);

  // Ensure email was intercepted
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'recover@serveease.test');
  assert.ok(sentEmails[0].text.includes(user.resetPasswordOtp));
});

test('2. POST /api/auth/forgot-password handles non-existent email uniformly to prevent enumeration', async () => {
  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'unknown@serveease.test' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('3. POST /api/auth/verify-otp validates 6-digit OTP and returns resetToken', async () => {
  await createTestCustomer({ email: 'otp.verify@serveease.test' });

  await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'otp.verify@serveease.test' });

  const user = await User.findOne({ email: 'otp.verify@serveease.test' }).select('+resetPasswordOtp');

  // Verify with valid code
  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({
      email: 'otp.verify@serveease.test',
      otp: user.resetPasswordOtp
    });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.success, true);
  assert.ok(verifyRes.body.resetToken);
});

test('4. POST /api/auth/verify-otp rejects invalid OTP with HTTP 400', async () => {
  await createTestCustomer({ email: 'bad.otp@serveease.test' });

  await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'bad.otp@serveease.test' });

  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({
      email: 'bad.otp@serveease.test',
      otp: '999999'
    });

  assert.equal(verifyRes.status, 400);
  assert.equal(verifyRes.body.success, false);
});

test('5. Complete recovery lifecycle: reset password and log in with new password', async () => {
  const { password: oldPass } = await createTestCustomer({ email: 'lifecycle@serveease.test' });

  // 1. Request OTP
  await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'lifecycle@serveease.test' });

  const user = await User.findOne({ email: 'lifecycle@serveease.test' }).select('+resetPasswordOtp');

  // 2. Verify OTP
  const verifyRes = await request(app)
    .post('/api/auth/verify-otp')
    .send({
      email: 'lifecycle@serveease.test',
      otp: user.resetPasswordOtp
    });

  const { resetToken } = verifyRes.body;

  // 3. Reset password
  const newPass = 'NewBrandSecurePass123!';
  const resetRes = await request(app)
    .post('/api/auth/reset-password')
    .send({
      email: 'lifecycle@serveease.test',
      resetToken,
      newPassword: newPass
    });

  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);

  // 4. Old password must fail
  const oldLoginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'lifecycle@serveease.test',
      password: oldPass,
      role: 'customer'
    });
  assert.equal(oldLoginRes.status, 401);

  // 5. New password must succeed
  const newLoginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'lifecycle@serveease.test',
      password: newPass,
      role: 'customer'
    });
  assert.equal(newLoginRes.status, 200);
  assert.equal(newLoginRes.body.success, true);
  assert.ok(newLoginRes.body.token);
});
