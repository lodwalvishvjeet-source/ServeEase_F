import mongoose from 'mongoose';

/**
 * VerificationDocument Schema
 * Stores metadata for verification documents uploaded by service providers.
 * Document binary content is stored securely in MongoDB GridFS.
 */
const verificationDocumentSchema = new mongoose.Schema(
  {
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider reference is required'],
      index: true
    },
    gridFsFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'GridFS file identifier is required']
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: ['id_proof', 'trade_license', 'address_proof', 'certification', 'other'],
        message: '{VALUE} is not a valid document type'
      },
      default: 'trade_license'
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      enum: {
        values: ['application/pdf', 'image/jpeg', 'image/png'],
        message: '{VALUE} is not an allowed document format'
      }
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      max: [5 * 1024 * 1024, 'Document cannot exceed 5 MB']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'approved', 'rejected'],
        message: '{VALUE} is not a valid document review status'
      },
      default: 'pending',
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewNotes: {
      type: String,
      trim: true,
      default: ''
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: ''
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.gridFsFileId;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.gridFsFileId;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound index for querying a provider's documents by status and date
verificationDocumentSchema.index({ provider: 1, status: 1, createdAt: -1 });

verificationDocumentSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  const idStr = String(this._id);
  obj._id = idStr;
  obj.id = idStr;
  delete obj.gridFsFileId;
  delete obj.__v;
  return obj;
};

const VerificationDocument = mongoose.model('VerificationDocument', verificationDocumentSchema);

export default VerificationDocument;
