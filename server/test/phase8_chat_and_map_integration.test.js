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

  // Initialize HTTP server with Socket.IO
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

// Helper: Register provider with mandatory fields
const registerProvider = async (overrides = {}) => {
  const unique = Math.random().toString(36).substring(7);
  const defaultPayload = {
    name: 'Licensed Technician',
    email: `tech.${Date.now()}.${unique}@serveease.test`,
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Leak Repair', 'Pipe Fitting'],
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

// Helper: Connect Socket.IO client
const createSocketClient = (token) => {
  return Client(`http://localhost:${serverPort}`, {
    auth: token ? { token } : undefined,
    transports: ['websocket'],
    autoConnect: true,
    reconnection: false
  });
};

// Helper: Tomorrow's date string
const getTomorrowDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// =========================================================================
// 1. AUTHENTICATED USERS CAN ACCESS THEIR OWN AUTHORIZED CONVERSATIONS
// =========================================================================
test('1. Authenticated users can access their own authorized conversations', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Authorized Customer',
    email: 'auth.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Authorized Provider',
    email: 'auth.prov@example.com'
  });

  // Create an appointment between them
  const bookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provider.id || provider._id,
      serviceName: 'Leak Repair',
      category: 'Plumbing Services',
      city: 'sangli',
      serviceAddress: '100 Vishrambag Road, Sangli',
      bookingDate: getTomorrowDateString(),
      bookingTime: '10:00 AM'
    });
  assert.equal(bookingRes.status, 201);
  const bookingId = bookingRes.body.booking._id;

  // Create conversation linked to this booking
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ bookingId });

  assert.equal(convRes.status, 201);
  assert.equal(convRes.body.success, true);
  const convId = convRes.body.conversation._id;

  // Customer fetches their conversations
  const custFetch = await request(app)
    .get('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(custFetch.status, 200);
  assert.equal(custFetch.body.conversations.length, 1);
  assert.equal(custFetch.body.conversations[0]._id, convId);

  // Provider fetches their conversations
  const provFetch = await request(app)
    .get('/api/conversations')
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(provFetch.status, 200);
  assert.equal(provFetch.body.conversations.length, 1);
  assert.equal(provFetch.body.conversations[0]._id, convId);
});

// =========================================================================
// 2. UNRELATED USERS CANNOT LOAD CONVERSATIONS OR MESSAGES
// =========================================================================
test('2. Unrelated users cannot load conversations or messages', async () => {
  const { token: c1Token } = await registerUser({
    name: 'Customer One',
    email: 'c1.chat@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { user: provider } = await registerProvider({
    name: 'Provider Tech',
    email: 'p.tech@example.com'
  });

  const { token: c2Token } = await registerUser({
    name: 'Unrelated Customer Two',
    email: 'c2.unrelated@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // C1 creates conversation with Provider
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${c1Token}`)
    .send({ providerId: provider.id || provider._id });
  assert.equal(convRes.status, 201);
  const convId = convRes.body.conversation._id;

  // C2 attempts to view C1's conversation
  const c2Access = await request(app)
    .get(`/api/conversations/${convId}`)
    .set('Authorization', `Bearer ${c2Token}`);
  assert.equal(c2Access.status, 403);
  assert.equal(c2Access.body.success, false);

  // C2 attempts to fetch message history
  const c2Messages = await request(app)
    .get(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${c2Token}`);
  assert.equal(c2Messages.status, 403);
});

// =========================================================================
// 3. INVALID SOCKET.IO AUTHENTICATION IS REJECTED
// =========================================================================
test('3. Invalid Socket.IO authentication is rejected', async () => {
  // A. Connecting with no token
  await new Promise((resolve) => {
    const socket = createSocketClient(null);
    socket.on('connect_error', (err) => {
      assert.match(err.message, /Authentication required/i);
      socket.disconnect();
      resolve();
    });
  });

  // B. Connecting with forged / invalid token
  await new Promise((resolve) => {
    const socket = createSocketClient('invalid_forged_jwt_token_123');
    socket.on('connect_error', (err) => {
      assert.match(err.message, /Authentication failed/i);
      socket.disconnect();
      resolve();
    });
  });
});

// =========================================================================
// 4. USERS CANNOT JOIN UNAUTHORIZED CONVERSATION ROOMS
// =========================================================================
test('4. Users cannot join unauthorized conversation rooms', async () => {
  const { token: c1Token } = await registerUser({
    name: 'Customer A',
    email: 'cust.a@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { user: provider } = await registerProvider({
    name: 'Provider A',
    email: 'prov.a@example.com'
  });

  const { token: c2Token } = await registerUser({
    name: 'Intruder Customer B',
    email: 'intruder.b@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // Conversation between Customer A and Provider A
  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${c1Token}`)
    .send({ providerId: provider.id || provider._id });
  const convId = convRes.body.conversation._id;

  // Intruder connects to Socket.IO with valid token
  await new Promise((resolve) => {
    const intruderSocket = createSocketClient(c2Token);
    intruderSocket.on('connect', () => {
      // Intruder attempts to join unauthorized conversation room
      intruderSocket.emit('join_conversation', { conversationId: convId }, (res) => {
        assert.equal(res.success, false);
        assert.match(res.error, /Forbidden/i);
        intruderSocket.disconnect();
        resolve();
      });
    });
  });
});

// =========================================================================
// 5. EMPTY AND EXCESSIVELY LONG MESSAGES ARE REJECTED
// =========================================================================
test('5. Empty and excessively long messages are rejected', async () => {
  const { token: custToken } = await registerUser({
    name: 'Validation Customer',
    email: 'val.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { user: provider } = await registerProvider({
    name: 'Validation Provider',
    email: 'val.prov@example.com'
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider.id || provider._id });
  const convId = convRes.body.conversation._id;

  // Empty string
  const emptyRes = await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: '   ' });
  assert.equal(emptyRes.status, 400);
  assert.match(emptyRes.body.error, /cannot be empty/i);

  // Excessively long message (> 2000 chars)
  const longText = 'A'.repeat(2001);
  const longRes = await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: longText });
  assert.equal(longRes.status, 400);
  assert.match(longRes.body.error, /cannot exceed 2000 characters/i);
});

// =========================================================================
// 6. SENDER IDENTITY IS TAKEN FROM AUTHENTICATION
// =========================================================================
test('6. Sender identity is taken from authentication', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Genuine Customer',
    email: 'genuine.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { user: provider } = await registerProvider({
    name: 'Target Provider',
    email: 'target.prov@example.com'
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider.id || provider._id });
  const convId = convRes.body.conversation._id;

  // Attempt to spoof sender by passing arbitrary sender in body
  const sendRes = await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      text: 'Hello technician, when can you arrive?',
      sender: provider.id || provider._id // Spoofed!
    });

  assert.equal(sendRes.status, 201);
  const savedMsg = sendRes.body.message;

  // Server must strictly set sender to the authenticated customer
  assert.equal(String(savedMsg.sender._id || savedMsg.sender), String(customer.id || customer._id));
});

// =========================================================================
// 7. MESSAGES PERSIST AND RELOAD AFTER REFRESH
// =========================================================================
test('7. Messages persist and reload after refresh', async () => {
  const { token: custToken } = await registerUser({
    name: 'Persistent Customer',
    email: 'pers.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { user: provider } = await registerProvider({
    name: 'Persistent Provider',
    email: 'pers.prov@example.com'
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider.id || provider._id });
  const convId = convRes.body.conversation._id;

  // Post message 1
  await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Persistent test message 1' });

  // Post message 2
  await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Persistent test message 2' });

  // Simulate refresh by fetching afresh from database
  const historyRes = await request(app)
    .get(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${custToken}`);

  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body.messages.length, 2);
  assert.equal(historyRes.body.messages[0].text, 'Persistent test message 1');
  assert.equal(historyRes.body.messages[1].text, 'Persistent test message 2');
});

// =========================================================================
// 8. UNREAD COUNTS AND READ STATE BEHAVE CORRECTLY
// =========================================================================
test('8. Unread counts and read state behave correctly', async () => {
  const { token: custToken } = await registerUser({
    name: 'Sender Customer',
    email: 'send.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerProvider({
    name: 'Recipient Provider',
    email: 'recip.prov@example.com'
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider.id || provider._id });
  const convId = convRes.body.conversation._id;

  // Customer sends message
  await request(app)
    .post(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Are you available tomorrow?' });

  // Provider checks unread count: should be 1
  const unreadRes = await request(app)
    .get('/api/conversations/unread-count')
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(unreadRes.status, 200);
  assert.equal(unreadRes.body.unreadCount, 1);

  // Provider marks messages as read
  const markReadRes = await request(app)
    .patch(`/api/conversations/${convId}/read`)
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(markReadRes.status, 200);
  assert.equal(markReadRes.body.success, true);

  // Provider checks unread count again: should be 0
  const afterReadRes = await request(app)
    .get('/api/conversations/unread-count')
    .set('Authorization', `Bearer ${provToken}`);
  assert.equal(afterReadRes.status, 200);
  assert.equal(afterReadRes.body.unreadCount, 0);
});

// =========================================================================
// 9. UNAUTHORIZED USERS CANNOT ACCESS MESSAGE HISTORY
// =========================================================================
test('9. Unauthorized users cannot access message history', async () => {
  const { token: custToken } = await registerUser({
    name: 'Chat User',
    email: 'chat.user@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { user: provider } = await registerProvider({
    name: 'Chat Provider',
    email: 'chat.prov@example.com'
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider.id || provider._id });
  const convId = convRes.body.conversation._id;

  // A. Unauthenticated request rejected with 401
  const unauthRes = await request(app).get(`/api/conversations/${convId}/messages`);
  assert.equal(unauthRes.status, 401);

  // B. Random user rejected with 403
  const { token: otherToken } = await registerUser({
    name: 'Other Random User',
    email: 'other.random@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const forbiddenRes = await request(app)
    .get(`/api/conversations/${convId}/messages`)
    .set('Authorization', `Bearer ${otherToken}`);
  assert.equal(forbiddenRes.status, 403);
});

// =========================================================================
// 10. INVALID LATITUDE/LONGITUDE VALUES ARE REJECTED
// =========================================================================
test('10. Invalid latitude/longitude values are rejected', async () => {
  const { token: provToken } = await registerProvider({
    name: 'Geo Provider',
    email: 'geo.prov@example.com'
  });

  // Invalid latitude (> 90)
  const invLatRes = await request(app)
    .patch('/api/users/me')
    .set('Authorization', `Bearer ${provToken}`)
    .send({
      providerDetails: {
        location: {
          latitude: 95.5,
          longitude: 74.58
        }
      }
    });
  assert.equal(invLatRes.status, 400);
  assert.match(invLatRes.body.error, /latitude/i);

  // Invalid longitude (> 180)
  const invLngRes = await request(app)
    .patch('/api/users/me')
    .set('Authorization', `Bearer ${provToken}`)
    .send({
      providerDetails: {
        location: {
          latitude: 16.85,
          longitude: 195.0
        }
      }
    });
  assert.equal(invLngRes.status, 400);
  assert.match(invLngRes.body.error, /longitude/i);

  // Valid coordinates succeed
  const validRes = await request(app)
    .patch('/api/users/me')
    .set('Authorization', `Bearer ${provToken}`)
    .send({
      providerDetails: {
        location: {
          latitude: 16.8524,
          longitude: 74.5815,
          address: 'Vishrambag Chowk, Sangli'
        }
      }
    });
  assert.equal(validRes.status, 200);
  assert.equal(validRes.body.user.providerDetails.location.latitude, 16.8524);
  assert.equal(validRes.body.user.providerDetails.location.longitude, 74.5815);
});

// =========================================================================
// 11. PROVIDERS WITHOUT COORDINATES DO NOT RECEIVE FABRICATED MARKERS
// =========================================================================
test('11. Providers without coordinates do not receive fabricated markers', async () => {
  await registerProvider({
    name: 'No GPS Provider',
    email: 'nogps.prov@example.com'
  });

  const listRes = await request(app)
    .get('/api/providers?city=sangli');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body.providers.length, 1);

  const provider = listRes.body.providers[0];
  // Coordinates must NOT be fabricated or defaulted to random values
  assert.equal(provider.location?.latitude ?? null, null);
  assert.equal(provider.location?.longitude ?? null, null);
});

// =========================================================================
// 12. MAP FILTERING RESPECTS THE SELECTED CITY AND CATEGORY
// =========================================================================
test('12. Map filtering respects the selected city and category', async () => {
  // Provider 1: Sangli + Plumbing
  const { token: p1Token } = await registerProvider({
    name: 'Sangli Plumber',
    email: 'sangli.plumber@example.com',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag'
    }
  });
  await request(app).patch('/api/users/me').set('Authorization', `Bearer ${p1Token}`).send({
    providerDetails: { location: { latitude: 16.85, longitude: 74.58 } }
  });

  // Provider 2: Sangli + Electrical
  const { token: p2Token } = await registerProvider({
    name: 'Sangli Electrician',
    email: 'sangli.electrician@example.com',
    city: 'sangli',
    providerDetails: {
      category: 'Electrical Repairs',
      serviceArea: 'Gaonbhag'
    }
  });
  await request(app).patch('/api/users/me').set('Authorization', `Bearer ${p2Token}`).send({
    providerDetails: { location: { latitude: 16.86, longitude: 74.59 } }
  });

  // Provider 3: Mumbai + Plumbing
  const { token: p3Token } = await registerProvider({
    name: 'Mumbai Plumber',
    email: 'mumbai.plumber@example.com',
    city: 'mumbai',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Bandra'
    }
  });
  await request(app).patch('/api/users/me').set('Authorization', `Bearer ${p3Token}`).send({
    providerDetails: { location: { latitude: 19.07, longitude: 72.87 } }
  });

  // Query Sangli with Plumbing
  const sangliPlumbingRes = await request(app)
    .get('/api/providers?city=sangli&category=plumbing');
  assert.equal(sangliPlumbingRes.status, 200);
  assert.equal(sangliPlumbingRes.body.providers.length, 1);
  assert.equal(sangliPlumbingRes.body.providers[0].name, 'Sangli Plumber');

  // Query Sangli with Electrical
  const sangliElectricRes = await request(app)
    .get('/api/providers?city=sangli&category=electrical-services');
  assert.equal(sangliElectricRes.status, 200);
  assert.equal(sangliElectricRes.body.providers.length, 1);
  assert.equal(sangliElectricRes.body.providers[0].name, 'Sangli Electrician');

  // Query Mumbai with Plumbing
  const mumbaiPlumbingRes = await request(app)
    .get('/api/providers?city=mumbai&category=plumbing');
  assert.equal(mumbaiPlumbingRes.status, 200);
  assert.equal(mumbaiPlumbingRes.body.providers.length, 1);
  assert.equal(mumbaiPlumbingRes.body.providers[0].name, 'Mumbai Plumber');
});

// =========================================================================
// 13. BOOKING CREATION SUPPORTS OPTIONAL COORDINATES & POPULATES PROVIDER LOCATION
// =========================================================================
test('13. Booking creation supports optional coordinates & populates provider location', async () => {
  const { token: custToken } = await registerUser({
    name: 'Map Customer',
    email: 'map.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provUser } = await registerProvider({
    name: 'Mapped Provider',
    email: 'mapped.prov@example.com',
    city: 'sangli'
  });

  // Set provider coordinates
  await request(app).patch('/api/users/me').set('Authorization', `Bearer ${provToken}`).send({
    providerDetails: {
      location: { latitude: 16.8524, longitude: 74.5815, address: 'Workshop Chowk, Sangli' }
    }
  });

  // Create booking with customer doorstep coordinates
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provUser._id,
      serviceName: 'Leak Repair',
      city: 'sangli',
      serviceAddress: 'Plot 45, North Shivajinagar, Sangli',
      bookingDate: getTomorrowDateString(),
      bookingTime: '11:00 AM',
      location: {
        latitude: 16.8550,
        longitude: 74.5880
      }
    });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.booking.location.latitude, 16.8550);
  assert.equal(createRes.body.booking.location.longitude, 74.5880);
  assert.equal(createRes.body.booking.provider.providerDetails.location.latitude, 16.8524);

  // Retrieve single booking as customer
  const getRes = await request(app)
    .get(`/api/bookings/${createRes.body.booking._id}`)
    .set('Authorization', `Bearer ${custToken}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.booking.location.latitude, 16.8550);
  assert.equal(getRes.body.booking.provider.providerDetails.location.latitude, 16.8524);
});

// =========================================================================
// 14. AUTHORIZED USERS CAN UPDATE BOOKING LOCATION; UNRELATED USERS FORBIDDEN
// =========================================================================
test('14. Authorized users can update booking location; unrelated users forbidden', async () => {
  const { token: custToken } = await registerUser({
    name: 'Booking Owner',
    email: 'owner.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: otherCustToken } = await registerUser({
    name: 'Unrelated Customer',
    email: 'unrelated.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provUser } = await registerProvider({
    name: 'Assigned Tech',
    email: 'assigned.tech@example.com',
    city: 'sangli'
  });

  // Create booking initially without coordinates
  const createRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${custToken}`)
    .send({
      providerId: provUser._id,
      serviceName: 'Leak Repair',
      city: 'sangli',
      serviceAddress: 'Civil Lines, Sangli',
      bookingDate: getTomorrowDateString(),
      bookingTime: '02:00 PM'
    });
  assert.equal(createRes.status, 201);
  const bookingId = createRes.body.booking._id;

  // Unrelated customer cannot update location (403)
  const forbiddenRes = await request(app)
    .patch(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${otherCustToken}`)
    .send({ latitude: 16.86, longitude: 74.59 });
  assert.equal(forbiddenRes.status, 403);

  // Invalid coordinates rejected with 400
  const invalidRes = await request(app)
    .patch(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ latitude: 120.0, longitude: 74.59 });
  assert.equal(invalidRes.status, 400);

  // Assigned provider can update booking location (e.g. pinned on arrival)
  const providerUpdateRes = await request(app)
    .patch(`/api/bookings/${bookingId}/location`)
    .set('Authorization', `Bearer ${provToken}`)
    .send({ latitude: 16.8540, longitude: 74.5820 });
  assert.equal(providerUpdateRes.status, 200);
  assert.equal(providerUpdateRes.body.booking.location.latitude, 16.8540);
  assert.equal(providerUpdateRes.body.booking.location.longitude, 74.5820);
});

