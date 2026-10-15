import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

/**
 * GET /api/notifications
 * Retrieve all notifications for the authenticated user, newest first.
 */
export const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('booking', 'serviceName bookingDate bookingTime status city price'),
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.countDocuments({ recipient: req.user._id, isRead: false })
    ]);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      notifications
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Fast endpoint to retrieve the unread notification count for the topbar badge.
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false
    });

    return res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read (strictly enforced for recipient only).
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification identifier format.'
      });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found.'
      });
    }

    // Ownership check: user cannot mark another user's notification as read
    if (notification.recipient.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to update this notification.'
      });
    }

    const updated = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: req.user._id
      },
      {
        $set: { isRead: true }
      },
      { returnDocument: 'after' }
    ).populate('booking', 'serviceName bookingDate bookingTime status city price');

    return res.status(200).json({
      success: true,
      notification: updated
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications belonging to the authenticated user as read.
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false
      },
      {
        $set: { isRead: true }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    return next(error);
  }
};
