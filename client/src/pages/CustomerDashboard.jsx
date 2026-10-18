import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Calendar, 
  User, 
  Compass, 
  ArrowRight, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  ShieldCheck,
  Wrench
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import Autocomplete from '../components/common/Autocomplete';
import ProviderCard from '../components/provider/ProviderCard';
import EmptyState from '../components/common/EmptyState';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SUPPORTED_CITIES, getCityDisplayName } from '../data/cities';
import { SERVICE_CATEGORIES } from '../data/sampleData';
import { providerApi, userApi } from '../services/api';

/**
 * Customer Dashboard Page (/customer/dashboard)
 * 
 * Central hub for authenticated customers:
 * - Personalized greeting with customer's real name
 * - Prominent "Find a Service" search bar pointing to Discover Services
 * - Current city switcher connected with MongoDB Atlas profile updates
 * - Popular service categories shortcuts
 * - Recommended verified providers queried live from /api/providers
 * - Recent bookings overview with clean empty state
 * - Quick shortcuts to Discover Services, My Bookings, Messages, and My Profile
 */
export default function CustomerDashboard() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [activeCity, setActiveCity] = useState(user?.city || 'sangli');
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendedProviders, setRecommendedProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState(null);
  const [isUpdatingCity, setIsUpdatingCity] = useState(false);
  const [cityFeedback, setCityFeedback] = useState('');

  // Keep activeCity in sync with user profile
  useEffect(() => {
    if (user?.city) {
      setActiveCity(user.city);
    }
  }, [user?.city]);

  // Load recommended providers for customer's city from backend API
  useEffect(() => {
    let isSubscribed = true;

    const fetchRecommended = async () => {
      setLoadingProviders(true);
      setProviderError(null);
      try {
        const data = await providerApi.getProviders({
          city: activeCity,
          limit: 6
        });
        if (isSubscribed) {
          if (data && data.success && Array.isArray(data.providers)) {
            setRecommendedProviders(data.providers);
          } else {
            setRecommendedProviders([]);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setProviderError(err.message || 'Failed to load local providers.');
        }
      } finally {
        if (isSubscribed) setLoadingProviders(false);
      }
    };

    fetchRecommended();
    return () => { isSubscribed = false; };
  }, [activeCity]);

  // Handle switching city (persists to backend and local storage)
  const handleCityChange = async (newCity) => {
    setActiveCity(newCity);
    setIsUpdatingCity(true);
    setCityFeedback('');

    try {
      await updateProfile({ city: newCity });
      localStorage.setItem('serveease_customer_city', newCity);
      setCityFeedback(`City updated to ${getCityDisplayName(newCity)}`);
      setTimeout(() => setCityFeedback(''), 3000);
    } catch {
      setCityFeedback(`Viewing ${getCityDisplayName(newCity)}`);
      setTimeout(() => setCityFeedback(''), 3000);
    } finally {
      setIsUpdatingCity(false);
    }
  };

  // Service & category suggestions for useful autocomplete
  const serviceSuggestions = useMemo(() => {
    const list = [];
    SERVICE_CATEGORIES.forEach(cat => {
      list.push({
        id: `cat-${cat.id}`,
        label: cat.name,
        category: 'Service Category',
        description: cat.shortDesc,
        isCategory: true
      });
      if (Array.isArray(cat.popularIssues)) {
        cat.popularIssues.forEach(issue => {
          list.push({
            id: `issue-${cat.id}-${issue}`,
            label: issue,
            category: cat.name,
            description: `Under ${cat.name}`,
            isCategory: false
          });
        });
      }
    });
    return list;
  }, []);

  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    params.append('city', activeCity);
    navigate(`/services?${params.toString()}`);
  };

  const handleSelectService = (item) => {
    if (!item) return;
    const params = new URLSearchParams();
    params.append('city', activeCity);
    if (item.isCategory) {
      params.append('category', item.label);
    } else {
      params.append('q', item.label);
    }
    navigate(`/services?${params.toString()}`);
  };

  const activeCityName = getCityDisplayName(activeCity);
  const popularCategories = SERVICE_CATEGORIES.slice(0, 8);

  return (
    <DashboardLayout
      title={`Customer Workspace`}
      subtitle={`Welcome back, ${user?.name || 'Customer'}`}
    >
      {/* 1. Welcome & City Bar */}
      <div className="card" style={{
        padding: '1.75rem',
        marginBottom: '2rem',
        backgroundColor: 'var(--color-bg-card)',
        borderLeft: '4px solid var(--primary-600)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="badge badge-primary">Customer Account</span>
            {cityFeedback && (
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                ✓ {cityFeedback}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
            Welcome back, {user?.name || 'Customer'} 👋
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem' }}>
            Book trusted local technicians and manage home repairs in <strong>{activeCityName}</strong>.
          </p>
        </div>

        {/* City Switcher */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          backgroundColor: 'var(--color-bg-subtle)',
          padding: '0.55rem 0.9rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)'
        }}>
          <MapPin size={18} style={{ color: 'var(--primary-600)' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label htmlFor="customer-city-select" style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Service Hub
            </label>
            <select
              id="customer-city-select"
              value={activeCity}
              onChange={(e) => handleCityChange(e.target.value)}
              disabled={isUpdatingCity}
              style={{
                border: 'none',
                background: 'transparent',
                fontWeight: 700,
                fontSize: '0.95rem',
                color: 'var(--color-text-title)',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {SUPPORTED_CITIES.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Pending Email Verification Banner */}
      {!user?.emailVerified && (
        <div style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <AlertCircle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: '0.98rem' }}>
                Email Verification Required for Bookings
              </p>
              <p style={{ margin: 0, color: '#b45309', fontSize: '0.88rem' }}>
                You can browse local services and technicians, but your email address must be verified before requesting appointments.
              </p>
            </div>
          </div>
          <Link to="/verify-email" state={{ email: user?.email }}>
            <Button variant="primary" size="sm" style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}>
              Verify Email Now
            </Button>
          </Link>
        </div>
      )}

      {/* 2. Prominent "Explore Services" Search Box */}
      <div className="card" style={{
        padding: '1.75rem',
        marginBottom: '2.25rem',
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--primary-100)'
      }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)', marginBottom: '0.75rem' }}>
          Explore Services in {activeCityName}
        </h2>

        <form onSubmit={handleSearchSubmit} style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '0.75rem',
          alignItems: 'start'
        }}>
          <Autocomplete
            id="customer-search-input"
            name="customerSearch"
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            onSelect={handleSelectService}
            options={serviceSuggestions}
            placeholder="Search services or categories (e.g. Geyser repair, AC service, Plumber...)"
            icon={<Search size={18} />}
            emptyMessage="No exact services found. Press Enter to search all."
            allowCustom={true}
          />

          <Button type="submit" variant="primary" id="customer-explore-services-btn">
            <Search size={16} /> Explore Services
          </Button>
        </form>

        {/* Quick Category Chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          {['Plumbing', 'Electrical Repairs', 'House Cleaning', 'Carpentry', 'Appliance Repair'].map((trade) => (
            <button
              key={trade}
              type="button"
              onClick={() => navigate(`/services?city=${activeCity}&category=${encodeURIComponent(trade)}`)}
              style={{
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                padding: '0.3rem 0.75rem',
                fontSize: '0.82rem',
                color: 'var(--color-text-body)',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
            >
              + {trade}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Quick Action Cards */}
      <div className="grid-3" style={{ gap: '1.25rem', marginBottom: '2.5rem' }}>
        <Link 
          to={`/services?city=${activeCity}`} 
          id="customer-explore-services-card"
          className="card" 
          style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}
        >
          <div style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary-100)',
            color: 'var(--primary-700)'
          }}>
            <Compass size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--color-text-title)', fontWeight: 600 }}>
              Explore Services
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              Search all local trades in {activeCityName}
            </p>
          </div>
        </Link>

        <Link to="/customer/bookings" className="card" style={{
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          textDecoration: 'none',
          color: 'inherit',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#e0f2fe',
            color: '#0284c7'
          }}>
            <Calendar size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--color-text-title)', fontWeight: 600 }}>
              My Bookings
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              Track appointments
            </p>
          </div>
        </Link>

        <Link to="/customer/profile" className="card" style={{
          padding: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          textDecoration: 'none',
          color: 'inherit',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f1f5f9',
            color: '#475569'
          }}>
            <User size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--color-text-title)', fontWeight: 600 }}>
              My Profile
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              Contact & city settings
            </p>
          </div>
        </Link>
      </div>

      {/* 4. Popular Service Categories */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)' }}>
            Popular Service Categories in {activeCityName}
          </h2>
          <Link to={`/services?city=${activeCity}`} style={{ fontSize: '0.88rem', color: 'var(--primary-700)', fontWeight: 600 }}>
            Browse All in Discover Services →
          </Link>
        </div>

        <div className="grid-4" style={{ gap: '1rem' }}>
          {popularCategories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => navigate(`/services?city=${activeCity}&category=${encodeURIComponent(cat.name)}`)}
              className="card"
              style={{
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '1.5rem' }}>{cat.icon || '🔧'}</span>
                <ChevronRight size={16} style={{ color: 'var(--color-text-subtle)' }} />
              </div>
              <h3 style={{ fontSize: '1rem', color: 'var(--color-text-title)', fontWeight: 600 }}>
                {cat.name}
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', lineHeight: 1.4 }}>
                {cat.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Recommended Providers from Real API */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)' }}>
              Recommended Providers in {activeCityName}
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              Verified specialists available in your neighborhood based on verified trade credentials.
            </p>
          </div>

          <Button to={`/services?city=${activeCity}`} variant="outline" size="sm">
            View All in Discover Services
          </Button>
        </div>

        {loadingProviders ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 0.75rem' }} />
            <p style={{ color: 'var(--color-text-muted)' }}>Loading specialists for {activeCityName}...</p>
          </div>
        ) : providerError ? (
          <div className="alert-box alert-error">
            <AlertCircle size={20} />
            <div>{providerError}</div>
          </div>
        ) : recommendedProviders.length > 0 ? (
          <div className="grid-3" style={{ gap: '1.5rem' }}>
            {recommendedProviders.map((provider) => (
              <ProviderCard key={provider._id || provider.id} provider={provider} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`No providers found in ${activeCityName}`}
            message="No verified technicians currently listed for this area. Try selecting another city or clearing trade filters."
            actionText="Change City to Pune"
            onAction={() => handleCityChange('pune')}
          />
        )}
      </div>

      {/* 5. Recent Bookings Overview with Clean Empty State */}
      <div className="card" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-title)' }}>
            Recent Bookings
          </h3>
          <span className="badge badge-primary">Appointments</span>
        </div>

        <div style={{
          padding: '1.5rem',
          backgroundColor: 'var(--color-bg-page)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem'
        }}>
          <Calendar size={24} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', color: 'var(--color-text-title)', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              No Active Appointments Scheduled
            </strong>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              You haven't scheduled any service visits in {activeCityName}. You can browse available technicians and consultation rates in Discover Services.
            </p>
            <div style={{ marginTop: '0.85rem' }}>
              <Button to={`/services?city=${activeCity}`} variant="primary" size="sm">
                Discover Local Services
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
