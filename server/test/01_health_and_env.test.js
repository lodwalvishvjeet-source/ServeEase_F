import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. Health check returns 200 with operational services and connected DB', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'healthy');
  assert.equal(res.body.system, 'ServeEase API Server');
  assert.equal(res.body.services.server, 'operational');
  assert.equal(res.body.services.database, 'connected');
});

test('2. Categories catalog returns supported home service categories', async () => {
  const res = await request(app).get('/api/providers/categories');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.categories));
  const categoryIds = res.body.categories.map(c => c.id);
  assert.ok(categoryIds.includes('plumbing'));
  assert.ok(categoryIds.includes('electrical-services'));
});

test('3. Cities catalog returns supported service cities metadata', async () => {
  const res = await request(app).get('/api/providers/cities');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.cities));
  const cityIds = res.body.cities.map(c => c.id);
  assert.ok(cityIds.includes('sangli'));
  assert.ok(cityIds.includes('pune'));
});
