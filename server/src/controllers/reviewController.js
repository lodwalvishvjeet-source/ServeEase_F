import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

// Safe customer projection when reviews are publicly listed
const CUSTOMER_SAFE_FIELDS = 'name city';

// Safe provider projection
const PROVIDER_SAFE_FIELDS = 'name city providerDetails.title providerDetails.category providerDetails.avatar';

/**
 * Reusable helper: calculate provider average rating and review count from persisted reviews
 * and update the provider's User document.
 */
export const recalculateProviderRating = async (providerId) => {
  const pId = new mongoose.Types.ObjectId(providerId);
  const stats = await Review.aggregate([
    { $match: { provider: pId, status: { $ne: 'hidden' } } },
    {
      $group: {
        _id: '$provider',
        avgRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 }
      }
    }
  ]);

  const reviewCount = stats.length > 0 ? stats[0].reviewCount : 0;
  // If no reviews, do not fabricate a 5-star rating; store null
  const averageRating = reviewCount > 0 ? Math.round(stats[0].avgRating * 10) / 10 : null;

  await User.findByIdAndUpdate(providerId, {
    $set: {
      'providerDetails.rating': averageRating,
      'providerDetails.reviewCount': reviewCount
    }
  });

  return { averageRating, reviewCount };
};

/**
 * POST /api/reviews
 * Submit a verified review for a completed booking (Customer only)
 */
export const createReview = async (req, res, next) => {
  try {
    // 1. Authenticated customer check
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        error: 'Only customers are permitted to submit service reviews.'
      });
    }

    const { bookingId, rating, comment, reviewText } = req.body;

    // 2. Validate booking ID
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        error: 'A valid completed booking identifier is required.'
      });
    }

    // 3. Validate rating (must be an integer from 1 to 5)
    const numRating = Number(rating);
    if (
      rating === undefined ||
      rating === null ||
      isNaN(numRating) ||
      !Number.isInteger(numRating) ||
      numRating < 1 ||
      numRating > 5
    ) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be an integer between 1 and 5 stars.'
      });
    }

    // 4. Validate comment length
    const rawComment = (comment !== undefined ? comment : reviewText) || '';
    if (typeof rawComment !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Review comment must be a text string.'
      });
    }
    const cleanComment = rawComment.trim();
    if (cleanComment.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Review text cannot exceed 1000 characters.'
      });
    }

    // 5. Retrieve booking and check existence
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found.'
      });
    }

    // 6. Ownership: Customer can only review bookings they personally created
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only review bookings that you personally scheduled.'
      });
    }

    // 7. Status: Booking must be completed
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: `Cannot review booking with status "${booking.status}". Reviews are permitted only for completed appointments.`
      });
    }

    // 8. One review per booking constraint check
    const existingReview = await Review.findOne({ booking: booking._id });
    if (existingReview) {
      return res.status(409).json({
        success: false,
        error: 'A review has already been submitted for this booking.'
      });
    }

    // 9. Create Review record
    let review;
    try {
      review = await Review.create({
        booking: booking._id,
        customer: req.user._id,
        provider: booking.provider,
        serviceName: booking.serviceName || '',
        rating: numRating,
        comment: cleanComment
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'A review has already been submitted for this booking.'
        });
      }
      throw createErr;
    }

    // 10. Recalculate provider's persisted rating & reviewCount
    const { averageRating, reviewCount } = await recalculateProviderRating(booking.provider);

    // 11. Create persistent notification for provider
    try {
      await Notification.create({
        recipient: booking.provider,
        type: 'review_received',
        title: 'New Customer Review',
        message: `${req.user.name} rated your service "${booking.serviceName}" with ${numRating} star${numRating > 1 ? 's' : ''}.`,
        booking: booking._id,
        data: {
          reviewId: review._id,
          bookingId: booking._id,
          rating: numRating,
          customerName: req.user.name
        }
      });
    } catch (notifErr) {
      console.warn('Could not persist review notification:', notifErr.message);
    }

    // Populate safe customer details for response
    const populated = await Review.findById(review._id)
      .populate('customer', CUSTOMER_SAFE_FIELDS);

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully. Thank you for your feedback!',
      review: populated,
      providerStats: {
        averageRating,
        reviewCount
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/reviews/provider/:providerId
 * List verified reviews for a service provider (Public or Authenticated)
 */
export const getProviderReviews = async (req, res, next) => {
  try {
    const { providerId } = req.params;

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider identifier.'
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { provider: new mongoose.Types.ObjectId(providerId), status: { $ne: 'hidden' } };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('customer', CUSTOMER_SAFE_FIELDS)
        .lean(),
      Review.countDocuments(filter)
    ]);

    // Retrieve provider aggregate rating
    const provider = await User.findById(providerId).select('providerDetails');
    const averageRating = provider?.providerDetails?.rating ?? null;
    const reviewCount = provider?.providerDetails?.reviewCount ?? total;

    return res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      averageRating,
      reviewCount,
      reviews
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/reviews/my
 * Get authenticated customer's own submitted reviews
 */
export const getMyReviews = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        error: 'Only customers have personal review records.'
      });
    }

    const reviews = await Review.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .populate('provider', PROVIDER_SAFE_FIELDS)
      .populate('booking', 'bookingDate bookingTime status serviceName price')
      .lean();

    return res.status(200).json({
      success: true,
      count: reviews.length,
      reviews
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/reviews/booking/:bookingId
 * Check if a particular booking has already been reviewed
 */
export const getBookingReview = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking identifier.'
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found.'
      });
    }

    // Access authorization check: Only the customer who created the booking, the assigned provider, or an admin
    const userId = req.user._id.toString();
    const isCustomer = booking.customer.toString() === userId;
    const isProvider = booking.provider.toString() === userId;
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to check review details for this booking.'
      });
    }

    const review = await Review.findOne({ booking: bookingId })
      .populate('customer', CUSTOMER_SAFE_FIELDS)
      .lean();

    return res.status(200).json({
      success: true,
      hasReviewed: Boolean(review),
      review: review || null
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/reviews/provider/:providerId/stats
 * Detailed rating distribution & metrics for a provider
 */
export const getProviderReviewStats = async (req, res, next) => {
  try {
    const { providerId } = req.params;

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider identifier.'
      });
    }

    const pId = new mongoose.Types.ObjectId(providerId);

    const [distribution, overall] = await Promise.all([
      Review.aggregate([
        { $match: { provider: pId, status: { $ne: 'hidden' } } },
        { $group: { _id: '$rating', count: { $sum: 1 } } }
      ]),
      Review.aggregate([
        { $match: { provider: pId, status: { $ne: 'hidden' } } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ])
    ]);

    const distMap = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach(d => {
      if (distMap[d._id] !== undefined) {
        distMap[d._id] = d.count;
      }
    });

    const totalReviews = overall.length > 0 ? overall[0].totalReviews : 0;
    const averageRating = totalReviews > 0 ? Math.round(overall[0].avgRating * 10) / 10 : null;

    return res.status(200).json({
      success: true,
      totalReviews,
      averageRating,
      distribution: distMap
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/reviews/:id/report
 * Report an inappropriate review for moderation (Authenticated Customer or Provider)
 */
export const reportReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'A valid review identifier is required.'
      });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'A specific explanation for this report is required (minimum 3 characters).'
      });
    }

    if (reason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        error: 'Report reason cannot exceed 500 characters.'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found.'
      });
    }

    // Check if review is already hidden
    if (review.status === 'hidden') {
      return res.status(400).json({
        success: false,
        error: 'This review has already been moderated and hidden.'
      });
    }

    // Check if user already reported this review
    const alreadyReported = review.reports?.some(
      r => r.reporter.toString() === req.user._id.toString() && r.status === 'pending'
    );
    if (alreadyReported) {
      return res.status(409).json({
        success: false,
        error: 'You have already submitted a pending report for this review.'
      });
    }

    review.reports.push({
      reporter: req.user._id,
      reporterRole: req.user.role,
      reason: reason.trim(),
      status: 'pending',
      createdAt: new Date()
    });

    await review.save();

    return res.status(201).json({
      success: true,
      message: 'Thank you for your report. Our administrative moderation team will investigate this review.'
    });
  } catch (error) {
    return next(error);
  }
};
