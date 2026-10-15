import mongoose from 'mongoose';

/**
 * Conversation Schema — ServeEase Direct Messaging Thread
 * 
 * Manages authorized direct communication channels between a Customer and a Provider:
 * - Participants: exactly 2 verified user references
 * - Booking: optional link to an existing appointment for job context
 * - lastMessage: cache of recent message text, sender, and timestamp
 */
const conversationSchema = new mongoose.Schema(
  {
    // The two participants involved in this communication thread
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],

    // Optional appointment context reference
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    },

    // Metadata cache for thread listing preview
    lastMessage: {
      text: {
        type: String,
        default: ''
      },
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      createdAt: {
        type: Date,
        default: null
      }
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

// Indexes for fast lookup of user conversations
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ booking: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
