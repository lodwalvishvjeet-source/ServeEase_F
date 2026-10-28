import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import nodemailer from 'nodemailer';
import User from '../../src/models/User.js';
import PendingRegistration from '../../src/models/PendingRegistration.js';
import Booking from '../../src/models/Booking.js';
import Conversation from '../../src/models/Conversation.js';
import Message from '../../src/models/Message.js';
import Notification from '../../src/models/Notification.js';
import Review from '../../src/models/Review.js';
import VerificationDocument from '../../src/models/VerificationDocument.js';
import AuditLog from '../../src/models/AuditLog.js';
import { generateToken } from '../../src/controllers/authController.js';

let mongoServer = null;
export const sentEmails = [];

/**
 * Configure test environment, MongoMemoryServer, and nodemailer mock
 */
export async function setupTestEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test_jwt_secret_key_minimum_32_characters_long_for_serveease';
  process.env.EMAIL_USER = 'test.mailer@serveease.dev';
  process.env.EMAIL_PASS = 'mockpassword';

  // Mock nodemailer so real SMTP is never contacted
  nodemailer.createTransport = () => ({
    sendMail: async (mailOptions) => {
      sentEmails.push(mailOptions);
      return { messageId: `mock-msg-${Date.now()}` };
    }
  });

  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    process.env.MONGODB_URI = uri;
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri);
    }
  }
}

/**
 * Teardown in-memory database
 */
export async function teardownTestEnvironment() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Reset all MongoDB collections and mocks
 */
export async function clearAllData() {
  sentEmails.length = 0;
  await Promise.all([
    User.deleteMany({}),
    PendingRegistration.deleteMany({}),
    Booking.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Review.deleteMany({}),
    VerificationDocument.deleteMany({}),
    AuditLog.deleteMany({})
  ]);
}

/**
 * Helper to seed a verified customer
 */
export async function createTestCustomer(overrides = {}) {
  const uniq = Math.random().toString(36).substring(7);
  const password = overrides.password || 'CustomerPass123!';
  const passwordHash = await User.hashPassword(password);

  const customer = await User.create({
    name: overrides.name || `Customer ${uniq}`,
    email: overrides.email || `customer.${Date.now()}.${uniq}@serveease.test`,
    role: 'customer',
    city: overrides.city || 'sangli',
    phoneNumber: overrides.phoneNumber || '+91 9822000001',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    passwordHash,
    ...overrides
  });

  const token = generateToken(customer._id, customer.role);
  return { user: customer, token, password };
}

/**
 * Helper to seed an approved provider
 */
export async function createTestProvider(overrides = {}) {
  const uniq = Math.random().toString(36).substring(7);
  const { providerDetails: customDetails, ...otherOverrides } = overrides;
  const password = otherOverrides.password || 'ProviderPass123!';
  const passwordHash = await User.hashPassword(password);

  const provider = await User.create({
    name: otherOverrides.name || `Provider ${uniq}`,
    email: otherOverrides.email || `provider.${Date.now()}.${uniq}@serveease.test`,
    role: 'provider',
    city: otherOverrides.city || 'sangli',
    phoneNumber: otherOverrides.phoneNumber || '+91 9822000002',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    passwordHash,
    verificationStatus: otherOverrides.verificationStatus || 'approved',
    providerDetails: {
      bio: 'Professional certified technician with 5+ years experience',
      category: 'Electrical Services',
      categorySlug: 'electrical-services',
      hourlyRate: 350,
      isAvailable: true,
      isVerified: true,
      verificationStatus: 'approved',
      servicesOffered: [
        'Electrical Wiring',
        'Fan Repair'
      ],
      rating: 4.8,
      ratingCount: 12,
      ...customDetails,
      isVerified: customDetails?.isVerified ?? true,
      verificationStatus: customDetails?.verificationStatus || 'approved'
    },
    ...otherOverrides
  });

  const token = generateToken(provider._id, provider.role);
  return { user: provider, token, password };
}

/**
 * Helper to seed an administrator
 */
export async function createTestAdmin(overrides = {}) {
  const uniq = Math.random().toString(36).substring(7);
  const password = overrides.password || 'AdminPass123!';
  const passwordHash = await User.hashPassword(password);

  const admin = await User.create({
    name: overrides.name || 'System Administrator',
    email: overrides.email || `admin.${Date.now()}.${uniq}@serveease.test`,
    role: 'admin',
    city: overrides.city || 'sangli',
    phoneNumber: overrides.phoneNumber || '+91 9822000099',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    passwordHash,
    ...overrides
  });

  const token = generateToken(admin._id, admin.role);
  return { user: admin, token, password };
}

/**
 * Helper to create an active booking between customer and provider
 */
export async function createTestBooking({ customer, provider, overrides = {} }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const booking = await Booking.create({
    customer: customer._id,
    provider: provider._id,
    serviceName: overrides.serviceName || 'Electrical Wiring',
    category: overrides.category || 'Electrical Services',
    city: overrides.city || customer.city || 'sangli',
    serviceAddress: overrides.serviceAddress || '123 Test Street, Vishrambag',
    bookingDate: overrides.bookingDate || dateStr,
    bookingTime: overrides.bookingTime || '10:00 AM - 11:00 AM',
    price: overrides.price || 350,
    status: overrides.status || 'pending',
    description: overrides.description || 'Repair needed',
    ...overrides
  });

  return booking;
}
