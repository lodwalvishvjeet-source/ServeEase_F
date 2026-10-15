import rateLimit from 'express-rate-limit';

/**
 * Authentication Endpoints Rate Limiter
 * 
 * Protects `/api/auth/login` and `/api/auth/register` against brute-force
 * attacks and credential-stuffing by limiting requests per IP window.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: process.env.NODE_ENV === 'test' ? 10000 : 30, // Limit each IP to 30 authentication requests per 15 minutes
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
  }
});

export default authLimiter;
