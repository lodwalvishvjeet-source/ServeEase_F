import { performance } from 'perf_hooks';
import supertest from 'supertest';
import app from '../src/app.js';
import { setupTestEnvironment, teardownTestEnvironment, createTestCustomer, clearAllData } from './helpers/testUtils.js';

async function runBenchmark() {
  await setupTestEnvironment();
  await clearAllData();

  const customer = await createTestCustomer({
    email: 'test.registered@serveease.test',
    password: 'CorrectPassword123!'
  });

  const request = supertest(app);
  const ITERATIONS = 10;

  async function measure(name, fn) {
    // Warmup 1 run
    await fn();
    const times = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`${name.padEnd(52)} | Avg: ${avg.toFixed(2).padStart(6)}ms | Min: ${min.toFixed(2).padStart(6)}ms | Max: ${max.toFixed(2).padStart(6)}ms`);
    return { name, avg, min, max };
  }

  console.log('='.repeat(92));
  console.log('📊 BASELINE PERFORMANCE MEASUREMENTS (ServeEase Auth)');
  console.log('='.repeat(92));

  // 1. Login with invalid email syntax (e.g. 'invalid-email-syntax')
  await measure('1. POST /api/auth/login (Invalid email syntax)', async () => {
    await request.post('/api/auth/login').send({
      email: 'invalid-email-syntax',
      password: 'SomePassword123!'
    });
  });

  // 2. Login with syntactically valid but non-existent email
  await measure('2. POST /api/auth/login (Non-existent email)', async () => {
    await request.post('/api/auth/login').send({
      email: 'nonexistent.random.user999@example.com',
      password: 'SomePassword123!'
    });
  });

  // 3. Login with registered email + wrong password
  await measure('3. POST /api/auth/login (Existing user, wrong pass)', async () => {
    await request.post('/api/auth/login').send({
      email: 'test.registered@serveease.test',
      password: 'WrongPassword123!'
    });
  });

  // 4. Login with registered email + valid password
  await measure('4. POST /api/auth/login (Existing user, valid pass)', async () => {
    await request.post('/api/auth/login').send({
      email: 'test.registered@serveease.test',
      password: 'CorrectPassword123!'
    });
  });

  // 5. Register with invalid email syntax
  await measure('5. POST /api/auth/register (Invalid email syntax)', async () => {
    await request.post('/api/auth/register').send({
      name: 'John Doe',
      email: 'not-an-email',
      password: 'SecurePassword123!',
      city: 'sangli',
      role: 'customer'
    });
  });

  // 6. Register with duplicate existing email
  await measure('6. POST /api/auth/register (Duplicate email check)', async () => {
    await request.post('/api/auth/register').send({
      name: 'John Doe',
      email: 'test.registered@serveease.test',
      password: 'SecurePassword123!',
      city: 'sangli',
      role: 'customer'
    });
  });

  // 7. Forgot password with invalid email syntax
  await measure('7. POST /api/auth/forgot-password (Invalid email syntax)', async () => {
    await request.post('/api/auth/forgot-password').send({
      email: 'bad-email-format'
    });
  });

  // 8. Forgot password with non-existent email
  await measure('8. POST /api/auth/forgot-password (Non-existent email)', async () => {
    await request.post('/api/auth/forgot-password').send({
      email: 'nonexistent.user999@example.com'
    });
  });

  // 9. Verify Email OTP with invalid email syntax
  await measure('9. POST /api/auth/verify-email-otp (Invalid email syntax)', async () => {
    await request.post('/api/auth/verify-email-otp').send({
      email: 'bad-email',
      otp: '123456'
    });
  });

  // 10. Resend Verification OTP with invalid email syntax
  await measure('10. POST /api/auth/resend-verification-otp (Invalid email)', async () => {
    await request.post('/api/auth/resend-verification-otp').send({
      email: 'bad-email'
    });
  });

  console.log('='.repeat(92));
  await teardownTestEnvironment();
}

runBenchmark().catch(console.error);
