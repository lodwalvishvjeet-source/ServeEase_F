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
  return { res, token: res.body.token, user: res.body.user, cookie: res.headers['set-cookie'] };
};

const createSocketClient = (token, cookie = null) => {
  return Client(`http://localhost:${serverPort}`, {
    auth: token ? { token } : undefined,
    extraHeaders: cookie ? { Cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie } : undefined,
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true
  });
};

test('1. Customer sends a message via Socket.IO and the SP receives it without refreshing', async () => {
  const { token: custToken, user: customer } = await registerUser({
    name: 'Realtime Customer',
    email: 'rt.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerUser({
    name: 'Realtime Provider',
    email: 'rt.prov@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Leak Repair'],
      startingPrice: 300,
      hourlyRate: 350
    }
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider._id });
  assert.equal(convRes.status, 201);
  const conversationId = convRes.body.conversation._id;

  const custSocket = createSocketClient(custToken);
  const provSocket = createSocketClient(provToken);

  await Promise.all([
    new Promise((resolve) => custSocket.on('connect', resolve)),
    new Promise((resolve) => provSocket.on('connect', resolve))
  ]);

  // Both join conversation
  await new Promise((resolve) => custSocket.emit('join_conversation', { conversationId }, resolve));
  await new Promise((resolve) => provSocket.emit('join_conversation', { conversationId }, resolve));

  // SP listens for incoming message
  const provReceived = [];
  provSocket.on('new_message', (msg) => {
    provReceived.push(msg);
  });

  // Customer sends message
  await new Promise((resolve) => {
    custSocket.emit('send_message', { conversationId, text: 'Hello SP, need leak fixed ASAP' }, (res) => {
      assert.equal(res.success, true);
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(provReceived.length, 1);
  assert.equal(provReceived[0].text, 'Hello SP, need leak fixed ASAP');
  assert.equal(provReceived[0].sender._id.toString(), customer._id.toString());

  custSocket.disconnect();
  provSocket.disconnect();
});

test('2. SP replies and customer receives it without refreshing', async () => {
  const { token: custToken } = await registerUser({
    name: 'Reply Customer',
    email: 'reply.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerUser({
    name: 'Reply Provider',
    email: 'reply.prov@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Leak Repair'],
      startingPrice: 300,
      hourlyRate: 350
    }
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider._id });
  const conversationId = convRes.body.conversation._id;

  const custSocket = createSocketClient(custToken);
  const provSocket = createSocketClient(provToken);

  await Promise.all([
    new Promise((resolve) => custSocket.on('connect', resolve)),
    new Promise((resolve) => provSocket.on('connect', resolve))
  ]);

  await new Promise((resolve) => custSocket.emit('join_conversation', { conversationId }, resolve));
  await new Promise((resolve) => provSocket.emit('join_conversation', { conversationId }, resolve));

  const custReceived = [];
  custSocket.on('new_message', (msg) => {
    custReceived.push(msg);
  });

  // SP replies
  await new Promise((resolve) => {
    provSocket.emit('send_message', { conversationId, text: 'I can arrive tomorrow at 10 AM' }, (res) => {
      assert.equal(res.success, true);
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(custReceived.length, 1);
  assert.equal(custReceived[0].text, 'I can arrive tomorrow at 10 AM');

  custSocket.disconnect();
  provSocket.disconnect();
});

test('3. Messages remain persisted and appear in history after reloading', async () => {
  const { token: custToken } = await registerUser({
    name: 'History Customer',
    email: 'hist.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerUser({
    name: 'History Provider',
    email: 'hist.prov@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Leak Repair'],
      startingPrice: 300,
      hourlyRate: 350
    }
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider._id });
  const conversationId = convRes.body.conversation._id;

  // Post 2 messages via REST/Socket
  await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Persistent message 1' });

  await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${provToken}`)
    .send({ text: 'Persistent message 2' });

  // Simulate reload by fetching message history
  const historyRes = await request(app)
    .get(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`);

  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body.total, 2);
  assert.equal(historyRes.body.messages[0].text, 'Persistent message 1');
  assert.equal(historyRes.body.messages[1].text, 'Persistent message 2');
});

test('4. Delivery works even if recipient was not in conversation room (delivered via personal user channel)', async () => {
  const { token: custToken } = await registerUser({
    name: 'Channel Customer',
    email: 'channel.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerUser({
    name: 'Channel Provider',
    email: 'channel.prov@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Leak Repair'],
      startingPrice: 300,
      hourlyRate: 350
    }
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider._id });
  const conversationId = convRes.body.conversation._id;

  const custSocket = createSocketClient(custToken);
  const provSocket = createSocketClient(provToken);

  await Promise.all([
    new Promise((resolve) => custSocket.on('connect', resolve)),
    new Promise((resolve) => provSocket.on('connect', resolve))
  ]);

  // Customer joins conversation room, BUT SP does NOT join conversation room!
  await new Promise((resolve) => custSocket.emit('join_conversation', { conversationId }, resolve));

  const provReceived = [];
  provSocket.on('new_message', (msg) => {
    provReceived.push(msg);
  });

  // Customer sends message via Socket
  await new Promise((resolve) => {
    custSocket.emit('send_message', { conversationId, text: 'Delivered via user channel even without joining room' }, (res) => {
      assert.equal(res.success, true);
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(provReceived.length, 1);
  assert.equal(provReceived[0].text, 'Delivered via user channel even without joining room');

  // Customer sends message via REST
  await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Delivered via REST to user channel' });

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(provReceived.length, 2);
  assert.equal(provReceived[1].text, 'Delivered via REST to user channel');

  custSocket.disconnect();
  provSocket.disconnect();
});

test('5. Unauthorized users cannot receive another conversation messages', async () => {
  const { token: custToken } = await registerUser({
    name: 'Private Customer',
    email: 'priv.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerUser({
    name: 'Private Provider',
    email: 'priv.prov@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Leak Repair'],
      startingPrice: 300,
      hourlyRate: 350
    }
  });

  const { token: eavesdropperToken } = await registerUser({
    name: 'Eavesdropper',
    email: 'intruder@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider._id });
  const conversationId = convRes.body.conversation._id;

  const custSocket = createSocketClient(custToken);
  const eavesdropperSocket = createSocketClient(eavesdropperToken);

  await Promise.all([
    new Promise((resolve) => custSocket.on('connect', resolve)),
    new Promise((resolve) => eavesdropperSocket.on('connect', resolve))
  ]);

  // Eavesdropper attempts to join conversation room -> must be rejected
  const joinAttemptRes = await new Promise((resolve) => {
    eavesdropperSocket.emit('join_conversation', { conversationId }, resolve);
  });
  assert.equal(joinAttemptRes.success, false);

  const eavesdropperReceived = [];
  eavesdropperSocket.on('new_message', (msg) => {
    eavesdropperReceived.push(msg);
  });

  // Customer sends message
  await request(app)
    .post(`/api/conversations/${conversationId}/messages`)
    .set('Authorization', `Bearer ${custToken}`)
    .send({ text: 'Secret trade discussion' });

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(eavesdropperReceived.length, 0, 'Unauthorized eavesdropper must not receive message');

  custSocket.disconnect();
  eavesdropperSocket.disconnect();
});

test('6. Reconnecting clients can continue messaging without error', async () => {
  const { token: custToken } = await registerUser({
    name: 'Reconnect Customer',
    email: 'recon.cust@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const { token: provToken, user: provider } = await registerUser({
    name: 'Reconnect Provider',
    email: 'recon.prov@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    providerDetails: {
      category: 'Plumbing Services',
      serviceArea: 'Vishrambag',
      servicesOffered: ['Leak Repair'],
      startingPrice: 300,
      hourlyRate: 350
    }
  });

  const convRes = await request(app)
    .post('/api/conversations')
    .set('Authorization', `Bearer ${custToken}`)
    .send({ providerId: provider._id });
  const conversationId = convRes.body.conversation._id;

  let custSocket = createSocketClient(custToken);
  const provSocket = createSocketClient(provToken);

  await Promise.all([
    new Promise((resolve) => custSocket.on('connect', resolve)),
    new Promise((resolve) => provSocket.on('connect', resolve))
  ]);

  await new Promise((resolve) => custSocket.emit('join_conversation', { conversationId }, resolve));
  await new Promise((resolve) => provSocket.emit('join_conversation', { conversationId }, resolve));

  // Disconnect customer
  custSocket.disconnect();

  // Customer reconnects
  custSocket = createSocketClient(custToken);
  await new Promise((resolve) => custSocket.on('connect', resolve));
  await new Promise((resolve) => custSocket.emit('join_conversation', { conversationId }, resolve));

  const provReceived = [];
  provSocket.on('new_message', (msg) => provReceived.push(msg));

  // Customer sends message after reconnection
  await new Promise((resolve) => {
    custSocket.emit('send_message', { conversationId, text: 'Message after reconnection' }, (res) => {
      assert.equal(res.success, true);
      resolve();
    });
  });

  await new Promise((r) => setTimeout(r, 200));
  assert.equal(provReceived.length, 1);
  assert.equal(provReceived[0].text, 'Message after reconnection');

  custSocket.disconnect();
  provSocket.disconnect();
});

test('7. Bearer null or undefined header falls back to cookie authentication safely', async () => {
  const { token: custToken, cookie } = await registerUser({
    name: 'Null Header User',
    email: 'nullhdr@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // Connect socket sending auth: { token: 'null' } but with valid cookie
  const socket = Client(`http://localhost:${serverPort}`, {
    auth: { token: 'null' },
    extraHeaders: { Cookie: Array.isArray(cookie) ? cookie.join('; ') : cookie },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: false
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', (err) => reject(new Error('Connection failed: ' + err.message)));
  });

  assert.equal(socket.connected, true);
  socket.disconnect();
});
