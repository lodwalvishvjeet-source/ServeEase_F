import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import PendingRegistration from '../src/models/PendingRegistration.js';
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

test('1. Customer registration creates pending record and dispatches 6-digit OTP email', async () => {
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Rohan Patil',
      email: 'rohan.patil@serveease.test',
      password: 'StrongPassword123!',
      role: 'customer',
      city: 'sangli',
      phoneNumber: '+91 9822100001'
    });

  assert.equal(regRes.status, 200);
  assert.equal(regRes.body.success, true);
  assert.equal(regRes.body.pendingVerification, true);
  assert.ok(regRes.body.message.includes('Verification code sent'));

  // Ensure user is NOT created yet in User collection
  const userInDb = await User.findOne({ email: 'rohan.patil@serveease.test' });
  assert.equal(userInDb, null);

  // Ensure record is saved in PendingRegistration with bcrypt/hashed OTP
  const pendingInDb = await PendingRegistration.findOne({ email: 'rohan.patil@serveease.test' });
  assert.ok(pendingInDb);
  assert.equal(pendingInDb.role, 'customer');
  assert.ok(pendingInDb.otpHash);
  assert.ok(pendingInDb.otpExpires > new Date());

  // Verify email dispatch was intercepted and contains 6-digit OTP
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, 'rohan.patil@serveease.test');
  const otpMatch = sentEmails[0].text.match(/\b\d{6}\b/);
  assert.ok(otpMatch, 'Email body must contain 6-digit verification code');
});

test('2. Registration validates required fields and password rules', async () => {
  const shortPassRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Weak User',
      email: 'weak@serveease.test',
      password: '123',
      role: 'customer',
      city: 'sangli',
      phoneNumber: '+91 9822100001'
    });

  assert.equal(shortPassRes.status, 400);
  assert.equal(shortPassRes.body.success, false);
});

test('3. Registration rejects already-registered active accounts with HTTP 409 Conflict', async () => {
  await createTestCustomer({ email: 'existing@serveease.test' });

  const dupRes = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Duplicate Rohan',
      email: 'existing@serveease.test',
      password: 'StrongPassword123!',
      role: 'customer',
      city: 'sangli',
      phoneNumber: '+91 9822100001'
    });

  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.body.success, false);
  assert.ok(dupRes.body.error.toLowerCase().includes('already exists'));
});

test('4. POST /api/auth/verify-email-otp rejects invalid or wrong OTP code', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Test Verify',
      email: 'verify.fail@serveease.test',
      password: 'StrongPassword123!',
      role: 'customer',
      city: 'sangli',
      phoneNumber: '+91 9822100001'
    });

  const failRes = await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'verify.fail@serveease.test',
      otp: '000000'
    });

  assert.equal(failRes.status, 400);
  assert.equal(failRes.body.success, false);
  assert.ok(failRes.body.error.toLowerCase().includes('invalid'));
});

test('5. POST /api/auth/verify-email-otp materializes User, deletes PendingRegistration, and returns JWT', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Kavita Shinde',
      email: 'kavita@serveease.test',
      password: 'StrongPassword123!',
      role: 'customer',
      city: 'sangli',
      phoneNumber: '+91 9822100005'
    });

  // Extract the sent OTP from email mock
  const lastMail = sentEmails[sentEmails.length - 1];
  const otp = lastMail.text.match(/\b\d{6}\b/)[0];

  const verifyRes = await request(app)
    .post('/api/auth/verify-email-otp')
    .send({
      email: 'kavita@serveease.test',
      otp
    });

  assert.equal(verifyRes.status, 201);
  assert.equal(verifyRes.body.success, true);
  assert.ok(verifyRes.body.token);
  assert.equal(verifyRes.body.user.email, 'kavita@serveease.test');
  assert.equal(verifyRes.body.user.emailVerified, true);

  // Pending record must be removed
  const pendingAfter = await PendingRegistration.findOne({ email: 'kavita@serveease.test' });
  assert.equal(pendingAfter, null);

  // Active user must now exist in DB
  const userInDb = await User.findOne({ email: 'kavita@serveease.test' });
  assert.ok(userInDb);
  assert.equal(userInDb.emailVerified, true);
});

test('6. POST /api/auth/resend-verification-otp enforces cooldown and dispatches fresh OTP', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Resend Test',
      email: 'resend@serveease.test',
      password: 'StrongPassword123!',
      role: 'customer',
      city: 'sangli',
      phoneNumber: '+91 9822100006'
    });

  // Immediate resend should trigger 429 cooldown limit
  const fastResendRes = await request(app)
    .post('/api/auth/resend-verification-otp')
    .send({ email: 'resend@serveease.test' });

  assert.equal(fastResendRes.status, 429);
  assert.ok(fastResendRes.body.error.includes('Please wait'));

  // Simulate cooldown expiry (> 60s)
  await PendingRegistration.updateOne(
    { email: 'resend@serveease.test' },
    { lastResendAt: new Date(Date.now() - 65 * 1000) }
  );

  const resendRes = await request(app)
    .post('/api/auth/resend-verification-otp')
    .send({ email: 'resend@serveease.test' });

  assert.equal(resendRes.status, 200);
  assert.equal(resendRes.body.success, true);
});
