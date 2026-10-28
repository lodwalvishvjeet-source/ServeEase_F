import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import VerificationDocument from '../src/models/VerificationDocument.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, createTestCustomer, createTestProvider, createTestAdmin, createTestBooking } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. Admin can fetch platform stats via GET /api/admin/stats', async () => {
  const { token: adminToken } = await createTestAdmin();
  await createTestCustomer();
  await createTestProvider();

  const res = await request(app)
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.stats);
  assert.ok(res.body.stats.users.totalUsers >= 3);
});

test('2. Admin can list all users via GET /api/admin/users', async () => {
  const { token: adminToken } = await createTestAdmin();
  await createTestCustomer({ name: 'Alpha Customer' });

  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.users));
  assert.ok(res.body.users.length >= 2);
});

test('3. Admin can update user status via PATCH /api/admin/users/:id/status', async () => {
  const { token: adminToken } = await createTestAdmin();
  const { user: customer } = await createTestCustomer();

  const res = await request(app)
    .patch(`/api/admin/users/${customer._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: 'suspended',
      reason: 'Terms of service violation'
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.status, 'suspended');

  const inDb = await User.findById(customer._id);
  assert.equal(inDb.status, 'suspended');
});

test('4. Admin can verify provider via PATCH /api/admin/providers/:id/verify', async () => {
  const { token: adminToken } = await createTestAdmin();
  const { user: provider } = await createTestProvider({
    verificationStatus: 'pending',
    providerDetails: { isVerified: false, verificationStatus: 'pending' }
  });

  // Seed a verification document (required by security rule before approval)
  await VerificationDocument.create({
    provider: provider._id,
    documentType: 'trade_license',
    originalFilename: 'trade_license.pdf',
    fileName: `trade_${Date.now()}.pdf`,
    mimeType: 'application/pdf',
    fileSize: 12000,
    gridFsFileId: new VerificationDocument()._id,
    status: 'pending'
  });

  const res = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      isVerified: true,
      notes: 'Credentials and trade license confirmed'
    });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.provider.providerDetails.isVerified, true);
  assert.equal(res.body.provider.providerDetails.verificationStatus, 'approved');
});

test('5. Admin can inspect platform bookings via GET /api/admin/bookings', async () => {
  const { token: adminToken } = await createTestAdmin();
  const { user: customer } = await createTestCustomer();
  const { user: provider } = await createTestProvider();
  await createTestBooking({ customer, provider });

  const res = await request(app)
    .get('/api/admin/bookings')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.bookings));
  assert.equal(res.body.bookings.length, 1);
});

test('6. Non-admin customer or provider is blocked from admin endpoints (HTTP 403)', async () => {
  const { token: customerToken } = await createTestCustomer();

  const res = await request(app)
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});
