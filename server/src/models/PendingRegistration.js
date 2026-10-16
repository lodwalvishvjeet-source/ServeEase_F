import mongoose from 'mongoose';

/**
 * PendingRegistration Schema
 * Holds temporary registration submissions until the 6-digit email OTP
 * is verified by the server. Records expire automatically via TTL index.
 * No unverified accounts are ever inserted into the main User collection.
 */
const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required']
    },
    role: {
      type: String,
      enum: ['customer', 'provider'],
      required: true,
      default: 'customer'
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: ''
    },
    city: {
      type: String,
      trim: true,
      default: ''
    },
    providerDetails: {
      category: { type: String, trim: true, default: '' },
      categorySlug: { type: String, trim: true, default: '' },
      title: { type: String, trim: true, default: '' },
      servicesOffered: [{ type: String, trim: true }],
      experienceYears: { type: Number, default: 0 },
      city: { type: String, trim: true, default: '' },
      serviceArea: { type: String, trim: true, default: '' },
      startingPrice: { type: Number, default: 0 },
      hourlyRate: { type: Number, default: 0 },
      isAvailable: { type: Boolean, default: true },
      isVerified: { type: Boolean, default: false },
      isDemo: { type: Boolean, default: false },
      bio: { type: String, trim: true, default: '' },
      avatar: { type: String, trim: true, default: '' },
      responseTime: { type: String, default: 'Within 1 hour' }
    },
    otpHash: {
      type: String,
      required: true
    },
    otpExpires: {
      type: Date,
      required: true,
      index: { expires: 0 } // Document removed by MongoDB TTL once expired
    },
    attempts: {
      type: Number,
      default: 0
    },
    lastResendAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const PendingRegistration = mongoose.model('PendingRegistration', pendingRegistrationSchema);

export default PendingRegistration;
