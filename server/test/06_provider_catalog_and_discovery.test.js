import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, createTestProvider } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. GET /api/providers requires city parameter with HTTP 400', async () => {
  const res = await request(app).get('/api/providers');
  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('city'));
});

test('2. GET /api/providers?city=sangli lists active providers in the specified city', async () => {
  await createTestProvider({ name: 'Sangli Electrician', city: 'sangli' });
  await createTestProvider({ name: 'Pune Plumber', city: 'pune' });

  const res = await request(app).get('/api/providers?city=sangli');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.providers));
  assert.equal(res.body.providers.length, 1);
  assert.equal(res.body.providers[0].name, 'Sangli Electrician');
});

test('3. GET /api/providers?city=sangli&category=electrical-services filters by service category', async () => {
  await createTestProvider({
    name: 'Wiring Pro',
    city: 'sangli',
    providerDetails: {
      category: 'Electrical Services',
      categorySlug: 'electrical-services',
      servicesOffered: ['Electrical Wiring', 'Switchboard Repair']
    }
  });
  await createTestProvider({
    name: 'Plumbing Expert',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      categorySlug: 'plumbing',
      servicesOffered: ['Pipe Leakage Fix', 'Tap Fitting']
    }
  });

  const res = await request(app).get('/api/providers?city=sangli&category=electrical-services');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.providers.length, 1);
  assert.equal(res.body.providers[0].name, 'Wiring Pro');
});

test('4. GET /api/providers/:id returns full provider details for valid ID', async () => {
  const { user } = await createTestProvider({ name: 'Expert Technician' });

  const res = await request(app).get(`/api/providers/${user._id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.provider.name, 'Expert Technician');
  assert.equal(res.body.provider.role, 'provider');
});

test('5. GET /api/providers/:id returns HTTP 404 for non-existent provider ID', async () => {
  const fakeId = '507f1f77bcf86cd799439011';
  const res = await request(app).get(`/api/providers/${fakeId}`);
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});
