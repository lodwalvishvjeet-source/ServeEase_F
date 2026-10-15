import mongoose from 'mongoose';
import User from '../models/User.js';
import { normalizeCity, SUPPORTED_CITIES } from '../config/cities.js';
import { validateIndianMobile } from '../utils/validation.js';
import { getIO } from '../socket/index.js';

/**
 * GET /api/users/me or GET /api/users/profile
 * Retrieve the authenticated user's own profile
 */
export const getMyProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user.toSafeObject()
  });
};

/**
 * PATCH or PUT /api/users/me (or /api/users/profile)
 * Safely update user's own profile fields
 * 
 * Strict Allowlist:
 * - Customers: name, phoneNumber, city
 * - Providers: name, phoneNumber, city, and providerDetails (category, title, servicesOffered,
 *   experienceYears, serviceArea, startingPrice, hourlyRate, isAvailable, bio)
 * 
 * Privileged fields (role, status, passwordHash, email, _id, isVerified, isDemo, rating, reviewCount)
 * are strictly protected against privilege escalation and mass-assignment.
 */
export const updateMyProfile = async (req, res, next) => {
  try {
    const user = req.user;
    const body = req.body || {};
    const { name, phoneNumber, city } = body;

    // 1. Validate and update Name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Name must be at least 2 characters long.'
        });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Name cannot exceed 100 characters.'
        });
      }
      user.name = name.trim();
    }

    // 2. Validate and update Phone Number (Indian mobile format: 10 digits starting with 6-9)
    if (phoneNumber !== undefined) {
      if (phoneNumber !== null && String(phoneNumber).trim() !== '') {
        const phoneResult = validateIndianMobile(String(phoneNumber));
        if (!phoneResult.isValid) {
          return res.status(400).json({
            success: false,
            error: phoneResult.error
          });
        }
        user.phoneNumber = phoneResult.normalized;
      } else {
        user.phoneNumber = '';
      }
    }

    // 3. Validate and update City
    if (city !== undefined && String(city).trim() !== '') {
      const canonicalCity = normalizeCity(city);
      if (!canonicalCity) {
        return res.status(400).json({
          success: false,
          error: `Invalid city: "${city}". Supported cities are ${SUPPORTED_CITIES.map(c => c.name).join(', ')}.`
        });
      }
      user.city = canonicalCity;
      if (user.role === 'provider' && user.providerDetails) {
        user.providerDetails.city = canonicalCity;
      }
    }

    // 4. Provider-specific details (only allowed if authenticated user is a provider)
    let availabilityToggled = false;
    if (user.role === 'provider') {
      const details = body.providerDetails || body;

      if (!user.providerDetails) {
        user.providerDetails = {};
      }

      if (details.category !== undefined && typeof details.category === 'string') {
        const cat = details.category.trim();
        if (cat) {
          user.providerDetails.category = cat;
          user.providerDetails.categorySlug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        }
      }

      if (details.title !== undefined && typeof details.title === 'string') {
        user.providerDetails.title = details.title.trim();
      }

      if (details.servicesOffered !== undefined) {
        if (Array.isArray(details.servicesOffered)) {
          user.providerDetails.servicesOffered = details.servicesOffered.map(s => String(s).trim()).filter(Boolean);
        } else if (typeof details.servicesOffered === 'string') {
          user.providerDetails.servicesOffered = details.servicesOffered.split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      if (details.experienceYears !== undefined) {
        const exp = Number(details.experienceYears);
        if (isNaN(exp) || exp < 0) {
          return res.status(400).json({
            success: false,
            error: 'Experience years must be a non-negative number.'
          });
        }
        user.providerDetails.experienceYears = exp;
      }

      if (details.serviceArea !== undefined && typeof details.serviceArea === 'string') {
        user.providerDetails.serviceArea = details.serviceArea.trim();
      }

      if (details.startingPrice !== undefined) {
        if (details.startingPrice === null || typeof details.startingPrice === 'boolean') {
          return res.status(400).json({
            success: false,
            error: 'Starting price must be a non-negative number.'
          });
        }
        const price = Number(details.startingPrice);
        if (isNaN(price) || price < 0 || !Number.isFinite(price) || price > 100000) {
          return res.status(400).json({
            success: false,
            error: 'Starting price must be a non-negative number.'
          });
        }
        user.providerDetails.startingPrice = Math.round(price);
      }

      if (details.hourlyRate !== undefined) {
        if (details.hourlyRate === null || typeof details.hourlyRate === 'boolean') {
          return res.status(400).json({
            success: false,
            error: 'Hourly rate must be a non-negative number.'
          });
        }
        const rate = Number(details.hourlyRate);
        if (isNaN(rate) || rate < 0 || !Number.isFinite(rate) || rate > 100000) {
          return res.status(400).json({
            success: false,
            error: 'Hourly rate must be a non-negative number.'
          });
        }
        user.providerDetails.hourlyRate = Math.round(rate);
      }

      if (details.isAvailable !== undefined) {
        user.providerDetails.isAvailable = Boolean(details.isAvailable);
        availabilityToggled = true;
      }

      if (details.bio !== undefined && typeof details.bio === 'string') {
        user.providerDetails.bio = details.bio.trim();
      }

      if (details.location !== undefined || details.latitude !== undefined || details.longitude !== undefined) {
        const loc = (details.location && typeof details.location === 'object') ? details.location : {};
        let lat = details.latitude !== undefined ? details.latitude : loc.latitude;
        let lng = details.longitude !== undefined ? details.longitude : loc.longitude;
        let addr = details.locationAddress !== undefined ? details.locationAddress : loc.address;

        if (lat !== undefined && lat !== null && lat !== '') {
          const numLat = Number(lat);
          if (isNaN(numLat) || numLat < -90 || numLat > 90) {
            return res.status(400).json({
              success: false,
              error: 'Invalid latitude. Latitude must be a number between -90 and 90.'
            });
          }
          lat = numLat;
        } else {
          lat = null;
        }

        if (lng !== undefined && lng !== null && lng !== '') {
          const numLng = Number(lng);
          if (isNaN(numLng) || numLng < -180 || numLng > 180) {
            return res.status(400).json({
              success: false,
              error: 'Invalid longitude. Longitude must be a number between -180 and 180.'
            });
          }
          lng = numLng;
        } else {
          lng = null;
        }

        user.providerDetails.location = {
          latitude: lat,
          longitude: lng,
          address: typeof addr === 'string' ? addr.trim() : (user.providerDetails.location?.address || '')
        };
      }

      // Security rule: isVerified, isDemo, rating, and reviewCount are strictly protected
      // against self-modification and cannot be modified through this endpoint.
    }

    await user.save();

    // Broadcast real-time availability update if provider toggled availability
    if (user.role === 'provider' && availabilityToggled) {
      try {
        const io = getIO();
        if (io) {
          io.emit('provider_availability_changed', {
            providerId: user._id.toString(),
            isAvailable: user.providerDetails.isAvailable,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (socketErr) {
        console.warn('Socket broadcast error (provider_availability_changed):', socketErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: user.toSafeObject()
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/users/:id
 * Retrieve profile by specific user ID
 * Enforces privacy: non-admin users cannot view other customers' private profile records.
 */
export const getProfileById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user identifier format.'
      });
    }

    const isSelf = req.user._id.toString() === id;
    const isAdmin = req.user.role === 'admin';

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (isSelf || isAdmin || targetUser.role === 'provider') {
      return res.status(200).json({ success: true, user: targetUser.toSafeObject() });
    }

    // Customers cannot access other customers' profiles
    return res.status(403).json({
      success: false,
      error: "You are not authorized to view another customer's profile."
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH or PUT /api/users/:id
 * Update profile by specific user ID
 * Strictly enforces that a user can only edit their own profile, unless they have admin privileges.
 */
export const updateProfileById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isSelf = req.user._id.toString() === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to edit another user's profile."
      });
    }

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user identifier format.'
      });
    }

    if (isSelf) {
      return updateMyProfile(req, res, next);
    }

    // Administrator updating target user
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    // Temporarily attach targetUser to run validation & update
    const savedUser = req.user;
    req.user = targetUser;
    try {
      return await updateMyProfile(req, res, next);
    } finally {
      req.user = savedUser;
    }
  } catch (error) {
    return next(error);
  }
};
