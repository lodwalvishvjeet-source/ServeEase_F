import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import http from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import { initSocket } from '../src/socket/index.js';

let mongoServer;
let httpServer;
let socketServer;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_serveease';
  await mongoose.connect(uri);

  httpServer = http.createServer(app);
  socketServer = initSocket(httpServer, ['*']);
  await new Promise((resolve) => httpServer.listen(0, resolve));
});

test.after(async () => {
  if (socketServer) {
    socketServer.close();
  }
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
  await Conversation.deleteMany({});
  await Message.deleteMany({});
});

const registerUser = async (userData) => {
  const payload = { ...userData };
  if (payload.role === 'provider' && !payload.providerDetails) {
    payload.providerDetails = {
      category: 'Plumbing Services',
      title: 'Certified Plumber',
      servicesOffered: ['Pipe Leakage', 'Tap Fitting'],
      serviceArea: 'Vishrambag',
      startingPrice: 350,
      hourlyRate: 400
    };
  }
  const res = await request(app).post('/api/auth/register').send(payload);
  if (res.status >= 400) {
    throw new Error(`Registration failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  if (payload.role === 'provider' && res.body.user) {
    await User.findByIdAndUpdate(res.body.user._id, {
      'providerDetails.isVerified': true,
      'providerDetails.verificationStatus': 'approved',
      verificationStatus: 'approved'
    });
  } else if (res.body?.user && payload.role !== 'admin') {
    await User.findByIdAndUpdate(res.body.user._id, {
      emailVerified: true
    });
    res.body.user.emailVerified = true;
  }
  const cookies = res.headers['set-cookie'] || [];
  return {
    user: res.body.user,
    token: res.body.token,
    cookies
  };
};

test('1. Rapid concurrent requests to createOrGetConversation produce exactly ONE conversation document', async () => {
  const customer = await registerUser({
    name: 'Concurrent Customer',
    email: 'concurrent.cust@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'mumbai',
    phoneNumber: '9876543210'
  });

  const provider = await registerUser({
    name: 'Concurrent Provider',
    email: 'concurrent.prov@example.com',
    password: 'Password123!',
    role: 'provider',
    city: 'mumbai',
    phoneNumber: '9876543211'
  });

  // Simulate 5 simultaneous requests (like React StrictMode + double-clicks)
  const reqPromises = Array.from({ length: 5 }).map(() =>
    request(app)
      .post('/api/conversations')
      .set('Cookie', customer.cookies)
      .send({ providerId: provider.user._id })
  );

  const responses = await Promise.all(reqPromises);

  for (const res of responses) {
    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.conversation?._id);
  }

  // All responses must return the EXACT SAME conversation ID
  const firstId = responses[0].body.conversation._id;
  for (let i = 1; i < responses.length; i++) {
    assert.strictEqual(
      responses[i].body.conversation._id,
      firstId,
      `Response ${i} returned different conversation ID`
    );
  }

  // Verify database contains EXACTLY 1 conversation document
  const totalCount = await Conversation.countDocuments({});
  assert.strictEqual(totalCount, 1, `Expected 1 conversation in DB, found ${totalCount}`);
});

test('2. Customer initiating conversation vs SP initiating conversation returns the exact same conversation document', async () => {
  const customer = await registerUser({
    name: 'Alice Customer',
    email: 'alice@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'pune',
    phoneNumber: '9876543220'
  });

  const provider = await registerUser({
    name: 'Bob Provider',
    email: 'bob@example.com',
    password: 'Password123!',
    role: 'provider',
    city: 'pune',
    phoneNumber: '9876543221'
  });

  // Step A: Customer initiates conversation with Provider
  const resFromCust = await request(app)
    .post('/api/conversations')
    .set('Cookie', customer.cookies)
    .send({ providerId: provider.user._id });

  assert.ok([200, 201].includes(resFromCust.status));
  const custConvId = resFromCust.body.conversation._id;

  // Step B: Provider initiates conversation with Customer
  const resFromProv = await request(app)
    .post('/api/conversations')
    .set('Cookie', provider.cookies)
    .send({ customerId: customer.user._id });

  assert.strictEqual(resFromProv.status, 200);
  const provConvId = resFromProv.body.conversation._id;

  // Both should point to the exact same conversation ID
  assert.strictEqual(custConvId, provConvId);

  // Verify only 1 document in database
  const count = await Conversation.countDocuments({});
  assert.strictEqual(count, 1);
});

test('3. getConversations deduplicates threads so both customer and SP see only 1 entry even if legacy duplicates exist', async () => {
  const customer = await registerUser({
    name: 'Charlie Customer',
    email: 'charlie@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '9876543230'
  });

  const provider = await registerUser({
    name: 'Dave Provider',
    email: 'dave@example.com',
    password: 'Password123!',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '9876543231'
  });

  // Artificially inject duplicate conversation documents via raw collection (simulating pre-fix legacy duplicates without pairKey)
  const legacyId1 = new mongoose.Types.ObjectId();
  const legacyId2 = new mongoose.Types.ObjectId();
  const legacyId3 = new mongoose.Types.ObjectId();
  const custObjId = new mongoose.Types.ObjectId(customer.user._id);
  const provObjId = new mongoose.Types.ObjectId(provider.user._id);

  await Conversation.collection.insertMany([
    {
      _id: legacyId1,
      participants: [custObjId, provObjId],
      updatedAt: new Date(Date.now() - 60000),
      createdAt: new Date(Date.now() - 60000)
    },
    {
      _id: legacyId2,
      participants: [provObjId, custObjId],
      updatedAt: new Date(Date.now() - 30000),
      createdAt: new Date(Date.now() - 30000)
    },
    {
      _id: legacyId3,
      participants: [custObjId, provObjId],
      updatedAt: new Date(Date.now() + 1000),
      createdAt: new Date(Date.now() + 1000)
    }
  ]);

  // In database, there are 3 documents for this pair
  const totalInDb = await Conversation.countDocuments({});
  assert.strictEqual(totalInDb, 3);

  // Customer fetches conversation list
  const custRes = await request(app)
    .get('/api/conversations')
    .set('Cookie', customer.cookies);

  assert.strictEqual(custRes.status, 200);
  assert.strictEqual(custRes.body.conversations.length, 1, 'Customer should only see 1 deduplicated thread');
  assert.strictEqual(custRes.body.conversations[0]._id, legacyId3.toString(), 'Should return most recently updated conversation');

  // Provider fetches conversation list
  const provRes = await request(app)
    .get('/api/conversations')
    .set('Cookie', provider.cookies);

  assert.strictEqual(provRes.status, 200);
  assert.strictEqual(provRes.body.conversations.length, 1, 'Provider should only see 1 deduplicated thread');
  assert.strictEqual(provRes.body.conversations[0]._id, legacyId3.toString());
});

test('4. Two different customers messaging the same provider produce distinct conversations', async () => {
  const cust1 = await registerUser({
    name: 'Cust One',
    email: 'cust1@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'mumbai',
    phoneNumber: '9876543240'
  });

  const cust2 = await registerUser({
    name: 'Cust Two',
    email: 'cust2@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'mumbai',
    phoneNumber: '9876543241'
  });

  const provider = await registerUser({
    name: 'Common Provider',
    email: 'commonprov@example.com',
    password: 'Password123!',
    role: 'provider',
    city: 'mumbai',
    phoneNumber: '9876543242'
  });

  const res1 = await request(app)
    .post('/api/conversations')
    .set('Cookie', cust1.cookies)
    .send({ providerId: provider.user._id });

  const res2 = await request(app)
    .post('/api/conversations')
    .set('Cookie', cust2.cookies)
    .send({ providerId: provider.user._id });

  assert.ok([200, 201].includes(res1.status));
  assert.ok([200, 201].includes(res2.status));
  assert.notStrictEqual(
    res1.body.conversation._id,
    res2.body.conversation._id,
    'Different customers must have distinct conversations with the provider'
  );

  // Provider fetches conversations and should see both (2 distinct threads)
  const provRes = await request(app)
    .get('/api/conversations')
    .set('Cookie', provider.cookies);

  assert.strictEqual(provRes.status, 200);
  assert.strictEqual(provRes.body.conversations.length, 2);
});

test('5. Linked booking conversation deduplication preserves booking context and prevents race duplicates', async () => {
  const customer = await registerUser({
    name: 'Booking Customer',
    email: 'booking.cust@example.com',
    password: 'Password123!',
    role: 'customer',
    city: 'pune',
    phoneNumber: '9876543250'
  });

  const provider = await registerUser({
    name: 'Booking Provider',
    email: 'booking.prov@example.com',
    password: 'Password123!',
    role: 'provider',
    city: 'pune',
    phoneNumber: '9876543251'
  });

  const booking = await Booking.create({
    customer: customer.user._id,
    provider: provider.user._id,
    serviceName: 'AC Deep Clean',
    serviceCategory: 'Appliance Repair',
    price: 999,
    bookingDate: '2026-11-01',
    bookingTime: '10:00 AM',
    status: 'accepted',
    city: 'pune',
    serviceAddress: '123 FC Road, Pune, Maharashtra 411004'
  });

  // Concurrent creation with bookingId
  const reqPromises = Array.from({ length: 4 }).map(() =>
    request(app)
      .post('/api/conversations')
      .set('Cookie', customer.cookies)
      .send({ bookingId: booking._id })
  );

  const responses = await Promise.all(reqPromises);
  const firstId = responses[0].body.conversation._id;

  for (const res of responses) {
    assert.ok([200, 201].includes(res.status));
    assert.strictEqual(res.body.conversation._id, firstId);
    assert.strictEqual(res.body.conversation.booking?._id, booking._id.toString());
  }

  const count = await Conversation.countDocuments({ booking: booking._id });
  assert.strictEqual(count, 1, 'Only one conversation should exist for this booking');
});
