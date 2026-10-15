import '../config/env.js';
import { validateBootstrapEnv } from '../config/validateEnv.js';
import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * Administrative Bootstrap Script
 * 
 * Safely provisions the primary platform administrator account.
 * To execute:
 *   Option A: Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env and run: npm run bootstrap:admin
 *   Option B: Pass inline: ADMIN_EMAIL=admin@serveease.com ADMIN_PASSWORD=StrongPassword123 npm run bootstrap:admin
 *   Option C: Pass CLI args: node src/scripts/createAdmin.js --email=admin@serveease.com --password=StrongPassword123
 */
const bootstrapAdmin = async () => {
  console.log('====================================================');
  console.log('🛡️  ServeEase — Administrator Account Bootstrap');
  console.log('====================================================');

  // Support CLI arguments fallback (--email=... --password=... or positional arguments)
  const emailArg = process.argv.find(arg => arg.startsWith('--email='))?.split('=')[1] || 
    (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : undefined);
  const passwordArg = process.argv.find(arg => arg.startsWith('--password='))?.split('=')[1] || 
    (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : undefined);
  const nameArg = process.argv.find(arg => arg.startsWith('--name='))?.split('=')[1];

  const resetPassword = process.argv.includes('--reset-password') || process.argv.includes('--reset');

  if (emailArg && !process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = emailArg;
  if (passwordArg && !process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = passwordArg;
  if (nameArg && !process.env.ADMIN_NAME) process.env.ADMIN_NAME = nameArg;

  // Run validation
  validateBootstrapEnv({ exitOnError: true });

  const uri = process.env.MONGODB_URI;
  const name = process.env.ADMIN_NAME || 'Platform Administrator';
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  try {
    console.log('⏳ Connecting to MongoDB...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB.');

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.role === 'admin') {
        if (resetPassword) {
          console.log(`🔄 Updating credentials for existing administrator "${email}"...`);
          const passwordHash = await User.hashPassword(password);
          existingUser.passwordHash = passwordHash;
          if (name && name !== existingUser.name) {
            existingUser.name = name;
          }
          await existingUser.save();
          console.log('🎉 Administrator password updated successfully!');
          console.log('----------------------------------------------------');
          console.log(`👤 Name:   ${existingUser.name}`);
          console.log(`📧 Email:  ${existingUser.email}`);
          console.log(`🛡️  Role:   ${existingUser.role}`);
          console.log(`🆔 ID:     ${existingUser._id}`);
          console.log('----------------------------------------------------');
          console.log('🔒 For security, the password has not been displayed.');
          console.log('👉 You may now sign in as Admin at http://localhost:5173/login');
          console.log('====================================================');
          await mongoose.disconnect();
          process.exit(0);
        } else {
          console.log(`ℹ️  Notice: An administrator account with email "${email}" already exists.`);
          console.log('   Pass --reset-password to update this administrator password.');
          console.log('   No changes were made.');
        }
      } else {
        console.warn(`⚠️  Warning: A user with email "${email}" already exists with role "${existingUser.role}".`);
        console.warn('   To avoid unexpected privilege escalation, existing non-admin users cannot be overwritten by this script.');
      }
      await mongoose.disconnect();
      process.exit(0);
    }

    // Hash the password securely
    console.log('🔒 Hashing password securely with bcrypt...');
    const passwordHash = await User.hashPassword(password);

    // Create the admin account
    const newAdmin = await User.create({
      name,
      email,
      passwordHash,
      role: 'admin',
      status: 'active'
    });

    console.log('🎉 Administrator account created successfully!');
    console.log('----------------------------------------------------');
    console.log(`👤 Name:   ${newAdmin.name}`);
    console.log(`📧 Email:  ${newAdmin.email}`);
    console.log(`🛡️  Role:   ${newAdmin.role}`);
    console.log(`🆔 ID:     ${newAdmin._id}`);
    console.log('----------------------------------------------------');
    console.log('🔒 For security, the password has not been displayed.');
    console.log('👉 You may now sign in as Admin at http://localhost:5173/login');
    console.log('====================================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Bootstrap failed with error:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

bootstrapAdmin();
