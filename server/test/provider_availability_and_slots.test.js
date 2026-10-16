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
import { initSocket } from '../src/socket/index.js';
import {
  STANDARD_TIME_SLOTS,
  getKolkataNow,
  parseSlotTimes,
  validateBookingSlot,
  getAvailableSlotsForDate
} from '../src/utils/dateTime.js';

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
});

// Helper: Register customer
const registerCustomer = async (data = {}) => {
  const payload = {
    name: 'Customer Test',
    email: `cust_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
    password: 'Password123',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '+91 9822100001',
    ...data
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  assert.equal(res.status, 201, `Customer register failed: ${JSON.stringify(res.body)}`);
  return { res, token: res.body.token, user: res.body.user };
};

// Helper: Register provider
const registerProvider = async (data = {}) => {
  const providerDetails = {
    category: 'electrician',
    title: 'Expert Electrician',
    serviceArea: 'Central Sangli',
    servicesOffered: ['Wiring', 'Switch Repair'],
    experienceYears: 5,
    hourlyRate: 350,
    startingPrice: 200,
    isAvailable: true,
    ...(data.providerDetails || {})
  };

  const payload = {
    name: 'Provider Test',
    email: `prov_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
    password: 'Password123',
    role: 'provider',
    city: 'sangli',
    phoneNumber: '+91 9822100002',
    ...data,
    providerDetails
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  assert.equal(res.status, 201, `Provider register failed: ${JSON.stringify(res.body)}`);
  if (res.body.user) {
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

// Helper: Date string generator for tomorrow (YYYY-MM-DD in Asia/Kolkata)
const getTomorrowKolkataString = () => {
  const kolkataNow = getKolkataNow();
  const d = new Date(Date.UTC(kolkataNow.year, kolkataNow.month - 1, kolkataNow.day + 1));
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Date string generator for yesterday (YYYY-MM-DD in Asia/Kolkata)
const getYesterdayKolkataString = () => {
  const kolkataNow = getKolkataNow();
  const d = new Date(Date.UTC(kolkataNow.year, kolkataNow.month - 1, kolkataNow.day - 1));
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// =========================================================================
// SUITE 1: UNIT TESTS FOR DATE & TIME UTILITIES (Asia/Kolkata)
// =========================================================================
test('Suite 1: dateTime utilities', async (t) => {
  await t.test('1.1 getKolkataNow returns valid date and time parts', () => {
    const kn = getKolkataNow();
    assert.ok(kn.year >= 2024, 'Year must be current or future');
    assert.ok(kn.month >= 1 && kn.month <= 12, 'Month between 1 and 12');
    assert.ok(kn.day >= 1 && kn.day <= 31, 'Day between 1 and 31');
    assert.ok(kn.hour >= 0 && kn.hour <= 23, 'Hour between 0 and 23');
    assert.ok(kn.minute >= 0 && kn.minute <= 59, 'Minute between 0 and 59');
    assert.match(kn.dateStr, /^\d{4}-\d{2}-\d{2}$/, 'dateStr format YYYY-MM-DD');
  });

  await t.test('1.2 parseSlotTimes correctly extracts 24-hr start and end times', () => {
    const slot1 = parseSlotTimes('09:00 AM - 10:00 AM');
    assert.equal(slot1.startMinutes, 9 * 60);
    assert.equal(slot1.endMinutes, 10 * 60);

    const slot2 = parseSlotTimes('12:00 PM - 01:00 PM');
    assert.equal(slot2.startMinutes, 12 * 60);
    assert.equal(slot2.endMinutes, 13 * 60);

    const slot3 = parseSlotTimes('04:00 PM - 05:00 PM');
    assert.equal(slot3.startMinutes, 16 * 60);
    assert.equal(slot3.endMinutes, 17 * 60);
  });

  await t.test('1.3 validateBookingSlot rejects past dates and invalid formats', () => {
    const yesterday = getYesterdayKolkataString();
    const resPast = validateBookingSlot(yesterday, '10:00 AM - 11:00 AM');
    assert.equal(resPast.isValid, false);
    assert.match(resPast.reason, /past/i);

    const resInvalidSlot = validateBookingSlot(getTomorrowKolkataString(), 'Invalid Time Slot');
    assert.equal(resInvalidSlot.isValid, false);
    assert.match(resInvalidSlot.reason, /time|operating/i);
  });

  await t.test('1.4 validateBookingSlot rejects slots on today whose start time is in the past', () => {
    const kn = getKolkataNow();
    // Simulate a time at 14:30 (2:30 PM)
    const simulatedNow = {
      ...kn,
      hour: 14,
      minute: 30
    };

    // 09:00 AM - 10:00 AM on today (starts at 540 min, simulated now is 870 min)
    const resPastSlotToday = validateBookingSlot(kn.dateStr, '09:00 AM - 10:00 AM', simulatedNow);
    assert.equal(resPastSlotToday.isValid, false);
    assert.match(resPastSlotToday.reason, /already started or ended/i);

    // 04:00 PM - 05:00 PM on today (starts at 960 min, simulated now is 870 min -> FUTURE)
    const resFutureSlotToday = validateBookingSlot(kn.dateStr, '04:00 PM - 05:00 PM', simulatedNow);
    assert.equal(resFutureSlotToday.isValid, true);
  });

  await t.test('1.5 getAvailableSlotsForDate filters past slots for today and keeps all for future', () => {
    const kn = getKolkataNow();
    // Simulate midday 1:00 PM (13:00)
    const simulatedNow = {
      ...kn,
      hour: 13,
      minute: 0
    };

    const todaySlots = getAvailableSlotsForDate(kn.dateStr, simulatedNow);
    // Morning slots (9-10, 10-11, 11-12, 12-1) should NOT be in available list
    assert.ok(!todaySlots.includes('09:00 AM - 10:00 AM'));
    assert.ok(!todaySlots.includes('10:00 AM - 11:00 AM'));
    assert.ok(!todaySlots.includes('11:00 AM - 12:00 PM'));
    assert.ok(!todaySlots.includes('12:00 PM - 01:00 PM'));
    // Afternoon slots (1-2, 2-3, 3-4, 4-5, 5-6, 6-7) should be present
    assert.ok(todaySlots.includes('02:00 PM - 03:00 PM'));
    assert.ok(todaySlots.includes('04:00 PM - 05:00 PM'));

    // Future date should have all 9 slots
    const futureSlots = getAvailableSlotsForDate(getTomorrowKolkataString(), simulatedNow);
    assert.equal(futureSlots.length, STANDARD_TIME_SLOTS.length);
  });
});

// =========================================================================
// SUITE 2: PROVIDER AVAILABILITY TOGGLE & PERSISTENCE
// =========================================================================
test('Suite 2: Provider Availability Toggle & Persistence', async (t) => {
  await t.test('2.1 Provider can toggle availability to false and persist to MongoDB', async () => {
    const { token, user: provider } = await registerProvider({
      name: 'Ramesh Electricals',
      providerDetails: { isAvailable: true }
    });

    // Toggle to false
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        providerDetails: {
          isAvailable: false
        }
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.providerDetails.isAvailable, false);

    // Verify in MongoDB directly
    const dbUser = await User.findById(provider._id);
    assert.equal(dbUser.providerDetails.isAvailable, false);
  });

  await t.test('2.2 Provider can toggle availability back to true', async () => {
    const { token, user: provider } = await registerProvider({
      name: 'Ganesh Repairs',
      providerDetails: { isAvailable: false }
    });

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        providerDetails: {
          isAvailable: true
        }
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.providerDetails.isAvailable, true);

    const dbUser = await User.findById(provider._id);
    assert.equal(dbUser.providerDetails.isAvailable, true);
  });

  await t.test('2.3 Provider updating service via /api/providers/my-services updates availability', async () => {
    const { token, user: provider } = await registerProvider({
      name: 'Anil Carpenter',
      providerDetails: { isAvailable: true }
    });

    const res = await request(app)
      .put('/api/providers/my-services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        hourlyRate: 550,
        isAvailable: false
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.isAvailable, false);

    const dbUser = await User.findById(provider._id);
    assert.equal(dbUser.providerDetails.isAvailable, false);
  });

  await t.test('2.4 Customer cannot update provider availability via provider route', async () => {
    const { token } = await registerCustomer({
      name: 'Pooja Customer'
    });

    const res = await request(app)
      .put('/api/providers/my-services')
      .set('Authorization', `Bearer ${token}`)
      .send({
        isAvailable: false
      });

    assert.equal(res.status, 403);
  });
});

// =========================================================================
// SUITE 3: REAL-TIME AVAILABILITY NOTIFICATION (Socket.IO)
// =========================================================================
test('Suite 3: Real-Time Availability Notification (Socket.IO)', async (t) => {
  await t.test('3.1 Socket emits provider_availability_changed when provider toggles availability', async () => {
    const { token, user: provider } = await registerProvider({
      name: 'Vikram Socket',
      providerDetails: { isAvailable: true }
    });

    const clientSocket = Client(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false
    });

    await new Promise((resolve) => clientSocket.on('connect', resolve));

    const eventPromise = new Promise((resolve) => {
      clientSocket.on('provider_availability_changed', (data) => {
        resolve(data);
      });
    });

    await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        providerDetails: {
          isAvailable: false
        }
      });

    const eventData = await eventPromise;
    assert.equal(String(eventData.providerId), String(provider._id));
    assert.equal(eventData.isAvailable, false);
    assert.ok(eventData.updatedAt);

    clientSocket.disconnect();
  });
});

// =========================================================================
// SUITE 4: DISCOVERY & FILTERING BY AVAILABILITY
// =========================================================================
test('Suite 4: Discovery & Filtering by Availability', async (t) => {
  await t.test('4.1 GET /api/providers?available=true excludes offline providers', async () => {
    await registerProvider({
      name: 'Sunil Online Provider',
      providerDetails: { isAvailable: true }
    });

    await registerProvider({
      name: 'Mohan Offline Provider',
      providerDetails: { isAvailable: false }
    });

    // Query with available=true
    const resAvail = await request(app).get('/api/providers?available=true&city=sangli');
    assert.equal(resAvail.status, 200);
    const availableProviders = resAvail.body.providers;
    assert.ok(availableProviders.some((p) => p.name === 'Sunil Online Provider'));
    assert.ok(!availableProviders.some((p) => p.name === 'Mohan Offline Provider'));

    // Query all providers
    const resAll = await request(app).get('/api/providers?city=sangli');
    assert.equal(resAll.status, 200);
    assert.ok(resAll.body.providers.some((p) => p.name === 'Sunil Online Provider'));
    assert.ok(resAll.body.providers.some((p) => p.name === 'Mohan Offline Provider'));
  });
});

// =========================================================================
// SUITE 5: BOOKING VALIDATION & OFFLINE ENFORCEMENT
// =========================================================================
test('Suite 5: Booking Validation & Offline Enforcement', async (t) => {
  await t.test('5.1 Booking an offline provider is rejected with HTTP 400', async () => {
    const { user: provider } = await registerProvider({
      name: 'Offline Specialist',
      providerDetails: { isAvailable: false }
    });

    const { token: custToken } = await registerCustomer({
      name: 'Kavita Customer'
    });

    const tomorrow = getTomorrowKolkataString();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        providerId: provider._id,
        serviceName: 'Electrical Wiring',
        city: 'sangli',
        serviceAddress: '123 Sangli Road, Sangli',
        bookingDate: tomorrow,
        bookingTime: '10:00 AM - 11:00 AM'
      });

    assert.equal(res.status, 400);
    const errMsg = res.body.error || res.body.message;
    assert.match(errMsg, /offline|not currently accepting/i);
  });

  await t.test('5.2 Booking with past date is rejected with HTTP 400', async () => {
    const { user: provider } = await registerProvider({
      name: 'Available Specialist',
      providerDetails: { isAvailable: true }
    });

    const { token: custToken } = await registerCustomer({
      name: 'Ajay Customer'
    });

    const yesterday = getYesterdayKolkataString();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        providerId: provider._id,
        serviceName: 'Electrical Wiring',
        city: 'sangli',
        serviceAddress: '123 Sangli Road, Sangli',
        bookingDate: yesterday,
        bookingTime: '10:00 AM - 11:00 AM'
      });

    assert.equal(res.status, 400);
    const errMsg = res.body.error || res.body.message;
    assert.match(errMsg, /past/i);
  });

  await t.test('5.3 Booking valid future date and slot succeeds with HTTP 201', async () => {
    const { user: provider } = await registerProvider({
      name: 'Deepak Electrician',
      providerDetails: { isAvailable: true }
    });

    const { token: custToken } = await registerCustomer({
      name: 'Nitin Customer'
    });

    const tomorrow = getTomorrowKolkataString();
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        providerId: provider._id,
        serviceName: 'Electrical Wiring',
        city: 'sangli',
        serviceAddress: '456 Market Yard, Sangli',
        bookingDate: tomorrow,
        bookingTime: '11:00 AM - 12:00 PM'
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.booking.status, 'pending');
    assert.equal(res.body.booking.bookingDate, tomorrow);
    assert.equal(res.body.booking.bookingTime, '11:00 AM - 12:00 PM');
  });

  await t.test('5.4 Double booking prevention: conflicting accepted booking rejects with HTTP 409', async () => {
    const { user: provider } = await registerProvider({
      name: 'Kiran AC Tech',
      providerDetails: { isAvailable: true }
    });

    const { token: cust1Token, user: cust1 } = await registerCustomer({
      name: 'Client One'
    });

    const { token: cust2Token } = await registerCustomer({
      name: 'Client Two'
    });

    const tomorrow = getTomorrowKolkataString();
    const targetSlot = '02:00 PM - 03:00 PM';

    // Cust1 creates booking and provider accepts it
    const booking1 = await Booking.create({
      customer: cust1._id,
      provider: provider._id,
      serviceName: 'Electrical Wiring',
      serviceCategory: 'electrician',
      city: 'sangli',
      serviceAddress: 'Sangli High St',
      bookingDate: tomorrow,
      bookingTime: targetSlot,
      status: 'accepted',
      totalPrice: 350,
      customerPhone: '+91 9822100011'
    });

    assert.ok(booking1._id);

    // Cust2 tries to book the same slot
    const resConflict = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${cust2Token}`)
      .send({
        providerId: provider._id,
        serviceName: 'Electrical Wiring',
        city: 'sangli',
        serviceAddress: 'Another address',
        bookingDate: tomorrow,
        bookingTime: targetSlot
      });

    assert.equal(resConflict.status, 409);
    const errMsg = resConflict.body.error || resConflict.body.message;
    assert.match(errMsg, /already booked|slot is not available|confirmed appointment/i);
  });

  await t.test('5.5 Existing bookings remain intact when provider switches availability', async () => {
    const { token: provToken, user: provider } = await registerProvider({
      name: 'Vinay Electrician',
      providerDetails: { isAvailable: true }
    });

    const { user: cust } = await registerCustomer({
      name: 'Sneha Customer'
    });

    const tomorrow = getTomorrowKolkataString();

    const existingBooking = await Booking.create({
      customer: cust._id,
      provider: provider._id,
      serviceName: 'Electrical Wiring',
      serviceCategory: 'electrician',
      city: 'sangli',
      serviceAddress: 'Vishrambag, Sangli',
      bookingDate: tomorrow,
      bookingTime: '04:00 PM - 05:00 PM',
      status: 'accepted',
      totalPrice: 350,
      customerPhone: '+91 9822100033'
    });

    // Provider goes offline
    await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${provToken}`)
      .send({
        providerDetails: {
          isAvailable: false
        }
      });

    // Verify existing booking is completely intact
    const checkBooking = await Booking.findById(existingBooking._id);
    assert.equal(checkBooking.status, 'accepted');
    assert.equal(checkBooking.bookingDate, tomorrow);
    assert.equal(checkBooking.bookingTime, '04:00 PM - 05:00 PM');
  });
});
