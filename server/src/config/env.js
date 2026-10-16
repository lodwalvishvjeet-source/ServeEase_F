import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Compute directory of this file in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly resolve server/.env relative to this file
// Ensures server/.env is loaded consistently whether launched from server/, project root, or anywhere else
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

export const DEFAULT_JWT_SECRET = 'serveease_jwt_super_secret_development_key_2026_change_in_production';

/**
 * Returns the environment-configured JWT secret key.
 * In production mode, fails securely if JWT_SECRET is unset, matches development fallback, or is shorter than 32 characters.
 * In development and test modes, falls back to DEFAULT_JWT_SECRET.
 */
export const getJwtSecret = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.JWT_SECRET?.trim();

  if (isProduction) {
    if (!secret || secret === DEFAULT_JWT_SECRET || secret.length < 32) {
      throw new Error(
        'A secure, unique JWT_SECRET of at least 32 characters is strictly required in production mode.'
      );
    }
    return secret;
  }

  return secret || DEFAULT_JWT_SECRET;
};

export default process.env;
