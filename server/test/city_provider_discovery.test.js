import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { normalizeCity, isValidCity, SUPPORTED_CITIES, getCityDisplayName } from '../src/config/cities.js';
import { seedDemoProviders } from '../src/scripts/seedDemoProviders.js';

let mongoServer;

test.before(async () => {
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
});

// =========================================================================
// 1. CITY NORMALIZATION & CONFIGURATION TESTS
// =========================================================================
test('City normalization recognizes all five canonical cities and supported aliases', () => {
  // Sangli
  assert.equal(normalizeCity('Sangli'), 'sangli');
  assert.equal(normalizeCity('sangli'), 'sangli');
  assert.equal(normalizeCity('SANGLI'), 'sangli');
  assert.equal(normalizeCity('Sangli-Miraj'), 'sangli');

  // Chhatrapati Sambhajinagar & aliases
  assert.equal(normalizeCity('Chhatrapati Sambhajinagar'), 'chhatrapati-sambhajinagar');
  assert.equal(normalizeCity('chhatrapati-sambhajinagar'), 'chhatrapati-sambhajinagar');
  assert.equal(normalizeCity('Sambhajinagar'), 'chhatrapati-sambhajinagar');
  assert.equal(normalizeCity('sambhajinagar'), 'chhatrapati-sambhajinagar');
  assert.equal(normalizeCity('Aurangabad'), 'chhatrapati-sambhajinagar');
  assert.equal(normalizeCity('aurangabad'), 'chhatrapati-sambhajinagar');

  // Mumbai & aliases
  assert.equal(normalizeCity('Mumbai'), 'mumbai');
  assert.equal(normalizeCity('mumbai'), 'mumbai');
  assert.equal(normalizeCity('MUMBAI'), 'mumbai');
  assert.equal(normalizeCity('Bombay'), 'mumbai');
  assert.equal(normalizeCity('bombay'), 'mumbai');
  assert.equal(normalizeCity('Navi Mumbai'), 'mumbai');
  assert.equal(normalizeCity('Thane'), 'mumbai');

  // Pune & aliases
  assert.equal(normalizeCity('Pune'), 'pune');
  assert.equal(normalizeCity('pune'), 'pune');
  assert.equal(normalizeCity('PUNE'), 'pune');
  assert.equal(normalizeCity('Poona'), 'pune');
  assert.equal(normalizeCity('poona'), 'pune');
  assert.equal(normalizeCity('Pimpri-Chinchwad'), 'pune');
  assert.equal(normalizeCity('pcmc'), 'pune');

  // Nagpur & aliases
  assert.equal(normalizeCity('Nagpur'), 'nagpur');
  assert.equal(normalizeCity('nagpur'), 'nagpur');
  assert.equal(normalizeCity('NAGPUR'), 'nagpur');
  assert.equal(normalizeCity('Orange City'), 'nagpur');

  // Unsupported cities must return null
  assert.equal(normalizeCity('Nashik'), null, 'Unsupported cities must normalize to null');
  assert.equal(normalizeCity('Delhi'), null);
  assert.equal(normalizeCity('Bengaluru'), null);
  assert.equal(normalizeCity('Kolhapur'), null);
  assert.equal(normalizeCity(''), null);
  assert.equal(normalizeCity(null), null);
});

test('City display name formatting returns proper UI strings for all cities', () => {
  assert.equal(getCityDisplayName('sangli'), 'Sangli');
  assert.equal(getCityDisplayName('chhatrapati-sambhajinagar'), 'Chhatrapati Sambhajinagar');
  assert.equal(getCityDisplayName('sambhajinagar'), 'Chhatrapati Sambhajinagar');
  assert.equal(getCityDisplayName('mumbai'), 'Mumbai');
  assert.equal(getCityDisplayName('pune'), 'Pune');
  assert.equal(getCityDisplayName('nagpur'), 'Nagpur');
});

// =========================================================================
// 2. REGISTRATION WITH CITY VALIDATION ACROSS FIVE CITIES
// =========================================================================
test('Customer can register in Sangli and city persists as canonical value', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Sangli Customer',
      email: 'customer.sangli@example.com',
      password: 'SecurePassword123',
      role: 'customer',
      city: 'Sangli',
      phoneNumber: '+91 9822011111'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.city, 'sangli');
  assert.equal(res.body.user.cityName, 'Sangli');

  // Verify in MongoDB
  const inDb = await User.findOne({ email: 'customer.sangli@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.city, 'sangli');
  assert.equal(inDb.role, 'customer');
});

test('Customer can register in Chhatrapati Sambhajinagar using alias "Sambhajinagar"', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Sambhajinagar Customer',
      email: 'customer.csn@example.com',
      password: 'SecurePassword123',
      role: 'customer',
      city: 'Sambhajinagar',
      phoneNumber: '+91 9822022222'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.city, 'chhatrapati-sambhajinagar');
  assert.equal(res.body.user.cityName, 'Chhatrapati Sambhajinagar');

  const inDb = await User.findOne({ email: 'customer.csn@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.city, 'chhatrapati-sambhajinagar');
});

test('Customer can register in Mumbai using alias "Bombay"', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Mumbai Customer',
      email: 'customer.mumbai@example.com',
      password: 'SecurePassword123',
      role: 'customer',
      city: 'Bombay',
      phoneNumber: '+91 9822033333'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.city, 'mumbai');
  assert.equal(res.body.user.cityName, 'Mumbai');

  const inDb = await User.findOne({ email: 'customer.mumbai@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.city, 'mumbai');
});

test('Customer can register in Pune using alias "Poona"', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Pune Customer',
      email: 'customer.pune@example.com',
      password: 'SecurePassword123',
      role: 'customer',
      city: 'Poona',
      phoneNumber: '+91 9822044444'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.city, 'pune');
  assert.equal(res.body.user.cityName, 'Pune');

  const inDb = await User.findOne({ email: 'customer.pune@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.city, 'pune');
});

test('Customer can register in Nagpur', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Nagpur Customer',
      email: 'customer.nagpur@example.com',
      password: 'SecurePassword123',
      role: 'customer',
      city: 'Nagpur',
      phoneNumber: '+91 9822055555'
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.city, 'nagpur');
  assert.equal(res.body.user.cityName, 'Nagpur');

  const inDb = await User.findOne({ email: 'customer.nagpur@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.city, 'nagpur');
});

test('Registration rejects missing city with a clear validation error', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'No City Customer',
      email: 'nocity@example.com',
      password: 'SecurePassword123',
      role: 'customer'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Please select your city'));
});

test('Registration rejects unsupported city (e.g. Nashik, Delhi) with 400 Bad Request', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Nashik Customer',
      email: 'nashik@example.com',
      password: 'SecurePassword123',
      role: 'customer',
      city: 'Nashik'
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Invalid city selected'));
});

test('Provider can register in Pune with trade, services, area, and availability', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Kothrud Electricals',
      email: 'kothrud.elec@example.com',
      password: 'SecurePassword123',
      role: 'provider',
      city: 'Pune',
      phoneNumber: '+91 9822066666',
      providerDetails: {
        category: 'Electrical repairs',
        experienceYears: 8,
        city: 'pune',
        serviceArea: 'Kothrud & Karve Nagar',
        servicesOffered: 'Wiring, MCB repairs, appliance installation',
        startingPrice: 400,
        isAvailable: true
      }
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.role, 'provider');
  assert.equal(res.body.user.city, 'pune');
  assert.equal(res.body.user.providerDetails.category, 'Electrical repairs');
  assert.equal(res.body.user.providerDetails.isAvailable, true);
  assert.equal(res.body.user.providerDetails.isVerified, false, 'Provider cannot self-verify');

  // Verify in MongoDB
  const inDb = await User.findOne({ email: 'kothrud.elec@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.city, 'pune');
  assert.equal(inDb.providerDetails.category, 'Electrical repairs');
  assert.equal(inDb.providerDetails.isVerified, false);
  assert.equal(inDb.providerDetails.serviceArea, 'Kothrud & Karve Nagar');
});

// =========================================================================
// 3. PROVIDER DISCOVERY API (GET /api/providers)
// =========================================================================
test('GET /api/providers requires a valid city parameter and rejects invalid cities', async () => {
  const noCityRes = await request(app).get('/api/providers');
  assert.equal(noCityRes.status, 400);
  assert.ok(noCityRes.body.error.includes('city parameter is required'));

  const invalidCityRes = await request(app).get('/api/providers?city=nashik');
  assert.equal(invalidCityRes.status, 400);
  assert.ok(invalidCityRes.body.error.includes('Invalid city'));
});

test('GET /api/providers returns only eligible providers for requested canonical city and alias', async () => {
  const hash = await User.hashPassword('Pass123456');
  await User.create([
    {
      name: 'Sangli Electrician',
      email: 'sangli.elec@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Electrical repairs',
        serviceArea: 'Gaonbhag',
        isAvailable: true,
        isVerified: false
      }
    },
    {
      name: 'Mumbai Plumber',
      email: 'mumbai.plumb@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'mumbai',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        serviceArea: 'Andheri West',
        isAvailable: true,
        isVerified: false
      }
    },
    {
      name: 'Pune Carpenter',
      email: 'pune.carp@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'pune',
      status: 'active',
      providerDetails: {
        category: 'Carpentry',
        serviceArea: 'Viman Nagar',
        isAvailable: true,
        isVerified: false
      }
    },
    {
      name: 'Nagpur Painter',
      email: 'nagpur.paint@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'nagpur',
      status: 'active',
      providerDetails: {
        category: 'Painting',
        serviceArea: 'Dharampeth',
        isAvailable: true,
        isVerified: false
      }
    }
  ]);

  // Query Sangli
  const sangliRes = await request(app).get('/api/providers?city=sangli');
  assert.equal(sangliRes.status, 200);
  assert.equal(sangliRes.body.city.id, 'sangli');
  assert.equal(sangliRes.body.count, 1);
  assert.equal(sangliRes.body.providers[0].name, 'Sangli Electrician');

  // Query Mumbai via alias "bombay"
  const mumbaiRes = await request(app).get('/api/providers?city=bombay');
  assert.equal(mumbaiRes.status, 200);
  assert.equal(mumbaiRes.body.city.id, 'mumbai');
  assert.equal(mumbaiRes.body.count, 1);
  assert.equal(mumbaiRes.body.providers[0].name, 'Mumbai Plumber');

  // Query Pune via alias "poona"
  const puneRes = await request(app).get('/api/providers?city=poona');
  assert.equal(puneRes.status, 200);
  assert.equal(puneRes.body.city.id, 'pune');
  assert.equal(puneRes.body.count, 1);
  assert.equal(puneRes.body.providers[0].name, 'Pune Carpenter');

  // Query Nagpur
  const nagpurRes = await request(app).get('/api/providers?city=nagpur');
  assert.equal(nagpurRes.status, 200);
  assert.equal(nagpurRes.body.city.id, 'nagpur');
  assert.equal(nagpurRes.body.count, 1);
  assert.equal(nagpurRes.body.providers[0].name, 'Nagpur Painter');

  // Verify sensitive data is never leaked
  assert.equal(sangliRes.body.providers[0].passwordHash, undefined);
  assert.equal(sangliRes.body.providers[0].__v, undefined);
});

test('Category and availability filters work together with city filtering', async () => {
  const hash = await User.hashPassword('Pass123456');
  await User.create([
    {
      name: 'Available Plumber Sangli',
      email: 'avail.plumb@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        serviceArea: 'Vishrambag',
        isAvailable: true,
        isVerified: false
      }
    },
    {
      name: 'Busy Plumber Sangli',
      email: 'busy.plumb@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        serviceArea: 'Miraj',
        isAvailable: false,
        isVerified: false
      }
    },
    {
      name: 'Available Electrician Sangli',
      email: 'avail.elec@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Electrical repairs',
        serviceArea: 'Kupwad',
        isAvailable: true,
        isVerified: false
      }
    }
  ]);

  // 1. Filter by category only
  const categoryRes = await request(app).get('/api/providers?city=sangli&category=plumber');
  assert.equal(categoryRes.status, 200);
  assert.equal(categoryRes.body.count, 2);

  // 2. Filter by category + availability
  const combinedRes = await request(app).get('/api/providers?city=sangli&category=plumber&available=true');
  assert.equal(combinedRes.status, 200);
  assert.equal(combinedRes.body.count, 1);
  assert.equal(combinedRes.body.providers[0].name, 'Available Plumber Sangli');
  assert.equal(combinedRes.body.providers[0].isAvailable, true);
});

// =========================================================================
// 4. DEMO PROVIDER SEEDER: 60 PROVIDERS ACROSS 5 CITIES, IDEMPOTENCY & PROTECTION
// =========================================================================
test('Seed script creates exactly 60 demo providers (20 Sangli, 8 CSN, 12 Mumbai, 12 Pune, 8 Nagpur) idempotently without touching real records', async () => {
  // Pre-seed a real customer and a real provider to verify protection of existing real records
  const hash = await User.hashPassword('RealPass123456');
  await User.create([
    {
      name: 'Real Existing Customer',
      email: 'real.customer@example.com',
      passwordHash: hash,
      role: 'customer',
      city: 'sangli',
      status: 'active'
    },
    {
      name: 'Real Existing Provider',
      email: 'real.provider@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'mumbai',
      status: 'active',
      providerDetails: {
        category: 'Electrical repairs',
        serviceArea: 'Bandra',
        isAvailable: true,
        isVerified: true,
        isDemo: false
      }
    }
  ]);

  // First run of seeder
  const result1 = await seedDemoProviders();
  assert.equal(result1.success, true);
  assert.equal(result1.sangliCount, 20, 'Sangli must have 20 demo providers');
  assert.equal(result1.csnCount, 8, 'Chhatrapati Sambhajinagar must have 8 demo providers');
  assert.equal(result1.mumbaiCount, 12, 'Mumbai must have 12 demo providers');
  assert.equal(result1.puneCount, 12, 'Pune must have 12 demo providers');
  assert.equal(result1.nagpurCount, 8, 'Nagpur must have 8 demo providers');
  assert.equal(result1.total, 60, 'Total demo providers must be exactly 60');

  const totalDemoInDbAfter1 = await User.countDocuments({ 'providerDetails.isDemo': true });
  assert.equal(totalDemoInDbAfter1, 60);

  // Verify real records are still completely intact
  const realCust = await User.findOne({ email: 'real.customer@example.com' });
  assert.ok(realCust, 'Real customer must not be deleted or modified');
  const realProv = await User.findOne({ email: 'real.provider@example.com' });
  assert.ok(realProv, 'Real provider must not be deleted or modified');
  assert.equal(realProv.providerDetails.isVerified, true);
  assert.equal(realProv.providerDetails.isDemo, false);

  // Second run: must be completely idempotent
  const result2 = await seedDemoProviders();
  assert.equal(result2.success, true);
  assert.equal(result2.total, 60);

  const totalDemoInDbAfter2 = await User.countDocuments({ 'providerDetails.isDemo': true });
  assert.equal(totalDemoInDbAfter2, 60, 'Re-running seed script must not create duplicate providers');

  // Verify demo profiles have proper safeguards: marked isDemo, unverified, no fake ratings/reviews
  const sampleDemo = await User.findOne({ 'providerDetails.isDemo': true });
  assert.equal(sampleDemo.providerDetails.isDemo, true);
  assert.equal(sampleDemo.providerDetails.isVerified, false, 'Demo providers must remain unverified');
  assert.equal(sampleDemo.providerDetails.rating, null, 'Demo providers must not have fabricated ratings');
  assert.equal(sampleDemo.providerDetails.reviewCount, 0, 'Demo providers must not have fabricated reviews');
  assert.ok(['sangli', 'chhatrapati-sambhajinagar', 'mumbai', 'pune', 'nagpur'].includes(sampleDemo.city));

  // Verify city distribution in database matches specifications
  const sangliDbCount = await User.countDocuments({ city: 'sangli', 'providerDetails.isDemo': true });
  const csnDbCount = await User.countDocuments({ city: 'chhatrapati-sambhajinagar', 'providerDetails.isDemo': true });
  const mumbaiDbCount = await User.countDocuments({ city: 'mumbai', 'providerDetails.isDemo': true });
  const puneDbCount = await User.countDocuments({ city: 'pune', 'providerDetails.isDemo': true });
  const nagpurDbCount = await User.countDocuments({ city: 'nagpur', 'providerDetails.isDemo': true });

  assert.equal(sangliDbCount, 20);
  assert.equal(csnDbCount, 8);
  assert.equal(mumbaiDbCount, 12);
  assert.equal(puneDbCount, 12);
  assert.equal(nagpurDbCount, 8);
});
