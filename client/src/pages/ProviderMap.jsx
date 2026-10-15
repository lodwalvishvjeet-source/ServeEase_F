import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MapPin,
  Save,
  Navigation,
  Calendar,
  Clock,
  User,
  Wrench,
  ExternalLink,
  Info,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import DashboardLayout from '../components/layout/DashboardLayout';
import ServiceMap from '../components/map/ServiceMap';
import Button from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { providerApi, bookingApi } from '../services/api';
import { getCityDisplayName, normalizeCity } from '../data/cities';

/**
 * Provider Map & Location Page (/provider/map)
 * 
 * Provides authenticated service professionals with:
 * 1. Business base / workshop location manager (click map to drop pin or edit coordinates)
 * 2. Backend coordinate validation & persistence (-90 to 90 lat, -180 to 180 lng)
 * 3. Interactive map of assigned client appointments
 * 4. Directions and address visualization for confirmed bookings
 * 5. Informative fallbacks when coordinates are not set
 */
export default function ProviderMap() {
  const { user, updateProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') || 'business';
  const initialBookingId = searchParams.get('bookingId') || null;

  const [activeTab, setActiveTab] = useState(initialBookingId ? 'jobs' : initialTab);

  // Business Location Form State
  const initialLoc = user?.providerDetails?.location || {};
  const [latitude, setLatitude] = useState(initialLoc.latitude !== undefined && initialLoc.latitude !== null ? String(initialLoc.latitude) : '');
  const [longitude, setLongitude] = useState(initialLoc.longitude !== undefined && initialLoc.longitude !== null ? String(initialLoc.longitude) : '');
  const [address, setAddress] = useState(initialLoc.address || user?.providerDetails?.serviceArea || '');
  const [savingLocation, setSavingLocation] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Assigned Bookings State
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingsError, setBookingsError] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isPinningBooking, setIsPinningBooking] = useState(false);
  const [focusCoords, setFocusCoords] = useState(null);

  // Sync profile details if user updates
  useEffect(() => {
    if (user?.providerDetails?.location) {
      const loc = user.providerDetails.location;
      if (loc.latitude !== null && loc.latitude !== undefined) setLatitude(String(loc.latitude));
      if (loc.longitude !== null && loc.longitude !== undefined) setLongitude(String(loc.longitude));
      if (loc.address) setAddress(loc.address);
    }
  }, [user?.providerDetails?.location]);

  // Load Assigned Bookings for this Provider
  useEffect(() => {
    let isSubscribed = true;
    const fetchBookings = async () => {
      setLoadingBookings(true);
      setBookingsError(null);
      try {
        const res = await bookingApi.getProviderBookings();
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
          setBookingsError(err.message || 'Failed to load assigned bookings.');
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
    const p = new URLSearchParams(searchParams);
    p.set('tab', tab);
    setSearchParams(p);
  };

  // Map Click or Pin Drag in Business Location tab
  const handleMapPinDrop = ({ latitude: newLat, longitude: newLng }) => {
    setLatitude(String(newLat));
    setLongitude(String(newLng));
    setFeedback({
      type: 'info',
      text: `Pin placed at ${newLat}, ${newLng}. Click "Save Location" to publish.`
    });
  };

  // Save Business Location via Backend API
  const handleSaveLocation = async (e) => {
    if (e) e.preventDefault();
    setSavingLocation(true);
    setFeedback(null);

    let numLat = null;
    let numLng = null;

    if (latitude.trim() !== '') {
      numLat = Number(latitude);
      if (isNaN(numLat) || numLat < -90 || numLat > 90) {
        setSavingLocation(false);
        setFeedback({ type: 'error', text: 'Latitude must be a valid number between -90 and 90.' });
        return;
      }
    }

    if (longitude.trim() !== '') {
      numLng = Number(longitude);
      if (isNaN(numLng) || numLng < -180 || numLng > 180) {
        setSavingLocation(false);
        setFeedback({ type: 'error', text: 'Longitude must be a valid number between -180 and 180.' });
        return;
      }
    }

    if ((numLat !== null && numLng === null) || (numLat === null && numLng !== null)) {
      setSavingLocation(false);
      setFeedback({ type: 'error', text: 'Please specify both latitude and longitude, or clear both to remove coordinates.' });
      return;
    }

    try {
      const payload = {
        providerDetails: {
          location: {
            latitude: numLat,
            longitude: numLng,
            address: address.trim()
          }
        }
      };

      const res = await providerApi.updateProfile(payload);
      if (res.success) {
        await updateProfile(payload);
        setFeedback({
          type: 'success',
          text: numLat !== null
            ? 'Business location saved successfully! Customers can now view your base on the service map.'
            : 'Coordinates removed. Your profile will use general municipal area coverage.'
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update location on server.' });
    } finally {
      setSavingLocation(false);
    }
  };

  // Clear Location Coordinates
  const handleClearLocation = async () => {
    setLatitude('');
    setLongitude('');
    setSavingLocation(true);
    try {
      const payload = {
        providerDetails: {
          location: {
            latitude: null,
            longitude: null,
            address: address.trim()
          }
        }
      };
      await providerApi.updateProfile(payload);
      await updateProfile(payload);
      setFeedback({ type: 'success', text: 'Coordinates cleared. You are listed with area-based coverage.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to clear coordinates.' });
    } finally {
      setSavingLocation(false);
    }
  };

  // Handle Pin Drop for Assigned Booking
  const handlePinBookingLocation = async (coords) => {
    if (!selectedBooking) return;
    try {
      const res = await bookingApi.updateLocation(selectedBooking._id, coords);
      if (res.success && res.booking) {
        setBookings(prev => prev.map(b => b._id === res.booking._id ? res.booking : b));
        setSelectedBooking(res.booking);
        setFocusCoords([Number(coords.latitude), Number(coords.longitude)]);
        setFeedback({ type: 'success', text: 'Job doorstep pin saved successfully.' });
        setIsPinningBooking(false);
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save job coordinates.' });
    }
  };

  const currentCity = normalizeCity(user?.city || 'sangli') || 'sangli';
  const cityName = getCityDisplayName(currentCity);
  const hasPublishedCoords = latitude && longitude;

  return (
    <DashboardLayout
      title="Map & Location"
      subtitle={`Manage your business workshop coordinates and navigate assigned customer jobs in ${cityName}`}
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
              onClick={() => handleTabChange('business')}
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
                backgroundColor: activeTab === 'business' ? '#ffffff' : 'transparent',
                color: activeTab === 'business' ? '#ea580c' : 'var(--color-text-muted)',
                boxShadow: activeTab === 'business' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <MapPin size={16} />
              <span>My Business Location</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('jobs')}
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
                backgroundColor: activeTab === 'jobs' ? '#ffffff' : 'transparent',
                color: activeTab === 'jobs' ? '#4f46e5' : 'var(--color-text-muted)',
                boxShadow: activeTab === 'jobs' ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Calendar size={16} />
              <span>Assigned Job Locations ({bookings.length})</span>
            </button>
          </div>

          {/* Location Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {hasPublishedCoords ? (
              <span style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#15803d',
                backgroundColor: '#dcfce7',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: '1px solid #bbf7d0'
              }}>
                ● GPS Coordinates Live
              </span>
            ) : (
              <span style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#d97706',
                backgroundColor: '#fef3c7',
                padding: '4px 10px',
                borderRadius: '9999px',
                border: '1px solid #fde68a'
              }}>
                ○ Area Coverage Only (No GPS Pin)
              </span>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`alert-box alert-${feedback.type === 'success' ? 'success' : feedback.type === 'error' ? 'error' : 'info'}`}
            style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>

      {/* 2. Main Workspace */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 400px) 1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* Left Column */}
        <div>
          {activeTab === 'business' ? (
            /* Business Location Management Form */
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-title)', marginBottom: '0.25rem' }}>
                  Manage Workshop / Base Location
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                  Pin your shop, office, or dispatch center on the map. Customers in {cityName} will see your marker when browsing nearby specialists.
                </p>
              </div>

              <form onSubmit={handleSaveLocation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-title)', marginBottom: '0.35rem' }}>
                    Business / Dispatch Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Shop 12, Station Road, Vishrambag"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-title)', marginBottom: '0.35rem' }}>
                      Latitude (-90 to 90)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="e.g. 16.8524"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-title)', marginBottom: '0.35rem' }}>
                      Longitude (-180 to 180)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="e.g. 74.5815"
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#fff7ed',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid #ffedd5',
                  fontSize: '0.78rem',
                  color: '#9a3412',
                  lineHeight: 1.4
                }}>
                  💡 <strong>Tip:</strong> You can click anywhere on the map on the right to position your pin automatically, or drag the orange pin.
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={savingLocation}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.65rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    {savingLocation ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                    <span>Save Location</span>
                  </button>

                  {hasPublishedCoords && (
                    <button
                      type="button"
                      onClick={handleClearLocation}
                      disabled={savingLocation}
                      title="Clear coordinates"
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : (
            /* Assigned Bookings List */
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.25rem' }}>
                  Assigned Job Deliveries
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  Inspect customer locations for confirmed appointments.
                </p>
              </div>

              <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {loadingBookings ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                    <RefreshCw size={22} className="animate-spin" style={{ color: '#4f46e5', margin: '0 auto 0.5rem' }} />
                    <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Loading assigned jobs...</p>
                  </div>
                ) : bookingsError ? (
                  <div className="alert-box alert-error" style={{ fontSize: '0.82rem', padding: '0.75rem' }}>
                    {bookingsError}
                  </div>
                ) : bookings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    No service bookings currently assigned.
                  </div>
                ) : (
                  bookings.map((book) => {
                    const isSelected = selectedBooking?._id === book._id;
                    const hasCoords = book.location?.latitude && book.location?.longitude;

                    return (
                      <div
                        key={book._id}
                        onClick={() => {
                          setSelectedBooking(book);
                          setIsPinningBooking(false);
                          if (hasCoords) {
                            setFocusCoords([Number(book.location.latitude), Number(book.location.longitude)]);
                          }
                        }}
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
                            {hasCoords ? '📍 Mapped' : 'Address Only'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                          📅 {book.bookingDate} at {book.bookingTime}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '2px' }}>
                          📍 {book.serviceAddress}
                        </div>
                        {book.customer?.name && (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            Customer: <strong>{book.customer.name}</strong> {book.customer.phoneNumber ? `(${book.customer.phoneNumber})` : ''}
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
                                Navigate with Google Maps <ExternalLink size={11} />
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
                                {isPinningBooking ? 'Click Map to Set Job Pin' : 'Set GPS Pin on Map'}
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

        {/* Right Column: Leaflet Map */}
        <div>
          {/* Active Banner */}
          {activeTab === 'business' ? (
            <div style={{
              marginBottom: '0.75rem',
              padding: '0.65rem 1rem',
              backgroundColor: '#fff7ed',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #ffedd5',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#c2410c', textTransform: 'uppercase', fontWeight: 700 }}>
                  📍 Interactive Workshop Placement
                </span>
                <div style={{ fontSize: '0.88rem', color: '#9a3412', marginTop: '2px' }}>
                  Click anywhere on the map or drag the orange marker to position your business.
                </div>
              </div>
              {hasPublishedCoords && (
                <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>
                  Active Pin: {Number(latitude).toFixed(4)}, {Number(longitude).toFixed(4)}
                </span>
              )}
            </div>
          ) : selectedBooking && (
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
                  Job Appointment:
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-title)' }}>
                  {selectedBooking.serviceName} for {selectedBooking.customer?.name || 'Customer'}
                </div>
              </div>
              {isPinningBooking ? (
                <span style={{ fontSize: '0.82rem', color: '#c2410c', fontWeight: 700 }}>
                  📍 Click map to set client delivery pin
                </span>
              ) : selectedBooking.location?.latitude ? (
                <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600 }}>
                  ✓ Delivery coordinates active
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>
                  ⓘ Address: {selectedBooking.serviceAddress}
                </span>
              )}
            </div>
          )}

          <ServiceMap
            selectedCity={currentCity}
            height="540px"
            interactive={true}
            editable={activeTab === 'business' || isPinningBooking}
            currentLocation={
              activeTab === 'business' && latitude && longitude
                ? { latitude: Number(latitude), longitude: Number(longitude), address }
                : null
            }
            bookings={activeTab === 'jobs' ? bookings : []}
            onLocationChange={
              activeTab === 'business'
                ? handleMapPinDrop
                : isPinningBooking
                  ? handlePinBookingLocation
                  : null
            }
            focusLocation={focusCoords}
            emptyTitle={activeTab === 'jobs' ? 'No Assigned Job Pins' : 'Place Your Workshop Pin'}
            emptyMessage={activeTab === 'jobs' ? 'Select an appointment from the left to drop or view a doorstep GPS pin.' : 'Click anywhere on the map or tap "Use GPS Location" to establish your base point.'}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
