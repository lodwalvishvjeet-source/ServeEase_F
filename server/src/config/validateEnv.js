/**
 * Environment Configuration Validator
 * 
 * Audits and validates backend environment variables before server startup
 * or administrative bootstrap tasks.
 * 
 * Rules:
 * - Never prints secret values (passwords, JWT secrets, URIs) in logs.
 * - Stops startup only when a genuinely essential variable is missing.
 * - Emits helpful warnings for optional or non-fatal configuration gaps.
 * - Does not crash on unused optional features (e.g. third-party email, maps, chat).
 */

/**
 * Validate variables required for ordinary HTTP API server startup
 */
export const validateServerEnv = ({ exitOnError = true } = {}) => {
  const errors = [];
  const warnings = [];

  // 1. Essential: MONGODB_URI (required for database persistence & auth)
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    errors.push({
      variable: 'MONGODB_URI',
      message: 'MongoDB Atlas connection string is missing. Database persistence, authentication, and user queries cannot operate.',
      action: 'Set MONGODB_URI in server/.env (e.g. mongodb+srv://<username>:<password>@cluster.mongodb.net/serveease?retryWrites=true&w=majority)'
    });
  }

  // 2. Port Validation (optional, defaults to 5001)
  if (process.env.PORT && process.env.PORT !== 'undefined' && process.env.PORT.trim() !== '') {
    const port = Number(process.env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push({
        variable: 'PORT',
        message: `PORT="${process.env.PORT}" is not a valid network port. Must be an integer between 1 and 65535.`,
        action: 'Configure a valid integer PORT in server/.env (e.g. PORT=5001).'
      });
    }
  }

  // 3. JWT_SECRET Validation
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';
  const defaultSecretFallback = 'serveease_jwt_super_secret_development_key_2026_change_in_production';

  if (isProduction) {
    if (!jwtSecret || jwtSecret === defaultSecretFallback || jwtSecret.length < 32) {
      errors.push({
        variable: 'JWT_SECRET',
        message: 'A secure, unique JWT_SECRET of at least 32 characters is strictly required in production mode.',
        action: 'Configure a strong 32+ character JWT_SECRET in server/.env before deploying to production.'
      });
    }
  } else {
    if (!jwtSecret) {
      warnings.push({
        variable: 'JWT_SECRET',
        message: 'JWT_SECRET is not set in server/.env. Using development fallback. Note: configure a strong secret before deploying to production.'
      });
    } else if (jwtSecret.length < 16) {
      warnings.push({
        variable: 'JWT_SECRET',
        message: 'JWT_SECRET is short (less than 16 characters). Recommend using at least 32 characters for security.'
      });
    }
  }

  // 4. FRONTEND_URL / CLIENT_URL Validation (defaults to http://localhost:5174 / 5173)
  const configuredUrls = [process.env.FRONTEND_URL, process.env.CLIENT_URL]
    .filter(Boolean)
    .flatMap(val => val.split(',').map(s => s.trim()))
    .filter(Boolean);

  for (const rawUrl of configuredUrls) {
    try {
      new URL(rawUrl);
    } catch {
      warnings.push({
        variable: 'FRONTEND_URL',
        message: `Configured frontend URL "${rawUrl}" may not be a valid URL. Ensure it includes protocol (e.g. http://localhost:5174).`
      });
    }
  }

  // Print warnings if any
  if (warnings.length > 0) {
    console.log('----------------------------------------------------');
    console.log('ℹ️  [Environment Configuration Notices]');
    warnings.forEach(w => {
      console.warn(`   • ${w.variable}: ${w.message}`);
    });
    console.log('----------------------------------------------------');
  }

  // Handle fatal errors
  if (errors.length > 0) {
    console.error('====================================================');
    console.error('❌ [Environment Configuration Error] Server startup halted');
    console.error('   The following essential configuration is missing or invalid:');
    errors.forEach(e => {
      console.error(`   ❌ ${e.variable}`);
      console.error(`      Problem: ${e.message}`);
      console.error(`      Action:  ${e.action}`);
    });
    console.error('====================================================');

    if (exitOnError) {
      process.exit(1);
    }
    return { isValid: false, errors, warnings };
  }

  return { isValid: true, errors: [], warnings };
};

/**
 * Validate variables required ONLY for admin bootstrap script
 */
export const validateBootstrapEnv = ({ exitOnError = true } = {}) => {
  const errors = [];

  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    errors.push({
      variable: 'MONGODB_URI',
      message: 'MongoDB Atlas connection string is required to connect and create the admin user.',
      action: 'Set MONGODB_URI in server/.env.'
    });
  }

  const email = process.env.ADMIN_EMAIL?.trim();
  if (!email) {
    errors.push({
      variable: 'ADMIN_EMAIL',
      message: 'ADMIN_EMAIL is missing.',
      action: 'Set ADMIN_EMAIL in server/.env or pass inline: ADMIN_EMAIL=admin@serveease.com ADMIN_PASSWORD=... npm run bootstrap:admin'
    });
  } else {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      errors.push({
        variable: 'ADMIN_EMAIL',
        message: `ADMIN_EMAIL format is invalid.`,
        action: 'Provide a valid email address (e.g. admin@serveease.com).'
      });
    }
  }

  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    errors.push({
      variable: 'ADMIN_PASSWORD',
      message: 'ADMIN_PASSWORD is missing.',
      action: 'Set ADMIN_PASSWORD in server/.env or pass inline: ADMIN_EMAIL=admin@serveease.com ADMIN_PASSWORD=StrongPassword123 npm run bootstrap:admin'
    });
  } else if (password.length < 8) {
    errors.push({
      variable: 'ADMIN_PASSWORD',
      message: 'Admin password must be at least 8 characters long for adequate security.',
      action: 'Provide a password with at least 8 characters.'
    });
  }

  if (errors.length > 0) {
    console.error('====================================================');
    console.error('❌ [Admin Bootstrap Configuration Error]');
    errors.forEach(e => {
      console.error(`   ❌ ${e.variable}`);
      console.error(`      Problem: ${e.message}`);
      console.error(`      Action:  ${e.action}`);
    });
    console.error('====================================================');

    if (exitOnError) {
      process.exit(1);
    }
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
};

export default {
  validateServerEnv,
  validateBootstrapEnv
};
