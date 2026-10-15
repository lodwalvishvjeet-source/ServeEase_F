import express from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  getConversations,
  createOrGetConversation,
  getConversationById,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount
} from '../controllers/conversationController.js';

const router = express.Router();

// All conversation routes require authentication
router.use(authenticate);

// List authenticated user's conversations
router.get('/', getConversations);

// Create or get conversation
router.post('/', createOrGetConversation);

// Total unread messages across conversations
router.get('/unread-count', getUnreadCount);

// Specific conversation details
router.get('/:id', getConversationById);

// Message history for conversation
router.get('/:id/messages', getMessages);

// Send message to conversation
router.post('/:id/messages', sendMessage);

// Mark conversation messages as read
router.patch('/:id/read', markMessagesAsRead);

export default router;
