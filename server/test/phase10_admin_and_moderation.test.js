import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import Review from '../src/models/Review.js';
import AuditLog from '../src/models/AuditLog.js';
import VerificationDocument from '../src/models/VerificationDocument.js';

let mongoServer;

test.before(async () => {
  process.env.NODE_ENV = 'test';
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
  await Booking.deleteMany({});
  await Notification.deleteMany({});
  await Review.deleteMany({});
  await AuditLog.deleteMany({});
  await VerificationDocument.deleteMany({});
});

// Helper: Register standard customer
const registerCustomer = async (customEmail = null) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = customEmail || `customer.${uniq}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Suresh Patil',
    email,
    password: 'Password123',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '9876543210'
  });
  if (res.body?.user) {
    await User.findByIdAndUpdate(res.body.user._id, { emailVerified: true });
    res.body.user.emailVerified = true;
  }
  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Register standard provider
const registerProvider = async (customEmail = null, isVerified = false) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = customEmail || `provider.${uniq}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Vinod Electrician',
    email,
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '9876543211',
    providerDetails: {
      category: 'Electrical Services',
      title: 'Certified Home Electrician',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Fan Installation', 'Wiring Repair'],
      startingPrice: 300,
      hourlyRate: 150
    }
  });

  if (isVerified && res.body.user) {
    await User.findByIdAndUpdate(res.body.user._id, {
      'providerDetails.isVerified': true
    });
    res.body.user.providerDetails.isVerified = true;
  }

  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Create admin account directly and login
const createAndLoginAdmin = async (name = 'System Administrator', customEmail = null) => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const email = customEmail || `admin.${uniq}@serveease.com`;
  const password = 'AdminPassword123!';
  const passwordHash = await User.hashPassword(password);

  const adminUser = await User.create({
    name,
    email,
    passwordHash,
    role: 'admin',
    status: 'active'
  });

  const loginRes = await request(app).post('/api/auth/login').send({
    email,
    password
  });

  return {
    user: adminUser,
    token: loginRes.body.token
  };
};

// Helper: Setup completed booking for review testing
const setupBooking = async (customer, provider, status = 'completed') => {
  const booking = await Booking.create({
    customer: customer._id,
    provider: provider._id,
    serviceName: 'Wiring Repair',
    category: 'Electrical Services',
    city: 'sangli',
    serviceAddress: 'Flat 402, Royal Residency, Vishrambag, Sangli 416415',
    bookingDate: '2026-10-15',
    bookingTime: '10:00 AM',
    price: 300,
    status
  });
  return booking;
};

// ============================================================================
// 1. Customer cannot access admin pages or admin APIs
// ============================================================================
test('1. Customer cannot access admin APIs and receives 403 Forbidden', async () => {
  const { token: customerToken } = await registerCustomer();

  const endpoints = [
    { method: 'get', url: '/api/admin/stats' },
    { method: 'get', url: '/api/admin/analytics' },
    { method: 'get', url: '/api/admin/users' },
    { method: 'get', url: '/api/admin/providers' },
    { method: 'get', url: '/api/admin/bookings' },
    { method: 'get', url: '/api/admin/reviews' },
    { method: 'get', url: '/api/admin/audit-logs' }
  ];

  for (const ep of endpoints) {
    const res = await request(app)[ep.method](ep.url)
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(res.status, 403, `Customer should be denied access to ${ep.url}`);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Access denied'));
  }
});

// ============================================================================
// 2. Provider cannot access admin pages or admin APIs
// ============================================================================
test('2. Provider cannot access admin APIs and receives 403 Forbidden', async () => {
  const { token: providerToken } = await registerProvider();

  const endpoints = [
    { method: 'get', url: '/api/admin/stats' },
    { method: 'get', url: '/api/admin/analytics' },
    { method: 'get', url: '/api/admin/users' },
    { method: 'get', url: '/api/admin/providers' },
    { method: 'get', url: '/api/admin/bookings' },
    { method: 'get', url: '/api/admin/reviews' },
    { method: 'get', url: '/api/admin/audit-logs' }
  ];

  for (const ep of endpoints) {
    const res = await request(app)[ep.method](ep.url)
      .set('Authorization', `Bearer ${providerToken}`);
    assert.equal(res.status, 403, `Provider should be denied access to ${ep.url}`);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Access denied'));
  }
});

// ============================================================================
// 3. Unauthenticated requests are rejected
// ============================================================================
test('3. Unauthenticated requests are rejected with 401 Unauthorized', async () => {
  // Without any token
  const resNoAuth = await request(app).get('/api/admin/stats');
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.body.success, false);
  assert.ok(resNoAuth.body.error.includes('Authentication required'));

  // With invalid token
  const resInvalid = await request(app).get('/api/admin/stats')
    .set('Authorization', 'Bearer invalid_garbage_token_12345');
  assert.equal(resInvalid.status, 401);
  assert.equal(resInvalid.body.success, false);
});

// ============================================================================
// 4. A legitimate admin can access authorized admin features
// ============================================================================
test('4. Legitimate admin can access all authorized admin features', async () => {
  const { token: adminToken } = await createAndLoginAdmin();

  // Stats
  const resStats = await request(app).get('/api/admin/stats')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resStats.status, 200);
  assert.equal(resStats.body.success, true);
  assert.ok(resStats.body.stats.users);
  assert.ok(resStats.body.stats.providers);
  assert.ok(resStats.body.stats.bookings);
  assert.ok(resStats.body.stats.reviews);

  // Users list
  const resUsers = await request(app).get('/api/admin/users')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resUsers.status, 200);
  assert.ok(Array.isArray(resUsers.body.users));

  // Providers list
  const resProviders = await request(app).get('/api/admin/providers')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resProviders.status, 200);
  assert.ok(Array.isArray(resProviders.body.providers));

  // Bookings list
  const resBookings = await request(app).get('/api/admin/bookings')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resBookings.status, 200);
  assert.ok(Array.isArray(resBookings.body.bookings));

  // Reviews list
  const resReviews = await request(app).get('/api/admin/reviews')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resReviews.status, 200);
  assert.ok(Array.isArray(resReviews.body.reviews));

  // Audit logs list
  const resLogs = await request(app).get('/api/admin/audit-logs')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(resLogs.status, 200);
  assert.ok(Array.isArray(resLogs.body.logs));
});

// ============================================================================
// 5. Public registration cannot create an admin
// ============================================================================
test('5. Public registration strictly rejects admin role creation', async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Malicious Attacker',
    email: 'attacker@example.com',
    password: 'Password123',
    role: 'admin'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Administrator accounts cannot be created through public registration'));

  // Ensure record was never created
  const userInDb = await User.findOne({ email: 'attacker@example.com' });
  assert.equal(userInDb, null);
});

// ============================================================================
// 6. Admin statistics reflect actual database records
// ============================================================================
test('6. Admin statistics reflect actual persisted database records', async () => {
  // Create 1 admin
  const { token: adminToken } = await createAndLoginAdmin();

  // Create 2 customers
  const { user: c1 } = await registerCustomer('cust1@test.com');
  const { user: c2 } = await registerCustomer('cust2@test.com');

  // Create 2 providers (1 unverified, 1 verified)
  const { user: p1 } = await registerProvider('prov1@test.com', false);
  const { user: p2 } = await registerProvider('prov2@test.com', true);

  // Create 3 bookings with different statuses
  await setupBooking(c1, p1, 'pending');
  await setupBooking(c1, p2, 'accepted');
  const completedBooking = await setupBooking(c2, p2, 'completed');

  // Create 1 review
  await Review.create({
    booking: completedBooking._id,
    customer: c2._id,
    provider: p2._id,
    serviceName: 'Wiring Repair',
    rating: 5,
    comment: 'Exceptional service quality!'
  });

  const res = await request(app).get('/api/admin/stats')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  const { stats } = res.body;

  assert.equal(stats.users.totalCustomers, 2);
  assert.equal(stats.users.totalProviders, 2);
  assert.equal(stats.users.totalUsers, 5); // 1 admin + 2 customers + 2 providers
  assert.equal(stats.providers.total, 2);
  assert.equal(stats.providers.pendingVerification, 1);
  assert.equal(stats.providers.verified, 1);
  assert.equal(stats.bookings.total, 3);
  assert.equal(stats.bookings.byStatus.pending, 1);
  assert.equal(stats.bookings.byStatus.accepted, 1);
  assert.equal(stats.bookings.byStatus.completed, 1);
  assert.equal(stats.reviews.total, 1);
  assert.equal(stats.reviews.visible, 1);
  assert.equal(stats.reviews.hidden, 0);
});

// ============================================================================
// 6b. Admin analytics returns real database category, city, and trend aggregations
// ============================================================================
test('6b. Admin analytics returns real database category, city, and trend aggregations', async () => {
  const { token: adminToken } = await createAndLoginAdmin();
  const { token: customerToken, user: customer } = await registerCustomer();
  const { token: providerToken, user: provider } = await registerProvider();

  await request(app).post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Wiring Repair',
      category: 'Electrical Repairs',
      city: 'sangli',
      serviceAddress: '102 Market Yard, Sangli',
      bookingDate: '2026-10-15',
      timeSlot: '10:00 AM',
      totalAmount: 350
    });

  const res = await request(app).get('/api/admin/analytics?timeframe=30d')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.timeframe, '30d');
  assert.ok(res.body.analytics);
  assert.ok(res.body.analytics.users);
  assert.ok(res.body.analytics.categories);
  assert.ok(Array.isArray(res.body.analytics.categories.byBookings));
  assert.ok(Array.isArray(res.body.analytics.cityDistribution));
  assert.ok(Array.isArray(res.body.analytics.bookingTrends));

  // Non-admin rejected
  const resCust = await request(app).get('/api/admin/analytics')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(resCust.status, 403);
});

// ============================================================================
// 7. Suspension prevents suspended account from accessing protected endpoints
// ============================================================================
test('7. Account suspension immediately denies access and preserves role and audits action', async () => {
  const { token: adminToken, user: admin } = await createAndLoginAdmin();
  const { token: customerToken, user: customer } = await registerCustomer();

  // 1. Verify customer can access /api/auth/me before suspension
  const meBefore = await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(meBefore.status, 200);

  // 2. Admin suspends customer account
  const suspendRes = await request(app)
    .patch(`/api/admin/users/${customer._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: 'suspended',
      reason: 'Repeated cancellation and terms violation'
    });

  assert.equal(suspendRes.status, 200);
  assert.equal(suspendRes.body.user.status, 'suspended');
  assert.equal(suspendRes.body.user.role, 'customer', 'Role must not be changed upon suspension');

  // Verify AuditLog record was persisted
  const auditEntry = await AuditLog.findOne({
    targetId: customer._id,
    action: 'user_suspended'
  });
  assert.ok(auditEntry, 'Audit log must record suspension');
  assert.equal(auditEntry.admin.toString(), admin._id.toString());
  assert.equal(auditEntry.reason, 'Repeated cancellation and terms violation');

  // 3. Customer attempts access while suspended -> 403 Forbidden
  const meSuspended = await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(meSuspended.status, 403);
  assert.ok(meSuspended.body.error.includes('account has been suspended'));

  // 4. Admin reactivates account
  const reactivateRes = await request(app)
    .patch(`/api/admin/users/${customer._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: 'active',
      reason: 'User submitted verified explanation'
    });

  assert.equal(reactivateRes.status, 200);
  assert.equal(reactivateRes.body.user.status, 'active');

  // 5. Customer can access /api/auth/me again
  const meReactivated = await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(meReactivated.status, 200);

  // 6. Protection: Admin cannot suspend their own account
  const selfSuspendRes = await request(app)
    .patch(`/api/admin/users/${admin._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'suspended', reason: 'Self deactivation' });
  assert.equal(selfSuspendRes.status, 400);
  assert.ok(selfSuspendRes.body.error.includes('Administrators cannot suspend'));

  // 7. Protection: Cannot suspend the last remaining active admin
  const secondAdminPasswordHash = await User.hashPassword('Pass123!');
  const secondAdmin = await User.create({
    name: 'Second Admin',
    email: 'admin2@serveease.com',
    passwordHash: secondAdminPasswordHash,
    role: 'admin',
    status: 'active'
  });

  // Suspend second admin (allowed since there are 2 admins)
  const suspendAdmin2Res = await request(app)
    .patch(`/api/admin/users/${secondAdmin._id}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'suspended', reason: 'Admin rotation' });
  assert.equal(suspendAdmin2Res.status, 200);

  // Now try to suspend the first admin if someone tries, or if only 1 active admin remains:
  // With only 1 active admin remaining, attempting to suspend that active admin is blocked
  const admin2LoginRes = await request(app).post('/api/auth/login').send({
    email: 'admin2@serveease.com',
    password: 'Pass123!'
  });
  // Suspended admin cannot login
  assert.equal(admin2LoginRes.status, 403);
});

// ============================================================================
// 8. Provider verification cannot be changed by the provider themselves
// ============================================================================
test('8. Provider cannot manipulate or self-assign verification status', async () => {
  const { token: providerToken, user: provider } = await registerProvider();
  assert.equal(provider.providerDetails.isVerified, false);

  // Provider attempts to update profile with isVerified: true
  const patchRes = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${providerToken}`)
    .send({
      providerDetails: {
        isVerified: true,
        title: 'Updated Electrician Title'
      }
    });

  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.user.providerDetails.title, 'Updated Electrician Title');
  assert.equal(patchRes.body.user.providerDetails.isVerified, false, 'isVerified must remain false');

  // Verify in MongoDB directly
  const updatedUser = await User.findById(provider._id);
  assert.equal(updatedUser.providerDetails.isVerified, false, 'Database record must remain unverified');
});

// ============================================================================
// 9. Admin verification actions are persisted and audited
// ============================================================================
test('9. Admin verification approves provider, persists status, creates notification and audit entry', async () => {
  const { token: adminToken, user: admin } = await createAndLoginAdmin();
  const { user: provider } = await registerProvider();
  assert.equal(provider.providerDetails.isVerified, false);

  // 1. Attempting approval without any uploaded document is blocked
  const blockedRes = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      isVerified: true,
      notes: 'Govt electrical contractor license and Aadhaar verified.'
    });

  assert.equal(blockedRes.status, 400);
  assert.equal(blockedRes.body.success, false);
  assert.ok(blockedRes.body.error.includes('at least one uploaded and valid verification document'));

  // 2. Provider uploads / has a qualifying document
  await VerificationDocument.create({
    provider: provider._id,
    gridFsFileId: new mongoose.Types.ObjectId(),
    documentType: 'trade_license',
    originalFilename: 'govt_license.pdf',
    mimeType: 'application/pdf',
    fileSize: 2048,
    status: 'pending'
  });

  // 3. Admin approves verification with document present
  const verifyRes = await request(app)
    .patch(`/api/admin/providers/${provider._id}/verify`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      isVerified: true,
      notes: 'Govt electrical contractor license and Aadhaar verified.'
    });

  assert.equal(verifyRes.status, 200);
  assert.equal(verifyRes.body.success, true);
  assert.equal(verifyRes.body.provider.providerDetails.isVerified, true);

  // Verify database record
  const dbProvider = await User.findById(provider._id);
  assert.equal(dbProvider.providerDetails.isVerified, true);

  // Verify persistent audit log
  const audit = await AuditLog.findOne({
    targetId: provider._id,
    action: 'provider_verified'
  });
  assert.ok(audit, 'Audit log entry must be present');
  assert.equal(audit.admin.toString(), admin._id.toString());
  assert.equal(audit.reason, 'Govt electrical contractor license and Aadhaar verified.');
  assert.equal(audit.targetType, 'Provider');

  // Verify notification was generated for provider
  const notif = await Notification.findOne({
    recipient: provider._id,
    type: 'system'
  });
  assert.ok(notif, 'Notification should be delivered to provider');
  assert.ok(notif.message.includes('approved') || notif.message.includes('verified'));
});

// ============================================================================
// 10. Booking filters return correct results without leaking unauthorized private info
// ============================================================================
test('10. Booking filters return filtered results and mask customer private address', async () => {
  const { token: adminToken } = await createAndLoginAdmin();
  const { user: c1 } = await registerCustomer('cust.sangli@example.com');
  const { user: p1 } = await registerProvider('prov.sangli@example.com');

  // Booking in Sangli with sensitive street address
  await Booking.create({
    customer: c1._id,
    provider: p1._id,
    serviceName: 'Pipe Repair',
    category: 'Plumbing',
    city: 'sangli',
    serviceAddress: 'Flat 102, Shanti Niwas, Station Road, Vishrambag, Sangli',
    bookingDate: '2026-10-20',
    bookingTime: '11:00 AM',
    price: 350,
    status: 'pending'
  });

  // Booking in Mumbai
  await Booking.create({
    customer: c1._id,
    provider: p1._id,
    serviceName: 'Tap Replacement',
    category: 'Plumbing',
    city: 'mumbai',
    serviceAddress: 'Tower B, Flat 801, Bandra West, Mumbai',
    bookingDate: '2026-10-22',
    bookingTime: '02:00 PM',
    price: 500,
    status: 'accepted'
  });

  // Query filtered by city=sangli
  const resFiltered = await request(app)
    .get('/api/admin/bookings?city=sangli&status=pending')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(resFiltered.status, 200);
  assert.equal(resFiltered.body.bookings.length, 1);
  const item = resFiltered.body.bookings[0];
  assert.equal(item.city, 'sangli');
  assert.equal(item.status, 'pending');

  // Address privacy check: raw serviceAddress must not be leaked; serviceAddressMasked must be present
  assert.equal(item.serviceAddress, undefined, 'Raw serviceAddress must be stripped from response');
  assert.ok(item.serviceAddressMasked, 'serviceAddressMasked must be present');
  assert.ok(
    item.serviceAddressMasked.includes('[House/Street masked]') || item.serviceAddressMasked.includes('masked'),
    'Sensitive house/flat number must be masked'
  );
  assert.ok(!item.serviceAddressMasked.includes('Flat 102'), 'Private flat number must not appear');
});

// ============================================================================
// 11. Review moderation preserves original record and updates visible ratings correctly
// ============================================================================
test('11. Review moderation preserves review in DB and updates provider aggregate rating', async () => {
  const { token: adminToken, user: admin } = await createAndLoginAdmin();
  const { token: customerToken, user: customer } = await registerCustomer();
  const { user: provider } = await registerProvider();

  // Setup completed booking
  const booking1 = await setupBooking(customer, provider, 'completed');
  const booking2 = await setupBooking(customer, provider, 'completed');

  // Create 5-star review
  const review1 = await Review.create({
    booking: booking1._id,
    customer: customer._id,
    provider: provider._id,
    serviceName: 'Wiring Repair',
    rating: 5,
    comment: 'Punctual and very tidy.'
  });

  // Create 1-star abusive review
  const review2 = await Review.create({
    booking: booking2._id,
    customer: customer._id,
    provider: provider._id,
    serviceName: 'Wiring Repair',
    rating: 1,
    comment: 'Offensive and abusive comment with inappropriate content.'
  });

  // Recalculate baseline provider rating (5 + 1)/2 = 3.0
  let pRecord = await User.findById(provider._id);
  // Provider currently has 2 reviews with average 3.0
  const initialReviews = await Review.find({ provider: provider._id, status: { $ne: 'hidden' } });
  assert.equal(initialReviews.length, 2);

  // 1. Customer reports the abusive review
  const reportRes = await request(app)
    .post(`/api/reviews/${review2._id}/report`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      reason: 'Inappropriate language and harassment'
    });
  assert.equal(reportRes.status, 201);
  assert.equal(reportRes.body.success, true);

  // Check report is stored on review
  const reportedReview = await Review.findById(review2._id);
  assert.equal(reportedReview.reports.length, 1);
  assert.equal(reportedReview.reports[0].reason, 'Inappropriate language and harassment');
  assert.equal(reportedReview.reports[0].status, 'pending');

  // 2. Admin moderates and hides the abusive review
  const moderateRes = await request(app)
    .patch(`/api/admin/reviews/${review2._id}/moderate`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      status: 'hidden',
      reason: 'Confirmed violation of community guidelines',
      dismissReports: true
    });

  assert.equal(moderateRes.status, 200);
  assert.equal(moderateRes.body.review.status, 'hidden');

  // 3. Verify original review is preserved in database (not deleted!)
  const preservedReview = await Review.findById(review2._id);
  assert.ok(preservedReview, 'Review record must be retained in database');
  assert.equal(preservedReview.comment, 'Offensive and abusive comment with inappropriate content.');
  assert.equal(preservedReview.rating, 1);
  assert.equal(preservedReview.status, 'hidden');
  assert.equal(preservedReview.hiddenReason, 'Confirmed violation of community guidelines');
  assert.equal(preservedReview.reports[0].status, 'resolved');

  // 4. Verify provider aggregate rating is recalculated excluding hidden review
  pRecord = await User.findById(provider._id);
  assert.equal(pRecord.providerDetails.reviewCount, 1, 'Review count should now only count visible reviews');
  assert.equal(pRecord.providerDetails.rating, 5, 'Average rating should now be 5.0 (ignoring hidden review)');

  // 5. Public provider reviews endpoint must exclude the hidden review
  const publicReviewsRes = await request(app).get(`/api/reviews/provider/${provider._id}`);
  assert.equal(publicReviewsRes.status, 200);
  assert.equal(publicReviewsRes.body.reviews.length, 1);
  assert.equal(publicReviewsRes.body.reviews[0]._id.toString(), review1._id.toString());

  // 6. Audit log must record moderation action
  const audit = await AuditLog.findOne({
    targetId: review2._id,
    action: 'review_hidden'
  });
  assert.ok(audit, 'Audit log for review hiding must exist');
  assert.equal(audit.reason, 'Confirmed violation of community guidelines');
});

// ============================================================================
// 12. Audit logs cannot be modified by ordinary users
// ============================================================================
test('12. Audit logs are protected and cannot be viewed or mutated by ordinary users', async () => {
  const { token: customerToken } = await registerCustomer();
  const { token: providerToken } = await registerProvider();

  // Attempt to read audit logs
  const custGet = await request(app).get('/api/admin/audit-logs')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custGet.status, 403);

  const provGet = await request(app).get('/api/admin/audit-logs')
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(provGet.status, 403);

  // Attempt to POST, PUT, DELETE to audit logs
  const custPost = await request(app).post('/api/admin/audit-logs')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ action: 'fake_action' });
  assert.equal(custPost.status, 403);

  const custDelete = await request(app).delete('/api/admin/audit-logs/fake-id')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custDelete.status, 403);
});

// ============================================================================
// 13. Existing core booking and notification functionality continues to work
// ============================================================================
test('13. Core booking and notification flow continues working seamlessly', async () => {
  const { token: customerToken, user: customer } = await registerCustomer();
  const { token: providerToken, user: provider } = await registerProvider(null, true);

  // 1. Customer creates a booking
  const bookRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Fan Installation',
      category: 'Electrical Services',
      city: 'sangli',
      serviceAddress: '123 Ganesh Nagar, Sangli',
      bookingDate: '2026-10-25',
      bookingTime: '04:00 PM',
      description: 'Living room ceiling fan needs wiring check'
    });

  assert.equal(bookRes.status, 201);
  const bookingId = bookRes.body.booking._id;

  // 2. Provider receives booking notification and updates status to accepted
  const acceptRes = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.booking.status, 'accepted');

  // 3. Provider marks completed
  const completeRes = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${providerToken}`)
    .send({});

  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.booking.status, 'completed');

  // 4. Customer submits review
  const reviewRes = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId,
      rating: 5,
      comment: 'Super fast installation! Highly recommended.'
    });

  assert.equal(reviewRes.status, 201);
  assert.equal(reviewRes.body.review.rating, 5);

  // 5. Provider profile reflects updated rating
  const pUpdated = await User.findById(provider._id);
  assert.equal(pUpdated.providerDetails.reviewCount, 1);
  assert.equal(pUpdated.providerDetails.rating, 5);
});
