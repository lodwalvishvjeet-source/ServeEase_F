import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';

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
  delete process.env.EMAIL_USER;
  delete process.env.EMAIL_PASS;
  delete process.env.EMAIL_SERVICE;
  delete process.env.EMAIL_HOST;
  nodemailer.createTransport = originalCreateTransport;
});

// Helper to create a verified test customer
const createTestCustomer = async (overrides = {}) => {
  const passwordHash = await User.hashPassword('OldPassword123!');
  const user = await User.create({
    name: 'Test Customer',
    email: 'customer@gmail.com',
    phoneNumber: '+91 9876543210',
    city: 'pune',
    role: 'customer',
    passwordHash,
    ...overrides
  });
  return user;
};

// =========================================================================
// 1. FORGOT PASSWORD & OTP GENERATION
// =========================================================================

test('1. POST /api/auth/forgot-password rejects missing email with HTTP 400', async () => {
  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({});
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Email address is required'));
});

test('2. POST /api/auth/forgot-password rejects invalid email syntax with HTTP 400', async () => {
  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'not-an-email' });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('valid email'));
});

test('3. POST /api/auth/forgot-password returns 503 when email delivery service is unconfigured', async () => {
  await createTestCustomer();

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'customer@gmail.com' });

  assert.equal(res.status, 503);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('not configured'));

  // Ensure no OTP was persisted when email cannot be sent
  const user = await User.findOne({ email: 'customer@gmail.com' }).select('+resetPasswordOtp');
  assert.equal(user.resetPasswordOtp, null);
});

test('4. POST /api/auth/forgot-password generates OTP and sends email when SMTP configured', async () => {
  await createTestCustomer();

  process.env.EMAIL_USER = 'serveease.test@gmail.com';
  process.env.EMAIL_PASS = 'abcd efgh ijkl mnop';
  process.env.EMAIL_SERVICE = 'gmail';

  let sentMailOptions = null;
  nodemailer.createTransport = () => ({
    sendMail: async (options) => {
      sentMailOptions = options;
      return { messageId: '<test-message-id@gmail.com>' };
    }
  });

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'customer@gmail.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.message.includes('verification code has been sent'));

  // Verify OTP was saved to database with future expiration
  const user = await User.findOne({ email: 'customer@gmail.com' }).select('+resetPasswordOtp +resetPasswordOtpExpires');
  assert.ok(user.resetPasswordOtp, 'OTP should be persisted');
  assert.equal(user.resetPasswordOtp.length, 6, 'OTP should be 6 digits');
  assert.ok(user.resetPasswordOtpExpires > new Date(), 'OTP expiration should be in the future');

  // Verify email delivery call
  assert.ok(sentMailOptions, 'Nodemailer sendMail should have been called');
  assert.equal(sentMailOptions.to, 'customer@gmail.com');
  assert.ok(sentMailOptions.text.includes(user.resetPasswordOtp));
});

test('5. POST /api/auth/forgot-password cleans up OTP and returns 503 if SMTP delivery fails', async () => {
  await createTestCustomer();

  process.env.EMAIL_USER = 'serveease.test@gmail.com';
  process.env.EMAIL_PASS = 'invalid_app_pass';
  process.env.EMAIL_SERVICE = 'gmail';

  nodemailer.createTransport = () => ({
    sendMail: async () => {
      throw new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
    }
  });

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'customer@gmail.com' });

  assert.equal(res.status, 503);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Unable to deliver'));

  // Verify unsent OTP was removed from DB
  const user = await User.findOne({ email: 'customer@gmail.com' }).select('+resetPasswordOtp');
  assert.equal(user.resetPasswordOtp, null);
});

test('6. POST /api/auth/forgot-password returns consistent generic response for unregistered email', async () => {
  process.env.EMAIL_USER = 'serveease.test@gmail.com';
  process.env.EMAIL_PASS = 'abcd efgh ijkl mnop';
  process.env.EMAIL_SERVICE = 'gmail';

  const res = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: 'nonexistent@gmail.com' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.message.includes('verification code has been sent'));
});

// =========================================================================
// 2. OTP VERIFICATION
// =========================================================================

test('7. POST /api/auth/verify-otp rejects missing email or OTP with HTTP 400', async () => {
  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email: 'customer@gmail.com' });
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('8. POST /api/auth/verify-otp rejects incorrect OTP with HTTP 400', async () => {
  await createTestCustomer({
    resetPasswordOtp: '123456',
    resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000)
  });

  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email: 'customer@gmail.com', otp: '999999' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Invalid verification code'));
});

test('9. POST /api/auth/verify-otp rejects expired OTP with HTTP 400', async () => {
  await createTestCustomer({
    resetPasswordOtp: '123456',
    resetPasswordOtpExpires: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes in the past
  });

  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email: 'customer@gmail.com', otp: '123456' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('expired'));
});

test('10. POST /api/auth/verify-otp succeeds with valid OTP and issues reset token', async () => {
  await createTestCustomer({
    resetPasswordOtp: '123456',
    resetPasswordOtpExpires: new Date(Date.now() + 10 * 60 * 1000)
  });

  const res = await request(app)
    .post('/api/auth/verify-otp')
    .send({ email: 'customer@gmail.com', otp: '123456' });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.resetToken, 'Should return a single-use resetToken');

  // Verify OTP was cleared and resetToken was saved with expiration
  const user = await User.findOne({ email: 'customer@gmail.com' }).select('+resetPasswordOtp +resetPasswordToken +resetPasswordTokenExpires');
  assert.equal(user.resetPasswordOtp, null);
  assert.equal(user.resetPasswordToken, res.body.resetToken);
  assert.ok(user.resetPasswordTokenExpires > new Date());
});

// =========================================================================
// 3. PASSWORD RESET AND LOGIN WITH NEW CREDENTIALS
// =========================================================================

test('11. POST /api/auth/reset-password rejects invalid/expired reset token', async () => {
  await createTestCustomer();

  const res = await request(app)
    .post('/api/auth/reset-password')
    .send({
      email: 'customer@gmail.com',
      resetToken: 'invalid_token_here',
      newPassword: 'BrandNewPassword123!'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
});

test('12. POST /api/auth/reset-password rejects short passwords (< 6 chars)', async () => {
  await createTestCustomer({
    resetPasswordToken: 'valid_token',
    resetPasswordTokenExpires: new Date(Date.now() + 10 * 60 * 1000)
  });

  const res = await request(app)
    .post('/api/auth/reset-password')
    .send({
      email: 'customer@gmail.com',
      resetToken: 'valid_token',
      newPassword: '123'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('at least 6 characters'));
});

test('13. POST /api/auth/reset-password updates password, invalidates token, and allows login', async () => {
  await createTestCustomer({
    resetPasswordToken: 'secure_reset_token_xyz',
    resetPasswordTokenExpires: new Date(Date.now() + 10 * 60 * 1000)
  });

  const resetRes = await request(app)
    .post('/api/auth/reset-password')
    .send({
      email: 'customer@gmail.com',
      resetToken: 'secure_reset_token_xyz',
      newPassword: 'NewSecurePassword2026!'
    });

  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.success, true);

  // Verify reset token was cleared
  const user = await User.findOne({ email: 'customer@gmail.com' }).select('+resetPasswordToken');
  assert.equal(user.resetPasswordToken, null);

  // Verify old password fails to log in
  const oldLoginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'customer@gmail.com',
      password: 'OldPassword123!'
    });
  assert.equal(oldLoginRes.status, 401);

  // Verify new password successfully logs in
  const newLoginRes = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'customer@gmail.com',
      password: 'NewSecurePassword2026!'
    });
  assert.equal(newLoginRes.status, 200);
  assert.equal(newLoginRes.body.user.email, 'customer@gmail.com');
  assert.ok(newLoginRes.body.token, 'Should return authentication token');
});
