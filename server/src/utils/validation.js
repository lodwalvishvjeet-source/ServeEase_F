/**
 * ServeEase — Validation and Normalization Utilities
 * 
 * Provides consistent, secure validation for:
 * - Email syntax normalization
 * - Indian mobile numbers (10 digits starting with 6, 7, 8, or 9; optional +91 prefix)
 */

/**
 * Standard RFC-compliant email regex
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates and normalizes email syntax.
 * Note: Valid syntax confirms format only; it does not verify inbox ownership.
 * 
 * @param {string} email 
 * @returns {{ isValid: boolean, normalized: string, error?: string }}
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, normalized: '', error: 'Email address is required.' };
  }

  const trimmed = email.trim();
  if (!trimmed) {
    return { isValid: false, normalized: '', error: 'Email address cannot be empty.' };
  }

  const normalized = trimmed.toLowerCase();
  if (!EMAIL_REGEX.test(normalized)) {
    return {
      isValid: false,
      normalized,
      error: 'Please provide a valid email address (e.g. name@example.com).'
    };
  }

  return { isValid: true, normalized };
};

/**
 * Validates Indian mobile numbers:
 * Must be 10 digits starting with 6, 7, 8, or 9.
 * Accepts optional +91, 91, or 0 prefixes and ignores spaces, dashes, or parentheses.
 * Normalizes to standard '+91 XXXXXXXXXX' format.
 * 
 * @param {string} phone 
 * @returns {{ isValid: boolean, normalized: string, core10: string, error?: string }}
 */
export const validateIndianMobile = (phone) => {
  if (phone === undefined || phone === null) {
    return { isValid: false, normalized: '', core10: '', error: 'Phone number is required.' };
  }

  if (typeof phone !== 'string') {
    return { isValid: false, normalized: '', core10: '', error: 'Phone number must be a string.' };
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return { isValid: false, normalized: '', core10: '', error: 'Phone number cannot be empty.' };
  }

  // Remove formatting characters (spaces, dashes, parentheses)
  const clean = trimmed.replace(/[\s\-()]/g, '');

  // Must match either 10 digits starting with 6-9, or prefixed with +91, 91, or 0
  const match = clean.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  if (!match) {
    return {
      isValid: false,
      normalized: trimmed,
      core10: '',
      error: 'Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g., +91 98765 43210 or 9876543210).'
    };
  }

  const core10 = match[1];
  const normalized = `+91 ${core10}`;
  return { isValid: true, normalized, core10 };
};
