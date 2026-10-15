import mongoose from 'mongoose';

/**
 * Notification Schema — ServeEase User Activity Alerts
 * 
 * Supports notifications across the booking lifecycle:
 * - 'booking_created': Notifies provider when customer creates a booking
 * - 'booking_accepted': Notifies customer when provider accepts appointment
 * - 'booking_rejected': Notifies customer when provider declines appointment
 * - 'booking_cancelled': Notifies opposite party when booking is cancelled
 * - 'booking_completed': Notifies customer when service is marked completed
 * - 'system': Platform or account security notifications
 */
const notificationSchema = new mongoose.Schema(
  {
    // The recipient user of the notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user reference is required'],
      index: true
    },

    // Category of event
    type: {
      type: String,
      enum: {
        values: [
          'booking_created',
          'booking_accepted',
          'booking_in_progress',
          'booking_rejected',
          'booking_cancelled',
          'booking_completed',
          'new_message',
          'review_received',
          'system'
        ],
        message: '{VALUE} is not a recognized notification type'
      },
      required: [true, 'Notification type is required']
    },

    // Headline title
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },

    // Detailed message body
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters']
    },

    // Optional related booking reference
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true
    },

    // Read state
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },

    // Additional structured metadata (e.g. serviceName, customerName, city)
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound indexes for fast query performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
