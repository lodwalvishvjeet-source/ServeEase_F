import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { getIO } from '../socket/index.js';

// In-memory concurrency lock to prevent simultaneous requests from creating duplicate conversations
const pendingCreations = new Map();

/**
 * GET /api/conversations
 * List all conversations where the authenticated user is an authorized participant
 */
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId
    })
      .sort({ updatedAt: -1 })
      .populate('participants', 'name email role city phoneNumber providerDetails.avatar providerDetails.category providerDetails.title')
      .populate('booking', 'serviceName bookingDate bookingTime status price city serviceAddress completedAt customer provider');

    // Deduplicate conversations so each participant pair has exactly one logical conversation entry
    const seenPairs = new Set();
    const uniqueConversations = [];

    for (const conv of conversations) {
      const otherParticipant = conv.participants?.find(
        (p) => !p._id.equals(userId)
      );
      const otherId = otherParticipant ? otherParticipant._id.toString() : 'unknown';
      const pairKey = otherId + (conv.booking ? `_${(conv.booking._id || conv.booking).toString()}` : '');

      if (!seenPairs.has(pairKey)) {
        seenPairs.add(pairKey);
        uniqueConversations.push(conv);
      }
    }

    // Calculate unread message counts for each conversation
    const conversationsWithUnread = await Promise.all(
      uniqueConversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          isRead: false
        });

        const convObj = conv.toObject();
        convObj.unreadCount = unreadCount;
        return convObj;
      })
    );

    return res.status(200).json({
      success: true,
      count: conversationsWithUnread.length,
      conversations: conversationsWithUnread
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/conversations
 * Retrieve or create an authorized conversation
 * Supports linking to an appointment (bookingId) or verified provider (providerId)
 */
export const createOrGetConversation = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { bookingId, providerId, customerId } = req.body;

    let targetParticipantId = null;
    let linkedBooking = null;

    // 1. If conversation is linked to a booking
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Referenced booking appointment was not found.'
        });
      }

      // Check authorization: current user must be customer or provider of this booking
      const isCustomer = booking.customer.equals(userId);
      const isProvider = booking.provider.equals(userId);

      if (!isCustomer && !isProvider) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You are not authorized to start a conversation for this booking.'
        });
      }

      linkedBooking = booking._id;
      targetParticipantId = isCustomer ? booking.provider : booking.customer;
    } else if (providerId) {
      // 2. Pre-booking consultation initiated by customer with a provider
      const provider = await User.findOne({ _id: providerId, role: 'provider', status: 'active' });
      if (!provider) {
        return res.status(404).json({
          success: false,
          error: 'Target service provider not found or inactive.'
        });
      }

      if (provider._id.equals(userId)) {
        return res.status(400).json({
          success: false,
          error: 'You cannot start a conversation with yourself.'
        });
      }

      targetParticipantId = provider._id;
    } else if (customerId && req.user.role === 'provider') {
      // 3. Provider initiating with a customer
      const customer = await User.findOne({ _id: customerId, role: 'customer', status: 'active' });
      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Target customer was not found.'
        });
      }
      targetParticipantId = customer._id;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either a valid bookingId or providerId is required to start a conversation.'
      });
    }

    if (userId.equals(targetParticipantId)) {
      return res.status(400).json({
        success: false,
        error: 'You cannot start a conversation with yourself.'
      });
    }

    // Canonical sorted participants array ensures customer-provider ordering is invariant
    const canonicalParticipants = [userId, targetParticipantId].sort((a, b) =>
      a.toString().localeCompare(b.toString())
    );

    const canonicalPairKey = `${canonicalParticipants.map((p) => p.toString()).join(':')}${linkedBooking ? ':' + linkedBooking : ''}`;

    // Query for existing conversation:
    // If bookingId is provided, look for conversation for that booking
    // If direct providerId is provided, look for ANY existing conversation between this participant pair
    const existingQuery = {
      $or: [
        { pairKey: canonicalPairKey },
        linkedBooking
          ? { booking: linkedBooking, participants: { $all: [userId, targetParticipantId] } }
          : { participants: { $all: [userId, targetParticipantId] } }
      ]
    };

    let existingConv = await Conversation.findOne(existingQuery)
      .sort({ updatedAt: -1 })
      .populate('participants', 'name email role city phoneNumber providerDetails.avatar providerDetails.category providerDetails.title')
      .populate('booking', 'serviceName bookingDate bookingTime status price city serviceAddress completedAt customer provider');

    if (existingConv) {
      const unreadCount = await Message.countDocuments({
        conversation: existingConv._id,
        sender: { $ne: userId },
        isRead: false
      });
      const obj = existingConv.toObject();
      obj.unreadCount = unreadCount;
      return res.status(200).json({
        success: true,
        conversation: obj
      });
    }

    // Concurrency safety: deduplicate simultaneous in-flight creation requests
    const lockKey = canonicalPairKey;

    if (pendingCreations.has(lockKey)) {
      const existingPromise = pendingCreations.get(lockKey);
      const result = await existingPromise;
      return res.status(result.status).json({
        success: true,
        conversation: result.conversation
      });
    }

    const creationPromise = (async () => {
      // Re-check DB in case an earlier request created it right before lock acquisition
      const doubleCheck = await Conversation.findOne(existingQuery)
        .sort({ updatedAt: -1 })
        .populate('participants', 'name email role city phoneNumber providerDetails.avatar providerDetails.category providerDetails.title')
        .populate('booking', 'serviceName bookingDate bookingTime status price city serviceAddress completedAt customer provider');

      if (doubleCheck) {
        const unreadCount = await Message.countDocuments({
          conversation: doubleCheck._id,
          sender: { $ne: userId },
          isRead: false
        });
        const obj = doubleCheck.toObject();
        obj.unreadCount = unreadCount;
        return { status: 200, conversation: obj };
      }

      const newConv = await Conversation.create({
        participants: canonicalParticipants,
        booking: linkedBooking || null,
        pairKey: canonicalPairKey
      });

      const populatedConv = await Conversation.findById(newConv._id)
        .populate('participants', 'name email role city phoneNumber providerDetails.avatar providerDetails.category providerDetails.title')
        .populate('booking', 'serviceName bookingDate bookingTime status price city serviceAddress completedAt customer provider');

      const convObj = populatedConv.toObject();
      convObj.unreadCount = 0;
      return { status: 201, conversation: convObj };
    })();

    pendingCreations.set(lockKey, creationPromise);
    try {
      const result = await creationPromise;
      return res.status(result.status).json({
        success: true,
        conversation: result.conversation
      });
    } finally {
      pendingCreations.delete(lockKey);
    }
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/conversations/:id
 * Retrieve individual conversation details with strict authorization check
 */
export const getConversationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(id)
      .populate('participants', 'name email role city phoneNumber providerDetails.avatar providerDetails.category providerDetails.title')
      .populate('booking', 'serviceName bookingDate bookingTime status price city serviceAddress completedAt customer provider');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found.'
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p._id.equals(userId)
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to view this conversation.'
      });
    }

    if (conversation.booking) {
      const bCustomer = (conversation.booking.customer?._id || conversation.booking.customer)?.toString();
      const bProvider = (conversation.booking.provider?._id || conversation.booking.provider)?.toString();
      if (bCustomer && bProvider && userId.toString() !== bCustomer && userId.toString() !== bProvider) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You are not authorized to view this booking conversation.'
        });
      }
    }

    const unreadCount = await Message.countDocuments({
      conversation: conversation._id,
      sender: { $ne: userId },
      isRead: false
    });

    const convObj = conversation.toObject();
    convObj.unreadCount = unreadCount;

    return res.status(200).json({
      success: true,
      conversation: convObj
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/conversations/:id/messages
 * Retrieve paginated message history for an authorized conversation
 */
export const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { limit = 50, page = 1 } = req.query;

    const conversation = await Conversation.findById(id).populate('booking');
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found.'
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.equals(userId)
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not an authorized participant in this conversation.'
      });
    }

    if (conversation.booking) {
      const bCustomer = (conversation.booking.customer?._id || conversation.booking.customer)?.toString();
      const bProvider = (conversation.booking.provider?._id || conversation.booking.provider)?.toString();
      if (bCustomer && bProvider && userId.toString() !== bCustomer && userId.toString() !== bProvider) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You are not an authorized participant in this booking conversation.'
        });
      }
    }

    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * limitNum;

    const total = await Message.countDocuments({ conversation: id });
    const messages = await Message.find({ conversation: id })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate('sender', 'name role providerDetails.avatar');

    return res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page: pageNum,
      messages
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/conversations/:id/messages
 * Post a new message to a conversation thread
 */
export const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { text } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message text cannot be empty.'
      });
    }

    const cleanText = text.trim();
    if (cleanText.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message text cannot exceed 2000 characters.'
      });
    }

    const conversation = await Conversation.findById(id).populate('booking');
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found.'
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.equals(userId)
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to send messages in this conversation.'
      });
    }

    // Enforce booking status lifecycle check
    if (conversation.booking) {
      const booking = conversation.booking;
      const bCustomer = (booking.customer?._id || booking.customer)?.toString();
      const bProvider = (booking.provider?._id || booking.provider)?.toString();

      if (bCustomer && bProvider && userId.toString() !== bCustomer && userId.toString() !== bProvider) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You are not authorized to participate in this booking conversation.'
        });
      }

      if (booking.status === 'pending') {
        return res.status(409).json({
          success: false,
          error: 'Chat messaging is not available while booking is pending provider acceptance.'
        });
      }

      if (booking.status === 'completed') {
        return res.status(409).json({
          success: false,
          error: 'This service has been completed. Chat is closed for new messages.'
        });
      }

      if (booking.status === 'rejected') {
        return res.status(409).json({
          success: false,
          error: 'Chat messaging is not available for declined booking requests.'
        });
      }

      if (booking.status === 'cancelled') {
        return res.status(409).json({
          success: false,
          error: 'Chat messaging is not available for cancelled bookings.'
        });
      }

      if (booking.status !== 'accepted' && booking.status !== 'in_progress') {
        return res.status(409).json({
          success: false,
          error: `Chat messaging is only allowed for accepted or in-progress bookings (current status: ${booking.status}).`
        });
      }
    }

    // 1. Save message to MongoDB first
    const message = await Message.create({
      conversation: conversation._id,
      sender: userId,
      text: cleanText
    });

    // 2. Update conversation lastMessage metadata
    conversation.lastMessage = {
      text: cleanText,
      sender: userId,
      createdAt: message.createdAt
    };
    await conversation.save();

    const populatedMessage = await Message.findById(message._id).populate(
      'sender',
      'name role providerDetails.avatar'
    );

    // 3. Deliver via Socket.IO if active
    const recipientId = conversation.participants.find(
      (p) => !p.equals(userId)
    );

    const io = getIO();
    if (io) {
      // Chaining .to() delivers to both rooms while Socket.IO deduplicates any sockets present in both
      let broadcast = io.to(`conversation_${id}`);
      if (recipientId) {
        broadcast = broadcast.to(`user_${recipientId.toString()}`);
      }
      broadcast.emit('new_message', populatedMessage);
    }

    // 4. Create persistent notification for the recipient
    if (recipientId) {

      try {
        await Notification.create({
          recipient: recipientId,
          type: 'new_message',
          title: `New message from ${req.user.name}`,
          message: cleanText.length > 100 ? cleanText.slice(0, 97) + '...' : cleanText,
          booking: conversation.booking || null,
          data: { conversationId: conversation._id.toString() }
        });

        if (io) {
          io.to(`user_${recipientId.toString()}`).emit('new_notification', {
            title: `New message from ${req.user.name}`,
            conversationId: conversation._id.toString()
          });
        }
      } catch (notifErr) {
        console.error('Failed to create message notification:', notifErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: populatedMessage
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/conversations/:id/read
 * Mark received messages in conversation as read for the authenticated recipient
 */
export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found.'
      });
    }

    const isParticipant = conversation.participants.some(
      (p) => p.equals(userId)
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to access this conversation.'
      });
    }

    const result = await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: userId },
        isRead: false
      },
      {
        $set: { isRead: true, readAt: new Date() }
      }
    );

    const io = getIO();
    if (io) {
      io.to(`conversation_${id}`).emit('messages_read', {
        conversationId: id,
        readerId: userId.toString()
      });
    }

    return res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount || 0
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/conversations/unread-count
 * Returns total unread messages count for current user
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find all conversations user is a part of
    const userConversations = await Conversation.find({ participants: userId }).select('_id');
    const convIds = userConversations.map((c) => c._id);

    const unreadCount = await Message.countDocuments({
      conversation: { $in: convIds },
      sender: { $ne: userId },
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

export default {
  getConversations,
  createOrGetConversation,
  getConversationById,
  getMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount
};
