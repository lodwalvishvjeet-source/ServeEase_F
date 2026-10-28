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
});

// Helper: Register user and return token + doc
const registerUser = async (userData) => {
  const res = await request(app).post('/api/auth/register').send(userData);
  if (userData.role === 'provider' && res.body.user) {
    await User.findByIdAndUpdate(res.body.user._id, {
      'providerDetails.isVerified': true,
      'providerDetails.verificationStatus': 'approved',
      verificationStatus: 'approved'
    });
    res.body.user.providerDetails = res.body.user.providerDetails || {};
    res.body.user.providerDetails.isVerified = true;
    res.body.user.providerDetails.verificationStatus = 'approved';
    res.body.user.verificationStatus = 'approved';
  }
  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Setup customer, provider, and booking in desired status
const setupBookingWithStatus = async (status = 'completed') => {
  const uniq = Math.random().toString(36).slice(2, 8);
  const { token: providerToken, user: provider } = await registerUser({
    name: 'Master Plumber Ramesh',
    email: `ramesh.plumber.${uniq}@example.com`,
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      title: 'Expert Plumbing & Pipefitter',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Pipe Leak Repair', 'Tap Installation'],
      startingPrice: 350
    }
  });

  const { token: customerToken, user: customer } = await registerUser({
    name: 'Customer Ananya',
    email: `ananya.customer.${uniq}@example.com`,
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const booking = await Booking.create({
    customer: customer._id || customer.id,
    provider: provider._id || provider.id,
    serviceName: 'Pipe Leak Repair',
    category: 'Plumbing',
    city: 'sangli',
    serviceAddress: '123 River Road, Vishrambag, Sangli',
    bookingDate: '2026-10-15',
    bookingTime: '10:00 AM',
    status,
    price: 350,
    priceType: 'starting_charge',
    completedAt: status === 'completed' ? new Date() : null
  });

  return { providerToken, provider, customerToken, customer, booking };
};

// =========================================================================
// 1. VALID REVIEW FOR COMPLETED BOOKING SUCCEEDS
// =========================================================================
test('1. Valid review for a completed booking succeeds', async () => {
  const { customerToken, provider, booking } = await setupBookingWithStatus('completed');

  const res = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 5,
      comment: 'Excellent plumbing service! Arrived promptly and fixed the pipe leak cleanly.'
    });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.review.rating, 5);
  assert.strictEqual(res.body.review.comment, 'Excellent plumbing service! Arrived promptly and fixed the pipe leak cleanly.');
  assert.strictEqual(res.body.review.booking.toString(), booking._id.toString());

  // Check provider aggregate metrics updated
  const providerDoc = await User.findById(provider._id || provider.id);
  assert.strictEqual(providerDoc.providerDetails.rating, 5);
  assert.strictEqual(providerDoc.providerDetails.reviewCount, 1);

  // Check notification created for provider
  const notif = await Notification.findOne({ recipient: provider._id || provider.id, type: 'review_received' });
  assert.ok(notif, 'Persistent notification should be created for provider');
});

// =========================================================================
// 2. REVIEW FOR INCOMPLETE BOOKING IS REJECTED
// =========================================================================
test('2. Review for an incomplete booking (pending, accepted) is rejected', async () => {
  // Pending booking
  const { customerToken: cToken1, booking: pendingBooking } = await setupBookingWithStatus('pending');
  const resPending = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${cToken1}`)
    .send({
      bookingId: pendingBooking._id.toString(),
      rating: 4,
      comment: 'Attempting to review pending booking'
    });

  assert.strictEqual(resPending.status, 400);
  assert.strictEqual(resPending.body.success, false);
  assert.match(resPending.body.error, /completed/i);

  // Accepted booking
  const { customerToken: cToken2, booking: acceptedBooking } = await setupBookingWithStatus('accepted');
  const resAccepted = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${cToken2}`)
    .send({
      bookingId: acceptedBooking._id.toString(),
      rating: 4,
      comment: 'Attempting to review accepted booking'
    });

  assert.strictEqual(resAccepted.status, 400);
  assert.strictEqual(resAccepted.body.success, false);
  assert.match(resAccepted.body.error, /completed/i);
});

// =========================================================================
// 3. REVIEW FOR CANCELLED OR REJECTED BOOKING IS REJECTED
// =========================================================================
test('3. Review for a cancelled or rejected booking is rejected', async () => {
  // Cancelled booking
  const { customerToken: cToken1, booking: cancelledBooking } = await setupBookingWithStatus('cancelled');
  const resCancelled = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${cToken1}`)
    .send({
      bookingId: cancelledBooking._id.toString(),
      rating: 2,
      comment: 'Attempting to review cancelled booking'
    });

  assert.strictEqual(resCancelled.status, 400);
  assert.strictEqual(resCancelled.body.success, false);
  assert.match(resCancelled.body.error, /completed/i);

  // Rejected booking
  const { customerToken: cToken2, booking: rejectedBooking } = await setupBookingWithStatus('rejected');
  const resRejected = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${cToken2}`)
    .send({
      bookingId: rejectedBooking._id.toString(),
      rating: 1,
      comment: 'Attempting to review declined booking'
    });

  assert.strictEqual(resRejected.status, 400);
  assert.strictEqual(resRejected.body.success, false);
  assert.match(resRejected.body.error, /completed/i);
});

// =========================================================================
// 4. CUSTOMER CANNOT REVIEW ANOTHER CUSTOMER'S BOOKING
// =========================================================================
test("4. Customer cannot review another customer's booking", async () => {
  const { booking } = await setupBookingWithStatus('completed');

  // Register second customer (intruder)
  const { token: intruderToken } = await registerUser({
    name: 'Intruder Customer Dev',
    email: 'intruder.customer@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const res = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${intruderToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 1,
      comment: 'Malicious review attempt on someone elses booking'
    });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.success, false);
  assert.match(res.body.error, /personally scheduled/i);
});

// =========================================================================
// 5. UNAUTHENTICATED REVIEW REQUESTS ARE REJECTED
// =========================================================================
test('5. Unauthenticated review requests are rejected with 401 Unauthorized', async () => {
  const { booking } = await setupBookingWithStatus('completed');

  const res = await request(app)
    .post('/api/reviews')
    .send({
      bookingId: booking._id.toString(),
      rating: 5,
      comment: 'Unauthenticated review'
    });

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.success, false);
});

// =========================================================================
// 6. RATINGS BELOW 1, ABOVE 5, OR NON-NUMERIC RATINGS ARE REJECTED
// =========================================================================
test('6. Ratings below 1, above 5, or non-numeric ratings are rejected', async () => {
  const { customerToken, booking } = await setupBookingWithStatus('completed');

  // Rating 0
  const res0 = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id.toString(), rating: 0 });
  assert.strictEqual(res0.status, 400);
  assert.match(res0.body.error, /between 1 and 5/i);

  // Rating 6
  const res6 = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id.toString(), rating: 6 });
  assert.strictEqual(res6.status, 400);
  assert.match(res6.body.error, /between 1 and 5/i);

  // Non-numeric rating
  const resNaN = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id.toString(), rating: 'five_stars' });
  assert.strictEqual(resNaN.status, 400);
  assert.match(resNaN.body.error, /between 1 and 5/i);

  // Float rating (non-integer e.g. 3.7)
  const resFloat = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id.toString(), rating: 3.7 });
  assert.strictEqual(resFloat.status, 400);
  assert.match(resFloat.body.error, /integer between 1 and 5/i);
});

// =========================================================================
// 7. DUPLICATE REVIEW SUBMISSIONS ARE PREVENTED
// =========================================================================
test('7. Duplicate review submissions are prevented (409 Conflict)', async () => {
  const { customerToken, booking } = await setupBookingWithStatus('completed');

  // First review succeeds
  const res1 = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 5,
      comment: 'Initial positive review'
    });
  assert.strictEqual(res1.status, 201);

  // Second review for the same booking must fail with 409 Conflict
  const res2 = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 4,
      comment: 'Duplicate attempt to review again'
    });
  assert.strictEqual(res2.status, 409);
  assert.strictEqual(res2.body.success, false);
  assert.match(res2.body.error, /already been submitted/i);

  // Verify only 1 review persists in MongoDB
  const count = await Review.countDocuments({ booking: booking._id });
  assert.strictEqual(count, 1);
});

// =========================================================================
// 8. PROVIDER CANNOT FABRICATE OR EDIT REVIEWS
// =========================================================================
test('8. Provider cannot fabricate or edit reviews (403 Forbidden)', async () => {
  const { providerToken, booking } = await setupBookingWithStatus('completed');

  const res = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${providerToken}`)
    .send({
      bookingId: booking._id.toString(),
      rating: 5,
      comment: 'Provider attempting to review themselves'
    });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.success, false);
});

// =========================================================================
// 9. AVERAGE RATING AND REVIEW COUNT REFLECT PERSISTED REVIEWS
// =========================================================================
test('9. Average rating and review count reflect persisted reviews accurately', async () => {
  const { providerToken, provider, customerToken: c1Token, customer: c1 } = await setupBookingWithStatus('completed');

  // Customer 1 rates 5 stars
  const booking1 = await Booking.findOne({ customer: c1._id || c1.id });
  await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${c1Token}`)
    .send({ bookingId: booking1._id.toString(), rating: 5, comment: 'First 5-star review' });

  // Register Customer 2 and complete a second booking with same provider
  const { token: c2Token, user: c2 } = await registerUser({
    name: 'Customer Bharat',
    email: 'bharat.customer@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const booking2 = await Booking.create({
    customer: c2._id || c2.id,
    provider: provider._id || provider.id,
    serviceName: 'Tap Installation',
    category: 'Plumbing',
    city: 'sangli',
    serviceAddress: '456 Market Lane, Sangli',
    bookingDate: '2026-10-16',
    bookingTime: '02:00 PM',
    status: 'completed',
    price: 350,
    priceType: 'starting_charge',
    completedAt: new Date()
  });

  // Customer 2 rates 4 stars
  await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${c2Token}`)
    .send({ bookingId: booking2._id.toString(), rating: 4, comment: 'Second 4-star review' });

  // Average should be (5 + 4) / 2 = 4.5, reviewCount = 2
  const providerId = provider._id || provider.id;
  const providerRes = await request(app).get(`/api/providers/${providerId}`);
  assert.strictEqual(providerRes.status, 200);
  assert.strictEqual(providerRes.body.provider.rating, 4.5);
  assert.strictEqual(providerRes.body.provider.reviewCount, 2);

  // Also verify GET /api/reviews/provider/:id listing endpoint
  const listRes = await request(app).get(`/api/reviews/provider/${providerId}`);
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.body.total, 2);
  assert.strictEqual(listRes.body.averageRating, 4.5);
  assert.strictEqual(listRes.body.reviewCount, 2);
  assert.strictEqual(listRes.body.reviews.length, 2);
});

// =========================================================================
// 10. PROVIDERS WITHOUT REVIEWS DISPLAY AN APPROPRIATE EMPTY STATE
// =========================================================================
test('10. Providers without reviews display an appropriate empty state (rating: null / 0 count)', async () => {
  const { provider } = await setupBookingWithStatus('pending');
  const providerId = provider._id || provider.id;

  const providerRes = await request(app).get(`/api/providers/${providerId}`);
  assert.strictEqual(providerRes.status, 200);
  assert.strictEqual(providerRes.body.provider.rating, null);
  assert.strictEqual(providerRes.body.provider.reviewCount, 0);

  const reviewsRes = await request(app).get(`/api/reviews/provider/${providerId}`);
  assert.strictEqual(reviewsRes.status, 200);
  assert.strictEqual(reviewsRes.body.total, 0);
  assert.strictEqual(reviewsRes.body.reviews.length, 0);
  assert.strictEqual(reviewsRes.body.averageRating, null);
});

// =========================================================================
// 11. CHECK BOOKING REVIEW STATUS & CUSTOMER MY REVIEWS
// =========================================================================
test('11. Customer can check review status for booking and retrieve submitted reviews', async () => {
  const { customerToken, booking } = await setupBookingWithStatus('completed');

  // Before review
  const checkBefore = await request(app)
    .get(`/api/reviews/booking/${booking._id}`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.strictEqual(checkBefore.status, 200);
  assert.strictEqual(checkBefore.body.hasReviewed, false);
  assert.strictEqual(checkBefore.body.review, null);

  // Submit review
  await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ bookingId: booking._id.toString(), rating: 5, comment: 'Punctual and skillful' });

  // After review
  const checkAfter = await request(app)
    .get(`/api/reviews/booking/${booking._id}`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.strictEqual(checkAfter.status, 200);
  assert.strictEqual(checkAfter.body.hasReviewed, true);
  assert.strictEqual(checkAfter.body.review.rating, 5);

  // Customer my-reviews endpoint
  const myReviewsRes = await request(app)
    .get('/api/reviews/my')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.strictEqual(myReviewsRes.status, 200);
  assert.strictEqual(myReviewsRes.body.count, 1);
  assert.strictEqual(myReviewsRes.body.reviews[0].comment, 'Punctual and skillful');
});
