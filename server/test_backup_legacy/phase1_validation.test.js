import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import { validateEmail, validateIndianMobile } from '../src/utils/validation.js';

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

// Helper: register user
const registerUser = async (userData) => {
  const res = await request(app).post('/api/auth/register').send(userData);
  return { res, token: res.body.token, user: res.body.user };
};

// Unit tests for validateEmail
test('validateEmail utility handles valid and invalid syntax', () => {
  assert.equal(validateEmail('test@example.com').isValid, true);
  assert.equal(validateEmail('  USER@Domain.CO.IN ').normalized, 'user@domain.co.in');
  assert.equal(validateEmail('not-an-email').isValid, false);
  assert.equal(validateEmail('').isValid, false);
  assert.equal(validateEmail(null).isValid, false);
});

// Unit tests for validateIndianMobile
test('validateIndianMobile utility validates 10 digits starting with 6-9 and normalizes', () => {
  // Valid phone numbers
  assert.equal(validateIndianMobile('9876543210').isValid, true);
  assert.equal(validateIndianMobile('9876543210').normalized, '+91 9876543210');

  assert.equal(validateIndianMobile('98765 43210').isValid, true);
  assert.equal(validateIndianMobile('98765 43210').normalized, '+91 9876543210');

  assert.equal(validateIndianMobile('+91 98765 43210').isValid, true);
  assert.equal(validateIndianMobile('+91 98765 43210').normalized, '+91 9876543210');

  assert.equal(validateIndianMobile('8765432109').isValid, true);
  assert.equal(validateIndianMobile('7654321098').isValid, true);
  assert.equal(validateIndianMobile('6543210987').isValid, true);

  // With 0 prefix
  assert.equal(validateIndianMobile('09876543210').isValid, true);
  assert.equal(validateIndianMobile('09876543210').normalized, '+91 9876543210');

  // Invalid: starts with 1-5 (invalid starting digit)
  assert.equal(validateIndianMobile('5876543210').isValid, false);
  assert.equal(validateIndianMobile('1234567890').isValid, false);

  // Invalid: 9 digits
  assert.equal(validateIndianMobile('987654321').isValid, false);

  // Invalid: 11 digits
  assert.equal(validateIndianMobile('98765432101').isValid, false);

  // Invalid: alphabetic or malformed input
  assert.equal(validateIndianMobile('98765abcde').isValid, false);
  assert.equal(validateIndianMobile('phone-number').isValid, false);
  assert.equal(validateIndianMobile('+91-98765-invalid').isValid, false);
  assert.equal(validateIndianMobile('98765@43210').isValid, false);
  assert.equal(validateIndianMobile('').isValid, false);

  // Invalid: repeated country prefix
  assert.equal(validateIndianMobile('+91 +91 98765 43210').isValid, false);
  assert.equal(validateIndianMobile('+91919876543210').isValid, false);
  assert.equal(validateIndianMobile('+91+919876543210').isValid, false);
});

// Integration: Registration validation
test('Registration rejects invalid email format with HTTP 400', async () => {
  const { res } = await registerUser({
    name: 'Test Customer',
    email: 'invalid-email-address',
    password: 'Password123',
    city: 'sangli',
    role: 'customer'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.toLowerCase().includes('email'));
});

test('Registration normalizes valid email to lowercase', async () => {
  const { res } = await registerUser({
    name: 'Test Customer',
    email: '  CaseTest@EXAMPLE.com  ',
    password: 'Password123',
    city: 'pune',
    role: 'customer'
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.user.email, 'casetest@example.com');

  const inDb = await User.findOne({ email: 'casetest@example.com' });
  assert.ok(inDb);
  assert.equal(inDb.email, 'casetest@example.com');
});

test('Registration validates Indian mobile number format', async () => {
  // Invalid phone number: starts with 2
  const invalidRes = await request(app).post('/api/auth/register').send({
    name: 'Invalid Phone User',
    email: 'badphone@example.com',
    password: 'Password123',
    city: 'mumbai',
    phoneNumber: '2234567890',
    role: 'customer'
  });

  assert.equal(invalidRes.status, 400);
  assert.equal(invalidRes.body.success, false);
  assert.ok(invalidRes.body.error.includes('10-digit Indian mobile number'));

  // Valid phone number: starts with 9 and normalizes
  const validRes = await request(app).post('/api/auth/register').send({
    name: 'Valid Phone User',
    email: 'goodphone@example.com',
    password: 'Password123',
    city: 'mumbai',
    phoneNumber: '9876543210',
    role: 'customer'
  });

  assert.equal(validRes.status, 201);
  assert.equal(validRes.body.success, true);
  assert.equal(validRes.body.user.phoneNumber, '+91 9876543210');
});

test('Registration rejects explicit refusal of Terms & Conditions', async () => {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Refusing Terms User',
    email: 'noterms@example.com',
    password: 'Password123',
    city: 'sangli',
    agreeTerms: false,
    role: 'customer'
  });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error.toLowerCase().includes('terms'));
});

// Profile Update Phone Number Validation
test('Profile update validates phone number and preserves existing on failure', async () => {
  const { token } = await registerUser({
    name: 'Original Name',
    email: 'profilephone@example.com',
    password: 'Password123',
    city: 'sangli',
    phoneNumber: '9822100001',
    role: 'customer'
  });

  // Attempt invalid phone update
  const failRes = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      phoneNumber: 'not-a-phone'
    });

  assert.equal(failRes.status, 400);
  assert.equal(failRes.body.success, false);
  assert.ok(failRes.body.error.includes('Indian mobile number'));

  // Verify existing phone number is NOT cleared or corrupted in DB
  const inDb = await User.findOne({ email: 'profilephone@example.com' });
  assert.equal(inDb.phoneNumber, '+91 9822100001');

  // Valid update succeeds
  const successRes = await request(app)
    .patch('/api/users/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({
      phoneNumber: '+91 9822299999'
    });

  assert.equal(successRes.status, 200);
  assert.equal(successRes.body.success, true);
  assert.equal(successRes.body.user.phoneNumber, '+91 9822299999');
});
