import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  MapPin,
  Calendar,
  Clock,
  User,
  Wrench,
  Search,
  Filter,
  Navigation,
  ExternalLink,
  Info,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ServiceMap from '../components/map/ServiceMap';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { providerApi, bookingApi } from '../services/api';
import { connectSocket } from '../services/socket';
import { SUPPORTED_CITIES, getCityDisplayName, normalizeCity } from '../data/cities';
import { SERVICE_CATEGORIES } from '../data/sampleData';

/**
 * Customer Map & Location Page (/customer/map)
 * 
 * Provides authenticated customers with:
 * 1. Interactive map of verified service specialists in their city
 * 2. Visual representation of their own authorized booking appointment locations
 * 3. Quick focus/directions links for scheduled services
 * 4. Ability to pin/update their service delivery location for booked visits
 * 5. Informative fallbacks when GPS coordinates are unavailable
 */
export default function CustomerMap() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view tab: 'providers' | 'bookings'
  const initialTab = searchParams.get('tab') || 'providers';
  const initialBookingId = searchParams.get('bookingId') || null;
  const initialCity = normalizeCity(searchParams.get('city') || user?.city || 'sangli') || 'sangli';

  const [activeTab, setActiveTab] = useState(initialBookingId ? 'bookings' : initialTab);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Providers state
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providersError, setProvidersError] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);

  // Bookings state
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isPinningBooking, setIsPinningBooking] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Focus coordinates on map
  const [focusCoords, setFocusCoords] = useState(null);

  // Sync city when user profile city changes
  useEffect(() => {
    if (user?.city && !searchParams.get('city')) {
      const canonical = normalizeCity(user.city);
      if (canonical) setSelectedCity(canonical);
    }
  }, [user?.city]);

  // Load Providers for Selected City
  useEffect(() => {
    let isSubscribed = true;
    const fetchProviders = async () => {
      setLoadingProviders(true);
      setProvidersError(null);
      try {
        const res = await providerApi.getProviders({
          city: selectedCity,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          q: searchQuery.trim() || undefined,
          limit: 30
        });
        if (isSubscribed && res.success && Array.isArray(res.providers)) {
          setProviders(res.providers);
          if (res.providers.length > 0 && !selectedProvider) {
            setSelectedProvider(res.providers[0]);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setProvidersError(err.message || 'Failed to load local providers.');
        }
      } finally {
        if (isSubscribed) setLoadingProviders(false);
      }
    };

    fetchProviders();
    return () => { isSubscribed = false; };
  }, [selectedCity, selectedCategory, searchQuery]);

  // Real-time synchronization of provider availability changes on map
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

  // Load Customer's Authorized Bookings
  useEffect(() => {
    let isSubscribed = true;
    const fetchBookings = async () => {
      setLoadingBookings(true);
      setBookingsError(null);
      try {
        const res = await bookingApi.getMyBookings();
        if (isSubscribed && res.success && Array.isArray(res.bookings)) {
          setBookings(res.bookings);
          if (initialBookingId) {
            const matched = res.bookings.find(b => b._id === initialBookingId || b.id === initialBookingId);
            if (matched) {
              setSelectedBooking(matched);
              if (matched.location?.latitude && matched.location?.longitude) {
                setFocusCoords([Number(matched.location.latitude), Number(matched.location.longitude)]);
              }
            }
          } else if (res.bookings.length > 0 && !selectedBooking) {
            setSelectedBooking(res.bookings[0]);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setBookingsError(err.message || 'Failed to load your booking appointments.');
        }
      } finally {
        if (isSubscribed) setLoadingBookings(false);
      }
    };

    fetchBookings();
    return () => { isSubscribed = false; };
  }, [initialBookingId]);

  // Handle Tab Switch
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFeedback(null);
    setIsPinningBooking(false);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  // Handle Provider Selection
  const handleSelectProvider = (prov) => {
    setSelectedProvider(prov);
    const loc = prov.location || prov.providerDetails?.location;
    if (loc?.latitude && loc?.longitude) {
      setFocusCoords([Number(loc.latitude), Number(loc.longitude)]);
    } else {
      setFocusCoords(null);
    }
  };

  // Handle Booking Selection
  const handleSelectBooking = (book) => {
    setSelectedBooking(book);
    setIsPinningBooking(false);
    if (book.location?.latitude && book.location?.longitude) {
      setFocusCoords([Number(book.location.latitude), Number(book.location.longitude)]);
    } else {
      setFocusCoords(null);
    }
  };

  // Handle Pin Placement for Booking
  const handlePinBookingLocation = async (coords) => {
    if (!selectedBooking) return;
    setSavingLocation(true);
    setFeedback(null);
    try {
      const res = await bookingApi.updateLocation(selectedBooking._id, coords);
      if (res.success && res.booking) {
        setBookings(prev => prev.map(b => b._id === res.booking._id ? res.booking : b));
        setSelectedBooking(res.booking);
        setFocusCoords([Number(coords.latitude), Number(coords.longitude)]);
        setFeedback({ type: 'success', text: 'Appointment service coordinates saved successfully.' });
        setIsPinningBooking(false);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save booking coordinates.' });
    } finally {
      setSavingLocation(false);
    }
  };

  const cityName = getCityDisplayName(selectedCity);

  return (
    <DashboardLayout
      title="Map & Location"
      subtitle={`Interactive service areas, local specialists, and appointment locations in ${cityName}`}
    >
      {/* 1. Header Toolbar */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Tab Selector */}
          <div style={{
            display: 'inline-flex',
            backgroundColor: 'var(--color-bg-page)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)'
          }}>
            <button
              type="button"
              onClick={() => handleTabChange('providers')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                backgroundColor: activeTab === 'providers' ? '#ffffff' : 'transparent',
                color: activeTab === 'providers' ? 'var(--primary-700)' : 'var(--color-text-muted)',
                boxShadow: activeTab === 'providers' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Wrench size={16} />
              <span>Service Specialists ({providers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('bookings')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                backgroundColor: activeTab === 'bookings' ? '#ffffff' : 'transparent',
                color: activeTab === 'bookings' ? '#4f46e5' : 'var(--color-text-muted)',
                boxShadow: activeTab === 'bookings' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Calendar size={16} />
              <span>My Booking Locations ({bookings.length})</span>
            </button>
          </div>

          {/* City Selection Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Operating City:
            </span>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setFocusCoords(null);
                const p = new URLSearchParams(searchParams);
                p.set('city', e.target.value);
                setSearchParams(p);
              }}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: '#ffffff',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: 'var(--color-text-title)',
                cursor: 'pointer'
              }}
            >
              {SUPPORTED_CITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`alert-box alert-${feedback.type === 'success' ? 'success' : 'error'}`}
            style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      {/* 2. Main Map & Sidebar Workspace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 380px) 1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Left Column: List & Details Panel */}
        <div>
          {activeTab === 'providers' ? (
            /* Providers View Panel */
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.25rem' }}>
                  Providers in {cityName}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Select a technician to inspect their service area on the map.
                </p>
              </div>

              {/* Category Filter */}
              <div style={{ marginBottom: '0.85rem' }}>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.82rem',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <option value="all">All Service Categories</option>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider List */}
              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {loadingProviders ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <RefreshCw size={22} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 0.5rem' }} />
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Loading specialists...</p>
                  </div>
                ) : providersError ? (
                  <div className="alert-box alert-error" style={{ fontSize: '0.82rem', padding: '0.75rem' }}>
                    {providersError}
                  </div>
                ) : providers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    No providers found in {cityName} for this category.
                  </div>
                ) : (
                  providers.map((prov) => {
                    const isSelected = selectedProvider?._id === prov._id || selectedProvider?.id === prov.id;
                    const loc = prov.location || prov.providerDetails?.location;
                    const hasCoords = loc?.latitude && loc?.longitude;

                    return (
                      <div
                        key={prov._id || prov.id}
                        onClick={() => handleSelectProvider(prov)}
                        style={{
                          padding: '0.85rem',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${isSelected ? 'var(--primary-600)' : 'var(--color-border)'}`,
                          backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-title)' }}>
                            {prov.name}
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: prov.isAvailable !== false ? '#15803d' : '#64748b',
                              backgroundColor: prov.isAvailable !== false ? '#dcfce7' : '#f1f5f9',
                              padding: '2px 5px',
                              borderRadius: '4px'
                            }}>
                              ● {prov.isAvailable !== false ? 'Available' : 'Offline'}
                            </span>
                            {hasCoords ? (
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: '#15803d',
                                backgroundColor: '#dcfce7',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                📍 GPS Set
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#64748b',
                                backgroundColor: '#f1f5f9',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                Area Coverage
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary-700)', fontWeight: 600, marginTop: '2px' }}>
                          {prov.title || prov.category}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          Territory: {prov.serviceArea || cityName}
                        </div>

                        {isSelected && (
                          <div style={{ marginTop: '0.65rem', display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
                            <Button to={`/provider/${prov.id || prov._id}`} variant="primary" size="sm" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                              View Profile
                            </Button>
                            {hasCoords && (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.75rem',
                                  color: '#334155',
                                  backgroundColor: '#f1f5f9',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  fontWeight: 600
                                }}
                              >
                                Directions <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Bookings View Panel */
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.25rem' }}>
                  My Scheduled Appointments
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  View delivery locations for your verified service bookings.
                </p>
              </div>

              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {loadingBookings ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <RefreshCw size={22} className="animate-spin" style={{ color: '#4f46e5', margin: '0 auto 0.5rem' }} />
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Loading bookings...</p>
                  </div>
                ) : bookingsError ? (
                  <div className="alert-box alert-error" style={{ fontSize: '0.82rem', padding: '0.75rem' }}>
                    {bookingsError}
                  </div>
                ) : bookings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    You have no active bookings scheduled.
                    <div style={{ marginTop: '0.75rem' }}>
                      <Button to="/services" variant="primary" size="sm">
                        Book a Service
                      </Button>
                    </div>
                  </div>
                ) : (
                  bookings.map((book) => {
                    const isSelected = selectedBooking?._id === book._id;
                    const hasCoords = book.location?.latitude && book.location?.longitude;

                    return (
                      <div
                        key={book._id}
                        onClick={() => handleSelectBooking(book)}
                        style={{
                          padding: '0.85rem',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${isSelected ? '#4f46e5' : 'var(--color-border)'}`,
                          backgroundColor: isSelected ? '#f5f3ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <strong style={{ fontSize: '0.92rem', color: 'var(--color-text-title)' }}>
                            {book.serviceName}
                          </strong>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: hasCoords ? '#4f46e5' : '#d97706',
                            backgroundColor: hasCoords ? '#e0e7ff' : '#fef3c7',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}>
                            {hasCoords ? '📍 Mapped' : 'No GPS Pin'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          📅 {book.bookingDate} at {book.bookingTime}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '2px' }}>
                          📍 {book.serviceAddress}
                        </div>
                        {book.provider?.name && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            Technician: <strong>{book.provider.name}</strong>
                          </div>
                        )}

                        {isSelected && (
                          <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {hasCoords ? (
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${book.location.latitude},${book.location.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.75rem',
                                  color: '#ffffff',
                                  backgroundColor: '#4f46e5',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  fontWeight: 600
                                }}
                              >
                                Directions <ExternalLink size={11} />
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsPinningBooking(true);
                                }}
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #4f46e5',
                                  backgroundColor: isPinningBooking ? '#4f46e5' : '#ffffff',
                                  color: isPinningBooking ? '#ffffff' : '#4f46e5',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {isPinningBooking ? 'Click Map to Set Pin' : 'Set GPS Pin on Map'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map */}
        <div>
          {/* Active selection banner */}
          {activeTab === 'providers' && selectedProvider && (
            <div style={{
              marginBottom: '0.75rem',
              padding: '0.65rem 1rem',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Inspecting Technician:
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
                  {selectedProvider.name} — {selectedProvider.title || selectedProvider.category}
                </div>
              </div>
              {selectedProvider.location?.latitude ? (
                <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
                  ✓ Exact business marker shown on map
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>
                  ⓘ Servicing general area ({selectedProvider.serviceArea || cityName})
                </span>
              )}
            </div>
          )}

          {activeTab === 'bookings' && selectedBooking && (
            <div style={{
              marginBottom: '0.75rem',
              padding: '0.65rem 1rem',
              backgroundColor: isPinningBooking ? '#ffedd5' : '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${isPinningBooking ? '#fdba74' : 'var(--color-border)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Inspecting Appointment:
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
                  {selectedBooking.serviceName} ({selectedBooking.bookingDate})
                </div>
              </div>
              {isPinningBooking ? (
                <span style={{ fontSize: '0.82rem', color: '#c2410c', fontWeight: 700 }}>
                  📍 Click anywhere on the map to save your doorstep location
                </span>
              ) : selectedBooking.location?.latitude ? (
                <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600 }}>
                  ✓ Doorstep pin active ({Number(selectedBooking.location.latitude).toFixed(4)}, {Number(selectedBooking.location.longitude).toFixed(4)})
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>
                  ⓘ Address only: {selectedBooking.serviceAddress}
                </span>
              )}
            </div>
          )}

          {/* Leaflet Map Component */}
          <ServiceMap
            providers={activeTab === 'providers' ? providers : []}
            bookings={activeTab === 'bookings' ? bookings : []}
            selectedCity={selectedCity}
            height="540px"
            interactive={true}
            editable={isPinningBooking}
            onLocationChange={isPinningBooking ? handlePinBookingLocation : null}
            focusLocation={focusCoords}
            emptyTitle={activeTab === 'bookings' ? 'No Mapped Appointments' : null}
            emptyMessage={activeTab === 'bookings' ? 'None of your active bookings have GPS pins yet. Select an appointment on the left and click "Set GPS Pin on Map" to drop a pin.' : null}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
