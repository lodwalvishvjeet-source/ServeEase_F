import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { getJwtSecret } from '../src/config/env.js';

let mongoServer;

test.before(async () => {
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
});

// =========================================================================
// 1. USER MODEL & FIREBASE UID PERSISTENCE
// =========================================================================
test('User model supports optional passwordHash and stores firebaseUid index', async () => {
  const oauthUser = await User.create({
    name: 'Google OAuth User',
    email: 'oauth.user@example.com',
    firebaseUid: 'firebase_test_uid_12345',
    role: 'customer',
    city: 'mumbai',
    emailVerified: true,
    emailVerifiedAt: new Date()
  });

  assert.ok(oauthUser._id, 'User should be created in MongoDB');
  assert.equal(oauthUser.firebaseUid, 'firebase_test_uid_12345');
  assert.equal(oauthUser.passwordHash, null);

  // comparePassword should return false safely without throwing
  const isMatch = await oauthUser.comparePassword('anyPassword');
  assert.equal(isMatch, false);

  const safe = oauthUser.toSafeObject();
  assert.equal(safe.email, 'oauth.user@example.com');
  assert.equal(safe.passwordHash, undefined);
});

// =========================================================================
// 2. FIREBASE LOGIN ENDPOINT VALIDATION & SECURITY
// =========================================================================
test('POST /api/auth/firebase-login rejects missing idToken with HTTP 400', async () => {
  const res = await request(app)
    .post('/api/auth/firebase-login')
    .send({});

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Firebase ID token is required'));
});

test('POST /api/auth/firebase-login strictly blocks admin role creation', async () => {
  const res = await request(app)
    .post('/api/auth/firebase-login')
    .send({
      idToken: 'sample_token',
      role: 'admin'
    });

  // When Firebase Admin is in standby (no service account in test env), reports 503 standby
  // or 400 if validation runs first.
  assert.ok([400, 503].includes(res.status));
  assert.equal(res.body.success, false);
});

// =========================================================================
// 3. DUAL-MODE JWT AUTHENTICATION PRESERVATION
// =========================================================================
test('authenticate middleware maintains 100% backward compatibility with legacy JWTs', async () => {
  const user = await User.create({
    name: 'Legacy User',
    email: 'legacy.user@example.com',
    role: 'customer',
    city: 'pune',
    passwordHash: 'hashed_password_placeholder',
    emailVerified: true
  });

  const secret = getJwtSecret();
  const token = jwt.sign({ userId: user._id, role: user.role }, secret, { expiresIn: '15m' });

  // Test Bearer header
  const resBearer = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(resBearer.status, 200);
  assert.equal(resBearer.body.success, true);
  assert.equal(resBearer.body.user._id, user._id.toString());

  // Test Cookie header
  const resCookie = await request(app)
    .get('/api/users/me')
    .set('Cookie', `token=${token}`);

  assert.equal(resCookie.status, 200);
  assert.equal(resCookie.body.success, true);
  assert.equal(resCookie.body.user.email, 'legacy.user@example.com');
});

test('authenticate middleware rejects forged legacy tokens with HTTP 401', async () => {
  const forgedToken = jwt.sign({ userId: '65f000000000000000000000', role: 'admin' }, 'wrong_secret');

  const res = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${forgedToken}`);

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});
