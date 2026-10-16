import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';

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

// Helper: Future date string (tomorrow)
const getTomorrowDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// =========================================================================
// 1. PROVIDER SEES ONLY ASSIGNED BOOKINGS
// =========================================================================
test('1. Provider sees only bookings assigned to their account', async () => {
  const { token: p1Token, user: p1 } = await registerUser({
    name: 'Provider Assigned P1',
    email: 'p1.assigned@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Tap Repair']
    }
  });

  const { token: p2Token, user: p2 } = await registerUser({
    name: 'Provider Other P2',
    email: 'p2.other@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Gaonbhag',
      servicesOffered: ['Tap Repair']
    }
  });

  const { token: cToken } = await registerUser({
    name: 'Customer Sangli',
    email: 'c.sangli@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // Book P1
  await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: p1._id,
      serviceName: 'Tap Repair',
      city: 'sangli',
      serviceAddress: 'Vishrambag 1st Lane',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });

  // P1 sees the booking
  const p1Res = await request(app)
    .get('/api/bookings/provider')
    .set('Authorization', `Bearer ${p1Token}`);
  assert.equal(p1Res.status, 200);
  assert.equal(p1Res.body.count, 1);
  assert.equal(p1Res.body.bookings[0].provider.toString(), p1._id.toString());

  // P2 sees 0 bookings
  const p2Res = await request(app)
    .get('/api/bookings/provider')
    .set('Authorization', `Bearer ${p2Token}`);
  assert.equal(p2Res.status, 200);
  assert.equal(p2Res.body.count, 0);
});

// =========================================================================
// 2. CUSTOMER SEES ONLY THEIR OWN BOOKINGS
// =========================================================================
test('2. Customer sees only their own booking requests', async () => {
  const { user: provider } = await registerUser({
    name: 'Electrician Pune',
    email: 'elec.pune@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Electrical Services',
      serviceArea: 'Kothrud',
      servicesOffered: ['Fan Fitting']
    }
  });

  const { token: c1Token } = await registerUser({
    name: 'Customer Pune A',
    email: 'cpune.a@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  const { token: c2Token } = await registerUser({
    name: 'Customer Pune B',
    email: 'cpune.b@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  // C1 creates booking
  await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${c1Token}`)
    .send({
      providerId: provider._id,
      serviceName: 'Fan Fitting',
      city: 'pune',
      serviceAddress: 'Kothrud Hill View',
      bookingDate: getTomorrowDateString(),
      bookingTime: '02:00 PM'
    });

  // C1 checks bookings
  const c1Res = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${c1Token}`);
  assert.equal(c1Res.status, 200);
  assert.equal(c1Res.body.count, 1);

  // C2 checks bookings
  const c2Res = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${c2Token}`);
  assert.equal(c2Res.status, 200);
  assert.equal(c2Res.body.count, 0);
});

// =========================================================================
// 3. ACCEPTING A PENDING BOOKING CREATES A CUSTOMER NOTIFICATION
// =========================================================================
test('3. Accepting a pending booking creates a persistent notification for the customer', async () => {
  const { token: pToken, user: provider } = await registerUser({
    name: 'Mahesh Carpenter',
    email: 'mahesh.carpenter@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Carpentry',
      serviceArea: 'Baner',
      servicesOffered: ['Door Lock Fix']
    }
  });

  const { token: cToken, user: customer } = await registerUser({
    name: 'Nitin Kulkarni',
    email: 'nitin.k@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  // Create booking
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Door Lock Fix',
      city: 'pune',
      serviceAddress: 'Baner Main Road',
      bookingDate: getTomorrowDateString(),
      bookingTime: '11:00 AM'
    });
  const bookingId = createRes.body.booking._id;

  // Provider accepts booking
  const acceptRes = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${pToken}`);
  assert.equal(acceptRes.status, 200);

  // Verify customer receives notification
  const notif = await Notification.findOne({
    recipient: customer._id,
    type: 'booking_accepted'
  });
  assert.ok(notif, 'Customer should receive booking_accepted notification');
  assert.equal(notif.isRead, false);
  assert.ok(notif.title.includes('Appointment Confirmed'));
  assert.ok(notif.message.includes('Mahesh Carpenter accepted'));
});

// =========================================================================
// 4. REJECTING A PENDING BOOKING CREATES A CUSTOMER NOTIFICATION
// =========================================================================
test('4. Rejecting a pending booking creates a persistent notification for the customer', async () => {
  const { token: pToken, user: provider } = await registerUser({
    name: 'Pravin Electrician',
    email: 'pravin.elec@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Electrical Services',
      serviceArea: 'Miraj',
      servicesOffered: ['Wiring Check']
    }
  });

  const { token: cToken, user: customer } = await registerUser({
    name: 'Rahul More',
    email: 'rahul.more@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // Create booking
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Wiring Check',
      city: 'sangli',
      serviceAddress: 'Miraj Mission Compound',
      bookingDate: getTomorrowDateString(),
      bookingTime: '03:00 PM'
    });
  const bookingId = createRes.body.booking._id;

  // Provider declines booking
  const rejectRes = await request(app)
    .patch(`/api/bookings/${bookingId}/reject`)
    .set('Authorization', `Bearer ${pToken}`)
    .send({ reason: 'Fully booked for this evening' });
  assert.equal(rejectRes.status, 200);

  // Verify customer receives notification
  const notif = await Notification.findOne({
    recipient: customer._id,
    type: 'booking_rejected'
  });
  assert.ok(notif, 'Customer should receive booking_rejected notification');
  assert.ok(notif.title.includes('Service Request Declined'));
  assert.ok(notif.message.includes('Fully booked for this evening'));
});

// =========================================================================
// 5. CREATING A BOOKING CREATES A PROVIDER NOTIFICATION
// =========================================================================
test('5. Creating a booking creates a persistent notification for the assigned provider', async () => {
  const { user: provider } = await registerUser({
    name: 'Ganesh Plumber',
    email: 'ganesh.plumb@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'mumbai',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Andheri',
      servicesOffered: ['Sink Unclogging']
    }
  });

  const { token: cToken, user: customer } = await registerUser({
    name: 'Pooja Mehta',
    email: 'pooja.m@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Sink Unclogging',
      city: 'mumbai',
      serviceAddress: 'Lokhandwala Complex',
      bookingDate: getTomorrowDateString(),
      bookingTime: '04:00 PM'
    });
  assert.equal(createRes.status, 201);

  // Verify provider receives notification
  const notif = await Notification.findOne({
    recipient: provider._id,
    type: 'booking_created'
  });
  assert.ok(notif, 'Provider should receive booking_created notification');
  assert.equal(notif.isRead, false);
  assert.ok(notif.title.includes('New Service Booking Request'));
  assert.ok(notif.message.includes('Pooja Mehta requested an appointment'));
});

// =========================================================================
// 6. FAILED OR UNAUTHORIZED ACTIONS CREATE NO NOTIFICATION
// =========================================================================
test('6. Failed or unauthorized actions create no notifications in MongoDB', async () => {
  const { user: provider } = await registerUser({
    name: 'Sunita Cleaner',
    email: 'sunita.clean@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'nagpur',
    providerDetails: {
      category: 'Home Cleaning',
      serviceArea: 'Dharampeth',
      servicesOffered: ['Kitchen Scrubbing']
    }
  });

  const { token: cToken } = await registerUser({
    name: 'Fail Test Customer',
    email: 'fail.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'nagpur'
  });

  // Attempt booking with past date (fails with 400)
  const failRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Kitchen Scrubbing',
      city: 'nagpur',
      serviceAddress: 'Dharampeth Area',
      bookingDate: '2020-01-01',
      bookingTime: '10:00 AM'
    });
  assert.equal(failRes.status, 400);

  // Verify zero notifications were created
  const notifCount = await Notification.countDocuments();
  assert.equal(notifCount, 0, 'No notification should be created for failed operations');
});

// =========================================================================
// 7. REPEATED REQUESTS DO NOT CREATE DUPLICATE NOTIFICATIONS
// =========================================================================
test('7. Repeated duplicate booking submissions do not create duplicate notifications', async () => {
  const { user: provider } = await registerUser({
    name: 'Duplicate Guard Provider',
    email: 'dup.guard@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Pipe Welding']
    }
  });

  const { token: cToken } = await registerUser({
    name: 'Duplicate Requester',
    email: 'dup.req@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const payload = {
    providerId: provider._id,
    serviceName: 'Pipe Welding',
    city: 'sangli',
    serviceAddress: 'Vishrambag 2nd Lane',
    bookingDate: getTomorrowDateString(),
    bookingTime: '11:00 AM'
  };

  // 1st request succeeds
  const first = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send(payload);
  assert.equal(first.status, 201);

  // 2nd duplicate request rejected with 409 Conflict
  const second = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send(payload);
  assert.equal(second.status, 409);

  // Exactly 1 notification should exist for the provider
  const notifCount = await Notification.countDocuments({
    recipient: provider._id,
    type: 'booking_created'
  });
  assert.equal(notifCount, 1);
});

// =========================================================================
// 8. USER CAN LIST ONLY THEIR OWN NOTIFICATIONS
// =========================================================================
test('8. A user can list only their own notifications via GET /api/notifications', async () => {
  const { token: u1Token, user: u1 } = await registerUser({
    name: 'User Alpha',
    email: 'alpha@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  const { token: u2Token, user: u2 } = await registerUser({
    name: 'User Beta',
    email: 'beta@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  // Seed notification for u1
  await Notification.create({
    recipient: u1._id,
    type: 'system',
    title: 'Alpha Notice',
    message: 'Welcome Alpha'
  });

  // Seed notification for u2
  await Notification.create({
    recipient: u2._id,
    type: 'system',
    title: 'Beta Notice',
    message: 'Welcome Beta'
  });

  // u1 calls GET /api/notifications
  const res1 = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${u1Token}`);
  assert.equal(res1.status, 200);
  assert.equal(res1.body.count, 1);
  assert.equal(res1.body.notifications[0].title, 'Alpha Notice');

  // u2 calls GET /api/notifications
  const res2 = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${u2Token}`);
  assert.equal(res2.status, 200);
  assert.equal(res2.body.count, 1);
  assert.equal(res2.body.notifications[0].title, 'Beta Notice');
});

// =========================================================================
// 9. A USER CANNOT MARK ANOTHER USER'S NOTIFICATION AS READ
// =========================================================================
test('9. A user cannot mark another user notification as read', async () => {
  const { user: victim } = await registerUser({
    name: 'Victim User',
    email: 'victim.notif@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  const { token: attackerToken } = await registerUser({
    name: 'Attacker User',
    email: 'attacker.notif@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  const victimNotif = await Notification.create({
    recipient: victim._id,
    type: 'system',
    title: 'Private Notice',
    message: 'Private message for victim',
    isRead: false
  });

  // Attacker tries to mark victim's notification as read
  const res = await request(app)
    .patch(`/api/notifications/${victimNotif._id}/read`)
    .set('Authorization', `Bearer ${attackerToken}`);

  assert.equal(res.status, 403);
  assert.ok(res.body.error.includes('not authorized'));

  // Notification remains unread in database
  const inDb = await Notification.findById(victimNotif._id);
  assert.equal(inDb.isRead, false);
});

// =========================================================================
// 10. READ-ALL AFFECTS ONLY THE AUTHENTICATED USER'S NOTIFICATIONS
// =========================================================================
test('10. PATCH /api/notifications/read-all affects only the authenticated user notifications', async () => {
  const { token: userToken, user } = await registerUser({
    name: 'Read All User',
    email: 'readall@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'chhatrapati-sambhajinagar'
  });

  const { user: otherUser } = await registerUser({
    name: 'Untouched User',
    email: 'untouched@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'chhatrapati-sambhajinagar'
  });

  // Create 2 unread for user
  await Notification.create([
    { recipient: user._id, type: 'system', title: 'N1', message: 'M1', isRead: false },
    { recipient: user._id, type: 'system', title: 'N2', message: 'M2', isRead: false }
  ]);

  // Create 1 unread for otherUser
  const otherNotif = await Notification.create({
    recipient: otherUser._id,
    type: 'system',
    title: 'Other N',
    message: 'Other M',
    isRead: false
  });

  // User calls read-all
  const res = await request(app)
    .patch('/api/notifications/read-all')
    .set('Authorization', `Bearer ${userToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.modifiedCount, 2);

  // Other user's notification remains unread
  const otherInDb = await Notification.findById(otherNotif._id);
  assert.equal(otherInDb.isRead, false);
});

// =========================================================================
// 11. UNREAD COUNT CHANGES AFTER A NOTIFICATION IS READ
// =========================================================================
test('11. Unread count endpoint /api/notifications/unread-count decrements after marking as read', async () => {
  const { token, user } = await registerUser({
    name: 'Counter User',
    email: 'counter@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const n1 = await Notification.create({ recipient: user._id, type: 'system', title: 'U1', message: 'Msg1', isRead: false });
  await Notification.create({ recipient: user._id, type: 'system', title: 'U2', message: 'Msg2', isRead: false });

  // Check initial unread count
  const initialRes = await request(app)
    .get('/api/notifications/unread-count')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(initialRes.status, 200);
  assert.equal(initialRes.body.unreadCount, 2);

  // Mark n1 as read
  await request(app)
    .patch(`/api/notifications/${n1._id}/read`)
    .set('Authorization', `Bearer ${token}`);

  // Check updated unread count
  const updatedRes = await request(app)
    .get('/api/notifications/unread-count')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(updatedRes.status, 200);
  assert.equal(updatedRes.body.unreadCount, 1);
});

// =========================================================================
// 12. BOOKING STATUS AND NOTIFICATIONS PERSIST AFTER REFRESH
// =========================================================================
test('12. Booking status and notifications persist in MongoDB across independent query cycles', async () => {
  const { token: pToken, user: provider } = await registerUser({
    name: 'Persistence Provider',
    email: 'persist.prov@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'nagpur',
    providerDetails: {
      category: 'Vehicle Mechanic',
      serviceArea: 'Dharampeth',
      servicesOffered: ['Brake Service']
    }
  });

  const { token: cToken, user: customer } = await registerUser({
    name: 'Persistence Customer',
    email: 'persist.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'nagpur'
  });

  // Create booking
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Brake Service',
      city: 'nagpur',
      serviceAddress: 'Dharampeth Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '01:00 PM'
    });
  const bookingId = createRes.body.booking._id;

  // Provider accepts
  await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${pToken}`);

  // Query 1: Customer fetches bookings (simulating page reload)
  const reloadBookings = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${cToken}`);
  assert.equal(reloadBookings.status, 200);
  assert.equal(reloadBookings.body.bookings[0].status, 'accepted');

  // Query 2: Customer fetches notifications (simulating page reload)
  const reloadNotifs = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${cToken}`);
  assert.equal(reloadNotifs.status, 200);
  assert.equal(reloadNotifs.body.count, 1);
  assert.equal(reloadNotifs.body.notifications[0].type, 'booking_accepted');
});
