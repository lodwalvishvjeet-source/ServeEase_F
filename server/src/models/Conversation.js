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
    },

    // Canonical pair key to strictly enforce uniqueness at the database level:
    // Sorted participant ObjectIds + optional booking ID (e.g. "idA:idB" or "idA:idB:bookingId")
    pairKey: {
      type: String,
      default: null,
      index: true
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

// Pre-save hook: compute canonical pairKey automatically if not explicitly provided
conversationSchema.pre('save', function () {
  if (this.participants && this.participants.length >= 2) {
    const sorted = [...this.participants]
      .map((p) => (p._id || p).toString())
      .sort((a, b) => a.localeCompare(b));
    const bId = this.booking ? (this.booking._id || this.booking).toString() : '';
    this.pairKey = `${sorted.join(':')}${bId ? ':' + bId : ''}`;
  }
});

// Indexes for fast lookup of user conversations and strict DB-level uniqueness
conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ booking: 1 });
conversationSchema.index({ pairKey: 1 }, { unique: true, sparse: true, name: 'pairKey_1_unique' });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
