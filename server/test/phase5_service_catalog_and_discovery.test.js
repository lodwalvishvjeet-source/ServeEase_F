import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { SERVICE_CATEGORIES } from '../src/config/categories.js';

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

// Helper: Register user and return token
const registerUser = async (userData) => {
  const res = await request(app).post('/api/auth/register').send(userData);
  return { res, token: res.body.token, user: res.body.user };
};

// =========================================================================
// 1. LISTING SERVICE CATEGORIES
// =========================================================================
test('1. GET /api/providers/categories and /api/services/categories return all 9 canonical service categories with active status', async () => {
  const res1 = await request(app).get('/api/providers/categories');
  assert.equal(res1.status, 200);
  assert.equal(res1.body.success, true);
  assert.equal(res1.body.count, 9);
  assert.equal(res1.body.categories.length, 9);

  const categoryNames = res1.body.categories.map(c => c.name);
  assert.ok(categoryNames.includes('Plumbing'));
  assert.ok(categoryNames.includes('Electrical Services'));
  assert.ok(categoryNames.includes('Carpentry'));
  assert.ok(categoryNames.includes('Home Cleaning'));
  assert.ok(categoryNames.includes('Appliance Repair'));
  assert.ok(categoryNames.includes('Vehicle Mechanic'));
  assert.ok(categoryNames.includes('Driver Services'));
  assert.ok(categoryNames.includes('Painting'));
  assert.ok(categoryNames.includes('Other Home Services'));

  // Each category must have name, description, icon, startingPrice, and active status
  res1.body.categories.forEach(c => {
    assert.ok(c.id, 'Category must have an id');
    assert.ok(c.name, 'Category must have a name');
    assert.ok(c.description, 'Category must have a description');
    assert.ok(c.icon, 'Category must have an icon');
    assert.equal(c.status, 'active');
    assert.ok(typeof c.startingPrice === 'number');
  });

  // Alias endpoint verification
  const res2 = await request(app).get('/api/services/categories');
  assert.equal(res2.status, 200);
  assert.equal(res2.body.count, 9);
});

// =========================================================================
// 2. SEARCHING PROVIDERS BY NAME OR SERVICE
// =========================================================================
test('2. Searching providers by keyword (q) matches technician name, service offering, or specialty', async () => {
  const hash = await User.hashPassword('Pass123456');
  await User.create([
    {
      name: 'Ramesh Geyser Specialist',
      email: 'ramesh.geyser@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Plumbing',
        categorySlug: 'plumbing',
        title: 'Geyser and Solar Line Specialist',
        servicesOffered: ['Solar Water Heater Fitting', 'Concealed Pipe Welding'],
        serviceArea: 'Vishrambag',
        startingPrice: 350,
        experienceYears: 8,
        isAvailable: true
      }
    },
    {
      name: 'Sanjay Shinde',
      email: 'sanjay.shinde@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'sangli',
      status: 'active',
      providerDetails: {
        category: 'Electrical Services',
        categorySlug: 'electrical-services',
        title: 'Licensed Industrial Wireman',
        servicesOffered: ['Inverter Backup Wiring', 'Geyser Power Circuit Setup'],
        serviceArea: 'Gaonbhag',
        startingPrice: 200,
        experienceYears: 5,
        isAvailable: true
      }
    }
  ]);

  // Search by technician name "Ramesh"
  const nameRes = await request(app).get('/api/providers?city=sangli&q=Ramesh');
  assert.equal(nameRes.status, 200);
  assert.equal(nameRes.body.count, 1);
  assert.equal(nameRes.body.providers[0].name, 'Ramesh Geyser Specialist');

  // Search by service offering keyword "Inverter"
  const serviceRes = await request(app).get('/api/providers?city=sangli&q=Inverter');
  assert.equal(serviceRes.status, 200);
  assert.equal(serviceRes.body.count, 1);
  assert.equal(serviceRes.body.providers[0].name, 'Sanjay Shinde');

  // Search by shared keyword "Geyser"
  const sharedRes = await request(app).get('/api/providers?city=sangli&q=Geyser');
  assert.equal(sharedRes.status, 200);
  assert.equal(sharedRes.body.count, 2);
});

// =========================================================================
// 3. CITY-SPECIFIC DISCOVERY
// =========================================================================
test('3. Provider discovery strictly confines results to the requested canonical city', async () => {
  const hash = await User.hashPassword('Pass123456');
  await User.create([
    {
      name: 'Pune Carpenter Master',
      email: 'pune.carpenter@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'pune',
      status: 'active',
      providerDetails: {
        category: 'Carpentry',
        categorySlug: 'carpentry',
        title: 'Furniture Specialist',
        serviceArea: 'Kothrud',
        isAvailable: true
      }
    },
    {
      name: 'Mumbai Driver Pro',
      email: 'mumbai.driver@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'mumbai',
      status: 'active',
      providerDetails: {
        category: 'Driver Services',
        categorySlug: 'driver-services',
        title: 'Highway Chauffeur',
        serviceArea: 'Bandra',
        isAvailable: true
      }
    }
  ]);

  // Query Pune
  const puneRes = await request(app).get('/api/providers?city=pune');
  assert.equal(puneRes.status, 200);
  assert.equal(puneRes.body.city.id, 'pune');
  assert.equal(puneRes.body.count, 1);
  assert.equal(puneRes.body.providers[0].name, 'Pune Carpenter Master');

  // Query Mumbai using alias "Bombay"
  const bombayRes = await request(app).get('/api/providers?city=bombay');
  assert.equal(bombayRes.status, 200);
  assert.equal(bombayRes.body.city.id, 'mumbai');
  assert.equal(bombayRes.body.count, 1);
  assert.equal(bombayRes.body.providers[0].name, 'Mumbai Driver Pro');
});

// =========================================================================
// 4. CATEGORY FILTERING
// =========================================================================
test('4. Category filter returns only providers belonging to the selected category', async () => {
  const hash = await User.hashPassword('Pass123456');
  await User.create([
    {
      name: 'Nagpur House Cleaner',
      email: 'nagpur.clean@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'nagpur',
      status: 'active',
      providerDetails: {
        category: 'Home Cleaning',
        categorySlug: 'home-cleaning',
        title: 'Deep House Cleaning Pro',
        servicesOffered: ['Full House Scrubbing', 'Kitchen Degreasing'],
        serviceArea: 'Dharampeth',
        isAvailable: true
      }
    },
    {
      name: 'Nagpur Wall Painter',
      email: 'nagpur.paint@example.com',
      passwordHash: hash,
      role: 'provider',
      city: 'nagpur',
      status: 'active',
      providerDetails: {
        category: 'Painting',
        categorySlug: 'painting',
        title: 'Texture & Waterproof Painter',
        servicesOffered: ['Damp Proofing', 'Living Room Paint'],
        serviceArea: 'Sitabuldi',
        isAvailable: true
      }
    }
  ]);

  // Query Home Cleaning
  const cleanRes = await request(app).get('/api/providers?city=nagpur&category=home-cleaning');
  assert.equal(cleanRes.status, 200);
  assert.equal(cleanRes.body.count, 1);
  assert.equal(cleanRes.body.providers[0].name, 'Nagpur House Cleaner');

  // Query Painting
  const paintRes = await request(app).get('/api/providers?city=nagpur&category=painting');
  assert.equal(paintRes.status, 200);
  assert.equal(paintRes.body.count, 1);
  assert.equal(paintRes.body.providers[0].name, 'Nagpur Wall Painter');
});

// =========================================================================
// 5. EMPTY RESULTS
// =========================================================================
test('5. Empty results return count: 0 and empty array when no providers match filters', async () => {
  const res = await request(app).get('/api/providers?city=sangli&category=vehicle-mechanic&q=NonExistentQueryXYZ');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 0);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.providers, []);
});

// =========================================================================
// 6. INVALID CITY AND CATEGORY INPUTS
// =========================================================================
test('6. Invalid city and category inputs are rejected with clear HTTP 400 Bad Request', async () => {
  // Missing city
  const noCityRes = await request(app).get('/api/providers');
  assert.equal(noCityRes.status, 400);
  assert.ok(noCityRes.body.error.includes('city parameter is required'));

  // Invalid city (not in 5 supported cities)
  const invalidCityRes = await request(app).get('/api/providers?city=delhi');
  assert.equal(invalidCityRes.status, 400);
  assert.ok(invalidCityRes.body.error.includes('Invalid city'));

  // Invalid category
  const invalidCatRes = await request(app).get('/api/providers?city=sangli&category=spaceships');
  assert.equal(invalidCatRes.status, 400);
  assert.ok(invalidCatRes.body.error.includes('Invalid service category'));
});

// =========================================================================
// 7. PROVIDER CREATING OR EDITING THEIR OWN SERVICE
// =========================================================================
test('7. Authenticated provider can view, add, edit, and configure their own service offerings and rates', async () => {
  const { token } = await registerUser({
    name: 'Sambhaji Electrician',
    email: 'sambhaji.elec@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'chhatrapati-sambhajinagar',
    phoneNumber: '+91 9822100099',
    providerDetails: {
      category: 'Electrical Services',
      categorySlug: 'electrical-services',
      title: 'Residential Electrician',
      servicesOffered: ['MCB Replacement'],
      startingPrice: 199,
      hourlyRate: 250,
      experienceYears: 4,
      serviceArea: 'Cidco & Town Centre',
      isAvailable: true
    }
  });

  // 1. GET /api/providers/my-services
  const getRes = await request(app)
    .get('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(getRes.status, 200);
  assert.deepEqual(getRes.body.services, ['MCB Replacement']);
  assert.equal(getRes.body.startingPrice, 199);

  // 2. POST /api/providers/my-services (Add service)
  const addRes = await request(app)
    .post('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`)
    .send({ service: 'Geyser Power Point Installation' });
  assert.equal(addRes.status, 201);
  assert.ok(addRes.body.services.includes('Geyser Power Point Installation'));

  // 3. PUT /api/providers/my-services/:serviceName (Rename existing service)
  const renameRes = await request(app)
    .put('/api/providers/my-services/MCB%20Replacement')
    .set('Authorization', `Bearer ${token}`)
    .send({ newService: 'High-Capacity MCB Box Replacement' });
  assert.equal(renameRes.status, 200);
  assert.ok(renameRes.body.services.includes('High-Capacity MCB Box Replacement'));
  assert.ok(!renameRes.body.services.includes('MCB Replacement'));

  // 4. PUT /api/providers/my-services (Update rates, experience, area, availability)
  const updateRatesRes = await request(app)
    .put('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`)
    .send({
      startingPrice: 249,
      hourlyRate: 300,
      experienceYears: 5,
      serviceArea: 'Cidco, Cannaught Place & Waluj',
      isAvailable: false
    });
  assert.equal(updateRatesRes.status, 200);
  assert.equal(updateRatesRes.body.startingPrice, 249);
  assert.equal(updateRatesRes.body.hourlyRate, 300);
  assert.equal(updateRatesRes.body.experienceYears, 5);
  assert.equal(updateRatesRes.body.isAvailable, false);

  // 5. DELETE /api/providers/my-services/:serviceName
  const deleteRes = await request(app)
    .delete('/api/providers/my-services/Geyser%20Power%20Point%20Installation')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(deleteRes.status, 200);
  assert.ok(!deleteRes.body.services.includes('Geyser Power Point Installation'));
});

// =========================================================================
// 8. PREVENTING A PROVIDER FROM EDITING ANOTHER PROVIDER'S SERVICES
// =========================================================================
test('8. Provider cannot modify another provider services or profile', async () => {
  const { token: provider1Token, user: provider1 } = await registerUser({
    name: 'Provider One',
    email: 'prov1@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Carpentry',
      serviceArea: 'Kothrud'
    }
  });

  const { token: provider2Token, user: provider2 } = await registerUser({
    name: 'Provider Two',
    email: 'prov2@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Baner'
    }
  });

  assert.ok(provider1Token, 'Provider 1 should have received a token');
  assert.ok(provider2, 'Provider 2 should have been registered');

  // Provider 1 tries to modify Provider 2 via /api/users/:id
  const attackRes = await request(app)
    .patch(`/api/users/${provider2._id}`)
    .set('Authorization', `Bearer ${provider1Token}`)
    .send({ name: 'Hacked Provider Two' });

  assert.equal(attackRes.status, 403);
  assert.ok(attackRes.body.error.includes('not authorized to edit another user'));

  // Provider 2's data remains unmodified
  const p2InDb = await User.findById(provider2._id);
  assert.equal(p2InDb.name, 'Provider Two');
});

// =========================================================================
// 9. PREVENTING CUSTOMERS FROM EDITING PROVIDER SERVICES
// =========================================================================
test('9. Customers and unauthenticated visitors are forbidden from calling service-editing APIs', async () => {
  const { token: customerToken } = await registerUser({
    name: 'Standard Customer',
    email: 'customer.auth@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  // Customer tries to add service
  const addRes = await request(app)
    .post('/api/providers/my-services')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ service: 'Unauthorized Service' });
  assert.equal(addRes.status, 403);

  // Customer tries to update services
  const putRes = await request(app)
    .put('/api/providers/my-services')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ startingPrice: 100 });
  assert.equal(putRes.status, 403);

  // Unauthenticated visitor
  const unauthRes = await request(app)
    .post('/api/providers/my-services')
    .send({ service: 'Ghost Service' });
  assert.equal(unauthRes.status, 401);
});

// =========================================================================
// 10. PROTECTED FIELDS IMMUNITY
// =========================================================================
test('10. Protected fields (role, status, isVerified, passwordHash) cannot be modified via service-editing endpoints', async () => {
  const { token, user } = await registerUser({
    name: 'Tamper Target Provider',
    email: 'tamper@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'mumbai',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Andheri West'
    }
  });

  assert.ok(token, 'Provider should have received a token');
  assert.ok(user, 'Provider should have been created');

  // Attempt privilege escalation to admin and self-verification
  const tamperRes = await request(app)
    .put('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`)
    .send({
      role: 'admin',
      status: 'suspended',
      isVerified: true,
      passwordHash: 'injected_hash',
      startingPrice: 300
    });

  assert.equal(tamperRes.status, 200);

  // Verify in MongoDB that protected fields were NOT modified
  const inDb = await User.findById(user._id).select('+passwordHash');
  assert.equal(inDb.role, 'provider', 'Role must remain provider');
  assert.equal(inDb.status, 'active', 'Status must remain active');
  assert.equal(inDb.providerDetails.isVerified, false, 'isVerified must remain false');
  assert.notEqual(inDb.passwordHash, 'injected_hash', 'Password hash must not be overwritten');
  assert.equal(inDb.providerDetails.startingPrice, 300, 'Permitted startingPrice updated');
});

// =========================================================================
// 11. SENSITIVE FIELDS EXCLUSION (passwordHash never leaked)
// =========================================================================
test('11. Password hash and internal version keys are excluded from all provider discovery responses', async () => {
  const { user } = await registerUser({
    name: 'Clean Response Provider',
    email: 'clean.provider@example.com',
    password: 'SuperSecretPassword123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Carpentry',
      categorySlug: 'carpentry',
      title: 'Wood Artisan',
      serviceArea: 'Hinjawadi',
      isAvailable: true
    }
  });

  assert.ok(user, 'Provider should have been created');

  // Discovery list query
  const listRes = await request(app).get('/api/providers?city=pune');
  assert.equal(listRes.status, 200);
  const found = listRes.body.providers.find(p => p.name === 'Clean Response Provider');
  assert.ok(found);
  assert.equal(found.passwordHash, undefined);
  assert.equal(found.__v, undefined);

  // Single provider detail query
  const detailRes = await request(app).get(`/api/providers/${user._id}`);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.provider.passwordHash, undefined);
  assert.equal(detailRes.body.provider.__v, undefined);
});

// =========================================================================
// 12. EXISTING CORE UTILITIES, CITY CANONICAL MAPPINGS, AND HEALTHCHECK PASS
// =========================================================================
test('12. Existing healthcheck and canonical city mappings continue to operate correctly', async () => {
  const healthRes = await request(app).get('/api/health');
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.body.status, 'healthy');

  // All 5 canonical cities should be valid for discovery
  const cities = ['sangli', 'chhatrapati-sambhajinagar', 'mumbai', 'pune', 'nagpur'];
  for (const c of cities) {
    const res = await request(app).get(`/api/providers?city=${c}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.city.id, c);
  }
});

