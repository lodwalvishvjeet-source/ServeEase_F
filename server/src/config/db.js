import './env.js';
import mongoose from 'mongoose';

/**
 * MongoDB Atlas Connection Configuration
 * 
 * Safely establishes connection to MongoDB Atlas cluster using Mongoose.
 * - Reads connection URI strictly from backend environment variables.
 * - Handles missing configuration and connection failures with clear diagnostic messages.
 * - Monitors connection lifecycle events (connected, error, disconnected).
 * - Masks sensitive URI credentials in console logs.
 */

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    console.error('❌ [MongoDB] MONGODB_URI is not set in environment variables.');
    console.error('ℹ️ [MongoDB] Please configure MONGODB_URI in server/.env to enable database operations.');
    return false;
  }

  // Mask credentials for safe logging (handles special characters in password)
  const maskedUri = uri.replace(/\/\/(.*)@/, '//***:***@');

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout fast if Atlas cluster is unreachable
    });

    console.log(`✅ [MongoDB] Connected successfully to host: ${conn.connection.host}`);
    console.log(`📦 [MongoDB] Database: ${conn.connection.name}`);
    return true;
  } catch (error) {
    console.error(`❌ [MongoDB] Connection error to ${maskedUri}:`);
    console.error(`   Message: ${error.message}`);
    console.error('ℹ️ [MongoDB] Check:');
    console.error('   1. Your MongoDB Atlas Network Access allows your current IP (or 0.0.0.0/0 for development)');
    console.error('   2. Database username and password in server/.env are correct and URL-encoded if special chars');
    console.error('   3. Database cluster is active and not paused');
    return false;
  }
};

/**
 * Helper to get human-readable connection status for health check
 */
export const getConnectionState = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * Bounded read-only ping to verify active database responsiveness
 * Avoids hanging requests by applying a strict timeout.
 */
export const pingDatabase = async (timeoutMs = 1500) => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return false;
  }

  try {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Database ping timeout')), timeoutMs);
    });

    const pingPromise = mongoose.connection.db.admin().ping();
    const result = await Promise.race([pingPromise, timeoutPromise]);
    clearTimeout(timeoutId);

    return Boolean(result && (result.ok === 1 || result.ok === true));
  } catch {
    return false;
  }
};

// Monitor connection events
mongoose.connection.on('connected', () => {
  console.log('📡 [MongoDB Event] Connection established.');
});

mongoose.connection.on('reconnected', () => {
  console.log('📡 [MongoDB Event] Connection re-established.');
});

mongoose.connection.on('error', (err) => {
  console.error('📡 [MongoDB Event] Connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 [MongoDB Event] Connection disconnected.');
});

mongoose.connection.on('close', () => {
  console.log('📡 [MongoDB Event] Connection closed.');
});

export default connectDB;

