/**
 * ServeEase — Canonical Service Categories Catalog
 * 
 * Provides canonical service category definitions, display names,
 * descriptions, icon mappings, and aliases for search and filtering:
 * 1. Plumbing
 * 2. Electrical Services
 * 3. Carpentry
 * 4. Home Cleaning
 * 5. Appliance Repair
 * 6. Vehicle Mechanic
 * 7. Driver Services
 * 8. Painting
 * 9. Other Home Services
 */

export const SERVICE_CATEGORIES = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    slug: 'plumbing',
    description: 'Pipe leakages, tap fittings, drainage unclogging, geyser lines, and sanitary installations.',
    icon: 'Wrench',
    startingPrice: 299,
    status: 'active',
    aliases: ['plumbing', 'plumber', 'plumbing services', 'sanitary tech']
  },
  {
    id: 'electrical-services',
    name: 'Electrical Services',
    slug: 'electrical-services',
    description: 'Wiring, switchboard repairs, fuse fixes, appliance power circuits, and safety grounding.',
    icon: 'Zap',
    startingPrice: 249,
    status: 'active',
    aliases: ['electrical-services', 'electrical services', 'electrical', 'electrician', 'electrical repairs', 'wireman']
  },
  {
    id: 'carpentry',
    name: 'Carpentry',
    slug: 'carpentry',
    description: 'Custom furniture assembly, door locks, wooden hinge fixes, and cabinet repairs.',
    icon: 'Hammer',
    startingPrice: 349,
    status: 'active',
    aliases: ['carpentry', 'carpenter', 'carpentry & furniture', 'woodwork']
  },
  {
    id: 'home-cleaning',
    name: 'Home Cleaning',
    slug: 'home-cleaning',
    description: 'Deep house scrubbing, kitchen degreasing, bathroom disinfection, and sofa sanitization.',
    icon: 'Sparkles',
    startingPrice: 499,
    status: 'active',
    aliases: ['home-cleaning', 'home cleaning', 'cleaning', 'deep cleaning', 'home cleaning & sanitation', 'sanitization']
  },
  {
    id: 'appliance-repair',
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    description: 'Expert diagnostics and repair for ACs, washing machines, refrigerators, and microwaves.',
    icon: 'Cpu',
    startingPrice: 399,
    status: 'active',
    aliases: ['appliance-repair', 'appliance repair', 'appliance', 'appliance repairs', 'appliances']
  },
  {
    id: 'vehicle-mechanic',
    name: 'Vehicle Mechanic',
    slug: 'vehicle-mechanic',
    description: 'Two-wheeler and car roadside assistance, battery jumpstarts, puncture fixes, and tune-ups.',
    icon: 'Car',
    startingPrice: 349,
    status: 'active',
    aliases: ['vehicle-mechanic', 'vehicle mechanic', 'mechanic', 'vehicle mechanics', 'automobile', 'roadside']
  },
  {
    id: 'driver-services',
    name: 'Driver Services',
    slug: 'driver-services',
    description: 'Licensed professional drivers for hourly in-city commutes, outstation trips, and transit.',
    icon: 'Compass',
    startingPrice: 499,
    status: 'active',
    aliases: ['driver-services', 'driver services', 'driver', 'chauffeur', 'driving']
  },
  {
    id: 'painting',
    name: 'Painting',
    slug: 'painting',
    description: 'Interior wall repainting, exterior waterproof coatings, texture walls, and damp-proofing.',
    icon: 'Paintbrush',
    startingPrice: 799,
    status: 'active',
    aliases: ['painting', 'painter', 'painting & wall care', 'wall painting']
  },
  {
    id: 'other-home-services',
    name: 'Other Home Services',
    slug: 'other-home-services',
    description: 'Pest control, masonry, minor civil works, solar maintenance, and general handyman tasks.',
    icon: 'Home',
    startingPrice: 299,
    status: 'active',
    aliases: ['other-home-services', 'other home services', 'other', 'pest control', 'pest', 'handyman', 'general']
  }
];

/**
 * Normalizes input string to canonical category id/slug.
 * Returns null if the category is not recognized.
 */
export const normalizeCategory = (input) => {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim().toLowerCase();
  const slugified = raw.replace(/[\s_]+/g, '-');

  for (const cat of SERVICE_CATEGORIES) {
    if (cat.id === slugified || cat.slug === slugified || cat.name.toLowerCase() === raw) {
      return cat.id;
    }
    for (const alias of cat.aliases) {
      const aliasSlug = alias.trim().toLowerCase().replace(/[\s_]+/g, '-');
      if (aliasSlug === slugified || alias.toLowerCase() === raw) {
        return cat.id;
      }
    }
  }

  return null;
};

/**
 * Validates if an input string maps to a supported service category.
 */
export const isValidCategory = (input) => {
  return normalizeCategory(input) !== null;
};

/**
 * Retrieves the full category configuration object.
 */
export const getCategoryById = (idOrSlug) => {
  const canonicalId = normalizeCategory(idOrSlug);
  if (!canonicalId) return null;
  return SERVICE_CATEGORIES.find(c => c.id === canonicalId) || null;
};

/**
 * Builds a regex pattern matching all aliases and stems for a canonical category.
 */
export const getCategorySearchRegex = (idOrSlug) => {
  const canonicalId = normalizeCategory(idOrSlug);
  if (!canonicalId) return null;

  const patterns = {
    'plumbing': /plumb/i,
    'electrical-services': /electr/i,
    'carpentry': /carpen/i,
    'home-cleaning': /clean/i,
    'appliance-repair': /appliance/i,
    'vehicle-mechanic': /mechanic/i,
    'driver-services': /driv/i,
    'painting': /paint/i,
    'other-home-services': /(other|pest|handyman|mason)/i
  };

  return patterns[canonicalId] || new RegExp(canonicalId.replace(/-/g, ' '), 'i');
};

export default {
  SERVICE_CATEGORIES,
  normalizeCategory,
  isValidCategory,
  getCategoryById,
  getCategorySearchRegex
};
