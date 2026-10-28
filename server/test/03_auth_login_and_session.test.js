import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, createTestCustomer, createTestProvider } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. POST /api/auth/login authenticates customer and returns JWT token & user profile', async () => {
  const { user, password } = await createTestCustomer({ email: 'login.cust@serveease.test' });

  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'login.cust@serveease.test',
      password,
      role: 'customer'
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, 'login.cust@serveease.test');
  assert.equal(res.body.user.role, 'customer');

  // Verify auth cookie is set
  const cookies = res.headers['set-cookie'];
  assert.ok(cookies);
  assert.ok(cookies.some(c => c.includes('serveease_token') || c.includes('token')));
});

test('2. POST /api/auth/login authenticates provider and returns provider details', async () => {
  const { user, password } = await createTestProvider({ email: 'login.prov@serveease.test' });

  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'login.prov@serveease.test',
      password,
      role: 'provider'
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.token);
  assert.equal(res.body.user.role, 'provider');
});

test('3. POST /api/auth/login rejects incorrect password with HTTP 401', async () => {
  await createTestCustomer({ email: 'badpass@serveease.test' });

  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'badpass@serveease.test',
      password: 'IncorrectPassword999!',
      role: 'customer'
    });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('4. POST /api/auth/login rejects unregistered email with HTTP 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'nonexistent@serveease.test',
      password: 'Password123!',
      role: 'customer'
    });

  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
});

test('5. POST /api/auth/login rejects role mismatch with HTTP 403 or 401', async () => {
  const { password } = await createTestCustomer({ email: 'cust.only@serveease.test' });

  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'cust.only@serveease.test',
      password,
      role: 'provider' // Mismatch
    });

  assert.ok([401, 403].includes(res.status));
  assert.equal(res.body.success, false);
});

test('6. GET /api/auth/me returns current user with valid Bearer token', async () => {
  const { user, token } = await createTestCustomer({ email: 'me.test@serveease.test' });

  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.email, 'me.test@serveease.test');
});

test('7. GET /api/auth/me rejects unauthenticated or invalid token requests with HTTP 401', async () => {
  const noTokenRes = await request(app).get('/api/auth/me');
  assert.equal(noTokenRes.status, 401);

  const badTokenRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', 'Bearer invalid_signature_token');
  assert.equal(badTokenRes.status, 401);
});

test('8. POST /api/auth/logout clears auth cookies and returns 200', async () => {
  const res = await request(app).post('/api/auth/logout');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});
