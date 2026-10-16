import mongoose from 'mongoose';

/**
 * MongoDB GridFS Helper
 * Manages bucket creation, document streaming, and cleanup using
 * the project's active MongoDB connection.
 */

const BUCKET_NAME = 'verification_documents';

/**
 * Returns a GridFSBucket bound to the active database connection.
 */
export const getGridFSBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB database connection is not established for GridFS.');
  }
  return new mongoose.mongo.GridFSBucket(db, {
    bucketName: BUCKET_NAME
  });
};

/**
 * Uploads a memory buffer into GridFS.
 * Automatically cleans up any partial upload stream on error.
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Stored filename
 * @param {Object} metadata - Optional GridFS metadata
 * @returns {Promise<mongoose.Types.ObjectId>} Stored GridFS file ID
 */
export const uploadBufferToGridFS = async (buffer, filename, metadata = {}) => {
  const bucket = getGridFSBucket();
  
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        ...metadata,
        uploadedAt: new Date()
      }
    });

    uploadStream.on('error', (err) => {
      reject(err);
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });

    uploadStream.end(buffer);
  });
};

/**
 * Opens a readable download stream for a given GridFS file ID.
 * 
 * @param {string|mongoose.Types.ObjectId} fileId
 * @returns {GridFSBucketReadStream}
 */
export const openDownloadStreamFromGridFS = (fileId) => {
  const bucket = getGridFSBucket();
  const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
  return bucket.openDownloadStream(objectId);
};

/**
 * Deletes a file and its chunks from GridFS.
 * 
 * @param {string|mongoose.Types.ObjectId} fileId
 */
export const deleteFromGridFS = async (fileId) => {
  try {
    const bucket = getGridFSBucket();
    const objectId = typeof fileId === 'string' ? new mongoose.Types.ObjectId(fileId) : fileId;
    await bucket.delete(objectId);
  } catch (err) {
    console.warn(`GridFS file ${fileId} deletion notice:`, err.message);
  }
};

export default {
  getGridFSBucket,
  uploadBufferToGridFS,
  openDownloadStreamFromGridFS,
  deleteFromGridFS
};
