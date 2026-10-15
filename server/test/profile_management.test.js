import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';

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

// Helper: register and get auth token
const registerUser = async (userData) => {
  const res = await request(app).post('/api/auth/register').send(userData);
  return { res, token: res.body.token, user: res.body.user };
};

// =========================================================================
// 1. CUSTOMER PROFILE RETRIEVAL & EDITING
// =========================================================================
test('Customer can retrieve own profile via /api/users/me and /api/users/profile', async () => {
  const { token } = await registerUser({
    name: 'Anjali Sharma',
    email: 'anjali@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune',
    phoneNumber: '+91 9822100001'
  });

  // Test /api/users/me
  const resMe = await request(app)
    .get('/api/users/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(resMe.status, 200);
  assert.equal(resMe.body.success, true);
  assert.equal(resMe.body.user.name, 'Anjali Sharma');
  assert.equal(resMe.body.user.email, 'anjali@example.com');
  assert.equal(resMe.body.user.role, 'customer');
  assert.equal(resMe.body.user.city, 'pune');
  assert.equal(resMe.body.user.cityName, 'Pune');
  assert.equal(resMe.body.user.passwordHash, undefined, 'Password hash must never be returned');

  // Test /api/users/profile alias
  const resProfile = await request(app)
    .get('/api/users/profile')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(resProfile.status, 200);
  assert.equal(resProfile.body.user.name, 'Anjali Sharma');
});

test('Customer can update allowed profile fields (name, phone, city) and changes persist to MongoDB', async () => {
  const { token } = await registerUser({
    name: 'Pooja Kulkarni',
    email: 'pooja@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli',
    phoneNumber: '+91 9822100002'
  });

  const updateRes = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Pooja Amit Kulkarni',
      phoneNumber: '+91 9822199999',
      city: 'Mumbai' // Aliased or capitalized
    });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.success, true);
  assert.equal(updateRes.body.user.name, 'Pooja Amit Kulkarni');
  assert.equal(updateRes.body.user.phoneNumber, '+91 9822199999');
  assert.equal(updateRes.body.user.city, 'mumbai', 'City must be stored canonically');
  assert.equal(updateRes.body.user.cityName, 'Mumbai');

  // Verify directly in MongoDB
  const inDb = await User.findOne({ email: 'pooja@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.name, 'Pooja Amit Kulkarni');
  assert.equal(inDb.phoneNumber, '+91 9822199999');
  assert.equal(inDb.city, 'mumbai');
});

// =========================================================================
// 2. PROVIDER PROFILE RETRIEVAL & EDITING
// =========================================================================
test('Provider can retrieve and edit full trade profile via /api/providers/profile', async () => {
  const { token } = await registerUser({
    name: 'Santosh Electrician',
    email: 'santosh.elec@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    phoneNumber: '+91 9822200001',
    providerDetails: {
      category: 'Electrical Repairs',
      servicesOffered: 'Wiring, MCB setup',
      experienceYears: 5,
      serviceArea: 'Kothrud',
      startingPrice: 300,
      hourlyRate: 350,
      isAvailable: true
    }
  });

  // 1. Retrieve profile via provider endpoint
  const getRes = await request(app)
    .get('/api/providers/profile')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(getRes.status, 200);
  assert.equal(getRes.body.user.role, 'provider');
  assert.equal(getRes.body.user.providerDetails.category, 'Electrical Repairs');
  assert.equal(getRes.body.user.providerDetails.isVerified, false);

  // 2. Edit provider details
  const updateRes = await request(app)
    .put('/api/providers/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Santosh V. Joshi Electricals',
      phoneNumber: '+91 9822299999',
      city: 'Pune',
      providerDetails: {
        category: 'Electrical Repairs',
        title: 'Master Licensed Industrial & Domestic Wireman',
        servicesOffered: ['Single-Phase Wiring', 'Three-Phase MCB', 'Inverter Setup', 'Earthing Checks'],
        experienceYears: 9,
        serviceArea: 'Kothrud, Karve Nagar & Deccan',
        startingPrice: 399,
        hourlyRate: 450,
        isAvailable: false,
        bio: 'Nine years of licensed electrical expertise across West Pune.'
      }
    });

  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body.success, true);
  assert.equal(updateRes.body.user.name, 'Santosh V. Joshi Electricals');
  assert.equal(updateRes.body.user.providerDetails.experienceYears, 9);
  assert.equal(updateRes.body.user.providerDetails.startingPrice, 399);
  assert.equal(updateRes.body.user.providerDetails.hourlyRate, 450);
  assert.equal(updateRes.body.user.providerDetails.isAvailable, false);
  assert.equal(updateRes.body.user.providerDetails.servicesOffered.length, 4);

  // 3. Verify in MongoDB persistence
  const inDb = await User.findOne({ email: 'santosh.elec@example.com' });
  assert.equal(inDb.name, 'Santosh V. Joshi Electricals');
  assert.equal(inDb.providerDetails.experienceYears, 9);
  assert.equal(inDb.providerDetails.startingPrice, 399);
  assert.equal(inDb.providerDetails.hourlyRate, 450);
  assert.equal(inDb.providerDetails.isAvailable, false);
});

// =========================================================================
// 3. ROLE RESTRICTIONS & AUTHORIZATION
// =========================================================================
test('Customer is restricted from accessing provider-only profile endpoint', async () => {
  const { token } = await registerUser({
    name: 'Customer Bob',
    email: 'bob@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'nagpur'
  });

  const res = await request(app)
    .get('/api/providers/profile')
    .set('Authorization', `Bearer ${token}`);

  assert.equal(res.status, 403, 'Customer must be blocked from provider profile endpoint');
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Access denied'));
});

test('Unauthenticated profile requests are rejected with 401 Unauthorized', async () => {
  const getMeRes = await request(app).get('/api/users/me');
  assert.equal(getMeRes.status, 401);

  const getProfileRes = await request(app).get('/api/users/profile');
  assert.equal(getProfileRes.status, 401);

  const patchProfileRes = await request(app).patch('/api/users/profile').send({ name: 'Hacker' });
  assert.equal(patchProfileRes.status, 401);

  const provProfileRes = await request(app).get('/api/providers/profile');
  assert.equal(provProfileRes.status, 401);
});

test('User cannot edit another user\'s profile via /api/users/:id', async () => {
  const user1 = await registerUser({
    name: 'User One',
    email: 'user1@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const user2 = await registerUser({
    name: 'User Two',
    email: 'user2@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  // User 1 tries to edit User 2's profile
  const tamperRes = await request(app)
    .patch(`/api/users/${user2.user.id}`)
    .set('Authorization', `Bearer ${user1.token}`)
    .send({ name: 'Defaced Name' });

  assert.equal(tamperRes.status, 403, 'Attempting to edit another user must yield 403 Forbidden');
  assert.equal(tamperRes.body.success, false);
  assert.ok(tamperRes.body.error.includes('not authorized to edit another user'));

  // Verify User 2's record remains untouched
  const inDb = await User.findOne({ email: 'user2@example.com' });
  assert.equal(inDb.name, 'User Two');
});

// =========================================================================
// 4. SECURITY & PRIVILEGE ESCALATION PREVENTION
// =========================================================================
test('Attempts to change role, account status, or verification status are strictly blocked', async () => {
  const { token } = await registerUser({
    name: 'Tamper Tester',
    email: 'tamper@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'chhatrapati-sambhajinagar',
    providerDetails: {
      category: 'Plumbing',
      serviceArea: 'Cidco & Station Road',
      isVerified: false
    }
  });

  // Attempt to elevate role to admin, mark verified, and change status
  const tamperRes = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Tamper Tester Updated',
      role: 'admin',                // Privilege escalation attempt!
      status: 'suspended',          // Status tampering attempt!
      email: 'hacked@example.com',  // Email tampering attempt!
      providerDetails: {
        isVerified: true,           // Self-verification attempt!
        isDemo: true,
        rating: 5.0,
        reviewCount: 999
      }
    });

  assert.equal(tamperRes.status, 200);
  assert.equal(tamperRes.body.user.name, 'Tamper Tester Updated');
  assert.equal(tamperRes.body.user.role, 'provider', 'Role cannot be escalated');
  assert.equal(tamperRes.body.user.email, 'tamper@example.com', 'Email cannot be changed arbitrarily');
  assert.equal(tamperRes.body.user.providerDetails.isVerified, false, 'Provider cannot self-verify');
  assert.equal(tamperRes.body.user.providerDetails.rating, null, 'Fake ratings are rejected');
  assert.equal(tamperRes.body.user.providerDetails.reviewCount, 0, 'Fake review counts are rejected');

  // Verify directly in MongoDB
  const inDb = await User.findOne({ email: 'tamper@example.com' });
  assert.equal(inDb.role, 'provider');
  assert.equal(inDb.status, 'active');
  assert.equal(inDb.email, 'tamper@example.com');
  assert.equal(inDb.providerDetails.isVerified, false);
});

// =========================================================================
// 5. INPUT VALIDATION & CITY NORMALIZATION
// =========================================================================
test('Profile update rejects invalid names (< 2 characters)', async () => {
  const { token } = await registerUser({
    name: 'Valid Name',
    email: 'validname@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'pune'
  });

  const res = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'A' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Name must be at least 2 characters'));
});

test('Profile update rejects unsupported cities with HTTP 400', async () => {
  const { token } = await registerUser({
    name: 'Valid Name',
    email: 'citytest@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'sangli'
  });

  const res = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ city: 'Nashik' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.includes('Invalid city'));
});

test('Profile update rejects negative rates and experience years', async () => {
  const { token } = await registerUser({
    name: 'Rate Tester',
    email: 'ratetest@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'mumbai',
    providerDetails: {
      category: 'Electrical Repairs',
      serviceArea: 'Andheri West'
    }
  });

  // Negative starting price
  const res1 = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ providerDetails: { startingPrice: -100 } });
  assert.equal(res1.status, 400);
  assert.ok(res1.body.error.includes('Starting price must be a non-negative number'));

  // Negative hourly rate
  const res2 = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ providerDetails: { hourlyRate: -50 } });
  assert.equal(res2.status, 400);
  assert.ok(res2.body.error.includes('Hourly rate must be a non-negative number'));

  // Negative experience years
  const res3 = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ providerDetails: { experienceYears: -3 } });
  assert.equal(res3.status, 400);
  assert.ok(res3.body.error.includes('Experience years must be a non-negative number'));
});

// =========================================================================
// 4. PROVIDER MY SERVICES MANAGEMENT (/api/providers/my-services)
// =========================================================================
test('Provider can view, add, and remove services via /api/providers/my-services', async () => {
  const { token } = await registerUser({
    name: 'Santosh Carpenter',
    email: 'santosh@example.com',
    password: 'Password123',
    role: 'provider',
    city: 'pune',
    providerDetails: {
      category: 'Carpentry',
      servicesOffered: ['Furniture Assembly', 'Door Repair'],
      serviceArea: 'Kothrud'
    }
  });

  // 1. GET services
  const resGet = await request(app)
    .get('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(resGet.status, 200);
  assert.equal(resGet.body.success, true);
  assert.deepEqual(resGet.body.services, ['Furniture Assembly', 'Door Repair']);
  assert.equal(resGet.body.category, 'Carpentry');

  // 2. POST add service
  const resAdd = await request(app)
    .post('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`)
    .send({ service: 'Modular Kitchen Installation' });
  assert.equal(resAdd.status, 201);
  assert.equal(resAdd.body.success, true);
  assert.ok(resAdd.body.services.includes('Modular Kitchen Installation'));
  assert.equal(resAdd.body.services.length, 3);

  // 3. Prevent duplicate service
  const resDup = await request(app)
    .post('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`)
    .send({ service: 'furniture assembly' }); // Case-insensitive check
  assert.equal(resDup.status, 400);
  assert.ok(resDup.body.error.includes('already offered'));

  // 4. DELETE service
  const resDel = await request(app)
    .delete('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`)
    .send({ service: 'Door Repair' });
  assert.equal(resDel.status, 200);
  assert.equal(resDel.body.success, true);
  assert.ok(!resDel.body.services.includes('Door Repair'));
  assert.equal(resDel.body.services.length, 2);
});

test('Customer is restricted from provider services management endpoint', async () => {
  const { token } = await registerUser({
    name: 'Customer Rohit',
    email: 'rohit@example.com',
    password: 'Password123',
    role: 'customer',
    city: 'mumbai'
  });

  const res = await request(app)
    .get('/api/providers/my-services')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
});

