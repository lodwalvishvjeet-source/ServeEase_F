import express from 'express';
import { register, login, logout, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Public Authentication Endpoints (Rate Limited)
 */
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);

/**
 * Session Lifecycle Endpoints
 */
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
