import express from 'express';
import {
  getAdminStats,
  getAdminAnalytics,
  getUsers,
  getUserById,
  updateUserStatus,
  getAdminProviders,
  verifyProvider,
  getAdminBookings,
  getAdminReviews,
  moderateReview,
  getAdminAuditLogs
} from '../controllers/adminController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRole } from '../middleware/authorizeRole.js';

const router = express.Router();

/**
 * Administrative Protected Routes
 * Every route requires valid JWT authentication AND role === 'admin'
 */
router.use(authenticate, authorizeRole('admin'));

// 1. Platform Statistics & Advanced Analytics
router.get('/stats', getAdminStats);
router.get('/analytics', getAdminAnalytics);

// 2. User Management & Moderation
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/status', updateUserStatus);

// 3. Provider Verification & Credentials
router.get('/providers', getAdminProviders);
router.patch('/providers/:id/verify', verifyProvider);

// 4. Booking Oversight (Read-only)
router.get('/bookings', getAdminBookings);

// 5. Review Moderation & Report Handling
router.get('/reviews', getAdminReviews);
router.patch('/reviews/:id/moderate', moderateReview);

// 6. Persistent Audit Trail
router.get('/audit-logs', getAdminAuditLogs);

export default router;
