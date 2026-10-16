import express from 'express';
import {
  getAdminStats,
  getAdminAnalytics,
  getUsers,
  getUserById,
  updateUserStatus,
  deleteUser,
  getAdminProviders,
  verifyProvider,
  getAdminBookings,
  getAdminReviews,
  moderateReview,
  getAdminAuditLogs
} from '../controllers/adminController.js';
import { getDocumentById, getProviderDocumentsForAdmin } from '../controllers/documentController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRole } from '../middleware/authorizeRole.js';
import { adminLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * Administrative Protected Routes
 * Every route requires valid rate limiting, JWT authentication AND role === 'admin'
 */
router.use(adminLimiter, authenticate, authorizeRole('admin'));

// 1. Platform Statistics & Advanced Analytics
router.get('/stats', getAdminStats);
router.get('/analytics', getAdminAnalytics);

// 2. User Management & Moderation
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUser);

// 3. Provider Verification & Credentials
router.get('/providers', getAdminProviders);
router.patch('/providers/:id/verify', verifyProvider);
router.get('/providers/:id/documents', getProviderDocumentsForAdmin);
router.get('/documents/:id', getDocumentById);

// 4. Booking Oversight (Read-only)
router.get('/bookings', getAdminBookings);

// 5. Review Moderation & Report Handling
router.get('/reviews', getAdminReviews);
router.patch('/reviews/:id/moderate', moderateReview);

// 6. Persistent Audit Trail
router.get('/audit-logs', getAdminAuditLogs);

export default router;
