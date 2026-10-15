import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

/**
 * All notification operations require authentication
 */
router.use(authenticate);

// 1. List notifications for authenticated user
router.get('/', getNotifications);

// 2. Fast unread notification count
router.get('/unread-count', getUnreadCount);

// 3. Mark single notification as read
router.patch('/:id/read', markAsRead);

// 4. Mark all notifications as read
router.patch('/read-all', markAllAsRead);

export default router;
