import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, createTestCustomer, createTestProvider, createTestBooking } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. Create or retrieve conversation for an accepted booking', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'accepted' } });

  const res = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id });

  assert.ok([200, 201].includes(res.status));
  assert.equal(res.body.success, true);
  assert.ok(res.body.conversation._id);
});

test('2. Send and retrieve real-time conversation messages', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'accepted' } });

  // 1. Create conversation
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id });

  const convId = convRes.body.conversation._id;

  // 2. Customer sends a message
  const msgRes = await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ text: 'Hello, please arrive by 10 AM at the gate.' });

  assert.equal(msgRes.status, 201);
  assert.equal(msgRes.body.success, true);
  assert.equal(msgRes.body.message.text, 'Hello, please arrive by 10 AM at the gate.');

  // 3. Provider fetches messages
  const getRes = await request(app)
    .get(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.success, true);
  assert.equal(getRes.body.messages.length, 1);
  assert.equal(getRes.body.messages[0].text, 'Hello, please arrive by 10 AM at the gate.');
});

test('3. Mark messages as read and verify unread count', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider, token: providerToken } = await createTestProvider();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'accepted' } });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id });

  const convId = convRes.body.conversation._id;

  // Customer sends message
  await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ text: 'Are you on the way?' });

  // Provider marks messages as read
  const readRes = await request(app)
    .patch(`/api/conversations/${convId}/read`)
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.success, true);

  // Provider unread count should now be 0
  const unreadRes = await request(app)
    .get('/api/conversations/unread-count')
    .set('Authorization', `Bearer ${providerToken}`);

  assert.equal(unreadRes.status, 200);
  assert.equal(unreadRes.body.unreadCount, 0);
});

test('4. Third-party unassigned user cannot access conversation messages (HTTP 403)', async () => {
  const { user: customer, token: customerToken } = await createTestCustomer();
  const { user: provider } = await createTestProvider();
  const { token: strangerToken } = await createTestCustomer();

  const booking = await createTestBooking({ customer, provider, overrides: { status: 'accepted' } });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id });

  const convId = convRes.body.conversation._id;

  const res = await request(app)
    .get(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${strangerToken}`);

  assert.equal(res.status, 403);
});
