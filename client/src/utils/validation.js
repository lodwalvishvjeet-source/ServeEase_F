/**
 * ServeEase — Client-Side Validation Utilities
 * 
 * Provides consistent validation for email syntax and Indian mobile phone numbers.
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validates and normalizes email format.
 * NOTE: Valid syntax confirms structure only; it does not prove inbox ownership.
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
      error: 'Please enter a valid email address (e.g. name@example.com).'
    };
  }

  return { isValid: true, normalized };
};

/**
 * Validates Indian mobile phone numbers:
 * - Exactly 10 digits
 * - Starts with 6, 7, 8, or 9
 * - Accepts optional +91, 91, or 0 prefixes with arbitrary spaces/dashes
 * - Returns normalized standard format (+91 XXXXXXXXXX)
 * 
 * @param {string} phone 
 * @returns {{ isValid: boolean, normalized: string, core10: string, error?: string }}
 */
export const validateIndianMobile = (phone) => {
  if (phone === undefined || phone === null) {
    return { isValid: false, normalized: '', core10: '', error: 'Enter a valid 10-digit Indian mobile number.' };
  }

  if (typeof phone !== 'string') {
    return { isValid: false, normalized: '', core10: '', error: 'Enter a valid 10-digit Indian mobile number.' };
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return { isValid: false, normalized: '', core10: '', error: 'Enter a valid 10-digit Indian mobile number.' };
  }

  // Reject any string containing characters other than digits, spaces, hyphens, parentheses, and leading plus
  if (!/^\+?[0-9\s\-()]+$/.test(trimmed)) {
    return {
      isValid: false,
      normalized: trimmed,
      core10: '',
      error: 'Enter a valid 10-digit Indian mobile number.'
    };
  }

  // Reject misplaced or multiple '+' signs
  if (trimmed.indexOf('+') > 0 || (trimmed.match(/\+/g) || []).length > 1) {
    return {
      isValid: false,
      normalized: trimmed,
      core10: '',
      error: 'Enter a valid 10-digit Indian mobile number.'
    };
  }

  // Remove permitted formatting characters (spaces, dashes, parentheses)
  const clean = trimmed.replace(/[\s\-()]/g, '');

  // Must match either 10 digits starting with 6-9, or prefixed with +91, 91, or 0
  const match = clean.match(/^(?:\+?91|0)?([6-9]\d{9})$/);

  if (!match) {
    return {
      isValid: false,
      normalized: trimmed,
      core10: '',
      error: 'Enter a valid 10-digit Indian mobile number.'
    };
  }

  const core10 = match[1];
  const normalized = `+91 ${core10}`;
  return { isValid: true, normalized, core10 };
};
