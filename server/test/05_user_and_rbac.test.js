import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, createTestCustomer, createTestProvider, createTestAdmin } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. GET /api/users/profile returns authenticated user profile', async () => {
  const { user, token } = await createTestCustomer({ name: 'Sanjay More' });

  const res = await request(app)
    .get('/api/users/profile')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.name, 'Sanjay More');
  assert.equal(res.body.user.role, 'customer');
});

test('2. PATCH /api/users/profile updates user details securely', async () => {
  const { token } = await createTestCustomer();

  const updateRes = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Sanjay R. More',
      city: 'pune'
    });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.success, true);
  assert.equal(updateRes.body.user.name, 'Sanjay R. More');
  assert.equal(updateRes.body.user.city, 'pune');
});

test('3. RBAC: Customer can access customer-zone, blocked from provider-zone and admin-zone', async () => {
  const { token: customerToken } = await createTestCustomer();

  // Access customer-zone (Should succeed: 200)
  const custRes = await request(app)
    .get('/api/users/customer-zone')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custRes.status, 200);

  // Access provider-zone (Should fail: 403)
  const provRes = await request(app)
    .get('/api/users/provider-zone')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(provRes.status, 403);

  // Access admin-zone (Should fail: 403)
  const adminRes = await request(app)
    .get('/api/users/admin-zone')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(adminRes.status, 403);
});

test('4. RBAC: Provider can access provider-zone, blocked from customer-zone and admin-zone', async () => {
  const { token: providerToken } = await createTestProvider();

  // Access provider-zone (Should succeed: 200)
  const provRes = await request(app)
    .get('/api/users/provider-zone')
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(provRes.status, 200);

  // Access customer-zone (Should fail: 403)
  const custRes = await request(app)
    .get('/api/users/customer-zone')
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(custRes.status, 403);

  // Access admin-zone (Should fail: 403)
  const adminRes = await request(app)
    .get('/api/users/admin-zone')
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(adminRes.status, 403);
});

test('5. RBAC: Admin can access admin-zone', async () => {
  const { token: adminToken } = await createTestAdmin();

  const adminRes = await request(app)
    .get('/api/users/admin-zone')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminRes.status, 200);
});

test('6. Unauthenticated requests to protected endpoints return HTTP 401', async () => {
  const res = await request(app).get('/api/users/profile');
  assert.equal(res.status, 401);
});
