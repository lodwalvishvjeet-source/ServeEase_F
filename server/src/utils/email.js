import nodemailer from 'nodemailer';

/**
 * Creates and returns a Nodemailer transporter instance based on environment variables.
 * Supports:
 *   1. Gmail service (service: 'gmail') via EMAIL_SERVICE=gmail, EMAIL_HOST containing gmail.com,
 *      or when EMAIL_USER ends with @gmail.com.
 *   2. Custom SMTP host via EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS.
 * 
 * Returns null if credentials (EMAIL_USER or EMAIL_PASS) are not provided.
 */
export const getTransporter = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();
  const host = process.env.EMAIL_HOST?.trim();
  const service = process.env.EMAIL_SERVICE?.trim();
  const port = Number(process.env.EMAIL_PORT) || 587;
  const secure = process.env.EMAIL_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    return null;
  }

  const isGmail =
    service?.toLowerCase() === 'gmail' ||
    host?.toLowerCase().includes('gmail.com') ||
    user.toLowerCase().endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }

  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });
  }

  return null;
};

/**
 * Check whether email delivery service has the required credentials configured.
 * @returns {boolean}
 */
export const isEmailConfigured = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();
  const host = process.env.EMAIL_HOST?.trim();
  const service = process.env.EMAIL_SERVICE?.trim();

  if (!user || !pass) return false;
  return Boolean(
    service?.toLowerCase() === 'gmail' ||
    host ||
    user.toLowerCase().endsWith('@gmail.com')
  );
};

/**
 * Send an email using the configured Nodemailer transporter.
 * Throws structured errors on configuration gaps or SMTP delivery failures.
 * Strictly NEVER logs OTP codes or sensitive credentials.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plaintext body
 * @param {string} options.html - HTML body
 * @returns {Promise<Object>} Nodemailer send info
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();

  if (!transporter) {
    const missing = [];
    if (!process.env.EMAIL_USER) missing.push('EMAIL_USER');
    if (!process.env.EMAIL_PASS) missing.push('EMAIL_PASS');
    if (!process.env.EMAIL_HOST && !process.env.EMAIL_SERVICE) missing.push('EMAIL_HOST or EMAIL_SERVICE');

    console.warn(`⚠️ [Email Service]: Email delivery not configured. Missing: ${missing.join(', ')}`);
    const error = new Error(`Email delivery is not configured on the server. Missing environment variables: ${missing.join(', ')}`);
    error.code = 'EMAIL_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  const fromAddress = process.env.EMAIL_FROM?.trim() || `"ServeEase" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text,
    html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (err) {
    console.error('❌ [Email Service]: SMTP delivery failed:', err.message);
    const deliveryError = new Error('Failed to deliver verification email via SMTP server.');
    deliveryError.code = 'EMAIL_DELIVERY_FAILED';
    deliveryError.statusCode = 503;
    deliveryError.originalMessage = err.message;
    throw deliveryError;
  }
};
