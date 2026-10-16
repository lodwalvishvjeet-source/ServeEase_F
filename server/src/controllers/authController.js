import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { normalizeCity, SUPPORTED_CITIES } from '../config/cities.js';
import { validateEmail, validateIndianMobile } from '../utils/validation.js';
import { getJwtSecret } from '../config/env.js';

/**
 * JWT Token Generator
 * Signs user ID and role into the token with 24h expiration
 */
export const generateToken = (userId, role) => {
  const secret = getJwtSecret();
  return jwt.sign(
    { userId, role },
    secret,
    { expiresIn: '24h' }
  );
};

/**
 * Helper to set HttpOnly Cookie with security best practices
 */
export const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });
};

/**
 * Helper to clear the Auth Cookie on logout
 */
export const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
};

/**
 * POST /api/auth/register
 * Register a Customer or Service Provider
 * Public admin creation is strictly forbidden.
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'customer', phoneNumber, city, providerDetails, agreeTerms, acceptedTerms } = req.body;

    // 1. Basic field presence checks
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    // Terms & conditions validation if explicitly provided as false
    const termsRejected = agreeTerms === false || acceptedTerms === false;
    if (termsRejected) {
      return res.status(400).json({
        success: false,
        error: 'You must agree to the Terms of Service and Privacy Policy to register.'
      });
    }

    // 2. Strict public role restriction & privilege escalation guard
    const requestedRole = (role || 'customer').toLowerCase().trim();
    if (
      requestedRole === 'admin' ||
      req.body.isAdmin === true ||
      req.body.isAdmin === 'true' ||
      req.body.isAdministrator === true ||
      req.body.isAdministrator === 'true' ||
      req.body.admin === true
    ) {
      return res.status(400).json({
        success: false,
        error: 'Administrator accounts cannot be created through public registration. Use the secure bootstrap script.'
      });
    }

    if (!['customer', 'provider'].includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        error: "Invalid account role. Public registration only supports 'customer' or 'provider'."
      });
    }

    // 3. Email format validation and normalization
    const emailResult = validateEmail(email);
    if (!emailResult.isValid) {
      return res.status(400).json({ success: false, error: emailResult.error });
    }
    const normalizedEmail = emailResult.normalized;

    // 4. Phone number validation (Indian mobile format: 10 digits starting with 6, 7, 8, or 9)
    let normalizedPhoneNumber = '';
    if (phoneNumber !== undefined && phoneNumber !== null && String(phoneNumber).trim() !== '') {
      const phoneResult = validateIndianMobile(String(phoneNumber));
      if (!phoneResult.isValid) {
        return res.status(400).json({ success: false, error: phoneResult.error });
      }
      normalizedPhoneNumber = phoneResult.normalized;
    }

    // 5. Password policy (at least 6 characters)
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    // 6. City Validation (Required for both Customer and Provider)
    const rawCity = city || (requestedRole === 'provider' ? providerDetails?.city : undefined);
    if (!rawCity || typeof rawCity !== 'string' || !rawCity.trim()) {
      return res.status(400).json({
        success: false,
        error: `Please select your city. Supported cities: ${SUPPORTED_CITIES.map(c => c.name).join(', ')}.`
      });
    }

    const canonicalCity = normalizeCity(rawCity);
    if (!canonicalCity) {
      return res.status(400).json({
        success: false,
        error: `Invalid city selected: "${rawCity}". Supported cities: ${SUPPORTED_CITIES.map(c => c.name).join(', ')}.`
      });
    }

    // 7. Duplicate account check
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in instead.'
      });
    }

    // 8. Format providerDetails if role is provider
    let formattedProviderDetails = undefined;
    if (requestedRole === 'provider') {
      const category = providerDetails?.category?.trim();
      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Please specify your primary service trade or category.'
        });
      }

      const serviceArea = providerDetails?.serviceArea?.trim();
      if (!serviceArea) {
        return res.status(400).json({
          success: false,
          error: 'Please specify your service area or operating neighborhood.'
        });
      }

      let servicesOffered = [];
      if (Array.isArray(providerDetails?.servicesOffered)) {
        servicesOffered = providerDetails.servicesOffered.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof providerDetails?.servicesOffered === 'string') {
        servicesOffered = providerDetails.servicesOffered.split(',').map(s => s.trim()).filter(Boolean);
      }

      formattedProviderDetails = {
        category,
        categorySlug: category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: providerDetails?.title?.trim() || `${category} Specialist`,
        servicesOffered,
        experienceYears: Math.max(0, Number(providerDetails?.experienceYears) || 0),
        city: canonicalCity,
        serviceArea,
        startingPrice: Math.max(0, Number(providerDetails?.startingPrice) || 0),
        hourlyRate: Math.max(0, Number(providerDetails?.hourlyRate) || 0),
        isAvailable: providerDetails?.isAvailable !== false,
        isVerified: false, // Provider cannot self-verify
        isDemo: false,
        bio: providerDetails?.bio?.trim() || '',
        avatar: providerDetails?.avatar?.trim() || '',
        responseTime: providerDetails?.responseTime?.trim() || 'Within 1 hour'
      };
    }

    // 9. Password hashing via bcrypt with salt factor 12
    const passwordHash = await User.hashPassword(password);

    // 10. Save user to MongoDB
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: requestedRole,
      phoneNumber: normalizedPhoneNumber,
      city: canonicalCity,
      status: 'active',
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      ...(requestedRole === 'provider' ? { providerDetails: formattedProviderDetails } : {})
    });

    // 8. Issue JWT & set HttpOnly cookie
    const token = generateToken(newUser._id, newUser.role);
    setAuthCookie(res, token);

    // 9. Respond with safe profile & token
    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      user: newUser.toSafeObject(),
      token
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticate customer, provider, or administrator
 */
export const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email address and password.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user and explicitly select passwordHash
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    // Generic error on missing user or mismatched credentials to prevent enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email address or password.'
      });
    }

    // Compare candidate password with stored hash
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email address or password.'
      });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'This account has been suspended. Please contact platform support.'
      });
    }

    // Role validation: if login was attempted through a specific role tab, enforce that it matches the user's authentic account role
    if (role && typeof role === 'string' && role.trim()) {
      const requestedRole = role.trim().toLowerCase();
      if (requestedRole !== user.role) {
        const roleLabels = {
          customer: 'a customer',
          provider: 'a provider',
          admin: 'an administrator'
        };
        const loginTabNames = {
          customer: 'Customer Login',
          provider: 'Provider Login',
          admin: 'Admin Login'
        };
        const actualRoleLabel = roleLabels[user.role] || user.role;
        const targetLoginTab = loginTabNames[user.role] || `${user.role} Login`;

        return res.status(403).json({
          success: false,
          error: `This account is registered as ${actualRoleLabel}. Please use ${targetLoginTab}.`,
          actualRole: user.role
        });
      }
    }

    // Issue JWT & set HttpOnly cookie with trusted database role
    const token = generateToken(user._id, user.role);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      user: user.toSafeObject(),
      token
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/logout
 * Terminate user session & clear cookies
 */
export const logout = (req, res) => {
  clearAuthCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Signed out successfully.'
  });
};

/**
 * GET /api/auth/me
 * Check current authentication state and return active user profile
 */
export const getMe = (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user.toSafeObject()
  });
};
