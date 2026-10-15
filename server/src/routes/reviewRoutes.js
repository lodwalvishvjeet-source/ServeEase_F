import express from 'express';
import {
  createReview,
  getProviderReviews,
  getMyReviews,
  getBookingReview,
  getProviderReviewStats,
  reportReview
} from '../controllers/reviewController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRole } from '../middleware/authorizeRole.js';

const router = express.Router();

/**
 * Reviews & Ratings API Routes
 */

// POST /api/reviews — Authenticated customer submits review for a completed booking
router.post('/', authenticate, authorizeRole('customer'), createReview);

// GET /api/reviews/my — Authenticated customer lists their submitted reviews
router.get('/my', authenticate, authorizeRole('customer'), getMyReviews);

// GET /api/reviews/provider/:providerId — Public/Authenticated list of reviews for a provider
router.get('/provider/:providerId', getProviderReviews);

// GET /api/reviews/provider/:providerId/stats — Aggregated distribution & rating statistics
router.get('/provider/:providerId/stats', getProviderReviewStats);

// GET /api/reviews/booking/:bookingId — Check if an eligible booking has been reviewed
router.get('/booking/:bookingId', authenticate, getBookingReview);

// POST /api/reviews/:id/report — Authenticated user reports an inappropriate review
router.post('/:id/report', authenticate, reportReview);

export default router;
