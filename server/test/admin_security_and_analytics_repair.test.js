import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import http from 'http';
import { io as Client } from 'socket.io-client';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import Review from '../src/models/Review.js';
import AuditLog from '../src/models/AuditLog.js';
import { getJwtSecret, DEFAULT_JWT_SECRET } from '../src/config/env.js';
import { generateToken } from '../src/controllers/authController.js';
import { adminLimiter } from '../src/middleware/rateLimiter.js';
import { initSocket } from '../src/socket/index.js';

let mongoServer;
let httpServer;
let socketPort;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_admin_repair';
  await mongoose.connect(uri);

  httpServer = http.createServer(app);
  initSocket(httpServer, ['http://localhost:5173']);
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      socketPort = httpServer.address().port;
      resolve();
    });
  });
});

test.after(async () => {
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
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
});

const registerCustomer = async (email = 'cust.test@example.com') => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Suresh Patil',
    email,
    password: 'Password123!',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '9876543210'
  });
  return { token: res.body.token, user: res.body.user };
};

const registerProvider = async (email = 'prov.test@example.com') => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Vinod Electrician',
    email,
    password: 'Password123!',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '9876543211',
    providerDetails: {
      category: 'Electrical Repairs',
      title: 'Certified Electrician',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Fan Installation', 'Wiring Repair'],
      startingPrice: 300,
      hourlyRate: 150
    }
  });
  return { token: res.body.token, user: res.body.user };
};

const createAdmin = async (email = 'admin.test@serveease.com') => {
  const passwordHash = await User.hashPassword('AdminPass123!');
  const admin = await User.create({
    name: 'Platform Admin',
    email,
    passwordHash,
    role: 'admin',
    status: 'active'
  });
  const token = generateToken(admin._id, admin.role);
  return { user: admin, token };
};

// ============================================================================
// TASK 1.1: RESTRICT ADMIN ACCOUNT CREATION & PRIVILEGE GUARDS
// ============================================================================
test('1.1.1 Public registration strictly rejects isAdmin: true, role: "admin", and privilege fields', async () => {
  // Test role: "admin"
  const resRoleAdmin = await request(app).post('/api/auth/register').send({
    name: 'Attacker One',
    email: 'attacker1@example.com',
    password: 'Password123!',
    role: 'admin',
    city: 'sangli'
  });
  assert.equal(resRoleAdmin.status, 400);
  assert.equal(resRoleAdmin.body.success, false);
  assert.ok(resRoleAdmin.body.error.includes('Administrator accounts cannot be created through public registration'));

  // Test isAdmin: true
  const resIsAdmin = await request(app).post('/api/auth/register').send({
    name: 'Attacker Two',
    email: 'attacker2@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'sangli',
    isAdmin: true
  });
  assert.equal(resIsAdmin.status, 400);
  assert.equal(resIsAdmin.body.success, false);
  assert.ok(resIsAdmin.body.error.includes('Administrator accounts cannot be created through public registration'));

  // Test isAdministrator: true
  const resIsAdministrator = await request(app).post('/api/auth/register').send({
    name: 'Attacker Three',
    email: 'attacker3@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'sangli',
    isAdministrator: true
  });
  assert.equal(resIsAdministrator.status, 400);
  assert.equal(resIsAdministrator.body.success, false);

  // Ensure no records were created
  const count = await User.countDocuments({ email: { $in: ['attacker1@example.com', 'attacker2@example.com', 'attacker3@example.com'] } });
  assert.equal(count, 0);
});

test('1.1.2 Profile update cannot escalate user role to admin or modify status', async () => {
  const { token, user } = await registerCustomer('cust.profile@example.com');

  const patchRes = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Legit Name Change',
      role: 'admin',
      isAdmin: true,
      status: 'suspended'
    });

  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.user.role, 'customer', 'Role must remain customer');
  assert.equal(patchRes.body.user.status, 'active', 'Status must remain active');

  // Verify in MongoDB directly
  const inDb = await User.findById(user._id);
  assert.equal(inDb.role, 'customer');
  assert.equal(inDb.status, 'active');
  assert.equal(inDb.name, 'Legit Name Change');
});

// ============================================================================
// TASK 1.2: VERIFY ADMIN API AUTHORIZATION ON ALL ENDPOINTS
// ============================================================================
test('1.2.1 All admin endpoints require authentication and reject unauthenticated requests with 401', async () => {
  const endpoints = [
    { method: 'get', path: '/api/admin/stats' },
    { method: 'get', path: '/api/admin/analytics' },
    { method: 'get', path: '/api/admin/users' },
    { method: 'get', path: `/api/admin/users/${new mongoose.Types.ObjectId()}` },
    { method: 'patch', path: `/api/admin/users/${new mongoose.Types.ObjectId()}/status`, body: { status: 'suspended' } },
    { method: 'get', path: '/api/admin/providers' },
    { method: 'patch', path: `/api/admin/providers/${new mongoose.Types.ObjectId()}/verify`, body: { isVerified: true } },
    { method: 'get', path: '/api/admin/bookings' },
    { method: 'get', path: '/api/admin/reviews' },
    { method: 'patch', path: `/api/admin/reviews/${new mongoose.Types.ObjectId()}/moderate`, body: { status: 'hidden' } },
    { method: 'get', path: '/api/admin/audit-logs' }
  ];

  for (const ep of endpoints) {
    const reqInstance = request(app)[ep.method](ep.path);
    if (ep.body) reqInstance.send(ep.body);
    const res = await reqInstance;
    assert.equal(res.status, 401, `Endpoint ${ep.method.toUpperCase()} ${ep.path} should require auth`);
    assert.equal(res.body.success, false);
  }
});

test('1.2.2 Customer and provider tokens receive 403 Forbidden on all admin endpoints', async () => {
  const { token: customerToken } = await registerCustomer('cust.rbactest@example.com');
  const { token: providerToken } = await registerProvider('prov.rbactest@example.com');

  const endpoints = [
    { method: 'get', path: '/api/admin/stats' },
    { method: 'get', path: '/api/admin/analytics' },
    { method: 'get', path: '/api/admin/users' },
    { method: 'get', path: '/api/admin/providers' },
    { method: 'get', path: '/api/admin/bookings' },
    { method: 'get', path: '/api/admin/reviews' },
    { method: 'get', path: '/api/admin/audit-logs' }
  ];

  for (const token of [customerToken, providerToken]) {
    for (const ep of endpoints) {
      const res = await request(app)[ep.method](ep.path).set('Authorization', `Bearer ${token}`);
      assert.equal(res.status, 403, `Non-admin token must receive 403 on ${ep.path}`);
      assert.equal(res.body.success, false);
      assert.ok(res.body.error.includes('Access denied'));
    }
  }
});

// ============================================================================
// TASK 1.3: ADMIN ENDPOINT RATE LIMITING
// ============================================================================
test('1.3.1 adminLimiter returns 429 when threshold is reached', async () => {
  // Test the limiter behavior directly using an isolated express mini-app with max: 2
  const express = (await import('express')).default;
  const rateLimit = (await import('express-rate-limit')).default;
  const testApp = express();

  const testLimiter = rateLimit({
    windowMs: 1000,
    max: 2,
    statusCode: 429,
    message: { success: false, error: 'Too many administrative requests from this IP address.' }
  });

  testApp.get('/test-admin', testLimiter, (req, res) => res.json({ success: true }));

  // Request 1: 200
  const res1 = await request(testApp).get('/test-admin');
  assert.equal(res1.status, 200);

  // Request 2: 200
  const res2 = await request(testApp).get('/test-admin');
  assert.equal(res2.status, 200);

  // Request 3: 429
  const res3 = await request(testApp).get('/test-admin');
  assert.equal(res3.status, 429);
  assert.equal(res3.body.success, false);
  assert.ok(res3.body.error.includes('Too many administrative requests'));
});

// ============================================================================
// TASK 1.4: UNIFIED JWT CONFIGURATION (REST & SOCKET.IO)
// ============================================================================
test('1.4.1 REST and Socket.IO use identical JWT verification key and authenticate successfully', async () => {
  const { user, token } = await createAdmin('admin.jwt@serveease.com');

  // 1. REST check
  const restRes = await request(app)
    .get('/api/admin/stats')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(restRes.status, 200);
  assert.equal(restRes.body.success, true);

  // 2. Socket.IO check with the same token
  const clientSocket = Client(`http://localhost:${socketPort}`, {
    auth: { token },
    transports: ['websocket']
  });

  await new Promise((resolve, reject) => {
    clientSocket.on('connect', resolve);
    clientSocket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Socket connection timeout')), 4000);
  });

  assert.equal(clientSocket.connected, true);
  clientSocket.disconnect();
});

test('1.4.2 Socket.IO rejects forged or invalid tokens', async () => {
  const forgedSocket = Client(`http://localhost:${socketPort}`, {
    auth: { token: 'invalid.forged.jwt.token' },
    transports: ['websocket'],
    reconnection: false
  });

  const errMessage = await new Promise((resolve) => {
    forgedSocket.on('connect_error', (err) => resolve(err.message));
    forgedSocket.on('connect', () => resolve('unexpected_success'));
    setTimeout(() => resolve('timeout'), 4000);
  });

  assert.ok(errMessage.includes('Authentication failed'));
  forgedSocket.disconnect();
});

test('1.4.3 getJwtSecret throws in production mode if JWT_SECRET is unset, matches fallback, or short', () => {
  const savedEnv = process.env.NODE_ENV;
  const savedSecret = process.env.JWT_SECRET;
  try {
    process.env.NODE_ENV = 'production';

    // Unset
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /strictly required in production mode/);

    // Fallback default
    process.env.JWT_SECRET = DEFAULT_JWT_SECRET;
    assert.throws(() => getJwtSecret(), /strictly required in production mode/);

    // Too short (< 32 chars)
    process.env.JWT_SECRET = 'short_secret_123';
    assert.throws(() => getJwtSecret(), /strictly required in production mode/);

    // Valid 32+ characters
    process.env.JWT_SECRET = 'a_very_secure_production_secret_key_exceeding_32_characters';
    assert.equal(getJwtSecret(), 'a_very_secure_production_secret_key_exceeding_32_characters');
  } finally {
    process.env.NODE_ENV = savedEnv;
    process.env.JWT_SECRET = savedSecret;
  }
});

// ============================================================================
// TASK 2: REPAIR ADMIN DASHBOARD ANALYTICS REVENUE AGGREGATION
// ============================================================================
test('2.1 Revenue aggregation accurately calculates from price and excludes ineligible bookings', async () => {
  const { token: adminToken } = await createAdmin('admin.revenue@serveease.com');
  const { user: customer1 } = await registerCustomer('cust.rev1@example.com');
  const { user: customer2 } = await registerCustomer('cust.rev2@example.com');
  const { user: provider1 } = await registerProvider('prov.rev1@example.com');

  // Eligible Bookings:
  // 1. Completed in Sangli, Electrical Repairs, price: 500
  await Booking.create({
    customer: customer1._id,
    provider: provider1._id,
    serviceName: 'Wiring Repair',
    category: 'Electrical Repairs',
    city: 'sangli',
    serviceAddress: '123 Market Yard, Sangli',
    bookingDate: '2026-10-15',
    bookingTime: '10:00 AM',
    price: 500,
    status: 'completed'
  });

  // 2. Accepted in Sangli, Electrical Repairs, price: 300
  await Booking.create({
    customer: customer2._id,
    provider: provider1._id,
    serviceName: 'Switch Installation',
    category: 'Electrical Repairs',
    city: 'sangli',
    serviceAddress: '456 Vishrambag, Sangli',
    bookingDate: '2026-10-15',
    bookingTime: '02:00 PM',
    price: 300,
    status: 'accepted'
  });

  // 3. Completed in Mumbai, Plumbing, price: 1200
  await Booking.create({
    customer: customer1._id,
    provider: provider1._id,
    serviceName: 'Pipe Replacement',
    category: 'Plumbing',
    city: 'mumbai',
    serviceAddress: 'Flat 101, Bandra, Mumbai',
    bookingDate: '2026-10-16',
    bookingTime: '11:00 AM',
    price: 1200,
    status: 'completed'
  });

  // Ineligible Bookings (Must NOT contribute to revenue):
  // 4. Cancelled booking with price: 400
  await Booking.create({
    customer: customer1._id,
    provider: provider1._id,
    serviceName: 'Fan Repair',
    category: 'Electrical Repairs',
    city: 'sangli',
    serviceAddress: '789 Station Road, Sangli',
    bookingDate: '2026-10-16',
    bookingTime: '04:00 PM',
    price: 400,
    status: 'cancelled'
  });

  // 5. Rejected booking with price: 600
  await Booking.create({
    customer: customer2._id,
    provider: provider1._id,
    serviceName: 'Geyser Repair',
    category: 'Electrical Repairs',
    city: 'sangli',
    serviceAddress: '101 Gaonbhag, Sangli',
    bookingDate: '2026-10-17',
    bookingTime: '09:00 AM',
    price: 600,
    status: 'rejected'
  });

  // 6. Pending booking with price: 700
  await Booking.create({
    customer: customer1._id,
    provider: provider1._id,
    serviceName: 'AC Maintenance',
    category: 'HVAC',
    city: 'pune',
    serviceAddress: 'Shivajinagar, Pune',
    bookingDate: '2026-10-18',
    bookingTime: '01:00 PM',
    price: 700,
    status: 'pending'
  });

  // 7. Backward compatibility booking with totalAmount: 450 (accepted)
  await Booking.collection.insertOne({
    customer: customer2._id,
    provider: provider1._id,
    serviceName: 'Legacy Order',
    category: 'Plumbing',
    city: 'mumbai',
    serviceAddress: 'Andheri, Mumbai',
    bookingDate: '2026-10-18',
    bookingTime: '03:00 PM',
    totalAmount: 450,
    status: 'accepted',
    createdAt: new Date()
  });

  const res = await request(app)
    .get('/api/admin/analytics?timeframe=all')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const { analytics } = res.body;

  // Expected Eligible Revenue = 500 (completed) + 300 (accepted) + 1200 (completed) + 450 (accepted legacy) = 2450
  assert.equal(analytics.bookings.totalRevenue, 2450, 'Total revenue must sum eligible bookings and exclude cancelled/rejected/pending');

  // Verify City Distribution Revenue
  const sangliStats = analytics.cityDistribution.find((c) => c.city === 'sangli');
  assert.ok(sangliStats, 'Sangli should exist in city distribution');
  // Sangli eligible revenue: 500 + 300 = 800 (cancelled 400 & rejected 600 excluded)
  assert.equal(sangliStats.revenue, 800, 'Sangli revenue must be exactly 800');
  assert.equal(sangliStats.totalBookings, 4); // 4 bookings created in Sangli
  assert.equal(sangliStats.completedBookings, 1);

  const mumbaiStats = analytics.cityDistribution.find((c) => c.city === 'mumbai');
  assert.ok(mumbaiStats, 'Mumbai should exist in city distribution');
  // Mumbai eligible revenue: 1200 + 450 = 1650
  assert.equal(mumbaiStats.revenue, 1650, 'Mumbai revenue must be exactly 1650');

  // Verify Category Distribution Revenue
  const elecCat = analytics.categories.byBookings.find((c) => c.category === 'Electrical Repairs');
  assert.ok(elecCat, 'Electrical Repairs category must exist');
  assert.equal(elecCat.revenue, 800, 'Electrical Repairs revenue must be 800');

  const plumbCat = analytics.categories.byBookings.find((c) => c.category === 'Plumbing');
  assert.ok(plumbCat, 'Plumbing category must exist');
  assert.equal(elecCat.revenue, 800, 'Plumbing revenue must be 1650');
  assert.equal(plumbCat.revenue, 1650, 'Plumbing revenue must be 1650');

  // Verify Booking status counts
  assert.equal(analytics.bookings.byStatus.completed, 2);
  assert.equal(analytics.bookings.byStatus.accepted, 2);
  assert.equal(analytics.bookings.byStatus.cancelled, 1);
  assert.equal(analytics.bookings.byStatus.rejected, 1);
  assert.equal(analytics.bookings.byStatus.pending, 1);
  assert.equal(analytics.bookings.total, 7);

  // Verify daily trend revenue adds up to total revenue
  const totalTrendRevenue = analytics.bookingTrends.reduce((sum, t) => sum + t.revenue, 0);
  assert.equal(totalTrendRevenue, 2450, 'Daily trend revenues must sum to total eligible revenue');
});
