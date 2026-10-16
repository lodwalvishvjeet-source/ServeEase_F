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
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: '', core10: '', error: 'Phone number is required.' };
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return { isValid: false, normalized: '', core10: '', error: 'Phone number cannot be empty.' };
  }

  const clean = trimmed.replace(/[\s\-()]/g, '');
  const match = clean.match(/^(?:\+?91|0)?([6-9]\d{9})$/);

  if (!match) {
    return {
      isValid: false,
      normalized: trimmed,
      core10: '',
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g. 98765 43210 or +91 98765 43210).'
    };
  }

  const core10 = match[1];
  const normalized = `+91 ${core10}`;
  return { isValid: true, normalized, core10 };
};
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required.' };
  }
  const trimmed = password.trim();
  if (trimmed.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }
  const hasUpper = /[A-Z]/.test(trimmed);
  const hasLower = /[a-z]/.test(trimmed);
  const hasNumber = /[0-9]/.test(trimmed);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(trimmed);
  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return { isValid: false, error: 'Password must include uppercase, lowercase, number, and special character.' };
  }
  return { isValid: true };
};
