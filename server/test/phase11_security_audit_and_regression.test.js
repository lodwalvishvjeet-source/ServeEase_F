import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import Review from '../src/models/Review.js';
import AuditLog from '../src/models/AuditLog.js';

let mongoServer;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_serveease_audit';
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
  await Booking.deleteMany({});
  await Notification.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Review.deleteMany({});
  await AuditLog.deleteMany({});
});

// Helper: register customer
const createCustomer = async (customEmail = null) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = customEmail || `audit.cust.${uniq}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Audit Customer',
    email,
    password: 'Password123!',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '9876543210'
  });
  if (res.body?.user) {
    await User.findByIdAndUpdate(res.body.user._id, { emailVerified: true });
    res.body.user.emailVerified = true;
  }
  return { token: res.body.token, user: res.body.user };
};

// Helper: register provider
const createProvider = async (customEmail = null) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = customEmail || `audit.prov.${uniq}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Audit Provider',
    email,
    password: 'Password123!',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '9876543211',
    providerDetails: {
      category: 'Plumbing',
      title: 'Licensed Plumber',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Pipe Repair', 'Drain Cleaning'],
      startingPrice: 350,
      hourlyRate: 150
    }
  });
  await User.findByIdAndUpdate(res.body.user._id, {
    'providerDetails.isVerified': true,
    'providerDetails.verificationStatus': 'approved'
  });
  const updatedUser = await User.findById(res.body.user._id);
  return { token: res.body.token, user: updatedUser };
};

// Helper: provision admin
const createAdmin = async () => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = `audit.admin.${uniq}@serveease.com`;
  const password = 'AdminPassword123!';
  const passwordHash = await User.hashPassword(password);

  const admin = await User.create({
    name: 'Audit Administrator',
    email,
    passwordHash,
    role: 'admin',
    status: 'active'
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    email,
    password
  });

  return { token: loginRes.body.token, user: admin };
};

// ============================================================================
// 1. AUTHENTICATION & LOGIN SECURITY
// ============================================================================
test('Auth Audit: Successful and failed login attempts return uniform errors without enumeration', async () => {
  const { user } = await createCustomer('target.user@example.com');

  // Wrong password
  const failPass = await request(app).post('/api/auth/login').send({
    email: 'target.user@example.com',
    password: 'WrongPassword999'
  });
  assert.equal(failPass.status, 401);
  assert.equal(failPass.body.error, 'Invalid email address or password.');

  // Non-existent user
  const failUser = await request(app).post('/api/auth/login').send({
    email: 'nonexistent.user@example.com',
    password: 'AnyPassword123'
  });
  assert.equal(failUser.status, 401);
  assert.equal(failUser.body.error, 'Invalid email address or password.');

  // Suspended account
  await User.findByIdAndUpdate(user._id, { status: 'suspended' });
  const failSuspended = await request(app).post('/api/auth/login').send({
    email: 'target.user@example.com',
    password: 'Password123!'
  });
  assert.equal(failSuspended.status, 403);
  assert.ok(failSuspended.body.error.includes('account has been suspended'));
});

// ============================================================================
// 2. JWT VERIFICATION & ROLE ENFORCEMENT
// ============================================================================
test('Auth Audit: Malformed JWT tokens and cross-role unauthorized access are rejected', async () => {
  const { token: customerToken } = await createCustomer();
  const { token: providerToken } = await createProvider();
  const { token: adminToken } = await createAdmin();

  // Malformed token
  const badTokenRes = await request(app).get('/api/auth/me')
    .set('Authorization', 'Bearer invalid_signature_token');
  assert.equal(badTokenRes.status, 401);

  // Missing token
  const missingTokenRes = await request(app).get('/api/auth/me');
  assert.equal(missingTokenRes.status, 401);

  // Customer cannot access provider-zone or admin-zone
  const custToProv = await request(app).get('/api/users/provider-zone')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custToProv.status, 403);

  const custToAdmin = await request(app).get('/api/users/admin-zone')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custToAdmin.status, 403);

  // Provider cannot access customer-zone or admin-zone
  const provToCust = await request(app).get('/api/users/customer-zone')
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(provToCust.status, 403);

  const provToAdmin = await request(app).get('/api/users/admin-zone')
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(provToAdmin.status, 403);

  // Admin can access admin-zone
  const adminAccess = await request(app).get('/api/users/admin-zone')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminAccess.status, 200);
});

// ============================================================================
// 3. OBJECTID INPUT VALIDATION (MONGODB QUERY SAFETY)
// ============================================================================
test('API Security: Invalid MongoDB ObjectId parameters return structured HTTP 400 Bad Request', async () => {
  const { token: customerToken } = await createCustomer();

  // Invalid ID on provider discovery
  const provIdRes = await request(app).get('/api/providers/invalid-not-an-objectid');
  assert.equal(provIdRes.status, 400);
  assert.ok(provIdRes.body.error.includes('Invalid provider identifier format'));

  // Invalid ID on user profile
  const userIdRes = await request(app).get('/api/users/invalid-not-an-objectid')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(userIdRes.status, 400);
  assert.ok(userIdRes.body.error.includes('Invalid user identifier format'));

  // Invalid ID on booking details
  const bookIdRes = await request(app).get('/api/bookings/invalid-not-an-objectid')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(bookIdRes.status, 400);
  assert.ok(bookIdRes.body.error.includes('Invalid booking identifier format'));

  // Invalid ID on notification read
  const notifIdRes = await request(app).patch('/api/notifications/invalid-not-an-objectid/read')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(notifIdRes.status, 400);
  assert.ok(notifIdRes.body.error.includes('Invalid notification identifier format'));

  // Invalid ID on review report
  const reportIdRes = await request(app).post('/api/reviews/invalid-not-an-objectid/report')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ reason: 'Spam review' });
  assert.equal(reportIdRes.status, 400);
  assert.ok(reportIdRes.body.error.includes('A valid review identifier is required'));
});

// ============================================================================
// 4. BOOKING OWNERSHIP & IDOR AUTHORIZATION
// ============================================================================
test('Booking Audit: Strict object-level authorization on bookings prevents unauthorized access and manipulation', async () => {
  const { token: customer1Token, user: customer1 } = await createCustomer();
  const { token: customer2Token } = await createCustomer();
  const { token: provider1Token, user: provider1 } = await createProvider();
  const { token: provider2Token } = await createProvider();

  // Customer 1 books Provider 1
  const bookingRes = await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${customer1Token}`)
    .send({
      providerId: provider1._id,
      serviceName: 'Pipe Repair',
      city: 'sangli',
      serviceAddress: '123 Test Street, Vishrambag, Sangli',
      bookingDate: '2026-11-10',
      bookingTime: '10:00 AM'
    });
  assert.equal(bookingRes.status, 201);
  const bookingId = bookingRes.body.booking._id;

  // Customer 2 cannot view Customer 1's booking
  const unauthView = await request(app).get(`/api/bookings/${bookingId}`)
    .set('Authorization', `Bearer ${customer2Token}`);
  assert.equal(unauthView.status, 403);
  assert.ok(unauthView.body.error.includes('not authorized'));

  // Provider 2 cannot accept Customer 1's booking assigned to Provider 1
  const unauthAccept = await request(app).patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provider2Token}`);
  assert.equal(unauthAccept.status, 403);
  assert.ok(unauthAccept.body.error.includes('not the technician assigned'));

  // Provider 2 cannot reject Customer 1's booking assigned to Provider 1
  const unauthReject = await request(app).patch(`/api/bookings/${bookingId}/reject`)
    .set('Authorization', `Bearer ${provider2Token}`);
  assert.equal(unauthReject.status, 403);

  // Provider 1 accepts the booking
  const authAccept = await request(app).patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provider1Token}`);
  assert.equal(authAccept.status, 200);
  assert.equal(authAccept.body.booking.status, 'accepted');

  // Provider 1 completes the booking
  const authComplete = await request(app).patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${provider1Token}`);
  assert.equal(authComplete.status, 200);
  assert.equal(authComplete.body.booking.status, 'completed');

  // Completed booking cannot be cancelled
  const cancelAfterComplete = await request(app).patch(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${customer1Token}`)
    .send({ reason: 'Changed mind' });
  assert.equal(cancelAfterComplete.status, 400);
  assert.ok(cancelAfterComplete.body.error.includes('cannot be cancelled'));
});

// ============================================================================
// 5. NOTIFICATION OWNERSHIP & TAMPERING PREVENTION
// ============================================================================
test('Notification Audit: Users cannot view or mark read another user’s notification', async () => {
  const { token: customer1Token, user: customer1 } = await createCustomer();
  const { token: customer2Token } = await createCustomer();

  // Create notification for Customer 1
  const notif = await Notification.create({
    recipient: customer1._id,
    type: 'system',
    title: 'Security Alert',
    message: 'Your profile was updated.'
  });

  // Customer 2 tries to mark Customer 1's notification as read
  const tamperRes = await request(app).patch(`/api/notifications/${notif._id}/read`)
    .set('Authorization', `Bearer ${customer2Token}`);
  assert.equal(tamperRes.status, 403);
  assert.ok(tamperRes.body.error.includes('not authorized'));

  // Notification is still unread in database
  const checkNotif = await Notification.findById(notif._id);
  assert.equal(checkNotif.isRead, false);

  // Customer 1 marks their own notification as read
  const legitimateRes = await request(app).patch(`/api/notifications/${notif._id}/read`)
    .set('Authorization', `Bearer ${customer1Token}`);
  assert.equal(legitimateRes.status, 200);
  assert.equal(legitimateRes.body.notification.isRead, true);
});

// ============================================================================
// 6. CHAT AUTHORIZATION & MESSAGE LIMITS
// ============================================================================
test('Chat Audit: Third parties cannot read or post in private conversations, and message limits are enforced', async () => {
  const { token: customerToken, user: customer } = await createCustomer();
  const { token: providerToken, user: provider } = await createProvider();
  const { token: eavesdropperToken } = await createCustomer();

  // Create conversation between Customer and Provider
  const convRes = await request(app).post('/api/conversations')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ providerId: provider._id });
  assert.equal(convRes.status, 201);
  const conversationId = convRes.body.conversation._id;

  // Eavesdropper tries to read messages
  const unauthRead = await request(app).get(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${eavesdropperToken}`);
  assert.equal(unauthRead.status, 403);

  // Eavesdropper tries to send a message
  const unauthSend = await request(app).post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${eavesdropperToken}`)
    .send({ text: 'Hello interceptor' });
  assert.equal(unauthSend.status, 403);

  // Authorized participant sending excessively long message (>2000 chars)
  const longText = 'A'.repeat(2005);
  const longRes = await request(app).post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ text: longText });
  assert.equal(longRes.status, 400);
  assert.ok(longRes.body.error.includes('cannot exceed 2000 characters'));

  // Authorized participant sending empty message
  const emptyRes = await request(app).post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ text: '   ' });
  assert.equal(emptyRes.status, 400);
  assert.ok(emptyRes.body.error.includes('cannot be empty'));

  // Legitimate message succeeds
  const legitRes = await request(app).post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ text: 'What is your availability tomorrow morning?' });
  assert.equal(legitRes.status, 201);
  assert.equal(legitRes.body.message.text, 'What is your availability tomorrow morning?');
});

// ============================================================================
// 7. REVIEW SECURITY & STATS INTEGRITY
// ============================================================================
test('Review Audit: Object authorization protects booking review check and hidden reviews are excluded from stats', async () => {
  const { token: customer1Token, user: customer1 } = await createCustomer();
  const { token: customer2Token } = await createCustomer();
  const { token: providerToken, user: provider } = await createProvider();
  const { token: adminToken } = await createAdmin();

  // Completed booking
  const booking = await Booking.create({
    customer: customer1._id,
    provider: provider._id,
    serviceName: 'Pipe Repair',
    city: 'sangli',
    serviceAddress: 'Flat 101, Test Lane, Sangli',
    bookingDate: '2026-10-30',
    bookingTime: '02:00 PM',
    price: 350,
    status: 'completed'
  });

  // Customer 2 cannot check review details for Customer 1's booking
  const unauthReviewCheck = await request(app).get(`/api/reviews/booking/${booking._id}`)
    .set('Authorization', `Bearer ${customer2Token}`);
  assert.equal(unauthReviewCheck.status, 403);
  assert.ok(unauthReviewCheck.body.error.includes('not authorized'));

  // Customer 1 checks review status -> 200
  const authReviewCheck = await request(app).get(`/api/reviews/booking/${booking._id}`)
    .set('Authorization', `Bearer ${customer1Token}`);
  assert.equal(authReviewCheck.status, 200);
  assert.equal(authReviewCheck.body.hasReviewed, false);

  // Submit 5-star review
  const review1Res = await request(app).post('/api/reviews')
    .set('Authorization', `Bearer ${customer1Token}`)
    .send({
      bookingId: booking._id,
      rating: 5,
      comment: 'Superb job done!'
    });
  assert.equal(review1Res.status, 201);

  // Duplicate submission rejected (409 Conflict)
  const dupRes = await request(app).post('/api/reviews')
    .set('Authorization', `Bearer ${customer1Token}`)
    .send({
      bookingId: booking._id,
      rating: 5,
      comment: 'Trying again'
    });
  assert.equal(dupRes.status, 409);

  // Check stats before moderation
  const statsBefore = await request(app).get(`/api/reviews/provider/${provider._id}/stats`);
  assert.equal(statsBefore.status, 200);
  assert.equal(statsBefore.body.totalReviews, 1);
  assert.equal(statsBefore.body.averageRating, 5);

  // Admin moderates and hides the review
  const hideRes = await request(app).patch(`/api/admin/reviews/${review1Res.body.review._id}/moderate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: 'hidden',
      reason: 'Under audit review'
    });
  assert.equal(hideRes.status, 200);

  // Check stats after moderation: hidden review is excluded!
  const statsAfter = await request(app).get(`/api/reviews/provider/${provider._id}/stats`);
  assert.equal(statsAfter.status, 200);
  assert.equal(statsAfter.body.totalReviews, 0);
  assert.equal(statsAfter.body.averageRating, null);
});

// ============================================================================
// 8. PRIVACY & SENSITIVE DATA EXCLUSION
// ============================================================================
test('Privacy Audit: Sensitive credentials, password hashes and raw delivery addresses are never exposed', async () => {
  const { token: adminToken } = await createAdmin();
  const { user: customer } = await createCustomer();
  const { user: provider } = await createProvider();

  // Create booking with sensitive private address
  await Booking.create({
    customer: customer._id,
    provider: provider._id,
    serviceName: 'Drain Cleaning',
    city: 'sangli',
    serviceAddress: 'Apartment 5B, Private Villa, Station Road, Vishrambag, Sangli',
    bookingDate: '2026-11-05',
    bookingTime: '03:00 PM',
    price: 350,
    status: 'pending'
  });

  // Admin oversight must mask private street address
  const adminBookings = await request(app).get('/api/admin/bookings')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(adminBookings.status, 200);
  const bItem = adminBookings.body.bookings[0];

  assert.equal(bItem.serviceAddress, undefined, 'serviceAddress must be removed');
  assert.ok(bItem.serviceAddressMasked, 'serviceAddressMasked must be present');
  assert.ok(!bItem.serviceAddressMasked.includes('Apartment 5B'), 'Private apartment number must not appear');

  // User retrieval must not expose passwordHash
  const userProfile = await request(app).get(`/api/users/${customer._id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(userProfile.status, 200);
  assert.equal(userProfile.body.user.passwordHash, undefined, 'passwordHash must never be exposed');
});
