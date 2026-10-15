/**
 * ServeEase — Supported Cities Configuration
 * 
 * Provides canonical city identifiers, display names, recognized aliases,
 * and popular localities for service coverage across Maharashtra:
 * 1. Sangli (sangli)
 * 2. Chhatrapati Sambhajinagar (chhatrapati-sambhajinagar)
 * 3. Mumbai (mumbai)
 * 4. Pune (pune)
 * 5. Nagpur (nagpur)
 */

export const SUPPORTED_CITIES = [
  {
    id: 'sangli',
    name: 'Sangli',
    aliases: ['sangli', 'sangli-miraj', 'sangli miraj'],
    state: 'Maharashtra',
    popularLocalities: [
      'Vishrambag',
      'Gaonbhag',
      'Kupwad',
      'Miraj',
      'Madhavnagar',
      'Khanbhag',
      'Sangliwadi',
      'Rajwada',
      'Market Yard',
      'Kalanagar',
      'Chintamani Nagar'
    ]
  },
  {
    id: 'chhatrapati-sambhajinagar',
    name: 'Chhatrapati Sambhajinagar',
    aliases: [
      'chhatrapati-sambhajinagar',
      'chhatrapati sambhajinagar',
      'sambhajinagar',
      'aurangabad'
    ],
    state: 'Maharashtra',
    popularLocalities: [
      'Cidco',
      'Cannaught Place',
      'Kranti Chowk',
      'Waluj',
      'Garkheda',
      'Samarth Nagar',
      'Seven Hills',
      'Beed Bypass',
      'Town Centre',
      'Railway Station Area'
    ]
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    aliases: [
      'mumbai',
      'bombay',
      'greater-mumbai',
      'greater mumbai',
      'navi-mumbai',
      'navi mumbai',
      'thane'
    ],
    state: 'Maharashtra',
    popularLocalities: [
      'Andheri',
      'Bandra',
      'Dadar',
      'Borivali',
      'Powai',
      'Thane',
      'Kurla',
      'Juhu',
      'Malad',
      'Colaba',
      'Ghatkopar',
      'Vashi'
    ]
  },
  {
    id: 'pune',
    name: 'Pune',
    aliases: [
      'pune',
      'poona',
      'pimpri-chinchwad',
      'pimpri chinchwad',
      'pcmc'
    ],
    state: 'Maharashtra',
    popularLocalities: [
      'Kothrud',
      'Baner',
      'Wakad',
      'Hinjewadi',
      'Viman Nagar',
      'Hadapsar',
      'Aundh',
      'Shivajinagar',
      'Kalyani Nagar',
      'Koregaon Park',
      'Pimpri'
    ]
  },
  {
    id: 'nagpur',
    name: 'Nagpur',
    aliases: [
      'nagpur',
      'orange-city',
      'orange city'
    ],
    state: 'Maharashtra',
    popularLocalities: [
      'Dharampeth',
      'Sitabuldi',
      'Sadar',
      'Ramdaspeth',
      'Wardha Road',
      'Manish Nagar',
      'Pratap Nagar',
      'Civil Lines',
      'Nandanvan',
      'Trimurti Nagar'
    ]
  }
];

export const DEFAULT_CITY_ID = 'sangli';

/**
 * Normalizes input string to canonical city id.
 * Recognizes spelling variants (e.g. "Sambhajinagar" -> "chhatrapati-sambhajinagar").
 * Returns null if the city is not supported.
 */
export const normalizeCity = (input) => {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim().toLowerCase();
  const slugified = raw.replace(/[\s_]+/g, '-');

  for (const city of SUPPORTED_CITIES) {
    if (city.id === slugified || city.id === raw) {
      return city.id;
    }
    for (const alias of city.aliases) {
      const aliasSlug = alias.trim().toLowerCase().replace(/[\s_]+/g, '-');
      if (aliasSlug === slugified || alias.toLowerCase() === raw) {
        return city.id;
      }
    }
  }

  return null;
};

/**
 * Validates if a city string maps to a supported city.
 */
export const isValidCity = (input) => {
  return normalizeCity(input) !== null;
};

/**
 * Retrieves the full city configuration object.
 */
export const getCityById = (idOrAlias) => {
  const canonicalId = normalizeCity(idOrAlias);
  if (!canonicalId) return null;
  return SUPPORTED_CITIES.find(c => c.id === canonicalId) || null;
};

/**
 * Retrieves the friendly display name for a city.
 */
export const getCityDisplayName = (idOrAlias) => {
  const city = getCityById(idOrAlias);
  return city ? city.name : idOrAlias;
};

export default {
  SUPPORTED_CITIES,
  DEFAULT_CITY_ID,
  normalizeCity,
  isValidCity,
  getCityById,
  getCityDisplayName
};
