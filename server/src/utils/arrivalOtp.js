import crypto from 'crypto';

const getSecret = () => process.env.JWT_SECRET || 'serveease_secure_arrival_otp_key_2026';

/**
 * Generate a cryptographically secure 6-digit OTP, seed, SHA-256 hash, and 24h expiry.
 * Plaintext OTP is NEVER stored in the database.
 */
export const generateArrivalOtpPayload = (bookingId) => {
  const seed = crypto.randomBytes(16).toString('hex');
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(`${bookingId.toString()}:${seed}`);
  const codeNum = (hmac.digest().readUInt32BE(0) % 900000) + 100000;
  const otp = codeNum.toString();
  const hash = crypto.createHash('sha256').update(otp).digest('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry
  return {
    otp,
    seed,
    hash,
    expires
  };
};

/**
 * Derive the 6-digit OTP from bookingId and seed using the server's private secret.
 * Used exclusively to display the OTP to the authorized customer while status is accepted.
 */
export const deriveArrivalOtp = (bookingId, seed) => {
  if (!bookingId || !seed) return null;
  const hmac = crypto.createHmac('sha256', getSecret());
  hmac.update(`${bookingId.toString()}:${seed}`);
  const codeNum = (hmac.digest().readUInt32BE(0) % 900000) + 100000;
  return codeNum.toString();
};

/**
 * Hash an OTP candidate with SHA-256 for comparison against arrivalOtpHash.
 */
export const hashArrivalOtp = (otp) => {
  if (!otp) return '';
  return crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
};
