import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import VerificationDocument from '../src/models/VerificationDocument.js';
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

test('1. GET /api/providers/my-services returns authenticated provider service catalog', async () => {
  const { token } = await createTestProvider({
    providerDetails: {
      servicesOffered: ['Geyser Repair', 'Wiring Installation']
    }
  });

  const res = await request(app)
    .get('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.services));
  assert.ok(res.body.services.includes('Geyser Repair'));
  assert.ok(res.body.services.includes('Wiring Installation'));
});

test('2. POST /api/providers/my-services adds a new service offering', async () => {
  const { token } = await createTestProvider({
    providerDetails: { servicesOffered: ['Initial Service'] }
  });

  const addRes = await request(app)
    .post('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`)
    .send({ service: 'Emergency Short Circuit Fix' });

  assert.equal(addRes.status, 201);
  assert.equal(addRes.body.success, true);
  assert.ok(addRes.body.services.includes('Emergency Short Circuit Fix'));
});

test('3. DELETE /api/providers/my-services/:serviceName removes a service offering', async () => {
  const { token } = await createTestProvider({
    providerDetails: { servicesOffered: ['Keep Service', 'Delete Me'] }
  });

  const delRes = await request(app)
    .delete('/api/providers/my-services/Delete%20Me')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(delRes.status, 200);
  assert.equal(delRes.body.success, true);
  assert.ok(!delRes.body.services.includes('Delete Me'));
  assert.ok(delRes.body.services.includes('Keep Service'));
});

test('4. GET /api/providers/documents returns uploaded documents for provider', async () => {
  const { user, token } = await createTestProvider();

  // Seed a document record
  await VerificationDocument.create({
    provider: user._id,
    documentType: 'id_proof',
    originalFilename: 'aadhaar_card.pdf',
    fileName: `aadhaar_${Date.now()}.pdf`,
    mimeType: 'application/pdf',
    fileSize: 10240,
    gridFsFileId: new VerificationDocument()._id,
    status: 'pending'
  });

  const res = await request(app)
    .get('/api/providers/documents')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.documents[0].documentType, 'id_proof');
});

test('5. Customer is blocked from provider services endpoints with HTTP 403', async () => {
  const { token: customerToken } = await createTestCustomer();

  const res = await request(app)
    .get('/api/providers/my-services')
    .set('Authorization', `Bearer ${customerToken}`);

  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});
