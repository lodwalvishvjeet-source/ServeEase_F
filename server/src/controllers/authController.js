import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { normalizeCity, SUPPORTED_CITIES } from '../config/cities.js';
import { validateEmail, validateIndianMobile } from '../utils/validation.js';
import { getJwtSecret } from '../config/env.js';
import { sendEmail, isEmailConfigured } from '../utils/email.js';

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

/**
 * POST /api/auth/forgot-password
 * Generate 6-digit OTP and send via email
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      return res.status(400).json({ success: false, error: emailCheck.error });
    }
    const normalizedEmail = emailCheck.normalized;

    // If email delivery service is not configured on the server, report clearly without leaking account existence
    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Password recovery email delivery is currently not configured on this server. Please contact support or configure Gmail SMTP credentials (EMAIL_USER and EMAIL_PASS).'
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Uniform generic response prevents user/email enumeration attacks
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, a 6-digit verification code has been sent.'
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = otpExpires;
    await user.save();

    // Attempt delivery via Nodemailer
    try {
      await sendEmail({
        to: user.email,
        subject: 'ServeEase — Password Reset Code',
        text: `Your ServeEase password reset code is: ${otp}. It will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #16a34a; text-align: center;">ServeEase Password Reset</h2>
            <p>Hello <strong>${user.name || 'User'}</strong>,</p>
            <p>We received a request to reset your password. Use the verification code below:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; background: #f1f5f9; padding: 8px 24px; border-radius: 8px; border: 1px dashed #94a3b8;">${otp}</span>
            </div>
            <p style="font-size: 0.85rem; color: #64748b;">This code will expire in 15 minutes. If you did not request a password reset, please disregard this email.</p>
          </div>
        `
      });
    } catch (sendErr) {
      // Clear generated OTP on delivery failure so an unreachable code doesn't linger
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      await user.save();

      console.error('❌ Failed to dispatch password reset OTP email:', sendErr.message);
      return res.status(503).json({
        success: false,
        error: 'Unable to deliver verification email via SMTP server. Please check email credentials or try again later.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'If an account exists with that email, a 6-digit verification code has been sent.'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify 6-digit OTP and return a single-use password reset token
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit OTP code are required.' });
    }
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      return res.status(400).json({ success: false, error: emailCheck.error });
    }
    const normalizedEmail = emailCheck.normalized;
    const user = await User.findOne({ email: normalizedEmail }).select('+resetPasswordOtp +resetPasswordOtpExpires');
    if (!user || !user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code. Please request a new one.' });
    }

    if (new Date() > user.resetPasswordOtpExpires) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpires = null;
      await user.save();
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    if (user.resetPasswordOtp !== otp.toString().trim()) {
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please check and try again.' });
    }

    // Generate reset token valid for 15 minutes
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    return res.status(200).json({
      success: true,
      resetToken,
      message: 'Verification code verified successfully.'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/reset-password
 * Reset user password using verified resetToken
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, reset token, and new password are required.' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      return res.status(400).json({ success: false, error: emailCheck.error });
    }
    const normalizedEmail = emailCheck.normalized;

    const user = await User.findOne({ email: normalizedEmail }).select('+resetPasswordToken +resetPasswordTokenExpires +passwordHash');
    if (!user || !user.resetPasswordToken || !user.resetPasswordTokenExpires) {
      return res.status(400).json({ success: false, error: 'Invalid or expired password reset session. Please request a new verification code.' });
    }

    if (new Date() > user.resetPasswordTokenExpires) {
      user.resetPasswordToken = null;
      user.resetPasswordTokenExpires = null;
      await user.save();
      return res.status(400).json({ success: false, error: 'Password reset session has expired. Please request a new code.' });
    }

    if (user.resetPasswordToken !== resetToken) {
      return res.status(400).json({ success: false, error: 'Invalid reset token. Please request a new verification code.' });
    }

    // Update password
    const passwordHash = await User.hashPassword(newPassword);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = null;
    user.resetPasswordTokenExpires = null;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully reset. You can now log in.'
    });
  } catch (error) {
    return next(error);
  }
};
