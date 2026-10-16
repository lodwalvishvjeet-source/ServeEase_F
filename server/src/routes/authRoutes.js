import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyEmailOtp,
  resendEmailVerificationOtp
} from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Public Authentication Endpoints (Rate Limited)
 */
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/verify-email-otp', authLimiter, verifyEmailOtp);
router.post('/verify-email', authLimiter, verifyEmailOtp);
router.post('/resend-verification-otp', otpLimiter, resendEmailVerificationOtp);
router.post('/resend-email-otp', otpLimiter, resendEmailVerificationOtp);

/**
 * Session Lifecycle Endpoints
 */
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
