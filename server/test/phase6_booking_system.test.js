import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';

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
});

// Helper: Register user and return token + doc
const registerUser = async (userData) => {
  const res = await request(app).post('/api/auth/register').send(userData);
  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Generate a valid future date (tomorrow in YYYY-MM-DD)
const getTomorrowDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// =========================================================================
// 1. VALID BOOKING CREATION
// =========================================================================
test('1. Valid booking creation succeeds with pending status, populated details, and calculated price', async () => {
  const { user: provider } = await registerUser({
    name: 'Suresh Patil Plumber',
    email: 'suresh.patil@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '+91 9822100001',
    providerDetails: {
      category: 'Plumbing',
      categorySlug: 'plumbing',
      title: 'Senior Sanitary Technician',
      servicesOffered: ['Concealed Pipe Leaks', 'Tap Fitting', 'Geyser Line'],
      serviceArea: 'Vishrambag',
      startingPrice: 350,
      hourlyRate: 400
    }
  });

  const { token: customerToken, user: customer } = await registerUser({
    name: 'Anjali Deshmukh',
    email: 'anjali.customer@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '+91 9822200002'
  });

  const tomorrowStr = getTomorrowDateString();

  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Concealed Pipe Leaks',
      city: 'sangli',
      serviceAddress: 'Flat 402, Royal Residency, Vishrambag',
      bookingDate: tomorrowStr,
      bookingTime: '10:00 AM - 11:00 AM',
      description: 'Severe water seepage behind the master bathroom tiles.'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.ok(res.body.booking);
  assert.equal(res.body.booking.status, 'pending');
  assert.equal(res.body.booking.price, 350); // Derived from provider startingPrice
  assert.equal(res.body.booking.serviceName, 'Concealed Pipe Leaks');
  assert.equal(res.body.booking.city, 'sangli');
  assert.equal(res.body.booking.customer.name, 'Anjali Deshmukh');
  assert.equal(res.body.booking.provider.name, 'Suresh Patil Plumber');
  assert.equal(res.body.booking.customer.passwordHash, undefined);
  assert.equal(res.body.booking.provider.passwordHash, undefined);
});

// =========================================================================
// 2. MISSING OR INVALID BOOKING FIELDS
// =========================================================================
test('2. Missing or invalid booking fields are rejected with clear HTTP 400 Bad Request', async () => {
  const { user: provider } = await registerUser({
    name: 'Ramesh Wireman',
    email: 'ramesh.wire@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Electrical Services',
      serviceArea: 'Kothrud',
      servicesOffered: ['Switchboard Repair'],
      startingPrice: 200
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'Customer Testing',
    email: 'cust.test@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  const tomorrowStr = getTomorrowDateString();

  // Missing providerId
  const noProvider = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      serviceName: 'Switchboard Repair',
      city: 'pune',
      serviceAddress: '123 Test Road',
      bookingDate: tomorrowStr,
      bookingTime: '10:00 AM'
    });
  assert.equal(noProvider.status, 400);

  // Short/invalid service address (< 5 chars)
  const shortAddr = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Switchboard Repair',
      city: 'pune',
      serviceAddress: 'No',
      bookingDate: tomorrowStr,
      bookingTime: '10:00 AM'
    });
  assert.equal(shortAddr.status, 400);

  // Past date rejected
  const pastDate = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Switchboard Repair',
      city: 'pune',
      serviceAddress: '123 Test Road, Kothrud',
      bookingDate: '2020-01-01',
      bookingTime: '10:00 AM'
    });
  assert.equal(pastDate.status, 400);
  assert.ok(pastDate.body.error.includes('past'));
});

// =========================================================================
// 3. UNAUTHENTICATED BOOKING REQUESTS
// =========================================================================
test('3. Unauthenticated booking requests are rejected with HTTP 401 Unauthorized', async () => {
  const createRes = await request(app)
    .post('/api/bookings')
    .send({ serviceName: 'Test' });
  assert.equal(createRes.status, 401);

  const getMyRes = await request(app).get('/api/bookings/my');
  assert.equal(getMyRes.status, 401);

  const getProvRes = await request(app).get('/api/bookings/provider');
  assert.equal(getProvRes.status, 401);
});

// =========================================================================
// 4. CUSTOMER CANNOT CREATE BOOKING ON BEHALF OF ANOTHER CUSTOMER
// =========================================================================
test('4. Customer ID is strictly derived from the authenticated session and cannot be spoofed', async () => {
  const { user: provider } = await registerUser({
    name: 'Deepak Painter',
    email: 'deepak.paint@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'mumbai',
    providerDetails: {
      category: 'Painting',
      serviceArea: 'Andheri',
      servicesOffered: ['Wall Touchup']
    }
  });

  const { token: customer1Token, user: customer1 } = await registerUser({
    name: 'Customer One',
    email: 'c1@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  const { user: victimCustomer } = await registerUser({
    name: 'Victim Customer',
    email: 'victim@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  // Customer 1 attempts to forge booking under Victim's customerId
  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customer1Token}`)
    .send({
      customerId: victimCustomer._id,
      customer: victimCustomer._id,
      providerId: provider._id,
      serviceName: 'Wall Touchup',
      city: 'mumbai',
      serviceAddress: '101 Marine Drive',
      bookingDate: getTomorrowDateString(),
      bookingTime: '02:00 PM'
    });

  assert.equal(res.status, 201);
  // Verified that the created booking belongs to Customer 1 (token owner), NOT victim
  assert.equal(res.body.booking.customer._id.toString(), customer1._id.toString());
  assert.notEqual(res.body.booking.customer._id.toString(), victimCustomer._id.toString());
});

// =========================================================================
// 5. PROVIDER MUST GENUINELY OFFER THE SELECTED SERVICE
// =========================================================================
test('5. Attempting to book an unoffered service is rejected with HTTP 400', async () => {
  const { user: provider } = await registerUser({
    name: 'Carpentry Specialist',
    email: 'wood.pro@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Carpentry',
      serviceArea: 'Gaonbhag',
      servicesOffered: ['Door Lock Repair', 'Cabinet Hinge']
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'Sneha Patil',
    email: 'sneha@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Airplane Jet Engine Overhaul', // Unoffered
      city: 'sangli',
      serviceAddress: 'Gaonbhag Main Road',
      bookingDate: getTomorrowDateString(),
      bookingTime: '11:00 AM'
    });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.includes('does not offer the requested service'));
});

// =========================================================================
// 6. CITY / PROVIDER MISMATCH IS REJECTED
// =========================================================================
test('6. City mismatch between provider operating city and requested city is rejected', async () => {
  const { user: provider } = await registerUser({
    name: 'Nagpur Mechanic',
    email: 'nagpur.mech@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'nagpur',
    providerDetails: {
      category: 'Vehicle Mechanic',
      serviceArea: 'Dharampeth',
      servicesOffered: ['Bike Oil Change']
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'Mumbai Resident',
    email: 'mumbai.res@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  // Customer tries to book the Nagpur technician in Mumbai
  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Bike Oil Change',
      city: 'mumbai',
      serviceAddress: 'Bandra West, Mumbai',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });

  assert.equal(res.status, 400);
  assert.ok(res.body.error.includes('operates in Nagpur'));
});

// =========================================================================
// 7. CUSTOMER SEES ONLY THEIR OWN BOOKINGS
// =========================================================================
test('7. Customer listing returns only appointments created by the authenticated customer', async () => {
  const { user: provider } = await registerUser({
    name: 'Mahesh Cleaner',
    email: 'mahesh@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Home Cleaning',
      serviceArea: 'Baner',
      servicesOffered: ['Full House Deep Clean']
    }
  });

  const { token: c1Token, user: c1 } = await registerUser({
    name: 'Customer A',
    email: 'c1.bookings@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  const { token: c2Token, user: c2 } = await registerUser({
    name: 'Customer B',
    email: 'c2.bookings@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  const dateStr = getTomorrowDateString();

  // C1 creates a booking
  await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${c1Token}`)
    .send({
      providerId: provider._id,
      serviceName: 'Full House Deep Clean',
      city: 'pune',
      serviceAddress: 'Baner Road Block 4',
      bookingDate: dateStr,
      bookingTime: '09:00 AM'
    });

  // C2 creates a booking
  await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${c2Token}`)
    .send({
      providerId: provider._id,
      serviceName: 'Full House Deep Clean',
      city: 'pune',
      serviceAddress: 'Aundh Green Avenue',
      bookingDate: dateStr,
      bookingTime: '02:00 PM'
    });

  // C1 requests their bookings
  const c1Res = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${c1Token}`);
  assert.equal(c1Res.status, 200);
  assert.equal(c1Res.body.count, 1);
  assert.equal(c1Res.body.bookings[0].serviceAddress, 'Baner Road Block 4');

  // C2 requests their bookings
  const c2Res = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${c2Token}`);
  assert.equal(c2Res.status, 200);
  assert.equal(c2Res.body.count, 1);
  assert.equal(c2Res.body.bookings[0].serviceAddress, 'Aundh Green Avenue');
});

// =========================================================================
// 8. PROVIDER SEES ONLY ASSIGNED BOOKINGS
// =========================================================================
test('8. Provider sees only booking requests assigned to their account', async () => {
  const { token: p1Token, user: p1 } = await registerUser({
    name: 'Electrician One',
    email: 'elec1@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'chhatrapati-sambhajinagar',
    providerDetails: {
      category: 'Electrical Services',
      serviceArea: 'Cidco',
      servicesOffered: ['Inverter Wiring']
    }
  });

  const { token: p2Token, user: p2 } = await registerUser({
    name: 'Electrician Two',
    email: 'elec2@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'chhatrapati-sambhajinagar',
    providerDetails: {
      category: 'Electrical Services',
      serviceArea: 'Waluj',
      servicesOffered: ['Inverter Wiring']
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'CSN Customer',
    email: 'csn.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'chhatrapati-sambhajinagar'
  });

  // Book P1
  await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: p1._id,
      serviceName: 'Inverter Wiring',
      city: 'chhatrapati-sambhajinagar',
      serviceAddress: 'Cidco N-1',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });

  // P1 views bookings
  const p1Res = await request(app)
    .get('/api/bookings/provider')
    .set('Authorization', `Bearer ${p1Token}`);
  assert.equal(p1Res.status, 200);
  assert.equal(p1Res.body.count, 1);

  // P2 views bookings
  const p2Res = await request(app)
    .get('/api/bookings/provider')
    .set('Authorization', `Bearer ${p2Token}`);
  assert.equal(p2Res.status, 200);
  assert.equal(p2Res.body.count, 0); // P2 sees 0 requests
});

// =========================================================================
// 9. ANOTHER PROVIDER CANNOT ACCEPT OR REJECT THE BOOKING
// =========================================================================
test('9. A provider cannot accept or reject bookings assigned to another provider', async () => {
  const { user: p1 } = await registerUser({
    name: 'Plumber Assigned',
    email: 'plumb.assigned@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Tap Repair']
    }
  });

  const { token: intruderToken } = await registerUser({
    name: 'Plumber Intruder',
    email: 'plumb.intruder@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Kupwad',
      servicesOffered: ['Tap Repair']
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'Sangli Citizen',
    email: 'sangli.citizen@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // Create booking for P1
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: p1._id,
      serviceName: 'Tap Repair',
      city: 'sangli',
      serviceAddress: 'Vishrambag Chowk',
      bookingDate: getTomorrowDateString(),
      bookingTime: '11:00 AM'
    });
  const bookingId = createRes.body.booking._id;

  // Intruder tries to accept
  const acceptRes = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${intruderToken}`);
  assert.equal(acceptRes.status, 403);
  assert.ok(acceptRes.body.error.includes('not the technician assigned'));

  // Intruder tries to reject
  const rejectRes = await request(app)
    .patch(`/api/bookings/${bookingId}/reject`)
    .set('Authorization', `Bearer ${intruderToken}`)
    .send({ reason: 'Intruder decline' });
  assert.equal(rejectRes.status, 403);
});

// =========================================================================
// 10. INVALID STATUS TRANSITIONS ARE REJECTED
// =========================================================================
test('10. Invalid status transitions are strictly rejected by the server', async () => {
  const { token: pToken, user: p } = await registerUser({
    name: 'Valid Tech',
    email: 'valid.tech@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Carpentry',
      serviceArea: 'Kothrud',
      servicesOffered: ['Door Fitting']
    }
  });

  const { token: cToken } = await registerUser({
    name: 'Customer Transitions',
    email: 'cust.trans@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  // Create booking (status: pending)
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: p._id,
      serviceName: 'Door Fitting',
      city: 'pune',
      serviceAddress: 'Kothrud Depot',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = createRes.body.booking._id;

  // 1. Cannot complete a pending booking directly (must be accepted first)
  const completeDirect = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${pToken}`);
  assert.equal(completeDirect.status, 400);
  assert.ok(completeDirect.body.error.includes('Only accepted'));

  // 2. Accept booking -> transitions to accepted
  const acceptRes = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${pToken}`);
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.booking.status, 'accepted');

  // 3. Cannot accept already accepted booking again
  const reAccept = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${pToken}`);
  assert.equal(reAccept.status, 400);

  // 4. Complete booking -> transitions to completed
  const completeRes = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${pToken}`);
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.booking.status, 'completed');

  // 5. Cannot cancel a completed booking
  const cancelCompleted = await request(app)
    .patch(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${cToken}`);
  assert.equal(cancelCompleted.status, 400);
  assert.ok(cancelCompleted.body.error.includes('Completed service appointments cannot be cancelled'));
});

// =========================================================================
// 11. CANCELLATION FOLLOWS DOCUMENTED POLICY
// =========================================================================
test('11. Cancellation is permitted during pending and accepted states with audit note', async () => {
  const { token: pToken, user: p } = await registerUser({
    name: 'Cancellation Tech',
    email: 'cancel.tech@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Gaonbhag',
      servicesOffered: ['Drain Cleaning']
    }
  });

  const { token: cToken } = await registerUser({
    name: 'Cancel Requester',
    email: 'cancel.req@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // Create booking
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${cToken}`)
    .send({
      providerId: p._id,
      serviceName: 'Drain Cleaning',
      city: 'sangli',
      serviceAddress: 'Gaonbhag 1st Lane',
      bookingDate: getTomorrowDateString(),
      bookingTime: '03:00 PM'
    });
  const bookingId = createRes.body.booking._id;

  // Customer cancels pending booking
  const cancelRes = await request(app)
    .patch(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${cToken}`)
    .send({ reason: 'Found alternate technician' });

  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.body.booking.status, 'cancelled');
  assert.equal(cancelRes.body.booking.cancellationReason, 'Found alternate technician');

  // Verified in database
  const inDb = await Booking.findById(bookingId);
  assert.equal(inDb.status, 'cancelled');
});

// =========================================================================
// 12. PRICE AND OWNERSHIP CANNOT BE OVERWRITTEN BY CLIENT INPUT
// =========================================================================
test('12. Price, status, and ownership cannot be manipulated by client-supplied payload', async () => {
  const { user: provider } = await registerUser({
    name: 'Price Target Tech',
    email: 'price.tech@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'mumbai',
    providerDetails: {
      category: 'Appliance Repair',
      serviceArea: 'Andheri',
      servicesOffered: ['AC Gas Refill'],
      startingPrice: 800
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'Sneaky Client',
    email: 'sneaky@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  // Client attempts to tamper price, status, and role
  const res = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'AC Gas Refill',
      city: 'mumbai',
      serviceAddress: 'Andheri Link Road',
      bookingDate: getTomorrowDateString(),
      bookingTime: '12:00 PM',
      price: 1, // Tamper attempt: 1 Rupee
      status: 'completed', // Tamper attempt: mark directly completed
      role: 'admin'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.booking.price, 800, 'Price must derive from provider record (800), not client (1)');
  assert.equal(res.body.booking.status, 'pending', 'Status must initialize as pending');
});

// =========================================================================
// 13. DUPLICATE SUBMISSIONS ARE SAFELY HANDLED
// =========================================================================
test('13. Repeated clicks for the same pending slot are rejected with HTTP 409 Conflict', async () => {
  const { user: provider } = await registerUser({
    name: 'Duplicate Test Tech',
    email: 'dup.tech@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Sink Trap']
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'Duplicate Clicker',
    email: 'dup.clicker@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const payload = {
    providerId: provider._id,
    serviceName: 'Sink Trap',
    city: 'sangli',
    serviceAddress: 'Vishrambag 2nd Lane',
    bookingDate: getTomorrowDateString(),
    bookingTime: '04:00 PM'
  };

  // First request succeeds
  const first = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(payload);
  assert.equal(first.status, 201);

  // Immediate second duplicate request returns 409 Conflict
  const second = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send(payload);
  assert.equal(second.status, 409);
  assert.ok(second.body.error.includes('already have a pending booking'));
});

// =========================================================================
// 14. SINGLE BOOKING DETAILS ACCESS AND EXCLUSION OF SENSITIVE FIELDS
// =========================================================================
test('14. GET /api/bookings/:id restricts viewing to parties and excludes sensitive data', async () => {
  const { token: providerToken, user: provider } = await registerUser({
    name: 'Detail Provider',
    email: 'detail.prov@example.com',
    password: 'ProviderPass123',
    role: 'provider',
    city: 'nagpur',
    providerDetails: {
      category: 'Driver Services',
      serviceArea: 'Dharampeth',
      servicesOffered: ['Airport Drop']
    }
  });

  const { token: customerToken } = await registerUser({
    name: 'Detail Customer',
    email: 'detail.cust@example.com',
    password: 'CustomerPass123',
    role: 'customer',
    city: 'nagpur'
  });

  const { token: strangerToken } = await registerUser({
    name: 'Stranger Customer',
    email: 'stranger@example.com',
    password: 'StrangerPass123',
    role: 'customer',
    city: 'nagpur'
  });

  // Create booking
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      providerId: provider._id,
      serviceName: 'Airport Drop',
      city: 'nagpur',
      serviceAddress: 'Dharampeth Square',
      bookingDate: getTomorrowDateString(),
      bookingTime: '06:00 AM'
    });
  const bookingId = createRes.body.booking._id;

  // Customer can view
  const custView = await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set('Authorization', `Bearer ${customerToken}`);
  assert.equal(custView.status, 200);
  assert.equal(custView.body.booking.customer.passwordHash, undefined);
  assert.equal(custView.body.booking.provider.passwordHash, undefined);

  // Provider can view
  const provView = await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set('Authorization', `Bearer ${providerToken}`);
  assert.equal(provView.status, 200);

  // Unrelated user is forbidden
  const strangerView = await request(app)
    .get(`/api/bookings/${bookingId}`)
    .set('Authorization', `Bearer ${strangerToken}`);
  assert.equal(strangerView.status, 403);
  assert.ok(strangerView.body.error.includes('not authorized'));
});
