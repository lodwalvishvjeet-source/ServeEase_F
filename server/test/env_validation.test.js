import test from 'node:test';
import assert from 'node:assert/strict';
import { validateServerEnv, validateBootstrapEnv } from '../src/config/validateEnv.js';

test('validateServerEnv succeeds with valid required configuration', () => {
  const originalMongo = process.env.MONGODB_URI;
  const originalPort = process.env.PORT;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/test';
    process.env.PORT = '5001';
    process.env.NODE_ENV = 'development';

    const result = validateServerEnv({ exitOnError: false });
    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
  } finally {
    process.env.MONGODB_URI = originalMongo;
    process.env.PORT = originalPort;
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test('validateServerEnv fails when MONGODB_URI is missing', () => {
  const originalMongo = process.env.MONGODB_URI;

  try {
    delete process.env.MONGODB_URI;

    const result = validateServerEnv({ exitOnError: false });
    assert.equal(result.isValid, false);
    const hasMongoError = result.errors.some(e => e.variable === 'MONGODB_URI');
    assert.equal(hasMongoError, true);
    // Ensure credentials are never leaked in error messages
    result.errors.forEach(e => {
      assert.ok(!e.message.includes('password'));
      assert.ok(!e.action.includes('password123'));
    });
  } finally {
    process.env.MONGODB_URI = originalMongo;
  }
});

test('validateServerEnv fails when PORT is not a valid integer', () => {
  const originalPort = process.env.PORT;

  try {
    process.env.PORT = 'invalid_port';

    const result = validateServerEnv({ exitOnError: false });
    assert.equal(result.isValid, false);
    const hasPortError = result.errors.some(e => e.variable === 'PORT');
    assert.equal(hasPortError, true);
  } finally {
    process.env.PORT = originalPort;
  }
});

test('validateServerEnv enforces 32+ character JWT_SECRET in production mode', () => {
  const originalJwt = process.env.JWT_SECRET;
  const originalEnv = process.env.NODE_ENV;

  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short_secret';

    const result = validateServerEnv({ exitOnError: false });
    assert.equal(result.isValid, false);
    const hasJwtError = result.errors.some(e => e.variable === 'JWT_SECRET');
    assert.equal(hasJwtError, true);
  } finally {
    process.env.JWT_SECRET = originalJwt;
    process.env.NODE_ENV = originalEnv;
  }
});

test('validateBootstrapEnv requires both ADMIN_EMAIL and ADMIN_PASSWORD', () => {
  const originalEmail = process.env.ADMIN_EMAIL;
  const originalPassword = process.env.ADMIN_PASSWORD;

  try {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    const result = validateBootstrapEnv({ exitOnError: false });
    assert.equal(result.isValid, false);
    const hasEmailErr = result.errors.some(e => e.variable === 'ADMIN_EMAIL');
    const hasPassErr = result.errors.some(e => e.variable === 'ADMIN_PASSWORD');
    assert.equal(hasEmailErr, true);
    assert.equal(hasPassErr, true);
  } finally {
    process.env.ADMIN_EMAIL = originalEmail;
    process.env.ADMIN_PASSWORD = originalPassword;
  }
});

test('validateBootstrapEnv enforces minimum 8 characters for ADMIN_PASSWORD', () => {
  const originalEmail = process.env.ADMIN_EMAIL;
  const originalPassword = process.env.ADMIN_PASSWORD;

  try {
    process.env.ADMIN_EMAIL = 'admin@serveease.com';
    process.env.ADMIN_PASSWORD = 'short';

    const result = validateBootstrapEnv({ exitOnError: false });
    assert.equal(result.isValid, false);
    const hasPassErr = result.errors.some(e => e.variable === 'ADMIN_PASSWORD');
    assert.equal(hasPassErr, true);
  } finally {
    process.env.ADMIN_EMAIL = originalEmail;
    process.env.ADMIN_PASSWORD = originalPassword;
  }
});

test('validateBootstrapEnv succeeds when valid email and password are provided', () => {
  const originalEmail = process.env.ADMIN_EMAIL;
  const originalPassword = process.env.ADMIN_PASSWORD;

  try {
    process.env.ADMIN_EMAIL = 'admin@serveease.com';
    process.env.ADMIN_PASSWORD = 'StrongAdminPassword2026!';

    const result = validateBootstrapEnv({ exitOnError: false });
    assert.equal(result.isValid, true);
    assert.equal(result.errors.length, 0);
  } finally {
    process.env.ADMIN_EMAIL = originalEmail;
    process.env.ADMIN_PASSWORD = originalPassword;
  }
});
