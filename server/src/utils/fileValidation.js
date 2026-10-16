/**
 * Document Content Validation Utility
 * 
 * Verifies document file types using magic bytes header signatures,
 * enforces size restrictions, and prevents spoofed extensions/MIMEs.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png'
];

/**
 * Validates a document buffer by inspecting its initial byte sequence.
 * 
 * Supported signatures:
 * - PDF:  %PDF- (0x25 0x50 0x44 0x46)
 * - JPEG: 0xFF 0xD8 0xFF
 * - PNG:  0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} reportedMimeType - Client-reported MIME type
 * @returns {{ isValid: boolean, detectedMime?: string, error?: string }}
 */
export const validateDocumentBuffer = (buffer, reportedMimeType = '') => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      isValid: false,
      error: 'Empty or unreadable document file.'
    };
  }

  // Enforce 5 MB maximum size
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds the maximum allowed limit of 5 MB.`
    };
  }

  // Detect genuine file type from magic bytes header
  let detectedMime = null;

  // PDF check: starts with "%PDF"
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    detectedMime = 'application/pdf';
  }
  // JPEG check: starts with 0xFF 0xD8 0xFF
  else if (
    buffer.length >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    detectedMime = 'image/jpeg';
  }
  // PNG check: starts with 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    detectedMime = 'image/png';
  }

  if (!detectedMime) {
    return {
      isValid: false,
      error: 'Invalid file format. Only legitimate PDF, JPEG, and PNG verification documents are accepted.'
    };
  }

  // If a reported MIME type was provided, verify compatibility
  const normalizedReported = reportedMimeType.toLowerCase().trim() === 'image/jpg'
    ? 'image/jpeg'
    : reportedMimeType.toLowerCase().trim();

  if (normalizedReported && normalizedReported !== detectedMime) {
    return {
      isValid: false,
      error: `Document header signature does not match reported MIME type (${reportedMimeType}).`
    };
  }

  return {
    isValid: true,
    detectedMime,
    size: buffer.length
  };
};

export default {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  validateDocumentBuffer
};
