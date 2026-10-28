import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import Review from '../src/models/Review.js';
import { initSocket } from '../src/socket/index.js';

let mongoServer;
let httpServer;
let socketServer;
let serverPort;

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
  serverPort = httpServer.address().port;
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
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Review.deleteMany({});
});

// Helper: Register user
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
  } else if (res.body?.user && userData.role !== 'admin') {
    await User.findByIdAndUpdate(res.body.user._id, {
      emailVerified: true
    });
    res.body.user.emailVerified = true;
  }
  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Register provider
const registerProvider = async (overrides = {}) => {
  const unique = Math.random().toString(36).substring(7);
  const defaultPayload = {
    name: 'Licensed Technician',
    email: `tech.${Date.now()}.${unique}@serveease.test`,
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '9876543210',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: [
        'Pipe Repair',
        'Tap Fitting',
        'Drain Cleaning',
        'Water Filter Installation',
        'Job A',
        'Job B',
        'Private Job',
        'Heater Repair',
        'Tap Replacement',
        'Sink Install',
        'Full House Wiring',
        'Routine Checkup',
        'Full Repiping',
        'Leak Repair',
        'Pipe Fitting'
      ],
      startingPrice: 300,
      hourlyRate: 350
    }
  };

  const payload = {
    ...defaultPayload,
    ...overrides,
    providerDetails: {
      ...defaultPayload.providerDetails,
      ...(overrides.providerDetails || {})
    }
  };

  return registerUser(payload);
};

// Helper: Tomorrow's date
const getTomorrowDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Connect Socket.IO client
const createSocketClient = (token) => {
  return Client(`http://localhost:${serverPort}`, {
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    autoConnect: true,
    reconnection: false
  });
};

// ============================================================================
// SCENARIO 1: Pending booking: neither participant can send chat messages
// ============================================================================
test('1. Pending booking: neither customer nor provider can send chat messages', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Pending Customer',
    email: 'pending.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Pending Provider',
    email: 'pending.prov@example.com'
  });

  // Create booking (pending)
  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Pipe Repair',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  assert.equal(bookingRes.status, 201);
  const bookingId = bookingRes.body.booking._id;

  // Create or get conversation for this booking
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId });
  assert.equal(convRes.status, 201);
  const conversationId = convRes.body.conversation._id;

  // Customer attempts to send message via REST -> 409 Conflict
  const custSendRes = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Hello, can you do this earlier?' });
  assert.equal(custSendRes.status, 409);
  assert.match(custSendRes.body.error, /pending provider acceptance/i);

  // Provider attempts to send message via REST -> 409 Conflict
  const provSendRes = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${provToken}`)
    .send({ text: 'Hello customer' });
  assert.equal(provSendRes.status, 409);
  assert.match(provSendRes.body.error, /pending provider acceptance/i);

  // Socket.IO test: Customer tries to emit send_message
  const custSocket = createSocketClient(custToken);
  await new Promise((resolve) => custSocket.on('connect', resolve));

  const socketError = await new Promise((resolve) => {
    custSocket.emit('send_message', { conversationId, text: 'Socket hello' }, (res) => {
      resolve(res);
    });
  });
  assert.equal(socketError.success, false);
  assert.equal(socketError.status, 409);
  assert.match(socketError.error, /pending provider acceptance/i);

  custSocket.disconnect();
});

// ============================================================================
// SCENARIO 2: Accepted booking: assigned customer and provider can exchange messages
// ============================================================================
test('2. Accepted booking: assigned customer and provider can exchange messages', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Accepted Customer',
    email: 'acc.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Accepted Provider',
    email: 'acc.prov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Tap Fitting',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  // Provider accepts booking
  const acceptRes = await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.booking.status, 'accepted');

  // Customer gets or creates conversation
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId });
  const conversationId = convRes.body.conversation._id;

  // Customer sends message via REST -> 201
  const custMsgRes = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Hello technician, see you tomorrow!' });
  assert.equal(custMsgRes.status, 201);
  assert.equal(custMsgRes.body.success, true);
  assert.equal(custMsgRes.body.message.text, 'Hello technician, see you tomorrow!');

  // Provider sends message via REST -> 201
  const provMsgRes = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${provToken}`)
    .send({ text: 'Got it, I will arrive on time.' });
  assert.equal(provMsgRes.status, 201);
  assert.equal(provMsgRes.body.success, true);

  // Exchange via Socket.IO
  const custSocket = createSocketClient(custToken);
  const provSocket = createSocketClient(provToken);
  await Promise.all([
    new Promise((resolve) => custSocket.on('connect', resolve)),
    new Promise((resolve) => provSocket.on('connect', resolve))
  ]);

  // Join rooms
  await new Promise((resolve) => custSocket.emit('join_conversation', { conversationId }, resolve));
  await new Promise((resolve) => provSocket.emit('join_conversation', { conversationId }, resolve));

  const socketSendPromise = new Promise((resolve) => {
    provSocket.on('new_message', (msg) => {
      resolve(msg);
    });
  });

  custSocket.emit('send_message', { conversationId, text: 'Realtime ping from customer' });
  const receivedMsg = await socketSendPromise;
  assert.equal(receivedMsg.text, 'Realtime ping from customer');

  custSocket.disconnect();
  provSocket.disconnect();
});

// ============================================================================
// SCENARIO 3: In Progress booking: chat remains available
// ============================================================================
test('3. In Progress booking: chat remains available for messaging', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Progress Customer',
    email: 'prog.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Progress Provider',
    email: 'prog.prov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Drain Cleaning',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  // Accept booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provToken}`);

  // Provider starts service
  const startRes = await request(app)
    .patch(`/api/bookings/${bookingId}/start`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(startRes.status, 200);
  assert.equal(startRes.body.booking.status, 'in_progress');

  // Conversation setup
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId });
  const conversationId = convRes.body.conversation._id;

  // Both participants can send messages while in progress
  const custMsg = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Are you at the doorstep?' });
  assert.equal(custMsg.status, 201);

  const provMsg = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${provToken}`)
    .send({ text: 'Yes, just ringing the bell.' });
  assert.equal(provMsg.status, 201);
});

// ============================================================================
// SCENARIO 4: Completed booking: new messages are rejected through both REST and Socket.IO
// ============================================================================
test('4. Completed booking: new messages are rejected through both REST and Socket.IO', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Completed Customer',
    email: 'comp.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Completed Provider',
    email: 'comp.prov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Water Filter Installation',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  await request(app).patch(`/api/bookings/${bookingId}/accept`).set('Authorization', `Bearer ${provToken}`);
  await request(app).patch(`/api/bookings/${bookingId}/start`).set('Authorization', `Bearer ${provToken}`);

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId });
  const conversationId = convRes.body.conversation._id;

  // Provider marks booking as completed
  const completeRes = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(completeRes.status, 200);
  assert.equal(completeRes.body.booking.status, 'completed');
  assert.ok(completeRes.body.booking.completedAt);

  // Customer tries to send message via REST -> 409 Conflict
  const custSend = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Can I ask one more question?' });
  assert.equal(custSend.status, 409);
  assert.match(custSend.body.error, /service has been completed/i);

  // Provider tries to send message via REST -> 409 Conflict
  const provSend = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${provToken}`)
    .send({ text: 'Thank you for your business.' });
  assert.equal(provSend.status, 409);
  assert.match(provSend.body.error, /service has been completed/i);

  // Socket.IO sending attempt -> rejected with status 409
  const socketClient = createSocketClient(custToken);
  await new Promise((resolve) => socketClient.on('connect', resolve));

  const socketResult = await new Promise((resolve) => {
    socketClient.emit('send_message', { conversationId, text: 'Late socket message' }, (res) => {
      resolve(res);
    });
  });
  assert.equal(socketResult.success, false);
  assert.equal(socketResult.status, 409);
  assert.match(socketResult.error, /service has been completed/i);

  socketClient.disconnect();
});

// ============================================================================
// SCENARIO 5: Rejected and Cancelled bookings: new messages are rejected
// ============================================================================
test('5. Rejected and Cancelled bookings: new messages are rejected through REST and Socket.IO', async () => {
  const { token: custToken } = await registerUser({
    name: 'Reject Customer',
    email: 'rej.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Reject Provider',
    email: 'rej.prov@example.com'
  });

  // A. REJECTED BOOKING TEST
  const book1 = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Job A',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const book1Id = book1.body.booking._id;

  const conv1 = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId: book1Id });
  const conv1Id = conv1.body.conversation._id;

  // Provider rejects request
  await request(app)
    .patch(`/api/bookings/${book1Id}/reject`)
    .set('Authorization', `Bearer ${provToken}`)
    .send({ reason: 'Fully booked' });

  // REST sending is rejected with 409
  const rejSend = await request(app)
    .post(`/api/conversations/${conv1Id}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Why did you decline?' });
  assert.equal(rejSend.status, 409);
  assert.match(rejSend.body.error, /declined/i);

  // B. CANCELLED BOOKING TEST
  const book2 = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Job B',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const book2Id = book2.body.booking._id;

  const conv2 = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId: book2Id });
  const conv2Id = conv2.body.conversation._id;

  // Customer cancels booking
  await request(app)
    .patch(`/api/bookings/${book2Id}/cancel`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ reason: 'Changed mind' });

  // REST sending is rejected with 409
  const canSend = await request(app)
    .post(`/api/conversations/${conv2Id}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Hello after cancel' });
  assert.equal(canSend.status, 409);
  assert.match(canSend.body.error, /cancelled/i);
});

// ============================================================================
// SCENARIO 6: Unrelated users cannot access the conversation or join its socket room
// ============================================================================
test('6. Unrelated users cannot access conversation or join its socket room', async () => {
  const { token: custToken } = await registerUser({
    name: 'Customer One',
    email: 'c1@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Provider One',
    email: 'p1@example.com'
  });

  const { token: strangerToken } = await registerUser({
    name: 'Stranger Danger',
    email: 'stranger@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Private Job',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId });
  const conversationId = convRes.body.conversation._id;

  // Stranger tries to get conversation details -> 403
  const strangerGet = await request(app)
    .get(`/api/conversations/${conversationId}`)
    .set('Authorization', `Bearer ${strangerToken}`);
  assert.equal(strangerGet.status, 403);

  // Stranger tries to get messages -> 403
  const strangerMsgs = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${strangerToken}`);
  assert.equal(strangerMsgs.status, 403);

  // Stranger tries to send message -> 403
  const strangerSend = await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${strangerToken}`)
    .send({ text: 'I am spying on you' });
  assert.equal(strangerSend.status, 403);

  // Stranger tries to join socket room
  const strangerSocket = createSocketClient(strangerToken);
  await new Promise((resolve) => strangerSocket.on('connect', resolve));

  const joinResult = await new Promise((resolve) => {
    strangerSocket.emit('join_conversation', { conversationId }, (res) => {
      resolve(res);
    });
  });
  assert.equal(joinResult.success, false);
  assert.match(joinResult.error, /Forbidden/i);

  strangerSocket.disconnect();
});

// ============================================================================
// SCENARIO 7: Only the assigned provider can mark the service completed
// ============================================================================
test('7. Only the assigned provider can mark the service completed', async () => {
  const { token: custToken } = await registerUser({
    name: 'Target Customer',
    email: 'tcust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: assignedProvToken, user: assignedProv } = await registerProvider({
    name: 'Assigned Tech',
    email: 'assigned@example.com'
  });

  const { token: rivalProvToken } = await registerProvider({
    name: 'Rival Tech',
    email: 'rival@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: assignedProv.id || assignedProv._id,
      serviceName: 'Heater Repair',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  // Accept booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${assignedProvToken}`);

  // Start booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/start`)
    .set('Authorization', `Bearer ${assignedProvToken}`);

  // Rival provider tries to complete booking -> 403 Forbidden
  const rivalComplete = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${rivalProvToken}`);
  assert.equal(rivalComplete.status, 403);

  // Assigned provider completes booking -> 200 OK
  const assignedComplete = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${assignedProvToken}`);
  assert.equal(assignedComplete.status, 200);
  assert.equal(assignedComplete.body.booking.status, 'completed');
  assert.ok(assignedComplete.body.booking.completedAt);
});

// ============================================================================
// SCENARIO 8: A customer cannot mark the service completed
// ============================================================================
test('8. A customer cannot mark the service completed or started', async () => {
  const { token: custToken } = await registerUser({
    name: 'Sneaky Customer',
    email: 'sneaky@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Target Provider',
    email: 'tprov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Tap Replacement',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  // Customer tries to complete booking -> 403 Forbidden (role check)
  const custComplete = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(custComplete.status, 403);

  // Customer tries to start booking -> 403 Forbidden (role check)
  const custStart = await request(app)
    .patch(`/api/bookings/${bookingId}/start`)
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(custStart.status, 403);
});

// ============================================================================
// SCENARIO 9: Invalid status transitions are rejected
// ============================================================================
test('9. Invalid status transitions are rejected by backend', async () => {
  const { token: custToken } = await registerUser({
    name: 'State Customer',
    email: 'state.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'State Provider',
    email: 'state.prov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Sink Install',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  // 1. Cannot start a pending booking directly -> 400
  const startPending = await request(app)
    .patch(`/api/bookings/${bookingId}/start`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(startPending.status, 400);

  // 2. Cannot complete a pending booking directly -> 400
  const completePending = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(completePending.status, 400);

  // Now accept booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/accept`)
    .set('Authorization', `Bearer ${provToken}`);

  // 3. Complete the booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${provToken}`);

  // 4. Cannot complete an already completed booking -> 400
  const repeatComplete = await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(repeatComplete.status, 400);
  assert.match(repeatComplete.body.error, /status "completed"/i);

  // 5. Cannot start a completed booking -> 400
  const startCompleted = await request(app)
    .patch(`/api/bookings/${bookingId}/start`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(startCompleted.status, 400);

  // 6. Cannot cancel a completed booking -> 400
  const cancelCompleted = await request(app)
    .patch(`/api/bookings/${bookingId}/cancel`)
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(cancelCompleted.status, 400);
});

// ============================================================================
// SCENARIO 10: Completing a booking updates the customer-visible status and notification
// ============================================================================
test('10. Completing a booking updates customer-visible status and creates notification', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Notif Customer',
    email: 'notif.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Notif Provider',
    email: 'notif.prov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Full House Wiring',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  await request(app).patch(`/api/bookings/${bookingId}/accept`).set('Authorization', `Bearer ${provToken}`);
  await request(app).patch(`/api/bookings/${bookingId}/complete`).set('Authorization', `Bearer ${provToken}`);

  // Verify in customer list endpoint
  const listRes = await request(app)
    .get('/api/bookings/my')
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(listRes.status, 200);
  const foundBooking = listRes.body.bookings.find((b) => b._id === bookingId);
  assert.ok(foundBooking);
  assert.equal(foundBooking.status, 'completed');
  assert.ok(foundBooking.completedAt);

  // Verify customer received booking_completed notification
  const notifRes = await request(app)
    .get('/api/notifications')
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(notifRes.status, 200);
  const compNotif = notifRes.body.notifications.find((n) => n.type === 'booking_completed');
  assert.ok(compNotif, 'Should have created a booking_completed notification');
  assert.match(compNotif.title, /Service Completed/i);
});

// ============================================================================
// SCENARIO 11: Existing conversation history remains available according to access policy
// ============================================================================
test('11. Existing conversation history remains accessible to participants after completion', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'History Customer',
    email: 'hist.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'History Provider',
    email: 'hist.prov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Routine Checkup',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  await request(app).patch(`/api/bookings/${bookingId}/accept`).set('Authorization', `Bearer ${provToken}`);

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId });
  const conversationId = convRes.body.conversation._id;

  // Send message while active
  await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Important diagnostic note for history' });

  // Complete booking
  await request(app)
    .patch(`/api/bookings/${bookingId}/complete`)
    .set('Authorization', `Bearer ${provToken}`);

  // Customer fetches messages -> 200 OK
  const custMsgs = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(custMsgs.status, 200);
  assert.equal(custMsgs.body.messages.length, 1);
  assert.equal(custMsgs.body.messages[0].text, 'Important diagnostic note for history');

  // Provider fetches messages -> 200 OK
  const provMsgs = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(provMsgs.status, 200);
  assert.equal(provMsgs.body.messages.length, 1);
});

// ============================================================================
// SCENARIO 12: Review eligibility is restricted to completed bookings
// ============================================================================
test('12. Review eligibility is strictly restricted to completed bookings', async () => {
  const { token: custToken } = await registerUser({
    name: 'Review Customer',
    email: 'review.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Review Provider',
    email: 'review.prov@example.com'
  });

  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Full Repiping',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Main St',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  const bookingId = bookingRes.body.booking._id;

  // A. Try reviewing pending booking -> 400 Bad Request
  const pendingReview = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      bookingId,
      rating: 5,
      comment: 'Premature review'
    });
  assert.equal(pendingReview.status, 400);
  assert.match(pendingReview.body.error, /completed appointments/i);

  // Accept booking
  await request(app).patch(`/api/bookings/${bookingId}/accept`).set('Authorization', `Bearer ${provToken}`);

  // B. Try reviewing accepted booking -> 400 Bad Request
  const acceptedReview = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      bookingId,
      rating: 5,
      comment: 'Still too early'
    });
  assert.equal(acceptedReview.status, 400);

  // Start booking
  await request(app).patch(`/api/bookings/${bookingId}/start`).set('Authorization', `Bearer ${provToken}`);

  // C. Try reviewing in_progress booking -> 400 Bad Request
  const progressReview = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      bookingId,
      rating: 5,
      comment: 'Almost done review'
    });
  assert.equal(progressReview.status, 400);

  // Complete booking
  await request(app).patch(`/api/bookings/${bookingId}/complete`).set('Authorization', `Bearer ${provToken}`);

  // D. Review completed booking -> 201 Created
  const completedReview = await request(app)
    .post('/api/reviews')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      bookingId,
      rating: 5,
      comment: 'Excellent service! Very professional.'
    });
  assert.equal(completedReview.status, 201);
  assert.equal(completedReview.body.success, true);
  assert.equal(completedReview.body.review.rating, 5);
});
