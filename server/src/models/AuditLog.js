import mongoose from 'mongoose';

/**
 * AuditLog Schema — ServeEase Administrative Audit Trail
 * 
 * Rules & Invariants:
 * - Records all sensitive platform administrative actions (suspensions, verifications, review moderation, cancellations).
 * - Read-only for ordinary users; never exposed to non-admin accounts.
 * - Sensitive values such as passwords, JWTs, or secrets are strictly excluded.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // The acting administrator
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Acting administrator is required'],
      index: true
    },

    // Snapshot of admin's display name and email
    adminName: {
      type: String,
      trim: true,
      default: ''
    },
    adminEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },

    // Action verb describing operation
    action: {
      type: String,
      required: [true, 'Action type is required'],
      trim: true,
      index: true
    },

    // Target record being modified
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Target record ID is required'],
      index: true
    },

    // Entity type of the target
    targetType: {
      type: String,
      required: [true, 'Target type is required'],
      enum: ['User', 'Provider', 'Review', 'Booking'],
      index: true
    },

    // Optional administrator documented reason
    reason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
      default: ''
    },

    // Optional non-sensitive metadata snapshot
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
