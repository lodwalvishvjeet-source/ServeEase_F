import mongoose from 'mongoose';
import User from '../models/User.js';
import { normalizeCity, getCityDisplayName, SUPPORTED_CITIES } from '../config/cities.js';
import { 
  SERVICE_CATEGORIES, 
  normalizeCategory, 
  isValidCategory, 
  getCategorySearchRegex 
} from '../config/categories.js';
import { getIO } from '../socket/index.js';

/**
 * GET /api/providers
 * City-based provider discovery endpoint
 * 
 * Supports:
 * - city (required): 'sangli', 'chhatrapati-sambhajinagar', 'mumbai', 'pune', 'nagpur' (or friendly aliases)
 * - category (optional): filter by primary service category (e.g. 'plumbing', 'electrical-services')
 * - available (optional): filter by availability status ('true')
 * - q (optional): keyword search in name, skills, title, area, and services
/**
 * Transparent Match Reasons Generator
 * Produces strictly verifiable, data-backed reasons for provider recommendation
 */
export const getMatchReasons = (provider, { q, category, serviceArea } = {}) => {
  const reasons = [];
  const details = provider.providerDetails || {};

  // 1. Keyword match on service name or specialty title
  if (q && q.trim()) {
    const qLower = q.trim().toLowerCase();
    const offered = Array.isArray(details.servicesOffered) ? details.servicesOffered : [];
    const matchedService = offered.find(s => String(s).toLowerCase().includes(qLower));
    if (matchedService) {
      reasons.push(`Offers: ${matchedService}`);
    } else if ((details.title || '').toLowerCase().includes(qLower)) {
      reasons.push(`Specializes in ${details.title}`);
    } else if ((provider.name || '').toLowerCase().includes(qLower)) {
      reasons.push(`Technician name matches "${q.trim()}"`);
    }
  }

  // 2. Category match
  if (category && category !== 'all') {
    const catName = details.category || category;
    reasons.push(`Matches category: ${catName}`);
  }

  // 3. Service area match
  if (serviceArea && serviceArea.trim()) {
    if ((details.serviceArea || '').toLowerCase().includes(serviceArea.trim().toLowerCase())) {
      reasons.push(`Servicing ${details.serviceArea}`);
    }
  } else if (details.serviceArea) {
    reasons.push(`Servicing ${details.serviceArea}`);
  }

  // 4. Availability
  if (details.isAvailable !== false) {
    reasons.push('Available for booking');
  }

  // 5. Verification status
  if (details.isVerified === true) {
    reasons.push('Verified professional');
  }

  // 6. Genuine customer rating
  if (details.rating && Number(details.rating) >= 4.0 && Number(details.reviewCount) > 0) {
    reasons.push(`Top rated (${Number(details.rating).toFixed(1)}★ from ${details.reviewCount} reviews)`);
  }

  // 7. Relevant experience
  if (details.experienceYears && Number(details.experienceYears) >= 3) {
    reasons.push(`${details.experienceYears}+ years experience`);
  }

  // Factual fallback
  if (reasons.length === 0) {
    const cityDisplay = provider.cityName || getCityDisplayName(provider.city) || 'selected city';
    reasons.push(`Active provider in ${cityDisplay}`);
  }

  return reasons;
};

/**
 * Transparent Ranking Scoring Formula (MongoDB Aggregation Expression)
 * Max Score ~ 110:
 * - Immediacy: Available for booking (+25 pts)
 * - Trust: Verified credentials (+20 pts)
 * - Proven Performance: Genuine customer rating (up to +30 pts)
 * - Review Confidence: Volume of verified reviews (up to +15 pts)
 * - Experience: Field experience up to 20 yrs (up to +20 pts)
 */
export const PROVIDER_MATCH_SCORE_EXPRESSION = {
  $add: [
    // 1. Availability bonus (25 pts)
    {
      $cond: [
        { $ne: ['$providerDetails.isAvailable', false] },
        25,
        0
      ]
    },
    // 2. Verified status bonus (20 pts)
    {
      $cond: [
        { $eq: ['$providerDetails.isVerified', true] },
        20,
        0
      ]
    },
    // 3. Genuine customer rating points (up to 30 pts)
    {
      $cond: [
        {
          $and: [
            { $gt: ['$providerDetails.rating', 0] },
            { $gt: ['$providerDetails.reviewCount', 0] }
          ]
        },
        { $multiply: [{ $divide: ['$providerDetails.rating', 5] }, 30] },
        0
      ]
    },
    // 4. Review count volume bonus (up to 15 pts)
    {
      $multiply: [
        { $min: [{ $ifNull: ['$providerDetails.reviewCount', 0] }, 10] },
        1.5
      ]
    },
    // 5. Experience points (up to 20 pts)
    {
      $multiply: [
        { $min: [{ $ifNull: ['$providerDetails.experienceYears', 0] }, 20] },
        1.0
      ]
    }
  ]
};

/**
 * GET /api/providers
 * City-based smart provider discovery endpoint
 * 
 * Supports:
 * - city (required): 'sangli', 'chhatrapati-sambhajinagar', 'mumbai', 'pune', 'nagpur' (or friendly aliases)
 * - category (optional): filter by primary service category (e.g. 'plumbing', 'electrical-services')
 * - serviceArea (optional): filter by provider coverage locality / area
 * - available (optional): filter by active availability status ('true')
 * - verified (optional): filter by admin-verified credential status ('true')
 * - minRating (optional): minimum rating threshold (1-5) based on genuine customer reviews
 * - minPrice, maxPrice (optional): consultation / visit rate price range
 * - q (optional): keyword search in name, skills, title, area, and services
 * - sort (optional): 'recommended' (default), 'experience', 'price-low', 'price-high', 'rating'
 * - page, limit (optional pagination)
 */
export const getProviders = async (req, res, next) => {
  try {
    const { 
      city, 
      category, 
      serviceArea,
      available, 
      verified,
      minRating,
      minPrice,
      maxPrice,
      q, 
      sort, 
      page = 1, 
      limit = 20 
    } = req.query;

    if (!city || typeof city !== 'string' || !city.trim()) {
      return res.status(400).json({
        success: false,
        error: `A valid city parameter is required. Supported cities: ${SUPPORTED_CITIES.map(c => `${c.name} (${c.id})`).join(', ')}.`
      });
    }

    const canonicalCity = normalizeCity(city);
    if (!canonicalCity) {
      return res.status(400).json({
        success: false,
        error: `Invalid city: "${city}". Supported cities are ${SUPPORTED_CITIES.map(c => c.name).join(', ')}.`
      });
    }

    // Base query: only active providers belonging to the specified canonical city
    const filter = {
      role: 'provider',
      status: 'active',
      city: canonicalCity
    };

    // Category and Keyword AND/OR clauses
    const andClauses = [];

    // Optional category filter
    if (category && category !== 'all') {
      if (!isValidCategory(category)) {
        return res.status(400).json({
          success: false,
          error: `Invalid service category: "${category}". Supported categories are: ${SERVICE_CATEGORIES.map(c => c.name).join(', ')}.`
        });
      }

      const catRegex = getCategorySearchRegex(category);
      andClauses.push({
        $or: [
          { 'providerDetails.category': catRegex },
          { 'providerDetails.categorySlug': catRegex },
          { 'providerDetails.title': catRegex },
          { 'providerDetails.servicesOffered': catRegex }
        ]
      });
    }

    // Optional search filter
    if (q && q.trim()) {
      const searchRegex = new RegExp(q.trim(), 'i');
      andClauses.push({
        $or: [
          { name: searchRegex },
          { 'providerDetails.title': searchRegex },
          { 'providerDetails.category': searchRegex },
          { 'providerDetails.serviceArea': searchRegex },
          { 'providerDetails.servicesOffered': searchRegex }
        ]
      });
    }

    if (andClauses.length === 1) {
      filter.$or = andClauses[0].$or;
    } else if (andClauses.length > 1) {
      filter.$and = andClauses;
    }

    // Optional service area filter
    if (serviceArea && typeof serviceArea === 'string' && serviceArea.trim()) {
      filter['providerDetails.serviceArea'] = new RegExp(serviceArea.trim(), 'i');
    }

    // Optional availability filter
    if (available === 'true') {
      filter['providerDetails.isAvailable'] = true;
    }

    // Optional verified filter
    if (verified === 'true') {
      filter['providerDetails.isVerified'] = true;
    }

    // Optional minimum rating filter (must be genuine customer ratings)
    if (minRating !== undefined && minRating !== null && String(minRating).trim() !== '') {
      const ratingNum = parseFloat(minRating);
      if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({
          success: false,
          error: 'Minimum rating must be a valid number between 1 and 5.'
        });
      }
      filter['providerDetails.rating'] = { $gte: ratingNum };
      filter['providerDetails.reviewCount'] = { $gt: 0 };
    }

    // Optional price range filters (minPrice / maxPrice)
    let minP, maxP;
    if (minPrice !== undefined && minPrice !== null && String(minPrice).trim() !== '') {
      minP = parseFloat(minPrice);
      if (isNaN(minP) || minP < 0) {
        return res.status(400).json({
          success: false,
          error: 'Minimum price must be a non-negative number.'
        });
      }
    }

    if (maxPrice !== undefined && maxPrice !== null && String(maxPrice).trim() !== '') {
      maxP = parseFloat(maxPrice);
      if (isNaN(maxP) || maxP < 0) {
        return res.status(400).json({
          success: false,
          error: 'Maximum price must be a non-negative number.'
        });
      }
    }

    if (minP !== undefined && maxP !== undefined && minP > maxP) {
      return res.status(400).json({
        success: false,
        error: 'Minimum price cannot be greater than maximum price.'
      });
    }

    if (minP !== undefined || maxP !== undefined) {
      const priceFilter = {};
      if (minP !== undefined) priceFilter.$gte = minP;
      if (maxP !== undefined) priceFilter.$lte = maxP;
      filter['providerDetails.startingPrice'] = priceFilter;
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Deterministic sorting options
    let sortObj;
    if (sort === 'experience') {
      sortObj = { 'providerDetails.experienceYears': -1, 'providerDetails.isAvailable': -1, createdAt: -1, _id: 1 };
    } else if (sort === 'price-low') {
      sortObj = { 'providerDetails.startingPrice': 1, 'providerDetails.isAvailable': -1, createdAt: -1, _id: 1 };
    } else if (sort === 'price-high') {
      sortObj = { 'providerDetails.startingPrice': -1, 'providerDetails.isAvailable': -1, createdAt: -1, _id: 1 };
    } else if (sort === 'rating') {
      sortObj = { 'providerDetails.rating': -1, 'providerDetails.reviewCount': -1, 'providerDetails.isAvailable': -1, createdAt: -1, _id: 1 };
    } else {
      // 'recommended' (default smart matching ranking)
      sortObj = { matchScore: -1, 'providerDetails.isAvailable': -1, 'providerDetails.experienceYears': -1, createdAt: -1, _id: 1 };
    }

    const total = await User.countDocuments(filter);

    // Efficient MongoDB aggregation pipeline: calculates deterministic matchScore and sorts
    const pipeline = [
      { $match: filter },
      { $addFields: { matchScore: PROVIDER_MATCH_SCORE_EXPRESSION } },
      { $project: { passwordHash: 0, __v: 0 } },
      { $sort: sortObj },
      { $skip: skip },
      { $limit: limitNum }
    ];

    const providers = await User.aggregate(pipeline);

    const safeProviders = providers.map((p) => {
      const details = p.providerDetails || {};
      const cityName = p.cityName || getCityDisplayName(p.city);
      return {
        id: String(p._id),
        _id: String(p._id),
        name: p.name,
        role: p.role,
        city: p.city,
        cityName,
        phoneNumber: p.phoneNumber,
        category: details.category || 'General Services',
        categorySlug: details.categorySlug || '',
        title: details.title || details.category || 'Service Provider',
        servicesOffered: details.servicesOffered || [],
        experienceYears: details.experienceYears || 0,
        serviceArea: details.serviceArea || '',
        startingPrice: details.startingPrice || 0,
        hourlyRate: details.hourlyRate || 0,
        isAvailable: details.isAvailable !== false,
        isVerified: Boolean(details.isVerified),
        isDemo: Boolean(details.isDemo),
        bio: details.bio || '',
        avatar: details.avatar || '',
        rating: details.rating != null ? details.rating : null,
        reviewCount: details.reviewCount || 0,
        responseTime: details.responseTime || 'Within 1 hour',
        location: details.location || null,
        matchScore: Math.round(p.matchScore || 0),
        matchReasons: getMatchReasons(p, { q, category, serviceArea }),
        providerDetails: details
      };
    });

    return res.status(200).json({
      success: true,
      city: {
        id: canonicalCity,
        name: getCityDisplayName(canonicalCity)
      },
      count: safeProviders.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      providers: safeProviders
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/providers/:id
 * Retrieve individual public provider profile
 */
export const getProviderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider identifier format.'
      });
    }

    const provider = await User.findOne({ _id: id, role: 'provider', status: 'active' })
      .select('-passwordHash -__v');

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Service provider not found or inactive.'
      });
    }

    const safe = provider.toSafeObject();
    const details = safe.providerDetails || {};
    return res.status(200).json({
      success: true,
      provider: {
        id: String(safe._id),
        _id: String(safe._id),
        name: safe.name,
        role: safe.role,
        city: safe.city,
        cityName: safe.cityName || getCityDisplayName(safe.city),
        phoneNumber: safe.phoneNumber,
        category: details.category || 'General Services',
        categorySlug: details.categorySlug || '',
        title: details.title || details.category || 'Service Provider',
        servicesOffered: details.servicesOffered || [],
        experienceYears: details.experienceYears || 0,
        serviceArea: details.serviceArea || '',
        startingPrice: details.startingPrice || 0,
        hourlyRate: details.hourlyRate || 0,
        isAvailable: details.isAvailable !== false,
        isVerified: Boolean(details.isVerified),
        isDemo: Boolean(details.isDemo),
        bio: details.bio || '',
        avatar: details.avatar || '',
        rating: details.rating != null ? details.rating : null,
        reviewCount: details.reviewCount || 0,
        responseTime: details.responseTime || 'Within 1 hour',
        location: details.location || null,
        matchReasons: getMatchReasons(safe),
        providerDetails: details
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/providers/cities
 * Returns supported cities metadata and localities
 */
export const getCitiesCatalog = (req, res) => {
  return res.status(200).json({
    success: true,
    cities: SUPPORTED_CITIES
  });
};

/**
 * GET /api/providers/categories
 * Returns canonical service categories catalog
 */
export const getCategoriesCatalog = (req, res) => {
  return res.status(200).json({
    success: true,
    count: SERVICE_CATEGORIES.length,
    categories: SERVICE_CATEGORIES
  });
};

/**
 * GET /api/providers/my-services
 * Retrieve the authenticated provider's current service catalog
 */
export const getMyServices = async (req, res) => {
  const details = req.user.providerDetails || {};
  return res.status(200).json({
    success: true,
    category: details.category || 'General Services',
    title: details.title || '',
    serviceArea: details.serviceArea || '',
    startingPrice: details.startingPrice || 0,
    hourlyRate: details.hourlyRate || 0,
    experienceYears: details.experienceYears || 0,
    isAvailable: details.isAvailable !== false,
    services: details.servicesOffered || []
  });
};

/**
 * POST /api/providers/my-services
 * Add a new service offering to provider's catalog
 */
export const addMyService = async (req, res, next) => {
  try {
    const { service } = req.body;
    if (!service || typeof service !== 'string' || service.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Service name must be at least 2 characters long.'
      });
    }

    const cleanService = service.trim();
    if (!req.user.providerDetails) {
      req.user.providerDetails = {};
    }
    if (!Array.isArray(req.user.providerDetails.servicesOffered)) {
      req.user.providerDetails.servicesOffered = [];
    }

    const existing = req.user.providerDetails.servicesOffered;
    const exists = existing.some(s => s.toLowerCase() === cleanService.toLowerCase());
    if (exists) {
      return res.status(400).json({
        success: false,
        error: 'This service offering is already offered in your catalog.'
      });
    }

    req.user.providerDetails.servicesOffered.push(cleanService);
    await req.user.save();

    return res.status(201).json({
      success: true,
      message: 'Service offering added successfully.',
      services: req.user.providerDetails.servicesOffered
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT/PATCH /api/providers/my-services/:serviceName? (or /api/providers/my-services)
 * Update an existing service offering or provider service settings (rates, area, availability)
 */
export const updateMyService = async (req, res, next) => {
  try {
    const rawServiceName = req.params?.serviceName || req.body?.oldService || req.body?.oldName;
    const { 
      service, 
      newService, 
      newName, 
      startingPrice, 
      hourlyRate, 
      experienceYears, 
      serviceArea, 
      isAvailable,
      title,
      category
    } = req.body;

    if (!req.user.providerDetails) {
      req.user.providerDetails = {};
    }
    if (!Array.isArray(req.user.providerDetails.servicesOffered)) {
      req.user.providerDetails.servicesOffered = [];
    }

    let serviceRenamed = false;
    const targetService = rawServiceName ? decodeURIComponent(rawServiceName).trim() : null;
    const replacementService = (newService || newName || service || '').trim();

    // If a specific service rename/edit was requested
    if (targetService) {
      if (!replacementService || replacementService.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Updated service name must be at least 2 characters long.'
        });
      }

      const existingIndex = req.user.providerDetails.servicesOffered.findIndex(
        s => s.toLowerCase() === targetService.toLowerCase()
      );

      if (existingIndex === -1) {
        return res.status(404).json({
          success: false,
          error: `Service "${targetService}" not found in your catalog.`
        });
      }

      // Check collision with another existing service
      const collisionIndex = req.user.providerDetails.servicesOffered.findIndex(
        (s, idx) => idx !== existingIndex && s.toLowerCase() === replacementService.toLowerCase()
      );
      if (collisionIndex !== -1) {
        return res.status(400).json({
          success: false,
          error: `A service offering named "${replacementService}" already exists in your catalog.`
        });
      }

      req.user.providerDetails.servicesOffered[existingIndex] = replacementService;
      serviceRenamed = true;
    }

    // Permitted service setting updates
    if (startingPrice !== undefined) {
      if (startingPrice === null || typeof startingPrice === 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Starting price must be a non-negative number.'
        });
      }
      const num = Number(startingPrice);
      if (isNaN(num) || num < 0 || !Number.isFinite(num) || num > 100000) {
        return res.status(400).json({
          success: false,
          error: 'Starting price must be a non-negative number.'
        });
      }
      req.user.providerDetails.startingPrice = Math.round(num);
    }

    if (hourlyRate !== undefined) {
      if (hourlyRate === null || typeof hourlyRate === 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Hourly rate must be a non-negative number.'
        });
      }
      const num = Number(hourlyRate);
      if (isNaN(num) || num < 0 || !Number.isFinite(num) || num > 100000) {
        return res.status(400).json({
          success: false,
          error: 'Hourly rate must be a non-negative number.'
        });
      }
      req.user.providerDetails.hourlyRate = Math.round(num);
    }

    if (experienceYears !== undefined) {
      const num = Number(experienceYears);
      if (isNaN(num) || num < 0) {
        return res.status(400).json({
          success: false,
          error: 'Experience years must be a non-negative number.'
        });
      }
      req.user.providerDetails.experienceYears = Math.min(60, Math.floor(num));
    }

    if (serviceArea !== undefined && typeof serviceArea === 'string') {
      req.user.providerDetails.serviceArea = serviceArea.trim().slice(0, 150);
    }

    if (isAvailable !== undefined) {
      req.user.providerDetails.isAvailable = Boolean(isAvailable);
    }

    if (title !== undefined && typeof title === 'string') {
      req.user.providerDetails.title = title.trim().slice(0, 120);
    }

    if (category !== undefined && typeof category === 'string' && category.trim()) {
      req.user.providerDetails.category = category.trim().slice(0, 80);
    }

    await req.user.save();

    if (isAvailable !== undefined) {
      try {
        const io = getIO();
        if (io) {
          io.emit('provider_availability_changed', {
            providerId: req.user._id.toString(),
            isAvailable: req.user.providerDetails.isAvailable !== false,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (socketErr) {
        console.warn('Socket broadcast error (provider_availability_changed):', socketErr.message);
      }
    }

    const details = req.user.providerDetails;
    return res.status(200).json({
      success: true,
      message: serviceRenamed ? 'Service offering updated successfully.' : 'Service details updated successfully.',
      category: details.category || 'General Services',
      title: details.title || '',
      serviceArea: details.serviceArea || '',
      startingPrice: details.startingPrice || 0,
      hourlyRate: details.hourlyRate || 0,
      experienceYears: details.experienceYears || 0,
      isAvailable: details.isAvailable !== false,
      services: details.servicesOffered || []
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/providers/my-services/:serviceName (or /api/providers/my-services with body)
 * Remove a service offering from provider's catalog
 */
export const deleteMyService = async (req, res, next) => {
  try {
    const rawService = req.params.serviceName || req.body?.service;
    const decodedService = decodeURIComponent(rawService || '').trim();

    if (!decodedService) {
      return res.status(400).json({
        success: false,
        error: 'Service name is required.'
      });
    }

    if (!req.user.providerDetails || !Array.isArray(req.user.providerDetails.servicesOffered)) {
      return res.status(200).json({
        success: true,
        message: 'Service removed.',
        services: []
      });
    }

    const beforeCount = req.user.providerDetails.servicesOffered.length;
    req.user.providerDetails.servicesOffered = req.user.providerDetails.servicesOffered.filter(
      s => s.toLowerCase() !== decodedService.toLowerCase()
    );

    if (req.user.providerDetails.servicesOffered.length === beforeCount) {
      return res.status(404).json({
        success: false,
        error: 'Service not found in your catalog.'
      });
    }

    await req.user.save();

    return res.status(200).json({
      success: true,
      message: 'Service offering removed successfully.',
      services: req.user.providerDetails.servicesOffered
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  getProviders,
  getProviderById,
  getCitiesCatalog,
  getCategoriesCatalog,
  getMyServices,
  addMyService,
  updateMyService,
  deleteMyService
};
