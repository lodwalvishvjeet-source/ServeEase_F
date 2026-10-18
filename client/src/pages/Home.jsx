import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Sparkles,
  Calendar,
  MessageSquare,
  User,
  RefreshCw,
  Lock,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import SectionHeading from '../components/common/SectionHeading';
import Button from '../components/common/Button';
import ServiceCard from '../components/service/ServiceCard';
import ProviderCard from '../components/provider/ProviderCard';
import EmptyState from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { SUPPORTED_CITIES, getCityDisplayName } from '../data/cities';
import { SERVICE_CATEGORIES } from '../data/sampleData';
import { providerApi, userApi } from '../services/api';

/**
 * Smart Role-Based Home Component
 * 
 * Determines rendering based on the authenticated user's role:
 * - Public Visitors: Attractive Landing Page with 5-city selector, search, categories, featured providers, how it works, trust/safety.
 * - Customers: Personalized customer home with greeting, city switcher, service search, recommended providers, recent booking status, quick links.
 * - Providers: Redirects to /provider/dashboard.
 * - Administrators: Redirects to /admin/dashboard.
 */
export default function Home() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--primary-600)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'var(--color-text-muted)' }}>Loading your ServeEase workspace...</p>
      </div>
    );
  }

  // Provider redirection
  if (isAuthenticated && user?.role === 'provider') {
    return <Navigate to="/provider/dashboard" replace />;
  }

  // Admin redirection
  if (isAuthenticated && user?.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Customer redirection
  if (isAuthenticated && user?.role === 'customer') {
    return <Navigate to="/customer/dashboard" replace />;
  }

  // Public visitor experience
  return <PublicLandingView />;
}

/**
 * =========================================================================
 * 1. PUBLIC VISITOR LANDING VIEW
 * =========================================================================
 */
function PublicLandingView() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('sangli');
  const [featuredProviders, setFeaturedProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Load real featured providers from backend for the selected city
  useEffect(() => {
    let isSubscribed = true;
    setLoadingProviders(true);

    providerApi.getProviders({ city: selectedCity, limit: 3 })
      .then(data => {
        if (isSubscribed && data.success && Array.isArray(data.providers)) {
          setFeaturedProviders(data.providers);
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setFeaturedProviders([]);
        }
      })
      .finally(() => {
        if (isSubscribed) setLoadingProviders(false);
      });

    return () => { isSubscribed = false; };
  }, [selectedCity]);

  const handleHeroSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (selectedCity) params.append('city', selectedCity);
    navigate(`/services?${params.toString()}`);
  };

  const activeCityName = getCityDisplayName(selectedCity);
  const popularCategories = SERVICE_CATEGORIES.slice(0, 8);

  return (
    <div className="public-landing-page">
      {/* Hero Section */}
      <section className="hero-section" style={{
        background: 'linear-gradient(135deg, #064e3b 0%, #065f46 45%, #047857 100%)',
        color: '#ffffff',
        padding: '5rem 0 4.5rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative circles */}
        <div style={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />

        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(8px)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#dcfce7',
              marginBottom: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <Sparkles size={15} style={{ color: '#86efac' }} />
              <span>Certified Local Professionals Across Maharashtra</span>
            </div>

            <h1 style={{
              fontSize: '3rem',
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#ffffff',
              marginBottom: '1.25rem',
              letterSpacing: '-0.02em'
            }}>
              Trusted Local Services, Right at Your Doorstep
            </h1>

            <p style={{
              fontSize: '1.2rem',
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '2.5rem',
              lineHeight: 1.6,
              maxWidth: '680px',
              margin: '0 auto 2.5rem'
            }}>
              Discover vetted electricians, plumbers, carpenters, and appliance experts in your neighborhood with transparent rates and fast response.
            </p>

            {/* Hero Search Box with City Selector */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem',
              boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.3)',
              color: 'var(--color-text-body)'
            }}>
              <form onSubmit={handleHeroSearch} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(220px, 2fr) auto',
                gap: '0.75rem',
                alignItems: 'center'
              }}>
                {/* 5-City Selector */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}>
                  <MapPin size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    aria-label="Select City"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: '100%',
                      fontWeight: 600,
                      color: 'var(--color-text-title)',
                      cursor: 'pointer',
                      outline: 'none',
                      fontSize: '0.95rem'
                    }}
                  >
                    {SUPPORTED_CITIES.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Service Search Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}>
                  <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="E.g. Plumbing, electrical, cleaning..."
                    aria-label="Search service"
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: '100%',
                      outline: 'none',
                      fontSize: '0.95rem',
                      color: 'var(--color-text-title)'
                    }}
                  />
                </div>

                {/* Find Services Button */}
                <Button type="submit" variant="primary" size="lg" style={{ height: '100%', whiteSpace: 'nowrap' }}>
                  <Search size={18} />
                  <span>Search Services</span>
                </Button>
              </form>
            </div>

            {/* Popular quick tags */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap',
              marginTop: '1.25rem',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Popular in {activeCityName}:</span>
              {['Plumbing', 'Electrical Repairs', 'House Cleaning', 'Carpentry', 'Appliance Repair'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    navigate(`/services?city=${selectedCity}&category=${encodeURIComponent(tag)}`);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    borderRadius: 'var(--radius-full)',
                    padding: '0.2rem 0.65rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Popular Service Categories */}
      <section className="section-spacing" style={{ backgroundColor: 'var(--color-bg-page)' }}>
        <div className="container">
          <SectionHeading
            eyebrow="Explore Categories"
            title="Popular Home & Maintenance Services"
            subtitle="Browse essential services delivered by verified local specialists."
            centered={true}
          />

          <div className="grid-4" style={{ gap: '1.25rem' }}>
            {popularCategories.map((cat) => (
              <ServiceCard
                key={cat.id}
                category={cat}
                selectedCity={selectedCity}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Local Providers in City */}
      <section className="section-spacing" style={{ backgroundColor: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="eyebrow" style={{ color: 'var(--primary-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>
                Verified Neighborhood Professionals
              </span>
              <h2 style={{ fontSize: '1.85rem', color: 'var(--color-text-title)', marginTop: '0.25rem' }}>
                Featured Specialists in {activeCityName}
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
                Connect directly with certified technicians ready to assist in your locality.
              </p>
            </div>

            <Button to={`/services?city=${selectedCity}`} variant="outline">
              View All {activeCityName} Providers <ArrowRight size={15} />
            </Button>
          </div>

          {loadingProviders ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 0.75rem' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>Retrieving specialists in {activeCityName}...</p>
            </div>
          ) : featuredProviders.length > 0 ? (
            <div className="grid-3" style={{ gap: '1.5rem' }}>
              {featuredProviders.map((provider) => (
                <ProviderCard key={provider._id || provider.id} provider={provider} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={`No providers currently listed in ${activeCityName}`}
              message="We are currently onboarding technicians in this city. Check other supported cities or register as a provider."
              actionText="Explore All Cities"
              onAction={() => navigate('/services')}
            />
          )}
        </div>
      </section>

      {/* How ServeEase Works */}
      <section className="section-spacing" style={{ backgroundColor: 'var(--color-bg-page)' }}>
        <div className="container">
          <SectionHeading
            eyebrow="Simple 3-Step Process"
            title="How ServeEase Works"
            subtitle="Get reliable neighborhood services arranged in three transparent steps."
            centered={true}
          />

          <div className="grid-3" style={{ gap: '2rem' }}>
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-700)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1.25rem'
              }}>
                1
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Select Service & City</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Choose your city from our 5 supported hubs and select the repair or maintenance trade you require.
              </p>
            </div>

            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-700)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1.25rem'
              }}>
                2
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Compare Verified Specialists</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Review real technician details, consultation pricing, experience, localities served, and active availability.
              </p>
            </div>

            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-700)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                fontWeight: 700,
                marginBottom: '1.25rem'
              }}>
                3
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Connect & Get It Done</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Log in to book an appointment or send direct requests with transparent doorstep consultation terms.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Safety Section */}
      <section className="section-spacing" style={{ backgroundColor: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border)' }}>
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'center', gap: '3rem' }}>
            <div>
              <span className="eyebrow" style={{ color: 'var(--primary-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.8rem' }}>
                Peace of Mind Guarantee
              </span>
              <h2 style={{ fontSize: '2rem', color: 'var(--color-text-title)', marginTop: '0.35rem', marginBottom: '1rem' }}>
                Why Maharashtra Trusts ServeEase
              </h2>
              <p style={{ color: 'var(--color-text-body)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
                Finding trustworthy home technicians shouldn't involve guesswork. ServeEase combines local community accountability with verified trade experience.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <ShieldCheck size={22} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-text-title)' }}>Identity & Trade Background Checked</strong>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Providers verify their contact credentials and trade background before listing.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <CheckCircle2 size={22} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-text-title)' }}>Transparent Upfront Consultation Rates</strong>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No hidden charges or surprise visit fees. Starting prices are clearly published.</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Clock size={22} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--color-text-title)' }}>Neighborhood-First Quick Response</strong>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Technicians operate within defined localities for prompt arrival times.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Trust Box */}
            <div className="card" style={{
              padding: '2.5rem',
              backgroundColor: 'var(--primary-50)',
              border: '1px solid var(--primary-100)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary-600)',
                  color: '#ffffff'
                }}>
                  <Lock size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--primary-900)' }}>Account Required for Booking</h3>
                  <p style={{ color: 'var(--primary-700)', fontSize: '0.85rem' }}>Protecting both customers and technicians</p>
                </div>
              </div>

              <p style={{ color: 'var(--primary-800)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
                Public visitors can freely browse technician catalogs and standard rates. To initiate a booking or message a provider, sign in to your ServeEase account.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Button to="/login" variant="primary">
                  Sign In to Book
                </Button>
                <Button to="/register" variant="outline" style={{ borderColor: 'var(--primary-600)', color: 'var(--primary-700)' }}>
                  Create Customer Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Join As Provider or Customer */}
      <section className="section-spacing" style={{ backgroundColor: 'var(--color-bg-page)' }}>
        <div className="container">
          <div className="card" style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            padding: '3rem 2rem',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h2 style={{ fontSize: '2.2rem', color: '#ffffff', marginBottom: '1rem' }}>
              Are You a Skilled Service Professional?
            </h2>
            <p style={{ color: '#cbd5e1', maxWidth: '600px', margin: '0 auto 2rem', fontSize: '1.05rem', lineHeight: 1.6 }}>
              Join hundreds of electricians, plumbers, and technicians on ServeEase across Sangli, Chhatrapati Sambhajinagar, Mumbai, Pune, and Nagpur.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Button to="/register" variant="primary" size="lg">
                Register as a Provider
              </Button>
              <Button to="/login" variant="outline" size="lg" style={{ borderColor: '#64748b', color: '#ffffff' }}>
                Provider Login
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * =========================================================================
 * 2. CUSTOMER HOME VIEW (Role: customer)
 * =========================================================================
 */
function CustomerHomeView({ user }) {
  const navigate = useNavigate();
  const [activeCity, setActiveCity] = useState(user?.city || 'sangli');
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendedProviders, setRecommendedProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [isUpdatingCity, setIsUpdatingCity] = useState(false);
  const [cityNotice, setCityNotice] = useState('');

  // Synchronize customer city
  useEffect(() => {
    if (user?.city) {
      setActiveCity(user.city);
    }
  }, [user?.city]);

  // Load recommended providers for customer's city from backend API
  useEffect(() => {
    let isSubscribed = true;
    setLoadingProviders(true);

    providerApi.getProviders({ city: activeCity, limit: 6 })
      .then(data => {
        if (isSubscribed && data.success && Array.isArray(data.providers)) {
          setRecommendedProviders(data.providers);
        }
      })
      .catch(() => {
        if (isSubscribed) setRecommendedProviders([]);
      })
      .finally(() => {
        if (isSubscribed) setLoadingProviders(false);
      });

    return () => { isSubscribed = false; };
  }, [activeCity]);

  // Handle customer switching their city (persists to backend profile and local state)
  const handleCitySwitch = async (newCity) => {
    setActiveCity(newCity);
    setIsUpdatingCity(true);
    setCityNotice('');

    try {
      await userApi.updateProfile({ city: newCity });
      setCityNotice(`City updated to ${getCityDisplayName(newCity)}!`);
      setTimeout(() => setCityNotice(''), 3000);
    } catch {
      // Local state still updated
      setCityNotice(`Browsing ${getCityDisplayName(newCity)}.`);
      setTimeout(() => setCityNotice(''), 3000);
    } finally {
      setIsUpdatingCity(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    params.append('city', activeCity);
    navigate(`/services?${params.toString()}`);
  };

  const activeCityName = getCityDisplayName(activeCity);
  const popularCategories = SERVICE_CATEGORIES.slice(0, 8);

  return (
    <div className="customer-home-page section-spacing" style={{ paddingTop: '1.5rem' }}>
      <div className="container">
        {/* Welcome & City Header Bar */}
        <div className="card" style={{
          padding: '1.75rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          backgroundColor: 'var(--color-bg-card)',
          borderLeft: '4px solid var(--primary-600)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span className="badge badge-primary">Customer Dashboard</span>
              {cityNotice && (
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-700)', fontWeight: 600 }}>
                  ✓ {cityNotice}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '1.75rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
              Welcome back, {user?.name || 'Customer'} 👋
            </h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Find and manage home repair specialists in your service area.
            </p>
          </div>

          {/* City Switching Control */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            backgroundColor: 'var(--color-bg-page)',
            padding: '0.5rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
          }}>
            <MapPin size={18} style={{ color: 'var(--primary-600)' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="customer-city-select" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Current City
              </label>
              <select
                id="customer-city-select"
                value={activeCity}
                onChange={(e) => handleCitySwitch(e.target.value)}
                disabled={isUpdatingCity}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--color-text-title)',
                  cursor: 'pointer',
                  outline: 'none',
                  paddingRight: '0.5rem'
                }}
              >
                {SUPPORTED_CITIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Customer Search Bar: "What service do you need?" */}
        <div className="card" style={{
          padding: '1.75rem',
          marginBottom: '2.5rem',
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)'
        }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)', marginBottom: '0.75rem' }}>
            What service do you need today?
          </h2>

          <form onSubmit={handleSearchSubmit} style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '0.75rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'var(--color-bg-subtle)',
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)'
            }}>
              <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search plumbing, wiring, AC cleaning, carpentry..."
                aria-label="What service do you need?"
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '1rem',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-title)'
                }}
              />
            </div>
            <Button type="submit" variant="primary">
              <Search size={16} /> Search Specialists
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

        {/* Quick Actions & Recent Bookings Grid */}
        <div className="grid-3" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
          {/* Quick Action: My Bookings */}
          <Link to="/customer/bookings" className="card" style={{
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}>
            <div style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-100)',
              color: 'var(--primary-700)'
            }}>
              <Calendar size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
                My Bookings
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                Track appointment status and service history
              </p>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--color-text-subtle)' }} />
          </Link>

          {/* Quick Action: Direct Messages */}
          <Link to="/customer/messages" className="card" style={{
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}>
            <div style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#e0f2fe',
              color: '#0284c7'
            }}>
              <MessageSquare size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
                Messages
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                Chat with technicians regarding repairs
              </p>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--color-text-subtle)' }} />
          </Link>

          {/* Quick Action: Profile Settings */}
          <Link to="/customer/profile" className="card" style={{
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}>
            <div style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fef3c7',
              color: '#d97706'
            }}>
              <User size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
                My Profile
              </h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                Update contact number, name, and address
              </p>
            </div>
            <ChevronRight size={18} style={{ color: 'var(--color-text-subtle)' }} />
          </Link>
        </div>

        {/* Popular Service Categories */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)' }}>
              Popular Categories in {activeCityName}
            </h2>
            <Link to={`/services?city=${activeCity}`} style={{ fontSize: '0.88rem', color: 'var(--primary-700)', fontWeight: 600 }}>
              Browse All Categories →
            </Link>
          </div>

          <div className="grid-4" style={{ gap: '1.25rem' }}>
            {popularCategories.map((cat) => (
              <ServiceCard
                key={cat.id}
                category={cat}
                selectedCity={activeCity}
              />
            ))}
          </div>
        </div>

        {/* Recommended Providers for Customer City */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)' }}>
                Recommended Providers in {activeCityName}
              </h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
                Verified specialists active in your selected city based on trade ratings.
              </p>
            </div>

            <Button to={`/services?city=${activeCity}`} variant="outline" size="sm">
              See All {activeCityName} Providers
            </Button>
          </div>

          {loadingProviders ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 0.75rem' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>Loading specialists for {activeCityName}...</p>
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
              message="No verified specialists match this city yet. Try switching cities or exploring nearby areas."
              actionText="Change City"
              onAction={() => handleCitySwitch('pune')}
            />
          )}
        </div>

        {/* Recent Bookings & Dispatch Status Section */}
        <div className="card" style={{ padding: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--color-text-title)' }}>
              Recent Booking Activity
            </h3>
            <span className="badge badge-primary">Recent Activity</span>
          </div>

          <div style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-bg-page)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '1rem'
          }}>
            <AlertCircle size={22} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', color: 'var(--color-text-title)', fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                Booking Dispatch Engine Status
              </strong>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                You have no active pending bookings in {activeCityName}. You can explore provider profiles and consultation rates above. Live appointment dispatching connects directly when you book a verified provider.
              </p>
              <div style={{ marginTop: '0.75rem' }}>
                <Button to={`/services?city=${activeCity}`} variant="primary" size="sm">
                  Find a Provider Now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
