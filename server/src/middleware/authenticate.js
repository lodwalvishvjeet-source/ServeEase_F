import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../config/env.js';
import { verifyFirebaseIdToken, isFirebaseConfigured } from '../config/firebase.js';

/**
 * Authentication Middleware
 * 
 * Supports dual-mode authentication:
 * 1. Firebase ID Tokens (RS256 signed by Google) via Firebase Admin SDK
 * 2. ServeEase Legacy JWT Tokens (HS256 signed) via jsonwebtoken
 * 
 * Token sources:
 * 1. HttpOnly 'token' cookie (browser web clients)
 * 2. 'Authorization: Bearer <token>' header (API clients / tools / Firebase web clients)
 * 
 * Then queries MongoDB to verify:
 * - User account exists
 * - User account is active (not suspended)
 * 
 * Attaches fresh MongoDB user document to `req.user`.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Check Bearer Authorization header (fallback or API clients / Firebase web clients)
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

    let user = null;

    // Path A: If Firebase Admin is configured, attempt Firebase ID Token verification first
    if (isFirebaseConfigured) {
      const fbResult = await verifyFirebaseIdToken(token);
      if (fbResult.isValid && fbResult.decodedToken) {
        const decodedToken = fbResult.decodedToken;

        // 1. Primary lookup by firebaseUid
        user = await User.findOne({ firebaseUid: decodedToken.uid });

        // 2. Fallback lookup by verified email for secure account linking
        if (!user && decodedToken.email && decodedToken.email_verified) {
          const normalizedEmail = decodedToken.email.toLowerCase().trim();
          user = await User.findOne({ email: normalizedEmail });

          if (user) {
            // Securely link existing account to Firebase UID
            user.firebaseUid = decodedToken.uid;
            if (!user.emailVerified) {
              user.emailVerified = true;
              user.emailVerifiedAt = new Date();
            }
            await user.save();
          }
        }

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'User account not found. Please complete ServeEase registration.',
            code: 'FIREBASE_USER_NOT_REGISTERED'
          });
        }

        if (user.status === 'suspended') {
          return res.status(403).json({
            success: false,
            error: 'This account has been suspended by an administrator. Please contact support.'
          });
        }

        req.user = user;
        req.firebaseUser = decodedToken;
        return next();
      }
    }

    // Path B: Fallback to standard ServeEase JWT verification
    const secret = getJwtSecret();
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
    user = await User.findById(decoded.userId);
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
    return next();
  } catch (error) {
    return next(error);
  }
};

export default authenticate;
