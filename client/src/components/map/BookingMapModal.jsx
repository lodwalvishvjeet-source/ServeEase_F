import React, { useState, useEffect } from 'react';
import {
  MapPin,
  X,
  Navigation,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Calendar,
  User,
  Phone,
  Loader2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import ServiceMap from './ServiceMap';
import Button from '../common/Button';
import { bookingApi } from '../../services/api';
import { getCityDisplayName } from '../../data/cities';

/**
 * BookingMapModal Component
 * 
 * Secure, booking-scoped interactive map modal.
 * Strictly adheres to ServeEase location sharing policies:
 * 1. Only displays authorized locations fetched securely from GET /api/bookings/:id/location.
 * 2. Immediately handles server revocation (409) if booking is completed or cancelled.
 * 3. Shows customer delivery destination to assigned provider.
 * 4. Shows provider workshop/base location to customer with clear labeling (no fake live tracking).
 * 5. Provides clear fallback message when coordinates are not provided.
 */
export default function BookingMapModal({
  booking,
  role = 'customer',
  onClose
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revoked, setRevoked] = useState(false);
  const [locationData, setLocationData] = useState(null);

  const bookingId = booking?._id || booking?.id;

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch authorized booking location from server
  useEffect(() => {
    let isMounted = true;
    if (!bookingId) {
      setError('Invalid booking identifier.');
      setLoading(false);
      return;
    }

    const fetchLocation = async () => {
      setLoading(true);
      setError(null);
      setRevoked(false);

      try {
        const res = await bookingApi.getBookingLocation(bookingId);
        if (!isMounted) return;
        if (res?.success) {
          setLocationData(res);
        } else {
          setError(res?.error || 'Failed to retrieve location details.');
        }
      } catch (err) {
        if (!isMounted) return;
        const errMsg = err?.data?.error || err?.message || 'Unable to access booking location.';
        const isRevokedStatus = err?.data?.revoked || err?.status === 409 || err?.data?.status === 'completed';
        if (isRevokedStatus) {
          setRevoked(true);
        }
        setError(errMsg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLocation();
    return () => {
      isMounted = false;
    };
  }, [bookingId]);

  if (!booking) return null;

  const cityName = getCityDisplayName(locationData?.city || booking?.city || 'sangli');
  const customerLoc = locationData?.customerLocation;
  const providerLoc = locationData?.providerLocation;

  const hasCustomerCoords = customerLoc?.latitude !== null &&
    customerLoc?.latitude !== undefined &&
    customerLoc?.longitude !== null &&
    customerLoc?.longitude !== undefined;

  const hasProviderCoords = providerLoc?.latitude !== null &&
    providerLoc?.latitude !== undefined &&
    providerLoc?.longitude !== null &&
    providerLoc?.longitude !== undefined;

  // Build booking marker payload for ServiceMap
  const bookingMarkers = hasCustomerCoords
    ? [
        {
          _id: String(bookingId),
          serviceName: locationData?.serviceName || booking?.serviceName || 'Service Appointment',
          status: locationData?.status || booking?.status || 'accepted',
          serviceAddress: customerLoc?.address || booking?.serviceAddress || 'Client Location',
          location: {
            latitude: customerLoc.latitude,
            longitude: customerLoc.longitude
          }
        }
      ]
    : [];

  // Build provider marker payload for ServiceMap
  const providerMarkers = (hasProviderCoords && role === 'customer')
    ? [
        {
          _id: 'provider-assigned',
          name: providerLoc.providerName || 'Technician',
          title: providerLoc.title || 'Service Specialist',
          isAvailable: true,
          providerDetails: {
            isAvailable: true,
            title: providerLoc.title || 'Service Specialist',
            location: {
              latitude: providerLoc.latitude,
              longitude: providerLoc.longitude,
              address: providerLoc.address
            }
          }
        }
      ]
    : [];

  // Determine focus location
  const focusCoords = hasCustomerCoords
    ? [Number(customerLoc.latitude), Number(customerLoc.longitude)]
    : hasProviderCoords
    ? [Number(providerLoc.latitude), Number(providerLoc.longitude)]
    : null;

  // Destination coordinates for directions link
  const targetLat = role === 'provider' ? customerLoc?.latitude : (providerLoc?.latitude || customerLoc?.latitude);
  const targetLng = role === 'provider' ? customerLoc?.longitude : (providerLoc?.longitude || customerLoc?.longitude);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Location details for ${booking.serviceName || 'appointment'}`}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.68)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.18s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '840px',
          maxHeight: '92vh',
          padding: 0,
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          border: '1px solid var(--color-border)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-100)',
                color: 'var(--color-primary-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <MapPin size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-text-title)', fontWeight: 700 }}>
                  {role === 'provider' ? 'Customer Service Location' : 'Service Appointment Location'}
                </h3>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    backgroundColor: revoked ? '#fef2f2' : '#f0fdf4',
                    color: revoked ? '#b91c1c' : '#15803d',
                    border: `1px solid ${revoked ? '#fecaca' : '#bbf7d0'}`
                  }}
                >
                  {revoked ? 'Access Revoked' : (booking.status === 'in_progress' ? 'In Progress' : 'Confirmed Booking')}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                {booking.serviceName || 'Service Appointment'} • {cityName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close location modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* 1. Loading State */}
          {loading && (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary-600)' }} />
              <div style={{ fontWeight: 600, color: 'var(--color-text-title)', fontSize: '0.95rem' }}>
                Verifying authorized location access...
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Enforcing strict ServeEase booking privacy and security protocols
              </p>
            </div>
          )}

          {/* 2. Access Revoked State (Post-completion or cancellation) */}
          {!loading && revoked && (
            <div
              style={{
                backgroundColor: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#be123c' }}>
                <ShieldAlert size={22} />
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                  Location Access Revoked — Appointment Concluded
                </h4>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#881337', lineHeight: 1.5 }}>
                In strict accordance with ServeEase privacy policies, precise GPS map tracking is immediately revoked once a service is completed, cancelled, or rejected.
              </p>
              <div
                style={{
                  marginTop: '0.5rem',
                  backgroundColor: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  border: '1px solid #ffe4e6',
                  fontSize: '0.85rem',
                  color: 'var(--color-text-body)'
                }}
              >
                <div style={{ fontWeight: 600, color: '#9f1239', marginBottom: '0.25rem' }}>
                  Recorded Service Delivery Address:
                </div>
                <div>📍 {booking.serviceAddress || 'Address on booking record'}</div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                  (Retained in your booking receipt history for billing and warranty records)
                </div>
              </div>
            </div>
          )}

          {/* 3. Non-revoked Error State */}
          {!loading && !revoked && error && (
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                color: '#92400e'
              }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.25rem' }}>
                  Location Not Available
                </div>
                <div style={{ fontSize: '0.85rem' }}>{error}</div>
              </div>
            </div>
          )}

          {/* 4. Active Location Sharing View */}
          {!loading && !revoked && locationData && (
            <>
              {/* Address Details Card */}
              <div
                style={{
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                {/* Role-specific details */}
                {role === 'provider' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Customer Destination
                        </span>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-title)', marginTop: '2px' }}>
                          📍 {customerLoc?.address}
                        </div>
                      </div>
                      {customerLoc?.customerName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <User size={14} /> {customerLoc.customerName}
                          </span>
                          {customerLoc.customerPhone && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Phone size={14} /> {customerLoc.customerPhone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary-700)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Your Delivery Address
                        </span>
                        <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text-title)', marginTop: '2px' }}>
                          📍 {customerLoc?.address}
                        </div>
                      </div>

                      {providerLoc && (
                        <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Assigned Specialist
                          </span>
                          <div style={{ fontWeight: 700, color: 'var(--color-text-title)' }}>
                            {providerLoc.providerName}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                            Base Location: {providerLoc.address || cityName}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Privacy & Real-time disclosure */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.76rem',
                    color: 'var(--color-text-muted)',
                    borderTop: '1px solid var(--color-border)',
                    paddingTop: '0.5rem'
                  }}
                >
                  <ShieldCheck size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span>
                    Location access is active during this scheduled appointment and will automatically revoke when marked completed.
                  </span>
                </div>
              </div>

              {/* Coordinates Fallback Warning if coords missing */}
              {!hasCustomerCoords && (
                <div
                  style={{
                    backgroundColor: '#fefce8',
                    border: '1px solid #fef08a',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    fontSize: '0.85rem',
                    color: '#854d0e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={16} />
                    <span>Exact GPS coordinates were not provided with this address. Map is centered on {cityName}.</span>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${customerLoc?.address || ''}, ${cityName}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-xs"
                    style={{ fontSize: '0.78rem', color: '#854d0e', borderColor: '#fde047' }}
                  >
                    <ExternalLink size={12} /> Search Address in Google Maps ↗
                  </a>
                </div>
              )}

              {/* Leaflet Map Display */}
              <div
                style={{
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
              >
                <ServiceMap
                  selectedCity={locationData?.city || booking?.city || 'sangli'}
                  bookings={bookingMarkers}
                  providers={providerMarkers}
                  focusLocation={focusCoords}
                  height="360px"
                  interactive={true}
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Booking ID: <code style={{ fontSize: '0.78rem' }}>{bookingId}</code>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!loading && !revoked && targetLat && targetLng && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Navigation size={14} /> Open Navigation Directions ↗
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline btn-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
