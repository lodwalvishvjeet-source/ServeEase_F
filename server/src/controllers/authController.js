import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PendingRegistration from '../models/PendingRegistration.js';
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

    // 9. Email service check
    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Email delivery service is currently not configured on this server. Please contact platform support.'
      });
    }

    // 10. Password hashing via bcrypt with salt factor 12
    const passwordHash = await User.hashPassword(password);

    // 11. Generate secure 6-digit email verification OTP and hash it (SHA-256)
    const emailVerificationOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(emailVerificationOtp).digest('hex');
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // 12. Save to PendingRegistration (Never insert unverified placeholder in User collection)
    await PendingRegistration.deleteMany({ email: normalizedEmail });
    const pendingRegistration = await PendingRegistration.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: requestedRole,
      phoneNumber: normalizedPhoneNumber,
      city: canonicalCity,
      providerDetails: requestedRole === 'provider' ? formattedProviderDetails : undefined,
      otpHash,
      otpExpires,
      attempts: 0,
      lastResendAt: new Date()
    });

    // 13. Dispatch verification email
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'ServeEase — Verify Your Email Address',
        text: `Welcome to ServeEase, ${name.trim()}!\n\nYour 6-digit email verification code is: ${emailVerificationOtp}. It will expire in 15 minutes.\n\nPlease enter this code to verify your email address and complete registration.\n\nIf you did not create this account, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #16a34a; text-align: center;">Welcome to ServeEase</h2>
            <p>Hello <strong>${name.trim()}</strong>,</p>
            <p>Thank you for registering. Please enter the verification code below to verify your email address and complete your account creation:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; background: #f1f5f9; padding: 8px 24px; border-radius: 8px; border: 1px dashed #94a3b8;">${emailVerificationOtp}</span>
            </div>
            <p style="font-size: 0.85rem; color: #64748b;">This code will expire in 15 minutes. If you did not create an account on ServeEase, you can safely ignore this email.</p>
          </div>
        `
      });
    } catch (sendErr) {
      // Rollback pending registration if email delivery fails
      await PendingRegistration.deleteOne({ _id: pendingRegistration._id });
      console.error('❌ Failed to dispatch email verification OTP on registration:', sendErr.message);
      return res.status(503).json({
        success: false,
        error: 'Unable to deliver verification email. Please check your email address or SMTP configuration and try again.'
      });
    }

    // 14. Return pending status — no User record or JWT created until OTP is verified
    return res.status(200).json({
      success: true,
      pendingVerification: true,
      email: normalizedEmail,
      role: requestedRole,
      message: 'Verification code sent to your email. Please enter the code to complete registration.'
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

/**
 * POST /api/auth/verify-email-otp
 * Verify 6-digit OTP code before account creation.
 * Only after successful OTP verification is the User account created in MongoDB.
 */
export const verifyEmailOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const targetEmail = email || req.user?.email;

    if (!targetEmail || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email address and 6-digit verification code are required.'
      });
    }

    const emailCheck = validateEmail(targetEmail);
    if (!emailCheck.isValid) {
      return res.status(400).json({ success: false, error: emailCheck.error });
    }
    const normalizedEmail = emailCheck.normalized;

    // Check if user is already verified in main User collection
    const existingUser = await User.findOne({ email: normalizedEmail }).select('+emailVerificationOtp +emailVerificationOtpExpires');
    if (existingUser) {
      if (existingUser.emailVerified) {
        return res.status(200).json({
          success: true,
          message: 'Your email address is already verified.',
          user: existingUser.toSafeObject()
        });
      }

      // Legacy fallback: verify existing unverified user if code matches
      if (existingUser.emailVerificationOtp) {
        if (new Date() > existingUser.emailVerificationOtpExpires) {
          return res.status(400).json({
            success: false,
            error: 'Verification code has expired. Please request a new code.'
          });
        }
        const cleanOtp = otp.toString().trim();
        if (existingUser.emailVerificationOtp !== cleanOtp) {
          return res.status(400).json({
            success: false,
            error: 'Invalid verification code. Please check and try again.'
          });
        }
        existingUser.emailVerified = true;
        existingUser.emailVerifiedAt = new Date();
        existingUser.emailVerificationOtp = null;
        existingUser.emailVerificationOtpExpires = null;
        await existingUser.save();

        const token = generateToken(existingUser._id, existingUser.role);
        setAuthCookie(res, token);
        return res.status(200).json({
          success: true,
          message: 'Email address verified successfully.',
          user: existingUser.toSafeObject(),
          token
        });
      }
    }

    // Look up pending registration record
    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please register again.'
      });
    }

    // Check attempt limits (max 5)
    if (pending.attempts >= 5) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        error: 'Too many failed verification attempts. Please register again.'
      });
    }

    // Check expiration
    if (new Date() > pending.otpExpires) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new code or register again.'
      });
    }

    // Validate hashed OTP (SHA-256)
    const cleanOtp = otp.toString().trim();
    const candidateHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');

    if (candidateHash !== pending.otpHash) {
      pending.attempts += 1;
      await pending.save();
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code. Please check and try again.'
      });
    }

    // Guard against race conditions / concurrent verification requests
    const duplicate = await User.findOne({ email: normalizedEmail });
    if (duplicate) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please log in.'
      });
    }

    // Single-use: OTP is valid! Create the actual User in MongoDB
    const newUser = await User.create({
      name: pending.name,
      email: pending.email,
      passwordHash: pending.passwordHash,
      role: pending.role,
      phoneNumber: pending.phoneNumber,
      city: pending.city,
      status: 'active',
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      ...(pending.role === 'provider' ? { providerDetails: pending.providerDetails } : {})
    });

    // Clean up pending registration
    await PendingRegistration.deleteOne({ _id: pending._id });

    // Issue JWT & set HttpOnly cookie
    const token = generateToken(newUser._id, newUser.role);
    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Email verified successfully and account created.',
      user: newUser.toSafeObject(),
      token
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/resend-verification-otp
 * Resend 6-digit OTP code to pending registrant
 */
export const resendEmailVerificationOtp = async (req, res, next) => {
  try {
    const { email } = req.body;
    const targetEmail = email || req.user?.email;

    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required.'
      });
    }

    const emailCheck = validateEmail(targetEmail);
    if (!emailCheck.isValid) {
      return res.status(400).json({ success: false, error: emailCheck.error });
    }
    const normalizedEmail = emailCheck.normalized;

    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Email delivery service is currently not configured on this server. Please contact platform support.'
      });
    }

    // Check if account is already registered and verified
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.emailVerified) {
      return res.status(400).json({
        success: false,
        error: 'This email address is already verified.'
      });
    }

    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (!pending) {
      return res.status(400).json({
        success: false,
        error: 'No pending registration found for this email address. Please register again.'
      });
    }

    // Rate limiting: 60-second cooldown between resends
    if (pending.lastResendAt && (Date.now() - new Date(pending.lastResendAt).getTime() < 60 * 1000)) {
      const waitSeconds = Math.ceil((60 * 1000 - (Date.now() - new Date(pending.lastResendAt).getTime())) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new verification code.`
      });
    }

    // Generate new secure 6-digit OTP and SHA-256 hash
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    try {
      await sendEmail({
        to: pending.email,
        subject: 'ServeEase — New Verification Code',
        text: `Your new ServeEase verification code is: ${otp}. It will expire in 15 minutes.\n\nIf you did not request this code, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #16a34a; text-align: center;">ServeEase Verification Code</h2>
            <p>Hello <strong>${pending.name}</strong>,</p>
            <p>We received a request for a new verification code. Use the code below to verify your email address and complete registration:</p>
            <div style="text-align: center; margin: 24px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; background: #f1f5f9; padding: 8px 24px; border-radius: 8px; border: 1px dashed #94a3b8;">${otp}</span>
            </div>
            <p style="font-size: 0.85rem; color: #64748b;">This code will expire in 15 minutes. If you did not request this code, please disregard this email.</p>
          </div>
        `
      });
    } catch (sendErr) {
      console.error('❌ Failed to dispatch email verification OTP on resend:', sendErr.message);
      return res.status(503).json({
        success: false,
        error: 'Unable to deliver verification email via SMTP server. Please try again later.'
      });
    }

    // Update pending record
    pending.otpHash = otpHash;
    pending.otpExpires = otpExpires;
    pending.lastResendAt = new Date();
    pending.attempts = 0; // Reset failed attempts count
    await pending.save();

    return res.status(200).json({
      success: true,
      message: 'A new verification code has been sent to your email.'
    });
  } catch (error) {
    return next(error);
  }
};
