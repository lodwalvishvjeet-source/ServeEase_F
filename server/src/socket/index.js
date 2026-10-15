import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';

let ioInstance = null;

/**
 * Initialize Socket.IO Server with JWT authentication and strict room security
 */
export const initSocket = (httpServer, allowedOrigins = []) => {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST']
    }
  });

  // Socket Authentication Middleware — derives user identity from verified JWT
  io.use(async (socket, next) => {
    try {
      // Extract token from handshake auth, authorization header, or HttpOnly cookie
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token && socket.handshake.headers?.cookie) {
        const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]);
        }
      }

      if (!token) {
        return next(new Error('Authentication required: No token provided'));
      }

      const secret =
        process.env.JWT_SECRET ||
        'dev_fallback_secret_serveease_college_project_change_in_production';

      const decoded = jwt.verify(token, secret);
      const userId = decoded.userId || decoded.id;

      if (!userId) {
        return next(new Error('Authentication failed: Malformed token payload'));
      }

      const user = await User.findById(userId).select('-passwordHash -__v');
      if (!user || user.status !== 'active') {
        return next(new Error('Authentication failed: User account not found or suspended'));
      }

      // Attach authenticated user to socket instance
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // User automatically joins their private personal notifications room
    socket.join(`user_${userId}`);

    /**
     * join_conversation event
     * Strictly verifies participant authorization before allowing room entry.
     * Prevents arbitrary room spoofing.
     */
    socket.on('join_conversation', async (data, callback) => {
      try {
        const conversationId = typeof data === 'string' ? data : data?.conversationId;

        if (!conversationId) {
          if (callback) callback({ success: false, error: 'Conversation ID is required' });
          return;
        }

        const conversation = await Conversation.findById(conversationId).populate('booking');
        if (!conversation) {
          if (callback) callback({ success: false, error: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );

        if (!isParticipant) {
          if (callback) {
            callback({
              success: false,
              error: 'Forbidden: You are not an authorized participant in this conversation'
            });
          }
          return;
        }

        if (conversation.booking) {
          const bCustomer = (conversation.booking.customer?._id || conversation.booking.customer)?.toString();
          const bProvider = (conversation.booking.provider?._id || conversation.booking.provider)?.toString();
          if (bCustomer && bProvider && userId !== bCustomer && userId !== bProvider) {
            if (callback) {
              callback({
                success: false,
                error: 'Forbidden: You are not authorized to join this booking conversation'
              });
            }
            return;
          }
        }

        // Join the conversation room
        socket.join(`conversation_${conversationId}`);
        if (callback) callback({ success: true, conversationId });
      } catch (err) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    /**
     * leave_conversation event
     */
    socket.on('leave_conversation', (data) => {
      const conversationId = typeof data === 'string' ? data : data?.conversationId;
      if (conversationId) {
        socket.leave(`conversation_${conversationId}`);
      }
    });

    /**
     * send_message event
     * Validates message, saves to MongoDB first, updates thread, broadcasts, and notifies recipient.
     */
    socket.on('send_message', async (data, callback) => {
      try {
        const conversationId = data?.conversationId;
        const text = data?.text;

        if (!conversationId) {
          if (callback) callback({ success: false, error: 'Conversation ID is required' });
          return;
        }

        if (!text || typeof text !== 'string' || !text.trim()) {
          if (callback) callback({ success: false, error: 'Message text cannot be empty' });
          return;
        }

        const cleanText = text.trim();
        if (cleanText.length > 2000) {
          if (callback) callback({ success: false, error: 'Message text cannot exceed 2000 characters' });
          return;
        }

        const conversation = await Conversation.findById(conversationId).populate('booking');
        if (!conversation) {
          if (callback) callback({ success: false, error: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );

        if (!isParticipant) {
          if (callback) {
            callback({
              success: false,
              error: 'Forbidden: You are not authorized to send messages in this conversation'
            });
          }
          return;
        }

        if (conversation.booking) {
          const booking = conversation.booking;
          const bCustomer = (booking.customer?._id || booking.customer)?.toString();
          const bProvider = (booking.provider?._id || booking.provider)?.toString();

          if (bCustomer && bProvider && userId !== bCustomer && userId !== bProvider) {
            if (callback) {
              callback({
                success: false,
                error: 'Forbidden: You are not authorized to participate in this booking conversation'
              });
            }
            return;
          }

          if (booking.status === 'pending') {
            if (callback) {
              callback({
                success: false,
                status: 409,
                error: 'Chat messaging is not available while booking is pending provider acceptance.'
              });
            }
            return;
          }

          if (booking.status === 'completed') {
            if (callback) {
              callback({
                success: false,
                status: 409,
                error: 'This service has been completed. Chat is closed for new messages.'
              });
            }
            return;
          }

          if (booking.status === 'rejected') {
            if (callback) {
              callback({
                success: false,
                status: 409,
                error: 'Chat messaging is not available for declined booking requests.'
              });
            }
            return;
          }

          if (booking.status === 'cancelled') {
            if (callback) {
              callback({
                success: false,
                status: 409,
                error: 'Chat messaging is not available for cancelled bookings.'
              });
            }
            return;
          }

          if (booking.status !== 'accepted' && booking.status !== 'in_progress') {
            if (callback) {
              callback({
                success: false,
                status: 409,
                error: `Chat messaging is only allowed for accepted or in-progress bookings (current status: ${booking.status}).`
              });
            }
            return;
          }
        }

        // 1. Save message to MongoDB first
        const message = await Message.create({
          conversation: conversation._id,
          sender: socket.user._id,
          text: cleanText
        });

        // 2. Update parent conversation lastMessage
        conversation.lastMessage = {
          text: cleanText,
          sender: socket.user._id,
          createdAt: message.createdAt
        };
        await conversation.save();

        const populatedMessage = await Message.findById(message._id).populate(
          'sender',
          'name role providerDetails.avatar'
        );

        // 3. Deliver to room participants
        io.to(`conversation_${conversationId}`).emit('new_message', populatedMessage);

        // 4. Create persistent notification for the recipient
        const recipientId = conversation.participants.find(
          (p) => p.toString() !== userId
        );

        if (recipientId) {
          try {
            await Notification.create({
              recipient: recipientId,
              type: 'new_message',
              title: `New message from ${socket.user.name}`,
              message: cleanText.length > 100 ? cleanText.slice(0, 97) + '...' : cleanText,
              booking: conversation.booking || null,
              data: { conversationId: conversation._id.toString() }
            });

            // Also emit alert to recipient's private user channel
            io.to(`user_${recipientId.toString()}`).emit('new_notification', {
              title: `New message from ${socket.user.name}`,
              conversationId: conversation._id.toString()
            });
          } catch (notifErr) {
            console.error('Socket message notification error:', notifErr.message);
          }
        }

        if (callback) callback({ success: true, message: populatedMessage });
      } catch (err) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    /**
     * mark_read event
     * Updates unread messages for this user and alerts the room
     */
    socket.on('mark_read', async (data, callback) => {
      try {
        const conversationId = typeof data === 'string' ? data : data?.conversationId;
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const isParticipant = conversation.participants.some(
          (p) => p.toString() === userId
        );
        if (!isParticipant) return;

        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.user._id },
            isRead: false
          },
          {
            $set: { isRead: true, readAt: new Date() }
          }
        );

        io.to(`conversation_${conversationId}`).emit('messages_read', {
          conversationId,
          readerId: userId
        });

        if (callback) callback({ success: true });
      } catch (err) {
        if (callback) callback({ success: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      // Socket cleanly disconnected
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Access singleton Socket.IO instance
 */
export const getIO = () => ioInstance;

export default {
  initSocket,
  getIO
};
