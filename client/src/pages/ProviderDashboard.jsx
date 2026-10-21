import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Power, 
  Briefcase, 
  MapPin, 
  Wrench, 
  AlertCircle, 
  Plus,
  Inbox,
  Settings,
  RefreshCw,
  Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import DashboardLayout from '../components/layout/DashboardLayout';
import { getCityDisplayName } from '../data/cities';
import { providerApi, reviewApi } from '../services/api';
import { connectSocket } from '../services/socket';

/**
 * Service Provider Business Management Dashboard (/provider/dashboard)
 * 
 * Central business control center for service professionals:
 * - Real-time working availability toggle persisted to MongoDB Atlas
 * - Provider profile completion score meter
 * - Primary city, locality, and rate structures
 * - My Services catalog summary with real service counts
 * - Pending booking requests and confirmed jobs schedule
 * - Quick business management actions
 */
export default function ProviderDashboard() {
  const { user, loading, updateProfile } = useAuth();
  const [isAvailable, setIsAvailable] = useState(user?.providerDetails?.isAvailable !== false);
  const [isTogglingAvail, setIsTogglingAvail] = useState(false);
  const [availFeedback, setAvailFeedback] = useState(null);

  // Provider Reviews & Ratings State
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewStats, setReviewStats] = useState({ averageRating: null, reviewCount: 0 });

  // Keep local availability state synchronized if user profile updates
  useEffect(() => {
    if (user?.providerDetails?.isAvailable !== undefined) {
      setIsAvailable(user.providerDetails.isAvailable !== false);
    }
  }, [user?.providerDetails?.isAvailable]);

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    const socket = connectSocket();
    const handleAvailabilityChanged = (payload) => {
      const currentId = (user?._id || user?.id)?.toString();
      if (payload?.providerId && payload.providerId === currentId) {
        setIsAvailable(payload.isAvailable !== false);
      }
    };

    socket.on('provider_availability_changed', handleAvailabilityChanged);
    return () => {
      socket.off('provider_availability_changed', handleAvailabilityChanged);
    };
  }, [user?._id, user?.id]);

  // Load verified customer reviews
  useEffect(() => {
    if (user?._id) {
      setReviewsLoading(true);
      reviewApi.getProviderReviews(user._id)
        .then(data => {
          if (data.success) {
            setReviews(data.reviews || []);
            setReviewStats({
              averageRating: data.averageRating ?? null,
              reviewCount: data.reviewCount ?? (data.reviews?.length || 0)
            });
          }
        })
        .catch(err => {
          console.warn('Could not load provider dashboard reviews:', err.message);
        })
        .finally(() => {
          setReviewsLoading(false);
        });
    }
  }, [user?._id]);

  // Toggle provider availability and persist to backend
  const handleToggleAvailability = async () => {
    if (isTogglingAvail) return;
    const nextState = !isAvailable;
    setIsTogglingAvail(true);
    setAvailFeedback(null);

    try {
      // Persist to MongoDB through authenticated user profile endpoint
      // and update central AuthContext state
      const updatedUser = await updateProfile({
        providerDetails: {
          isAvailable: nextState
        }
      });
      const confirmedState = updatedUser?.providerDetails?.isAvailable !== false;
      setIsAvailable(confirmedState);
      setAvailFeedback({
        type: 'success',
        message: confirmedState ? 'Status set to Taking Jobs (Online)' : 'Status set to Currently Offline (Busy)'
      });
      setTimeout(() => setAvailFeedback(null), 3500);
    } catch (err) {
      console.warn('Could not persist availability toggle:', err.message);
      // Revert to canonical state on error
      setIsAvailable(user?.providerDetails?.isAvailable !== false);
      setAvailFeedback({
        type: 'error',
        message: err.message || 'Failed to update availability on server.'
      });
    } finally {
      setIsTogglingAvail(false);
    }
  };

  // Provider profile data extraction
  const providerDetails = user?.providerDetails || {};
  const category = providerDetails.category || 'Service Professional';
  const city = user?.cityName || (user?.city ? getCityDisplayName(user.city) : 'Sangli') || 'Sangli';
  const serviceArea = providerDetails.serviceArea || 'Local City Area';
  const startingPrice = Number(providerDetails.startingPrice) || 0;
  const hourlyRate = Number(providerDetails.hourlyRate) || 0;
  const experienceYears = Number(providerDetails.experienceYears) || 0;

  // Services offered array
  let services = [];
  if (Array.isArray(providerDetails.servicesOffered)) {
    services = providerDetails.servicesOffered;
  } else if (typeof providerDetails.servicesOffered === 'string' && providerDetails.servicesOffered.trim()) {
    services = providerDetails.servicesOffered.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Calculate profile completion score based on real fields
  let score = 20; // Base account registered
  if (user?.phoneNumber && String(user.phoneNumber).trim().length > 5) score += 20;
  if (providerDetails.serviceArea && String(providerDetails.serviceArea).trim().length > 2) score += 20;
  if (services.length > 0) score += 20;
  if (startingPrice > 0 || hourlyRate > 0) score += 20;

  if (loading && !user) {
    return (
      <DashboardLayout
        title="Provider Workspace"
        subtitle="Loading workspace..."
      >
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 0.75rem' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Loading provider profile...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Provider Workspace"
      subtitle={`Manage your service business in ${city}`}
    >
      {/* 1. Top Business Status Bar */}
      <div className="card" id="availability" style={{
        padding: '1.75rem',
        marginBottom: '2rem',
        backgroundColor: 'var(--color-bg-card)',
        borderLeft: `4px solid ${isAvailable ? 'var(--primary-600)' : 'var(--color-text-muted)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <span className="badge badge-primary">Business Profile</span>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isAvailable ? 'var(--color-success)' : 'var(--color-text-muted)',
              backgroundColor: isAvailable ? 'var(--color-success-bg)' : 'var(--color-bg-subtle)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
              border: `1px solid var(--color-border)`
            }}>
              ● {isAvailable ? 'Taking Jobs' : 'Offline / Busy'}
            </span>
            {availFeedback && (
              <span style={{
                fontSize: '0.82rem',
                color: availFeedback.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
                backgroundColor: availFeedback.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
                border: '1px solid var(--color-border)',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                {availFeedback.type === 'error' ? <AlertCircle size={14} /> : null}
                <span>{availFeedback.message}</span>
              </span>
            )}
          </div>

          <h1 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 1.85rem)', color: 'var(--color-text-title)', marginBottom: '0.25rem', fontWeight: 800 }}>
            {user?.name || 'Technician'} — {category}
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-base, 0.9375rem)' }}>
            Serving <strong>{serviceArea}</strong>, {city} • {experienceYears} years experience
          </p>
        </div>

        {/* Availability Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={handleToggleAvailability}
            disabled={isTogglingAvail}
            id="provider-avail-toggle-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: isTogglingAvail ? 'var(--color-text-muted)' : (isAvailable ? 'var(--primary-600)' : 'var(--color-text-muted)'),
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.92rem',
              cursor: isTogglingAvail ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.2s ease',
              opacity: isTogglingAvail ? 0.8 : 1
            }}
          >
            {isTogglingAvail ? (
              <>
                <RefreshCw size={17} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Power size={17} />
                <span>{isAvailable ? 'Taking Jobs (Online)' : 'Offline (Busy)'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Key Metrics & Progress */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {/* Profile Completion Meter */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)' }}>
                Profile Completion
              </h3>
              <span style={{ fontWeight: 700, color: score >= 80 ? 'var(--primary-600)' : 'var(--color-accent-gold)', fontSize: '1.1rem' }}>
                {score}%
              </span>
            </div>

            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--color-bg-subtle)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
              marginBottom: '1rem'
            }}>
              <div style={{
                width: `${score}%`,
                height: '100%',
                backgroundColor: score >= 80 ? 'var(--primary-600)' : 'var(--color-accent-gold)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.4s ease'
              }} />
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              {score < 100
                ? 'Complete your service catalog and pricing to increase customer inquiries.'
                : 'Your business profile is fully configured and ready for customer discovery!'}
            </p>
          </div>

          <Button to="/provider/profile" variant="outline" size="sm" block>
            Edit Business Profile
          </Button>
        </div>

        {/* Customer Rating & Reputation */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Star size={20} style={{ color: 'var(--color-accent-gold)' }} />
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)' }}>
                Rating & Reputation
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.35rem' }}>
              {reviewStats.averageRating != null && reviewStats.reviewCount > 0 ? (
                <>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-accent-gold)', fontFamily: 'var(--font-family-heading)' }}>
                    {Number(reviewStats.averageRating).toFixed(1)}
                  </span>
                  <span style={{ display: 'flex', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        fill={s <= Math.round(reviewStats.averageRating) ? 'var(--color-accent-gold)' : 'var(--color-border)'}
                        stroke={s <= Math.round(reviewStats.averageRating) ? 'var(--color-accent-gold)' : 'var(--color-border)'}
                      />
                    ))}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  No reviews yet
                </span>
              )}
            </div>

            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.84rem', lineHeight: 1.5, marginBottom: '1rem' }}>
              {reviewStats.reviewCount > 0
                ? `Calculated from ${reviewStats.reviewCount} verified completed job${reviewStats.reviewCount > 1 ? 's' : ''}.`
                : 'Ratings are calculated exclusively from verified completed bookings.'}
            </p>
          </div>

          <a
            href="#customer-reviews-section"
            className="btn btn-outline btn-sm"
            style={{ width: '100%', textAlign: 'center', display: 'block', textDecoration: 'none' }}
          >
            View Feedbacks ({reviewStats.reviewCount})
          </a>
        </div>

        {/* Territory & City Coverage */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <MapPin size={20} style={{ color: 'var(--primary-600)' }} />
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)' }}>
                Service Territory
              </h3>
            </div>

            <div style={{ marginBottom: '0.65rem' }}>
              <span style={{ fontSize: 'var(--font-size-2xs, 0.74rem)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Primary City</span>
              <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-title)' }}>{city}</p>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: 'var(--font-size-2xs, 0.74rem)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Localities Covered</span>
              <p style={{ fontSize: 'var(--font-size-base, 0.925rem)', color: 'var(--color-text-body)' }}>{serviceArea}</p>
            </div>
          </div>

          <Button to="/provider/profile" variant="outline" size="sm" block>
            Update Territory
          </Button>
        </div>

        {/* Consultation Pricing Structure */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Briefcase size={20} style={{ color: 'var(--primary-600)' }} />
              <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)' }}>
                Pricing Rates
              </h3>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>Doorstep Consultation:</span>
              <strong style={{ color: 'var(--color-text-title)' }}>{startingPrice > 0 ? `₹${startingPrice}` : 'On Inspection'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>Labor Rate / Hour:</span>
              <strong style={{ color: 'var(--color-text-title)' }}>{hourlyRate > 0 ? `₹${hourlyRate}/hr` : 'Standard'}</strong>
            </div>
          </div>

          <Button to="/provider/profile" variant="outline" size="sm" block>
            Update Rates
          </Button>
        </div>
      </div>

      {/* 3. My Services Summary Section */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)' }}>
              My Services Catalog ({services.length} active services)
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
              Specific repair tasks and installations you offer in {city}.
            </p>
          </div>

          <Button to="/provider/services" variant="primary" size="sm" id="provider-manage-services-btn">
            <Plus size={15} /> Manage Offerings
          </Button>
        </div>

        {services.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            {services.map((svc, idx) => (
              <span
                key={idx}
                style={{
                  backgroundColor: 'var(--primary-50)',
                  color: 'var(--primary-800)',
                  border: '1px solid var(--primary-100)',
                  padding: '0.45rem 0.9rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Wrench size={14} style={{ color: 'var(--primary-600)' }} />
                {svc}
              </span>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--color-bg-page)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              You have not added any specific services yet.
            </p>
            <Button to="/provider/services" variant="primary" size="sm">
              Add Your First Service
            </Button>
          </div>
        )}
      </div>

      {/* 4. Requests & Bookings Overview */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)' }}>
            Booking Inquiries & Job Schedule
          </h2>
          <span className="badge badge-primary">Schedule Overview</span>
        </div>

        <div style={{
          padding: '1.25rem',
          backgroundColor: 'var(--color-bg-page)',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--color-border)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem'
        }}>
          <AlertCircle size={22} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', color: 'var(--color-text-title)', fontSize: '0.95rem', marginBottom: '0.2rem' }}>
              Direct Dispatch Integration
            </strong>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
              Live customer job requests will be delivered to your workbench as bookings are received. Your provider profile and working status are live and discoverable in <strong>{city}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
              <Button to="/provider/requests" variant="outline" size="sm">
                View Requests Workbench
              </Button>
              <Button to="/provider/bookings" variant="outline" size="sm">
                Check Job Schedule
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Verified Customer Reviews Section */}
      <div className="card" id="customer-reviews-section" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span className="badge badge-primary">Customer Feedbacks</span>
              {reviewStats.averageRating != null && (
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Star size={14} fill="#d97706" stroke="#d97706" /> {Number(reviewStats.averageRating).toFixed(1)} Average
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', margin: 0 }}>
              Verified Service Reviews ({reviewStats.reviewCount})
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>
              Authentic reviews submitted by verified clients upon completion of booked service visits.
            </p>
          </div>
        </div>

        {reviewsLoading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 0.5rem' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0 }}>Loading client reviews...</p>
          </div>
        ) : reviews.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviews.map((rev) => (
              <div
                key={rev._id || rev.id}
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ color: 'var(--color-text-title)', fontSize: '0.95rem' }}>
                      {rev.customer?.name || 'Verified Client'}
                    </strong>
                    {rev.serviceName && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-info-blue)', backgroundColor: 'var(--color-info-blue-bg)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 500 }}>
                        {rev.serviceName}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        fill={s <= rev.rating ? '#d97706' : '#e2e8f0'}
                        stroke={s <= rev.rating ? '#d97706' : '#cbd5e1'}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#d97706' }}>
                    {rev.rating}.0
                  </span>
                </div>

                {rev.comment ? (
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-body)', margin: 0, lineHeight: 1.5 }}>
                    "{rev.comment}"
                  </p>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic', margin: 0 }}>
                    Client submitted star rating without additional comments.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '2.5rem 1rem',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed #cbd5e1'
          }}>
            <Star size={36} style={{ color: '#cbd5e1', margin: '0 auto 0.75rem', strokeWidth: 1.5 }} />
            <h4 style={{ margin: '0 0 0.35rem', color: 'var(--color-text-title)', fontSize: '1.05rem' }}>
              No Customer Reviews Yet
            </h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: 0, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
              Honest ratings and reviews are populated exclusively when customers complete booked service appointments with you.
            </p>
          </div>
        )}
      </div>

      {/* 5. Quick Business Actions Grid */}
      <div className="grid-3" style={{ gap: '1.5rem' }}>
        <Link to="/provider/services" className="card card-hoverable" style={{
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          textDecoration: 'none',
          color: 'inherit'
        }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary-100)',
            color: 'var(--primary-700)'
          }}>
            <Wrench size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
              Manage My Services
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
              Add or remove service offerings
            </p>
          </div>
        </Link>

        <Link to="/provider/requests" className="card card-hoverable" style={{
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          textDecoration: 'none',
          color: 'inherit'
        }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-info-blue-bg)',
            color: 'var(--color-info-blue)'
          }}>
            <Inbox size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
              Booking Requests
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
              Review customer service inquiries
            </p>
          </div>
        </Link>

        <Link to="/provider/profile" className="card card-hoverable" style={{
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          textDecoration: 'none',
          color: 'inherit'
        }}>
          <div style={{
            padding: '0.85rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-accent-gold-bg)',
            color: 'var(--color-accent-gold)'
          }}>
            <Settings size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-title)', marginBottom: '0.2rem' }}>
              Edit Business Profile
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
              Update rates, phone, and territory
            </p>
          </div>
        </Link>
      </div>
    </DashboardLayout>
  );
}
