import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  SlidersHorizontal, 
  RotateCcw, 
  AlertCircle, 
  RefreshCw, 
  Filter, 
  CheckCircle2,
  Wrench,
  Zap,
  Sparkles,
  Droplet,
  Home,
  ShieldCheck,
  Compass,
  ArrowRight,
  Map,
  LayoutGrid,
  Hammer,
  Cpu,
  Car,
  Paintbrush
} from 'lucide-react';
import SectionHeading from '../components/common/SectionHeading';
import ProviderCard from '../components/provider/ProviderCard';
import ServiceCard, { ServiceCardSkeleton } from '../components/service/ServiceCard';
import EmptyState from '../components/common/EmptyState';
import DashboardLayout from '../components/layout/DashboardLayout';
import ServiceMap from '../components/map/ServiceMap';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_CITIES, getCityDisplayName, normalizeCity, getCityById } from '../data/cities';
import { SERVICE_CATEGORIES as LOCAL_CATEGORIES } from '../data/sampleData';
import { providerApi } from '../services/api';
import { connectSocket } from '../services/socket';
import Autocomplete from '../components/common/Autocomplete';

// Fallback icon map for service category tokens
const ICON_MAP = {
  Wrench,
  Zap,
  Sparkles,
  Cpu,
  Hammer,
  Car,
  Compass,
  Paintbrush,
  Home,
  Droplet
};

/**
 * Unified Discover Services Page (/services)
 * 
 * Consolidates service browsing and provider discovery into a single, cohesive experience:
 * - 9-Category Service Catalog with loading, error, and empty states
 * - Explicit city requirement when no valid preference exists
 * - Keyword search across service names, categories, and technician profiles
 * - 5-city selector (Sangli, Chhatrapati Sambhajinagar, Mumbai, Pune, Nagpur)
 * - Category filter cards that filter on the same page without navigating away
 * - Active availability toggle
 * - Sorting by price and experience using verified backend data
 * - Shimmering loading skeletons, error state with retry, and informative empty state
 */
export default function Services() {
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active City Resolution: URL param -> User profile city -> localStorage
  const urlCity = searchParams.get('city');
  const normalizedUrlCity = urlCity ? normalizeCity(urlCity) : null;
  const userCity = user?.city ? normalizeCity(user.city) : null;
  const storedCity = localStorage.getItem('serveease_customer_city');
  const normalizedStoredCity = storedCity ? normalizeCity(storedCity) : null;

  // Explicit city selection is required if none exists
  const selectedCity = normalizedUrlCity || userCity || normalizedStoredCity || null;

  // Canonical metadata and human-friendly display name for the currently active city
  const activeCityMeta = useMemo(() => (selectedCity ? getCityById(selectedCity) : null), [selectedCity]);
  const activeCityDisplayName = useMemo(() => {
    if (!selectedCity) return '';
    return getCityDisplayName(selectedCity) || '';
  }, [selectedCity]);

  const selectedCategory = searchParams.get('category') || 'all';
  const searchQuery = searchParams.get('q') || '';
  const isAvailableOnly = searchParams.get('available') === 'true';
  const isVerifiedOnly = searchParams.get('verified') === 'true';
  const minRatingFilter = searchParams.get('minRating') || '';
  const maxPriceFilter = searchParams.get('maxPrice') || '';
  const areaFilter = searchParams.get('area') || '';
  const urlSort = searchParams.get('sort') || 'recommended';

  // Local state for debounced text inputs to keep typing responsive and preserve browser history
  const [searchInputValue, setSearchInputValue] = useState(searchQuery);
  const [areaInputValue, setAreaInputValue] = useState(areaFilter);

  // Synchronize local input state when browser back/forward or navigation changes searchParams
  useEffect(() => {
    setSearchInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setAreaInputValue(areaFilter);
  }, [areaFilter]);

  // Local state for sorting, providers, categories, loading, errors, and view mode
  const [sortBy, setSortBy] = useState(urlSort);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerError, setProviderError] = useState(null);

  // Categories Catalog State
  const [categories, setCategories] = useState(LOCAL_CATEGORIES);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState(null);

  // Sync URL search parameters cleanly with optional history replacement
  const updateUrlParams = (updates = {}, options = {}) => {
    const params = new URLSearchParams(searchParams);

    // Apply updates dictionary
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '' || value === false || (key === 'category' && value === 'all')) {
        params.delete(key);
      } else if (value === true) {
        params.set(key, 'true');
      } else {
        params.set(key, String(value));
      }
    });

    if (selectedCity && !params.has('city')) {
      params.set('city', selectedCity);
    }

    setSearchParams(params, options);
  };

  // Fetch Service Categories Catalog from API
  const fetchCategories = async () => {
    setLoadingCategories(true);
    setCategoryError(null);
    try {
      const data = await providerApi.getCategories();
      if (data && data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else {
        setCategories(LOCAL_CATEGORIES);
      }
    } catch (err) {
      console.warn('Could not fetch categories from server, using local catalog:', err.message);
      // Retain local fallback so UI remains functional
      setCategories(LOCAL_CATEGORIES);
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch Providers from API whenever city, category, search, availability, or filters change
  const fetchLiveProviders = async () => {
    if (!selectedCity) return;

    setLoadingProviders(true);
    setProviderError(null);

    try {
      const data = await providerApi.getProviders({
        city: selectedCity,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        serviceArea: areaFilter.trim() || undefined,
        q: searchQuery.trim() || undefined,
        available: isAvailableOnly,
        verified: isVerifiedOnly,
        minRating: minRatingFilter || undefined,
        maxPrice: maxPriceFilter || undefined,
        sort: sortBy,
        limit: 50
      });

      if (data && data.success && Array.isArray(data.providers)) {
        setProviders(data.providers);
      } else {
        setProviders([]);
      }
    } catch (err) {
      setProviderError(err.message || 'Error loading service providers from database.');
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    if (selectedCity) {
      fetchLiveProviders();
    }
  }, [
    selectedCity, 
    selectedCategory, 
    searchQuery, 
    isAvailableOnly, 
    isVerifiedOnly,
    minRatingFilter,
    maxPriceFilter,
    areaFilter,
    sortBy
  ]);

  // Real-time synchronization of provider availability changes via Socket.IO
  useEffect(() => {
    const socket = connectSocket();
    const handleAvailabilityChanged = ({ providerId, isAvailable }) => {
      setProviders((prev) =>
        prev.map((p) => {
          const id = (p._id || p.id)?.toString();
          if (id === providerId?.toString()) {
            return {
              ...p,
              isAvailable: isAvailable !== false,
              providerDetails: {
                ...(p.providerDetails || {}),
                isAvailable: isAvailable !== false
              }
            };
          }
          return p;
        })
      );
    };

    socket.on('provider_availability_changed', handleAvailabilityChanged);
    return () => {
      socket.off('provider_availability_changed', handleAvailabilityChanged);
    };
  }, []);

  // Window focus listener to refresh providers if tab was inactive
  useEffect(() => {
    const handleFocus = () => {
      if (selectedCity) {
        fetchLiveProviders();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [selectedCity, selectedCategory, searchQuery, isAvailableOnly, isVerifiedOnly, minRatingFilter, maxPriceFilter, areaFilter, sortBy]);


  const providerResultsRef = useRef(null);

  // Smoothly brings provider results into view when user selects a category or autocomplete suggestion
  const scrollToResults = () => {
    setTimeout(() => {
      if (providerResultsRef.current) {
        const rect = providerResultsRef.current.getBoundingClientRect();
        // If results section is below the viewport fold or scrolled past above, smoothly bring it into view
        if (rect.top < 60 || rect.top > window.innerHeight * 0.5) {
          const yOffset = -75; // Account for fixed top navbar
          const targetY = rect.top + window.pageYOffset + yOffset;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        }
      }
    }, 60);
  };

  // Autocomplete service, category, and provider suggestions
  const serviceAutocompleteOptions = useMemo(() => {
    const list = [];
    const seenLabels = new Set();

    const addOption = (opt) => {
      if (!opt || !opt.label) return;
      const key = opt.label.toLowerCase().trim();
      if (!seenLabels.has(key)) {
        seenLabels.add(key);
        list.push(opt);
      }
    };

    // Canonical category aliases for quick smart-matching (e.g. typing 'ele' suggests 'Electrician')
    const categoryAliases = {
      'Plumbing': ['Plumbing', 'Plumber', 'Plumbing Services', 'Sanitary Tech'],
      'Electrical Services': ['Electrical Services', 'Electrician', 'Electrical Repairs', 'Wireman'],
      'Carpentry': ['Carpentry', 'Carpenter', 'Woodwork', 'Furniture Assembly'],
      'Home Cleaning': ['Home Cleaning', 'House Cleaner', 'Deep Cleaning', 'Sanitization'],
      'Appliance Repair': ['Appliance Repair', 'AC Repair', 'AC Technician', 'Appliance Technician'],
      'Vehicle Mechanic': ['Vehicle Mechanic', 'Mechanic', 'Car Mechanic', 'Bike Mechanic', 'Roadside Assistance'],
      'Driver Services': ['Driver Services', 'Driver', 'Chauffeur', 'Personal Driver'],
      'Painting': ['Painting', 'Painter', 'House Painter', 'Wall Painting'],
      'Other Home Services': ['Other Home Services', 'Handyman', 'Pest Control', 'General Repairs']
    };

    // 1. Primary Categories & Aliases
    categories.forEach(cat => {
      const catName = cat.name || cat.title || cat.id;
      if (catName) {
        // Primary category entry
        addOption({
          id: `cat-${catName}`,
          label: catName,
          description: cat.shortDesc || cat.description || 'Service Category',
          type: 'category',
          targetCategory: catName,
          category: 'Categories',
          icon: cat.icon || null
        });

        // Category aliases (e.g. Electrician -> Electrical Services, Plumber -> Plumbing)
        const aliases = categoryAliases[catName] || [];
        aliases.forEach(alias => {
          if (alias.toLowerCase() !== catName.toLowerCase()) {
            addOption({
              id: `alias-${alias}`,
              label: alias,
              description: `Category Suggestion (${catName})`,
              type: 'category',
              targetCategory: catName,
              category: 'Categories',
              icon: cat.icon || null
            });
          }
        });

        // Category popular issues
        if (Array.isArray(cat.popularIssues)) {
          cat.popularIssues.forEach(issue => {
            addOption({
              id: `issue-${issue}`,
              label: issue,
              description: `${catName} Service`,
              type: 'service',
              targetCategory: catName,
              category: 'Common Services'
            });
          });
        }
      }
    });

    // 2. Additional popular repair services fallback if not covered by categories
    const commonServices = [
      { label: 'Tap Leakage & Pipe Repair', cat: 'Plumbing' },
      { label: 'Water Tap Leak', cat: 'Plumbing' },
      { label: 'Kitchen Sink & Drain Unclogging', cat: 'Plumbing' },
      { label: 'Switchboard Wiring & Short Circuit', cat: 'Electrical Services' },
      { label: 'Ceiling Fan & Light Installation', cat: 'Electrical Services' },
      { label: 'AC Deep Cleaning & Gas Refill', cat: 'Appliance Repair' },
      { label: 'Water Purifier & RO Servicing', cat: 'Appliance Repair' },
      { label: 'Door Lock & Hinge Repair', cat: 'Carpentry' },
      { label: 'Full Home Deep Cleaning', cat: 'Home Cleaning' },
      { label: 'Interior Wall Painting & Touchup', cat: 'Painting' },
      { label: 'Termite & Pest Control Treatment', cat: 'Other Home Services' },
      { label: 'Battery Jump Start', cat: 'Vehicle Mechanic' }
    ];

    commonServices.forEach(s => {
      addOption({
        id: `service-${s.label}`,
        label: s.label,
        description: `${s.cat} Service`,
        type: 'service',
        targetCategory: s.cat,
        category: 'Common Services'
      });
    });

    // 3. Real providers from current loaded list
    providers.forEach(p => {
      if (p.name) {
        addOption({
          id: `prov-${p._id || p.id}`,
          label: p.name,
          description: `${p.providerDetails?.title || p.category || 'Specialist'} • ${p.cityName || p.city || activeCityDisplayName || 'Local'}`,
          type: 'provider',
          targetCategory: p.providerDetails?.category || p.category || null,
          category: 'Providers'
        });
      }
    });

    return list;
  }, [categories, providers, activeCityDisplayName]);

  // Approved locality suggestions for active city from canonical configuration
  const localityAutocompleteOptions = useMemo(() => {
    if (!activeCityMeta?.popularLocalities) return [];
    return activeCityMeta.popularLocalities.map(loc => ({
      id: loc,
      label: loc,
      description: `${activeCityMeta.name} Area`
    }));
  }, [activeCityMeta]);

  const handleCategorySelect = (categoryName) => {
    const isAlreadySelected = 
      selectedCategory.toLowerCase() === categoryName.toLowerCase() ||
      selectedCategory.toLowerCase() === categoryName.toLowerCase().replace(/[\s_]+/g, '-');

    const nextCat = isAlreadySelected ? 'all' : categoryName;
    // Clear search query text when switching category so all matching providers appear immediately
    setSearchInputValue('');
    updateUrlParams({ category: nextCat, q: null });
    scrollToResults();
  };

  const handleSearchChange = (val) => {
    setSearchInputValue(val);
    updateUrlParams({ q: val || null }, { replace: true });
  };

  const handleServiceAutocompleteSelect = (item) => {
    if (!item) {
      // Clear search button clicked
      setSearchInputValue('');
      updateUrlParams({ q: null });
      return;
    }

    if (item.type === 'category') {
      const targetCat = item.targetCategory || item.label;
      setSearchInputValue('');
      updateUrlParams({ category: targetCat, q: null });
      scrollToResults();
    } else if (item.type === 'service') {
      setSearchInputValue(item.label);
      const updates = { q: item.label };
      if (item.targetCategory && selectedCategory === 'all') {
        updates.category = item.targetCategory;
      }
      updateUrlParams(updates);
      scrollToResults();
    } else if (item.type === 'provider') {
      setSearchInputValue(item.label);
      updateUrlParams({ q: item.label });
      scrollToResults();
    } else {
      const val = item.label || item.value || String(item);
      setSearchInputValue(val);
      updateUrlParams({ q: val || null });
      scrollToResults();
    }
  };

  const handleAreaChange = (val) => {
    setAreaInputValue(val);
    updateUrlParams({ area: val || null }, { replace: true });
  };

  const handleCityChange = (e) => {
    const nextCity = e.target.value;
    localStorage.setItem('serveease_customer_city', nextCity);
    updateUrlParams({ city: nextCity, area: null });
  };

  const handleSelectExplicitCity = (cityId) => {
    localStorage.setItem('serveease_customer_city', cityId);
    updateUrlParams({ city: cityId, area: null });
  };

  const handleAvailableToggle = (e) => {
    updateUrlParams({ available: e.target.checked });
  };

  const handleVerifiedToggle = (e) => {
    updateUrlParams({ verified: e.target.checked });
  };

  const handleRatingFilterChange = (e) => {
    updateUrlParams({ minRating: e.target.value || null });
  };

  const handlePriceFilterChange = (e) => {
    updateUrlParams({ maxPrice: e.target.value || null });
  };

  const handleSortChange = (e) => {
    const nextSort = e.target.value;
    setSortBy(nextSort);
    updateUrlParams({ sort: nextSort === 'recommended' ? null : nextSort });
  };

  const handleResetFilters = () => {
    setSortBy('recommended');
    setSearchInputValue('');
    setAreaInputValue('');
    const params = new URLSearchParams();
    if (selectedCity) params.set('city', selectedCity);
    setSearchParams(params);
  };

  // Client-side sorting fallback on real backend records
  const sortedProviders = useMemo(() => {
    return [...providers].sort((a, b) => {
      if (sortBy === 'recommended') return (Number(b.matchScore) || 0) - (Number(a.matchScore) || 0);
      if (sortBy === 'experience') return (Number(b.experienceYears) || 0) - (Number(a.experienceYears) || 0);
      if (sortBy === 'price-low') return (Number(a.startingPrice) || 0) - (Number(b.startingPrice) || 0);
      if (sortBy === 'price-high') return (Number(b.startingPrice) || 0) - (Number(a.startingPrice) || 0);
      if (sortBy === 'rating') return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      return 0;
    });
  }, [providers, sortBy]);

  // Dynamic provider results section heading (e.g. "Plumbing Providers Near You")
  const resultsHeading = useMemo(() => {
    if (selectedCategory && selectedCategory !== 'all') {
      const matchedCat = categories.find(
        c => (c.name || '').toLowerCase() === selectedCategory.toLowerCase() ||
             (c.slug || c.id || '').toLowerCase() === selectedCategory.toLowerCase().replace(/[\s_]+/g, '-')
      );
      const catDisplayName = matchedCat ? (matchedCat.name || matchedCat.title) : selectedCategory;
      return `${catDisplayName} Providers Near You`;
    }
    if (searchQuery) {
      return `Matching Providers for "${searchQuery}"`;
    }
    return `Service Providers in ${activeCityDisplayName || 'Your Area'}`;
  }, [selectedCategory, searchQuery, categories, activeCityDisplayName]);

  // =========================================================================
  // EXPLICIT CITY SELECTION VIEW (when no city is selected yet)
  // =========================================================================
  if (!selectedCity) {
    const citySelectionContent = (
      <div className="city-gate-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-100)',
            color: 'var(--primary-700)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}>
            <MapPin size={28} />
          </div>
          <h2 style={{ fontSize: '1.85rem', color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
            Select Your City to Discover Services
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', maxWidth: '600px', margin: '0 auto' }}>
            ServeEase connects you with verified neighborhood technicians. Please pick your city to view accurate pricing, nearby providers, and local coverage.
          </p>
        </div>

        <div className="grid-3" style={{ gap: '1.25rem' }}>
          {SUPPORTED_CITIES.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => handleSelectExplicitCity(city.id)}
              className="card"
              style={{
                padding: '1.5rem',
                textAlign: 'left',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
                    {city.name}
                  </span>
                  <MapPin size={18} style={{ color: 'var(--primary-600)' }} />
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Coverage: {city.popularLocalities.slice(0, 4).join(', ')}...
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--primary-600)',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}>
                <span>Explore Providers</span>
                <ArrowRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );

    if (isAuthenticated && (user?.role === 'customer' || user?.role === 'provider' || user?.role === 'admin')) {
      return (
        <DashboardLayout
          title="Select Your Service Location"
          subtitle="Choose your city to browse verified local technicians and pricing catalogs"
        >
          {citySelectionContent}
        </DashboardLayout>
      );
    }

    return (
      <div className="services-page section-spacing">
        <div className="container">
          {citySelectionContent}
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN COMBINED DISCOVERY CONTENT
  // =========================================================================
  const content = (
    <div className="discover-services-container">
      {/* 1. Search & Location Filter Bar */}
      <div className="card" style={{
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ maxWidth: '800px', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.45rem', color: 'var(--color-text-title)', marginBottom: '0.25rem' }}>
            What service do you need in {activeCityDisplayName}?
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
            Connect with verified neighborhood electricians, plumbers, carpenters, and appliance specialists.
          </p>
        </div>

        {/* Search, City & Sort Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px, 1.2fr) minmax(260px, 2.5fr) minmax(180px, 1fr)',
          gap: '0.75rem',
          alignItems: 'center'
        }}>
          {/* City Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.7rem 0.9rem',
            backgroundColor: 'var(--color-bg-page)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
          }}>
            <MapPin size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
            <select
              value={selectedCity}
              onChange={handleCityChange}
              aria-label="Filter by City"
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                fontWeight: 600,
                fontSize: '0.92rem',
                outline: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-title)'
              }}
            >
              {SUPPORTED_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service & Keyword Search Autocomplete */}
          <Autocomplete
            id="discover-service-search-input"
            name="q"
            value={searchInputValue}
            onChange={handleSearchChange}
            onSelect={handleServiceAutocompleteSelect}
            options={serviceAutocompleteOptions}
            placeholder="Search by service name, category, or provider..."
            icon={<Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
            allowCustom={true}
            clearable={true}
            debounceMs={250}
          />

          {/* Sort Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.7rem 0.9rem',
            backgroundColor: 'var(--color-bg-page)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
          }}>
            <SlidersHorizontal size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <select
              value={sortBy}
              onChange={handleSortChange}
              aria-label="Sort providers"
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '0.88rem',
                outline: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                color: 'var(--color-text-title)'
              }}
            >
              <option value="recommended">Best Match (Recommended)</option>
              <option value="rating">Top Rated</option>
              <option value="experience">Most Experienced</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Smart Matching Quick Filter Row */}
        <div style={{
          marginTop: '0.9rem',
          display: 'grid',
          gridTemplateColumns: 'minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(130px, 1fr)',
          gap: '0.75rem',
          alignItems: 'center'
        }}>
          {/* Locality / Area Filter Autocomplete */}
          <Autocomplete
            id="discover-area-filter-input"
            name="area"
            value={areaInputValue}
            onChange={handleAreaChange}
            onSelect={(item) => {
              const val = item ? (item.label || item.value || '') : '';
              handleAreaChange(val);
            }}
            options={localityAutocompleteOptions}
            placeholder={activeCityMeta ? `Filter by ${activeCityMeta.name} locality...` : 'Filter by neighborhood / area...'}
            icon={<MapPin size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />}
            allowCustom={true}
            clearable={true}
            debounceMs={300}
            emptyMessage={activeCityMeta ? `No known localities for ${activeCityMeta.name}. You can still type manually.` : 'Select a city.'}
          />

          {/* Rating Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.8rem',
            backgroundColor: 'var(--color-bg-page)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
          }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>Rating:</span>
            <select
              value={minRatingFilter}
              onChange={handleRatingFilterChange}
              aria-label="Filter by Minimum Rating"
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-title)'
              }}
            >
              <option value="">All Ratings</option>
              <option value="4.5">4.5+ ★ Top Rated</option>
              <option value="4">4.0+ ★ Highly Rated</option>
              <option value="3">3.0+ ★ Rated</option>
            </select>
          </div>

          {/* Price / Budget Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 0.8rem',
            backgroundColor: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
          }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>Budget:</span>
            <select
              value={maxPriceFilter}
              onChange={handlePriceFilterChange}
              aria-label="Filter by Consultation Budget"
              style={{
                border: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-title)'
              }}
            >
              <option value="">Any Budget</option>
              <option value="300">Under ₹300</option>
              <option value="500">Under ₹500</option>
              <option value="1000">Under ₹1,000</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary, Availability & Verified Toggles */}
        <div style={{
          marginTop: '1.25rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid rgba(21, 128, 61, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.85rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>
              Showing <strong>{sortedProviders.length}</strong> specialists in <strong>{activeCityDisplayName}</strong>
              {selectedCategory !== 'all' && (
                <> for category <strong>"{selectedCategory}"</strong></>
              )}
            </span>

            {/* Available Now Toggle */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isAvailableOnly}
                onChange={handleAvailableToggle}
                style={{ accentColor: 'var(--primary-600)', width: '15px', height: '15px' }}
              />
              <span>Available Now</span>
            </label>

            {/* Verified Only Toggle */}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={isVerifiedOnly}
                onChange={handleVerifiedToggle}
                style={{ accentColor: 'var(--primary-600)', width: '15px', height: '15px' }}
              />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                <ShieldCheck size={14} style={{ color: 'var(--primary-600)' }} />
                <span>Verified Only</span>
              </span>
            </label>
          </div>

          {(selectedCategory !== 'all' || searchQuery || isAvailableOnly || isVerifiedOnly || minRatingFilter || maxPriceFilter || areaFilter || sortBy !== 'recommended') && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--color-danger)',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.82rem'
              }}
            >
              <RotateCcw size={13} /> Reset Active Filters
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive Category Filter Bar */}
      <section style={{ marginBottom: '1.75rem' }} aria-label="Service Category Filters">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Categories
            </span>
            {selectedCategory !== 'all' && (
              <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                Active: {selectedCategory}
              </span>
            )}
          </div>

          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => handleCategorySelect('all')}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem', height: 'auto' }}
            >
              Show All Categories
            </button>
          )}
        </div>

        {/* Scrollable / Responsive Category Pills */}
        <div style={{
          display: 'flex',
          gap: '0.55rem',
          overflowX: 'auto',
          paddingBottom: '0.4rem',
          paddingTop: '0.1rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flexWrap: 'wrap'
        }}>
          {/* All Services Pill */}
          <button
            type="button"
            onClick={() => {
              if (selectedCategory !== 'all') {
                updateUrlParams({ category: 'all' });
                scrollToResults();
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1rem',
              borderRadius: 'var(--radius-full)',
              border: selectedCategory === 'all' ? '1px solid var(--primary-600)' : '1px solid var(--color-border)',
              backgroundColor: selectedCategory === 'all' ? 'var(--primary-600)' : 'var(--color-bg-card)',
              color: selectedCategory === 'all' ? '#ffffff' : 'var(--color-text-title)',
              fontWeight: selectedCategory === 'all' ? 700 : 500,
              fontSize: '0.86rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: selectedCategory === 'all' ? '0 2px 8px rgba(21, 128, 61, 0.25)' : 'var(--shadow-xs)',
              transition: 'all 0.18s ease'
            }}
          >
            <LayoutGrid size={15} style={{ color: selectedCategory === 'all' ? '#ffffff' : 'var(--primary-600)' }} />
            <span>All Services</span>
            {selectedCategory === 'all' && (
              <span style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontWeight: 600
              }}>
                {sortedProviders.length}
              </span>
            )}
          </button>

          {/* Individual Category Pills */}
          {categories.map((cat) => {
            const isSelected = 
              selectedCategory.toLowerCase() === (cat.name || '').toLowerCase() ||
              selectedCategory.toLowerCase() === (cat.slug || cat.id || '').toLowerCase();

            const IconComp = ICON_MAP[cat.icon] || Wrench;

            return (
              <button
                key={cat.id || cat.slug || cat.name}
                type="button"
                onClick={() => handleCategorySelect(cat.name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected ? '1px solid var(--primary-600)' : '1px solid var(--color-border)',
                  backgroundColor: isSelected ? 'var(--primary-600)' : 'var(--color-bg-card)',
                  color: isSelected ? '#ffffff' : 'var(--color-text-title)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 2px 8px rgba(21, 128, 61, 0.25)' : 'var(--shadow-xs)',
                  transition: 'all 0.18s ease'
                }}
              >
                <IconComp size={15} style={{ color: isSelected ? '#ffffff' : 'var(--primary-600)' }} />
                <span>{cat.name}</span>
                {isSelected && (
                  <CheckCircle2 size={13} style={{ color: '#ffffff', strokeWidth: 3 }} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. PROVIDER RESULTS SECTION */}
      <section ref={providerResultsRef} style={{ marginBottom: '3rem', scrollMarginTop: '90px' }} aria-label="Service Providers List">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text-title)', margin: 0 }}>
                {resultsHeading}
              </h2>
              <span className="badge badge-primary" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}>
                {sortedProviders.length} {sortedProviders.length === 1 ? 'provider' : 'providers'}
              </span>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginTop: '0.35rem', marginBottom: 0 }}>
              {selectedCategory !== 'all'
                ? `Verified local ${selectedCategory} specialists available in ${activeCityDisplayName} for prompt doorstep service.`
                : `Verified local professionals available for doorstep appointments across ${activeCityDisplayName}.`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* View Mode Toggle: List vs Map */}
            <div style={{
              display: 'inline-flex',
              backgroundColor: 'var(--color-bg-subtle, #f1f5f9)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              border: '1px solid var(--color-border)'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none',
                  backgroundColor: viewMode === 'list' ? 'var(--color-bg-card, #ffffff)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--primary-700)' : 'var(--color-text-muted)',
                  fontWeight: viewMode === 'list' ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <LayoutGrid size={14} />
                <span>List View</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('map')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'calc(var(--radius-md) - 2px)',
                  border: 'none',
                  backgroundColor: viewMode === 'map' ? 'var(--color-bg-card, #ffffff)' : 'transparent',
                  color: viewMode === 'map' ? 'var(--primary-700)' : 'var(--color-text-muted)',
                  fontWeight: viewMode === 'map' ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'map' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Map size={14} />
                <span>Map View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Results Region: Skeletons / Error / Map View / Cards / Empty State */}
        {loadingProviders ? (
          <div className="grid-3" style={{ gap: '1.25rem' }}>
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={idx} className="skeleton-provider-card">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div className="skeleton-box" style={{ width: '3.5rem', height: '3.5rem', borderRadius: 'var(--radius-md)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div className="skeleton-box" style={{ width: '60%', height: '1.1rem' }} />
                    <div className="skeleton-box" style={{ width: '40%', height: '0.8rem' }} />
                  </div>
                </div>
                <div className="skeleton-box" style={{ width: '80%', height: '0.9rem', marginTop: '0.5rem' }} />
                <div className="skeleton-box" style={{ width: '100%', height: '2.5rem', marginTop: '0.5rem' }} />
              </div>
            ))}
          </div>
        ) : providerError ? (
          <div className="alert-box alert-error" style={{ marginBottom: '2rem' }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong>Unable to load providers:</strong> {providerError}
            </div>
            <button
              onClick={fetchLiveProviders}
              className="btn btn-outline btn-sm"
              style={{ borderColor: '#f87171', color: '#b91c1c' }}
            >
              Retry Query
            </button>
          </div>
        ) : viewMode === 'map' ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <ServiceMap
              providers={sortedProviders}
              selectedCity={selectedCity}
              category={selectedCategory}
              height="520px"
            />
          </div>
        ) : sortedProviders.length > 0 ? (
          <div className="grid-3" style={{ gap: '1.25rem' }}>
            {sortedProviders.map((provider) => (
              <ProviderCard key={provider.id || provider._id} provider={provider} />
            ))}
          </div>
        ) : (
          <div className="card" style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-card)'
          }}>
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-600)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Search size={26} />
            </div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
              No {selectedCategory !== 'all' ? `${selectedCategory} ` : ''}Providers Found in {activeCityDisplayName}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto 1.5rem auto' }}>
              We could not find active technicians matching your selected criteria in {activeCityDisplayName}. You can reset your filters or explore other popular service categories below.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-primary btn-sm"
              >
                Reset All Filters
              </button>
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => handleCategorySelect('all')}
                  className="btn btn-outline btn-sm"
                >
                  Explore All Categories
                </button>
              )}
            </div>

            {/* Quick Suggestions Pills */}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.65rem' }}>
                Try browsing other popular categories:
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                {categories.slice(0, 5).map((cat) => (
                  <button
                    key={cat.id || cat.name}
                    type="button"
                    onClick={() => handleCategorySelect(cat.name)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '0.3rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-page)',
                      color: 'var(--primary-700)',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 4. EXPLORE SERVICE CATEGORIES & STANDARD RATES CATALOG */}
      <section style={{ marginBottom: '2.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', marginBottom: '0.25rem' }}>
              Service Catalog & Standard Consultation Rates
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              Click any category card to view its verified local specialists and coverage in {activeCityDisplayName}
            </p>
          </div>

          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => handleCategorySelect('all')}
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.82rem' }}
            >
              Show All Categories
            </button>
          )}
        </div>

        {loadingCategories ? (
          <div className="grid-3" style={{ gap: '1.25rem' }}>
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <ServiceCardSkeleton key={idx} />
            ))}
          </div>
        ) : categoryError ? (
          <div className="alert-box alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <div style={{ flex: 1 }}>{categoryError}</div>
            <button onClick={fetchCategories} className="btn btn-outline btn-sm">Retry</button>
          </div>
        ) : categories.length > 0 ? (
          <div className="grid-3" style={{ gap: '1.25rem' }}>
            {categories.map((cat) => {
              const isSelected = 
                selectedCategory.toLowerCase() === cat.name.toLowerCase() ||
                selectedCategory.toLowerCase() === (cat.slug || cat.id).toLowerCase();

              return (
                <ServiceCard
                  key={cat.id || cat.slug}
                  category={cat}
                  isSelected={isSelected}
                  onSelect={handleCategorySelect}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Categories Available"
            message="No service categories could be loaded. Please check your network connection."
            actionText="Reload Categories"
            onAction={fetchCategories}
          />
        )}
      </section>
    </div>
  );

  // If authenticated customer or provider, render inside SaaS DashboardLayout
  if (isAuthenticated && (user?.role === 'customer' || user?.role === 'provider' || user?.role === 'admin')) {
    return (
      <DashboardLayout
        title="Discover Services"
        subtitle={`Browse verified local home repair specialists in ${activeCityDisplayName || 'your area'}`}
      >
        {content}
      </DashboardLayout>
    );
  }

  // Public visitor layout
  return (
    <div className="services-page section-spacing">
      <div className="container">
        <SectionHeading
          eyebrow="Specialist Discovery"
          title={`Discover Services in ${activeCityDisplayName || 'Your City'}`}
          subtitle="Explore vetted neighborhood professionals, compare consultation rates, and view verified profiles."
          centered={false}
        />
        {content}
      </div>
    </div>
  );
}
