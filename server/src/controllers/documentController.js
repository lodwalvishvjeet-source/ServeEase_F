import path from 'path';
import mongoose from 'mongoose';
import VerificationDocument from '../models/VerificationDocument.js';
import User from '../models/User.js';
import { validateDocumentBuffer } from '../utils/fileValidation.js';
import { uploadBufferToGridFS, openDownloadStreamFromGridFS, deleteFromGridFS } from '../utils/gridfs.js';

const ALLOWED_DOC_TYPES = ['id_proof', 'trade_license', 'address_proof', 'certification', 'other'];

/**
 * POST /api/providers/documents
 * Upload a verification document (Service Provider only)
 * 
 * Secure workflow:
 * 1. Role restricted to 'provider'
 * 2. Buffer inspected for genuine magic bytes (PDF, JPEG, PNG)
 * 3. 5 MB hard limit enforced
 * 4. Stored in MongoDB GridFS with metadata in separate collection
 * 5. Provider account is NOT automatically approved
 */
export const uploadDocument = async (req, res, next) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        error: 'Only service provider accounts can upload verification documents.'
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'Please select a document file to upload (form field name: "document").'
      });
    }

    // 1. Content validation via magic bytes
    const validation = validateDocumentBuffer(req.file.buffer, req.file.mimetype);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    // 2. Document type validation
    let docType = (req.body.documentType || 'trade_license').toLowerCase().trim();
    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      docType = 'trade_license';
    }

    // 3. Sanitize filename to prevent path traversal
    const safeOriginalFilename = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFilename = `prov_${req.user._id}_${Date.now()}_${safeOriginalFilename}`;

    // 4. Store binary in MongoDB GridFS
    let gridFsFileId;
    try {
      gridFsFileId = await uploadBufferToGridFS(req.file.buffer, storageFilename, {
        providerId: req.user._id,
        documentType: docType,
        originalFilename: safeOriginalFilename,
        mimeType: validation.detectedMime,
        fileSize: req.file.size
      });
    } catch (gridFsErr) {
      console.error('GridFS upload failure:', gridFsErr.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to securely store document contents. Please try again.'
      });
    }

    // 5. Create metadata record
    let documentRecord;
    try {
      documentRecord = await VerificationDocument.create({
        provider: req.user._id,
        gridFsFileId,
        documentType: docType,
        originalFilename: safeOriginalFilename,
        mimeType: validation.detectedMime,
        fileSize: req.file.size,
        status: 'pending'
      });
    } catch (dbErr) {
      // Clean up orphaned GridFS file if metadata insert fails
      await deleteFromGridFS(gridFsFileId);
      throw dbErr;
    }

    // 6. Update provider record submission metadata without auto-approving
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        'providerDetails.submittedAt': new Date(),
        'providerDetails.verificationStatus': 'pending',
        'providerDetails.isVerified': false,
        verificationStatus: 'pending'
      },
      $addToSet: {
        'providerDetails.verificationDocuments': documentRecord._id
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Verification document uploaded successfully and submitted for administrator review.',
      document: documentRecord.toSafeObject()
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/providers/documents
 * List all verification documents uploaded by the authenticated provider
 */
export const getMyDocuments = async (req, res, next) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        error: 'Only service providers can list their verification documents.'
      });
    }

    const documents = await VerificationDocument.find({ provider: req.user._id })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents: documents.map((d) => d.toSafeObject())
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/providers/documents/:id or GET /api/admin/documents/:id
 * Stream protected document binary from MongoDB GridFS
 * 
 * Authorization:
 * - Admin can download any document
 * - Provider can download only documents they own
 * - Customers and unauthenticated users receive 403 Forbidden
 */
export const getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document identifier.'
      });
    }

    const documentRecord = await VerificationDocument.findById(id);
    if (!documentRecord) {
      return res.status(404).json({
        success: false,
        error: 'Verification document not found.'
      });
    }

    // Access control: only owner or administrator
    const isOwner = req.user._id.toString() === documentRecord.provider.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You are not authorized to view this private verification document.'
      });
    }

    // Set streaming headers
    res.setHeader('Content-Type', documentRecord.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', documentRecord.fileSize);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${documentRecord.originalFilename.replace(/["\\]/g, '')}"`
    );
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const downloadStream = openDownloadStreamFromGridFS(documentRecord.gridFsFileId);

    downloadStream.on('error', (err) => {
      console.error('GridFS streaming error:', err.message);
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Error retrieving document content.'
        });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/providers/documents/:id
 * Remove an uploaded document (own account only, only when pending)
 */
export const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document identifier.'
      });
    }

    const documentRecord = await VerificationDocument.findById(id);
    if (!documentRecord) {
      return res.status(404).json({
        success: false,
        error: 'Verification document not found.'
      });
    }

    // Ownership check
    if (documentRecord.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You cannot delete documents belonging to another service provider.'
      });
    }

    // Delete from GridFS
    await deleteFromGridFS(documentRecord.gridFsFileId);

    // Delete metadata
    await VerificationDocument.findByIdAndDelete(id);

    // Remove reference from provider
    await User.findByIdAndUpdate(req.user._id, {
      $pull: {
        'providerDetails.verificationDocuments': id
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Verification document removed.'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/admin/providers/:id/documents
 * List all documents uploaded by a specific provider for admin review
 */
export const getProviderDocumentsForAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider identifier.'
      });
    }

    const provider = await User.findOne({ _id: id, role: 'provider' });
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Service provider not found.'
      });
    }

    const documents = await VerificationDocument.find({ provider: id })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: documents.length,
      provider: {
        _id: provider._id,
        name: provider.name,
        email: provider.email,
        category: provider.providerDetails?.category,
        verificationStatus: provider.providerDetails?.verificationStatus || (provider.providerDetails?.isVerified ? 'approved' : 'pending'),
        isVerified: Boolean(provider.providerDetails?.isVerified)
      },
      documents: documents.map((d) => d.toSafeObject())
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  uploadDocument,
  getMyDocuments,
  getDocumentById,
  deleteDocument,
  getProviderDocumentsForAdmin
};
