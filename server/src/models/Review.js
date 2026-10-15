import mongoose from 'mongoose';

/**
 * Review Schema — ServeEase Verified Customer Reviews & Ratings
 * 
 * Rules & Invariants:
 * - Only authenticated customers who personally booked and completed a service can submit a review.
 * - Exactly one review allowed per completed booking (enforced via database unique constraint on `booking`).
 * - Rating must be an integer or valid number from 1 to 5.
 * - Customer privacy is respected: customer info populated in queries strictly excludes sensitive data.
 */
const reviewSchema = new mongoose.Schema(
  {
    // The completed booking this review is for (unique: exactly 1 review per booking)
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      unique: true,
      index: true
    },

    // Verified customer who submitted the review
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer reference is required'],
      index: true
    },

    // Service provider who performed the job
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider reference is required'],
      index: true
    },

    // Snapshot of service name reviewed
    serviceName: {
      type: String,
      trim: true,
      default: ''
    },

    // Quantitative rating between 1 and 5
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars']
    },

    // Qualitative customer feedback / comments
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Review comment cannot exceed 1000 characters'],
      default: ''
    },

    // Moderation Status: 'visible' or 'hidden'
    status: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
      index: true
    },

    // Administrator moderation details when hidden
    hiddenReason: {
      type: String,
      trim: true,
      default: ''
    },
    hiddenAt: {
      type: Date,
      default: null
    },
    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Inappropriate review reports submitted by users
    reports: [
      {
        reporter: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        reporterRole: {
          type: String,
          enum: ['customer', 'provider', 'admin'],
          default: 'customer'
        },
        reason: {
          type: String,
          required: true,
          trim: true,
          maxlength: [500, 'Report reason cannot exceed 500 characters']
        },
        status: {
          type: String,
          enum: ['pending', 'dismissed', 'resolved'],
          default: 'pending'
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        resolvedAt: {
          type: Date,
          default: null
        },
        resolvedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        resolutionNote: {
          type: String,
          trim: true,
          default: ''
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indexes for query performance and uniqueness
reviewSchema.index({ provider: 1, createdAt: -1 });
reviewSchema.index({ customer: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

export default Review;
