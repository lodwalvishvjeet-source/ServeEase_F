import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import Notification from '../src/models/Notification.js';
import { setupTestEnvironment, teardownTestEnvironment, clearAllData, createTestCustomer } from './helpers/testUtils.js';

test.before(async () => {
  await setupTestEnvironment();
});

test.after(async () => {
  await teardownTestEnvironment();
});

test.beforeEach(async () => {
  await clearAllData();
});

test('1. GET /api/notifications returns user notification feed and unread count', async () => {
  const { user, token } = await createTestCustomer();

  // Seed two notifications
  await Notification.create([
    { recipient: user._id, type: 'booking_accepted', title: 'Booking Confirmed', message: 'Provider accepted your request' },
    { recipient: user._id, type: 'booking_completed', title: 'Service Completed', message: 'Please leave a review', isRead: true }
  ]);

  const res = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 2);
  assert.equal(res.body.unreadCount, 1);
});

test('2. GET /api/notifications/unread-count returns fast numeric count', async () => {
  const { user, token } = await createTestCustomer();

  await Notification.create({
    recipient: user._id,
    type: 'new_message',
    title: 'New Message',
    message: 'Hello'
  });

  const res = await request(app)
    .get('/api/notifications/unread-count')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.unreadCount, 1);
});

test('3. PATCH /api/notifications/:id/read marks single notification read', async () => {
  const { user, token } = await createTestCustomer();

  const notif = await Notification.create({
    recipient: user._id,
    type: 'booking_accepted',
    title: 'Booking Confirmed',
    message: 'Technician is on the way'
  });

  const res = await request(app)
    .patch(`/api/notifications/${notif._id}/read`)
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.notification.isRead, true);
});

test('4. PATCH /api/notifications/read-all marks all notifications read', async () => {
  const { user, token } = await createTestCustomer();

  await Notification.create([
    { recipient: user._id, type: 'booking_accepted', title: 'Accepted 1', message: '...' },
    { recipient: user._id, type: 'booking_accepted', title: 'Accepted 2', message: '...' }
  ]);

  const res = await request(app)
    .patch('/api/notifications/read-all')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const unreadCount = await Notification.countDocuments({ recipient: user._id, isRead: false });
  assert.equal(unreadCount, 0);
});
