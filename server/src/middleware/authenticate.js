import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../config/env.js';

/**
 * Authentication Middleware
 * 
 * Verifies JWT token from either:
 * 1. HttpOnly 'token' cookie (browser web clients)
 * 2. 'Authorization: Bearer <token>' header (API clients / tools)
 * 
 * Then queries MongoDB to verify:
 * - User account actually exists
 * - User account is active (not suspended)
 * 
 * Attaches fresh user document to `req.user`.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Check Bearer Authorization header (fallback or API clients)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const candidate = req.headers.authorization.split(' ')[1];
      if (candidate && candidate.trim() && candidate !== 'null' && candidate !== 'undefined') {
        token = candidate.trim();
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.'
      });
    }

    const secret = getJwtSecret();
    
    // Verify token signature & expiry
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Your session has expired. Please sign in again.'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token. Please sign in again.'
      });
    }

    // Query active user state from MongoDB
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found or has been removed.'
      });
    }

    // Reject suspended accounts
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'This account has been suspended by an administrator. Please contact support.'
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return next(error);
  }
};

export default authenticate;
