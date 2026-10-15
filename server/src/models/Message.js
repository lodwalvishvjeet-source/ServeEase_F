import mongoose from 'mongoose';

/**
 * Message Schema — ServeEase Chat Message
 * 
 * Individual messages exchanged between customer and provider:
 * - conversation: reference to parent thread
 * - sender: authenticated user who posted the message
 * - text: sanitized message body (1 to 2000 chars)
 * - isRead: read status flag for the recipient
 * - readAt: timestamp when recipient opened the thread
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation reference is required'],
      index: true
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
      index: true
    },

    text: {
      type: String,
      required: [true, 'Message text cannot be empty'],
      trim: true,
      minlength: [1, 'Message text cannot be empty'],
      maxlength: [2000, 'Message text cannot exceed 2000 characters']
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true
    },

    readAt: {
      type: Date,
      default: null
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

// Compound indexes for fetching message history and unread counts
messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ conversation: 1, sender: 1, isRead: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
