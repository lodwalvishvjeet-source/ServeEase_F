import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Booking from '../src/models/Booking.js';
import { normalizeCity, SUPPORTED_CITIES } from '../src/config/cities.js';

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'phase14_test_jwt_secret_key_minimum_32_characters_for_serveease';
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

// =========================================================================
// 1. FILTERING: CITY, SERVICE CATEGORY, AND ALIAS NORMALIZATION
// =========================================================================
test('1. City filtering normalizes aliases and confines results to canonical city', async () => {
  const hash = await User.hashPassword('Pass123456');

  await User.create([
    {
      name: 'Mumbai Electrician',
      email: 'mumbai.elec@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'mumbai',
      status: 'active',
      providerDetails: {
        category: 'Electrical Services',
        servicesOffered: ['Switchboard Wiring', 'Fan Installation'],
        startingPrice: 350,
        isAvailable: true,
        isVerified: true,
        experienceYears: 5
      }
    },
    {
      name: 'Pune Electrician',
      email: 'pune.elec@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'pune',
      status: 'active',
      providerDetails: {
        category: 'Electrical Services',
        servicesOffered: ['Switchboard Wiring'],
        startingPrice: 300,
        isAvailable: true,
        isVerified: true,
        experienceYears: 3
      }
    }
  ]);

  // Query using Bombay alias
  const bombayRes = await request(app).get('/api/providers?city=bombay');
  assert.equal(bombayRes.status, 200);
  assert.equal(bombayRes.body.success, true);
  assert.equal(bombayRes.body.city.id, 'mumbai');
  assert.equal(bombayRes.body.count, 1);
  assert.equal(bombayRes.body.providers[0].name, 'Mumbai Electrician');

  // Query using Poona alias
  const poonaRes = await request(app).get('/api/providers?city=poona');
  assert.equal(poonaRes.status, 200);
  assert.equal(poonaRes.body.city.id, 'pune');
  assert.equal(poonaRes.body.count, 1);
  assert.equal(poonaRes.body.providers[0].name, 'Pune Electrician');

  // Unsupported city must return 400 Bad Request
  const invalidCityRes = await request(app).get('/api/providers?city=nashik');
  assert.equal(invalidCityRes.status, 400);
  assert.equal(invalidCityRes.body.success, false);
});

// =========================================================================
// 2. EXCLUSION OF SUSPENDED, INACTIVE, AND NON-PROVIDER ACCOUNTS
// =========================================================================
test('2. Suspended and non-provider accounts are strictly excluded from discovery', async () => {
  const hash = await User.hashPassword('Pass123456');

  await User.create([
    {
      name: 'Active Technician',
      email: 'active@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        servicesOffered: ['Tap Repair'],
        isAvailable: true,
        isVerified: true
      }
    },
    {
      name: 'Suspended Technician',
      email: 'suspended@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'suspended',
      providerDetails: {
        category: 'Plumbing',
        servicesOffered: ['Tap Repair'],
        isAvailable: true
      }
    },
    {
      name: 'Sangli Customer Account',
      email: 'customer@example.com',
      passwordHash: hash,
      role: 'customer',
      city: 'sangli',
      status: 'active'
    },
    {
      name: 'Sangli Admin Account',
      email: 'admin@example.com',
      passwordHash: hash,
      role: 'admin',
      city: 'sangli',
      status: 'active'
    }
  ]);

  const res = await request(app).get('/api/providers?city=sangli');
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.providers[0].name, 'Active Technician');
});

// =========================================================================
// 3. SERVICE CATEGORY AND SERVICE OFFERED FILTERING
// =========================================================================
test('3. Providers who do not offer the selected category or service do not appear', async () => {
  const hash = await User.hashPassword('Pass123456');

  await User.create([
    {
      name: 'Sangli Plumber',
      email: 'plumber@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        title: 'Licensed Plumber',
        servicesOffered: ['Pipe Leakage Repair', 'Drain Cleaning'],
        isAvailable: true,
        isVerified: true
      }
    },
    {
      name: 'Sangli Carpenter',
      email: 'carpenter@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Carpentry',
        title: 'Master Carpenter',
        servicesOffered: ['Furniture Assembly', 'Door Lock Repair'],
        isAvailable: true,
        isVerified: true
      }
    }
  ]);

  // Query Plumbing category
  const plumbRes = await request(app).get('/api/providers?city=sangli&category=plumbing');
  assert.equal(plumbRes.status, 200);
  assert.equal(plumbRes.body.count, 1);
  assert.equal(plumbRes.body.providers[0].name, 'Sangli Plumber');

  // Query keyword search 'Drain'
  const drainRes = await request(app).get('/api/providers?city=sangli&q=Drain');
  assert.equal(drainRes.status, 200);
  assert.equal(drainRes.body.count, 1);
  assert.equal(drainRes.body.providers[0].name, 'Sangli Plumber');

  // Query keyword search 'Lock'
  const lockRes = await request(app).get('/api/providers?city=sangli&q=Lock');
  assert.equal(lockRes.status, 200);
  assert.equal(lockRes.body.count, 1);
  assert.equal(lockRes.body.providers[0].name, 'Sangli Carpenter');

  // Invalid category must return 400
  const invalidCatRes = await request(app).get('/api/providers?city=sangli&category=aerospace');
  assert.equal(invalidCatRes.status, 400);
});

// =========================================================================
// 4. MATCHING FILTERS: AVAILABILITY, VERIFICATION, RATING, PRICE & AREA
// =========================================================================
test('4. Matching filters for availability, verification, rating, price, and service area', async () => {
  const hash = await User.hashPassword('Pass123456');

  await User.create([
    {
      name: 'Elite Verified Tech',
      email: 'elite@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        serviceArea: 'Vishrambag',
        startingPrice: 500,
        isAvailable: true,
        isVerified: true,
        rating: 4.8,
        reviewCount: 15,
        experienceYears: 10
      }
    },
    {
      name: 'Budget Available Tech',
      email: 'budget@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        serviceArea: 'Kupwad',
        startingPrice: 200,
        isAvailable: true,
        isVerified: false,
        rating: 3.5,
        reviewCount: 2,
        experienceYears: 2
      }
    },
    {
      name: 'Busy Unrated Tech',
      email: 'busy@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        serviceArea: 'Gaon Bhag',
        startingPrice: 300,
        isAvailable: false,
        isVerified: false,
        rating: null,
        reviewCount: 0,
        experienceYears: 1
      }
    }
  ]);

  // Available filter
  const availRes = await request(app).get('/api/providers?city=sangli&available=true&verified=all');
  assert.equal(availRes.status, 200);
  assert.equal(availRes.body.count, 2);

  // Verified filter
  const verifiedRes = await request(app).get('/api/providers?city=sangli&verified=true');
  assert.equal(verifiedRes.status, 200);
  assert.equal(verifiedRes.body.count, 1);
  assert.equal(verifiedRes.body.providers[0].name, 'Elite Verified Tech');

  // Min Rating filter (>= 4.0)
  const ratingRes = await request(app).get('/api/providers?city=sangli&minRating=4');
  assert.equal(ratingRes.status, 200);
  assert.equal(ratingRes.body.count, 1);
  assert.equal(ratingRes.body.providers[0].name, 'Elite Verified Tech');

  // Price range filter (minPrice=150, maxPrice=350)
  const priceRes = await request(app).get('/api/providers?city=sangli&minPrice=150&maxPrice=350&verified=all');
  assert.equal(priceRes.status, 200);
  assert.equal(priceRes.body.count, 2);
  const names = priceRes.body.providers.map(p => p.name);
  assert.ok(names.includes('Budget Available Tech'));
  assert.ok(names.includes('Busy Unrated Tech'));

  // Service area filter
  const areaRes = await request(app).get('/api/providers?city=sangli&serviceArea=Vishrambag');
  assert.equal(areaRes.status, 200);
  assert.equal(areaRes.body.count, 1);
  assert.equal(areaRes.body.providers[0].name, 'Elite Verified Tech');

  // Invalid minRating (> 5)
  const badRatingRes = await request(app).get('/api/providers?city=sangli&minRating=6');
  assert.equal(badRatingRes.status, 400);

  // Invalid price range (minPrice > maxPrice)
  const badPriceRes = await request(app).get('/api/providers?city=sangli&minPrice=500&maxPrice=200');
  assert.equal(badPriceRes.status, 400);
});

// =========================================================================
// 5. TRANSPARENT RANKING SCORING AND MATCH REASONS
// =========================================================================
test('5. Recommended sort ranks by verified signals without fabricating ratings or badges', async () => {
  const hash = await User.hashPassword('Pass123456');

  const [topTech, midTech, unratedTech] = await User.create([
    {
      name: 'Top Tech',
      email: 'top@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Electrical Services',
        servicesOffered: ['Complete Home Rewiring'],
        isAvailable: true, // +25
        isVerified: true,  // +20
        rating: 5.0,       // +30
        reviewCount: 10,   // +15
        experienceYears: 12 // +12
        // Expected score: 25 + 20 + 30 + 15 + 12 = 102
      }
    },
    {
      name: 'Mid Tech',
      email: 'mid@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Electrical Services',
        servicesOffered: ['Switchboard Installation'],
        isAvailable: true, // +25
        isVerified: false, // 0
        rating: 4.0,       // +24
        reviewCount: 2,    // +3
        experienceYears: 4  // +4
        // Expected score: 25 + 0 + 24 + 3 + 4 = 56
      }
    },
    {
      name: 'Unrated Inactive Tech',
      email: 'unrated@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Electrical Services',
        servicesOffered: ['Light Bulb Replacement'],
        isAvailable: false, // 0
        isVerified: false,  // 0
        rating: null,       // 0 (Must not fabricate a high score or fake rating)
        reviewCount: 0,     // 0
        experienceYears: 1  // +1
        // Expected score: 1
      }
    }
  ]);

  const res = await request(app).get('/api/providers?city=sangli&sort=recommended&verified=all');
  assert.equal(res.status, 200);
  assert.equal(res.body.count, 3);

  // Highest score first
  assert.equal(res.body.providers[0].name, 'Top Tech');
  assert.ok(res.body.providers[0].matchScore > res.body.providers[1].matchScore);
  assert.equal(res.body.providers[1].name, 'Mid Tech');
  assert.ok(res.body.providers[1].matchScore > res.body.providers[2].matchScore);
  assert.equal(res.body.providers[2].name, 'Unrated Inactive Tech');

  // Verify matchReasons reflect real attributes
  const topReasons = res.body.providers[0].matchReasons;
  assert.ok(topReasons.includes('Available for booking'));
  assert.ok(topReasons.includes('Verified professional'));
  assert.ok(topReasons.some(r => r.includes('Top rated')));
  assert.ok(topReasons.some(r => r.includes('years experience')));

  // Unrated tech does NOT have fake verified or top rated reasons
  const unratedReasons = res.body.providers[2].matchReasons;
  assert.ok(!unratedReasons.includes('Verified professional'));
  assert.ok(!unratedReasons.some(r => r.includes('Top rated')));
  assert.ok(!unratedReasons.includes('Available for booking'));

  // Sensitive credentials excluded
  assert.equal(res.body.providers[0].passwordHash, undefined);
  assert.equal(res.body.providers[0].__v, undefined);
});

// =========================================================================
// 6. PAGINATION AND STABLE DETERMINISTIC SORTING
// =========================================================================
test('6. Pagination splits results accurately with stable tie-breaking', async () => {
  const hash = await User.hashPassword('Pass123456');

  // Create 5 identical providers to test deterministic tie-breaking
  const providerData = [1, 2, 3, 4, 5].map(i => ({
    name: `Provider ${i}`,
    email: `p${i}@example.com`,
    passwordHash: hash,
    role: 'provider',
    city: 'pune',
    status: 'active',
    providerDetails: {
      category: 'Painting',
      startingPrice: 300,
      isAvailable: true,
      isVerified: true,
      experienceYears: 5
    }
  }));

  await User.create(providerData);

  const page1Res = await request(app).get('/api/providers?city=pune&page=1&limit=2');
  assert.equal(page1Res.status, 200);
  assert.equal(page1Res.body.count, 2);
  assert.equal(page1Res.body.total, 5);
  assert.equal(page1Res.body.totalPages, 3);

  const page2Res = await request(app).get('/api/providers?city=pune&page=2&limit=2');
  assert.equal(page2Res.status, 200);
  assert.equal(page2Res.body.count, 2);

  // Ensure no overlap between page 1 and page 2
  const page1Ids = page1Res.body.providers.map(p => p.id);
  const page2Ids = page2Res.body.providers.map(p => p.id);
  assert.ok(!page1Ids.some(id => page2Ids.includes(id)));
});

// =========================================================================
// 7. BOOKING INTEGRATION RE-VALIDATION
// =========================================================================
test('7. Booking revalidates selected provider and service eligibility', async () => {
  const hash = await User.hashPassword('Pass123456');

  const customer = await User.create({
    name: 'Booking Customer',
    email: 'customer.booking@example.com',
    passwordHash: hash,
    role: 'customer',
    city: 'sangli',
    phoneNumber: '9876543210',
    emailVerified: true
  });

  const provider = await User.create({
    name: 'Booking Provider',
    email: 'provider.booking@example.com',
    passwordHash: hash,
    role: 'provider',
    city: 'sangli',
    phoneNumber: '9876543211',
    status: 'active',
    providerDetails: {
      category: 'Plumbing',
      servicesOffered: ['Pipe Leakage Repair'],
      startingPrice: 250,
      isAvailable: true,
      isVerified: true
    }
  });

  // Login as customer
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'customer.booking@example.com', password: 'Pass123456' });
  const token = loginRes.body.token;

  // 1. Valid booking for offered service succeeds
  const validBookingRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      providerId: String(provider._id),
      serviceName: 'Pipe Leakage Repair',
      city: 'sangli',
      serviceAddress: '123 Market Road, Sangli',
      bookingDate: '2026-10-25',
      bookingTime: '10:00 AM'
    });
  assert.equal(validBookingRes.status, 201);
  assert.equal(validBookingRes.body.success, true);
  assert.equal(validBookingRes.body.booking.status, 'pending');

  // 2. Booking for unoffered service is strictly rejected
  const invalidServiceRes = await request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send({
      providerId: String(provider._id),
      serviceName: 'Automobile Transmission Repair',
      city: 'sangli',
      serviceAddress: '123 Market Road, Sangli',
      bookingDate: '2026-10-25',
      bookingTime: '11:00 AM'
    });
  assert.equal(invalidServiceRes.status, 400);
  assert.equal(invalidServiceRes.body.success, false);
});
