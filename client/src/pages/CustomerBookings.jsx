import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  AlertCircle, 
  Search, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Phone, 
  User, 
  ArrowRight,
  Loader2,
  FileText,
  MessageSquare,
  Star
} from 'lucide-react';
import Button from '../components/common/Button';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getCityDisplayName } from '../data/cities';
import { bookingApi, reviewApi } from '../services/api';
import { connectSocket } from '../services/socket';

/**
 * Status Badge Helpers
 */
const getStatusBadge = (status) => {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending Confirmation',
        bg: '#fef3c7',
        color: '#92400e',
        border: '#fde68a'
      };
    case 'accepted':
      return {
        label: 'Confirmed / Accepted',
        bg: '#dbeafe',
        color: '#1e40af',
        border: '#bfdbfe'
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        bg: '#f3e8ff',
        color: '#6b21a8',
        border: '#e9d5ff'
      };
    case 'completed':
      return {
        label: 'Completed',
        bg: '#dcfce7',
        color: '#166534',
        border: '#bbf7d0'
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        bg: '#fee2e2',
        color: '#991b1b',
        border: '#fecaca'
      };
    case 'rejected':
      return {
        label: 'Declined by Technician',
        bg: '#f1f5f9',
        color: '#475569',
        border: '#e2e8f0'
      };
    default:
      return {
        label: status,
        bg: '#f1f5f9',
        color: '#475569',
        border: '#e2e8f0'
      };
  }
};

/**
 * Customer Bookings Page (/customer/bookings)
 */
export default function CustomerBookings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'accepted' | 'completed' | 'cancelled'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cancellation modal state
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState(null);

  // Review modal state & customer reviews cache
  const [myReviews, setMyReviews] = useState({});
  const [reviewingBooking, setReviewingBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(null);
  const [viewingReview, setViewingReview] = useState(null);

  const userCityDisplay = user?.city ? getCityDisplayName(user.city) : 'Sangli';

  // Fetch customer's submitted reviews
  const fetchReviews = async () => {
    try {
      const res = await reviewApi.getMyReviews();
      if (res.success && Array.isArray(res.reviews)) {
        const map = {};
        res.reviews.forEach(r => {
          const bId = r.booking?._id || r.booking;
          if (bId) map[String(bId)] = r;
        });
        setMyReviews(map);
      }
    } catch (err) {
      console.warn('Could not load customer reviews:', err.message);
    }
  };

  // Fetch bookings from server
  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookingApi.getMyBookings();
      if (res.success && Array.isArray(res.bookings)) {
        setBookings(res.bookings);
      } else {
        setError(res.error || 'Failed to load service bookings.');
      }
    } catch (err) {
      setError(err.message || 'Network error while fetching bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchReviews();
  }, []);

  // Real-time booking status updates via Socket.IO
  useEffect(() => {
    const socket = connectSocket();
    const handleStatusUpdate = ({ bookingId, status, completedAt, booking }) => {
      setBookings(prev =>
        prev.map(b => (b._id === bookingId ? { ...b, status, completedAt: completedAt || booking?.completedAt || b.completedAt, ...(booking || {}) } : b))
      );
    };

    socket.on('booking_status_updated', handleStatusUpdate);

    return () => {
      socket.off('booking_status_updated', handleStatusUpdate);
    };
  }, []);

  // Handle Review submission
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewingBooking) return;
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Please select a rating between 1 and 5 stars.');
      return;
    }
    setIsSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(null);

    try {
      const res = await reviewApi.createReview({
        bookingId: reviewingBooking._id,
        rating: reviewRating,
        comment: reviewComment
      });

      if (res.success && res.review) {
        setReviewSuccess('Review submitted successfully! Thank you for rating the service.');
        setMyReviews(prev => ({
          ...prev,
          [String(reviewingBooking._id)]: res.review
        }));
        setTimeout(() => {
          setReviewingBooking(null);
          setReviewSuccess(null);
        }, 1500);
      } else {
        setReviewError(res.error || 'Failed to submit review.');
      }
    } catch (err) {
      setReviewError(err.message || 'Error communicating with server.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Handle Cancellation submission
  const handleConfirmCancel = async () => {
    if (!cancellingId) return;
    setIsCancelling(true);
    setActionError(null);

    try {
      const res = await bookingApi.cancelBooking(cancellingId, cancelReason);
      if (res.success && res.booking) {
        // Update local state with the returned updated booking
        setBookings(prev => prev.map(b => (b._id === cancellingId ? res.booking : b)));
        setCancellingId(null);
        setCancelReason('');
      } else {
        setActionError(res.error || 'Could not cancel booking.');
      }
    } catch (err) {
      setActionError(err.message || 'Error executing cancellation.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Filter bookings based on activeTab
  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return b.status === 'pending';
    if (activeTab === 'accepted') return b.status === 'accepted';
    if (activeTab === 'in_progress') return b.status === 'in_progress';
    if (activeTab === 'completed') return b.status === 'completed';
    if (activeTab === 'cancelled') return b.status === 'cancelled';
    if (activeTab === 'rejected') return b.status === 'rejected';
    return true;
  });

  return (
    <DashboardLayout
      title="My Service Bookings"
      subtitle="Track scheduled technician visits, inspect service receipts, and manage appointments"
    >
      <div className="customer-bookings-content">

        {/* Global Feedback Banner */}
        {actionError && (
          <div className="alert-box alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Header toolbar with refresh button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Filter Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            borderBottom: '1px solid var(--color-border)',
            flexWrap: 'wrap'
          }}>
            {[
              { id: 'all', label: `All (${bookings.length})` },
              { id: 'pending', label: `Pending (${bookings.filter(b => b.status === 'pending').length})` },
              { id: 'accepted', label: `Accepted (${bookings.filter(b => b.status === 'accepted').length})` },
              { id: 'in_progress', label: `In Progress (${bookings.filter(b => b.status === 'in_progress').length})` },
              { id: 'completed', label: `Completed (${bookings.filter(b => b.status === 'completed').length})` },
              { id: 'cancelled', label: `Cancelled (${bookings.filter(b => b.status === 'cancelled').length})` },
              { id: 'rejected', label: `Rejected (${bookings.filter(b => b.status === 'rejected').length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.6rem 1rem',
                  fontSize: '0.88rem',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? 'var(--primary-700)' : 'var(--color-text-muted)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--primary-600)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchBookings}
            disabled={loading}
            className="btn btn-outline btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
              Loading your service appointments...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <AlertCircle size={36} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
              Unable to Load Bookings
            </h3>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.92rem' }}>
              {error}
            </p>
            <Button variant="primary" onClick={fetchBookings}>
              <RefreshCw size={16} /> Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredBookings.length === 0 && (
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-100)',
              color: 'var(--primary-700)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <Calendar size={28} />
            </div>

            <h3 style={{ fontSize: '1.4rem', color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
              {activeTab === 'all' ? 'No Service Bookings Found' : `No ${activeTab} bookings`}
            </h3>

            <p style={{ color: 'var(--color-text-muted)', maxWidth: '520px', margin: '0 auto 1.75rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
              {activeTab === 'all'
                ? `You haven't requested any home repair visits in ${userCityDisplay} yet. Discover verified technicians and book doorstep service.`
                : `You currently have no appointments categorized under "${activeTab}".`}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Button to="/services" variant="primary">
                <Search size={16} /> Discover Services in {userCityDisplay}
              </Button>
            </div>
          </div>
        )}

        {/* Bookings List Grid */}
        {!loading && !error && filteredBookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredBookings.map((b) => {
              const statusBadge = getStatusBadge(b.status);
              const providerObj = b.provider || {};
              const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80';
              const canCancel = ['pending', 'accepted'].includes(b.status);

              return (
                <article
                  key={b._id}
                  id={`booking-card-${b._id}`}
                  className="card"
                  style={{
                    padding: '1.5rem',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'box-shadow 0.2s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    borderBottom: '1px solid #f1f5f9',
                    paddingBottom: '1rem',
                    marginBottom: '1rem'
                  }}>
                    {/* Provider Info & Service Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <img
                        src={providerObj.providerDetails?.avatar || defaultAvatar}
                        alt={providerObj.name || 'Technician'}
                        style={{
                          width: '3.25rem',
                          height: '3.25rem',
                          borderRadius: 'var(--radius-lg)',
                          objectFit: 'cover',
                          border: '2px solid var(--primary-100)'
                        }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = defaultAvatar;
                        }}
                      />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-text-title)' }}>
                            {b.serviceName}
                          </h4>
                          {b.category && (
                            <span style={{ fontSize: '0.72rem', backgroundColor: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px', color: '#475569', fontWeight: 600 }}>
                              {b.category}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                          Technician: <strong style={{ color: 'var(--color-text-body)' }}>{providerObj.name || 'Assigned Technician'}</strong>
                          {providerObj.phoneNumber && (
                            <span style={{ marginLeft: '0.75rem', color: 'var(--primary-700)' }}>
                              <Phone size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                              {providerObj.phoneNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.85rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: statusBadge.bg,
                      color: statusBadge.color,
                      border: `1px solid ${statusBadge.border}`,
                      fontSize: '0.8rem',
                      fontWeight: 700
                    }}>
                      <span style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: statusBadge.color
                      }} />
                      {statusBadge.label}
                    </div>
                  </div>

                  {/* Booking Details Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.88rem',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                        Scheduled Date & Time
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-title)', fontWeight: 600, marginTop: '0.2rem' }}>
                        <Calendar size={15} style={{ color: 'var(--primary-600)' }} />
                        <span>{b.bookingDate}</span>
                        <Clock size={15} style={{ color: 'var(--primary-600)', marginLeft: '0.35rem' }} />
                        <span>{b.bookingTime}</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                        Service Address
                      </span>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', color: 'var(--color-text-body)', marginTop: '0.2rem' }}>
                        <MapPin size={15} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                        <span>{b.serviceAddress}, {b.cityName || getCityDisplayName(b.city)}</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                        Visit / Quoted Price
                      </span>
                      <div style={{ marginTop: '0.2rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-700)' }}>
                        {b.price && Number(b.price) > 0 ? `₹${b.price}` : 'On Inspection Quote'}
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '0.35rem' }}>
                          (Pay on site)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Optional Customer Description or Rejection Reason */}
                  {b.description && (
                    <div style={{
                      backgroundColor: '#f8fafc',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      color: 'var(--color-text-body)',
                      marginBottom: '1rem',
                      border: '1px solid #e2e8f0'
                    }}>
                      <strong>Special Instructions:</strong> "{b.description}"
                    </div>
                  )}

                  {b.rejectionReason && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      color: '#991b1b',
                      marginBottom: '1rem',
                      border: '1px solid #fee2e2'
                    }}>
                      <strong>Technician Decline Reason:</strong> "{b.rejectionReason}"
                    </div>
                  )}

                  {b.cancellationReason && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.85rem',
                      color: '#991b1b',
                      marginBottom: '1rem',
                      border: '1px solid #fee2e2'
                    }}>
                      <strong>Cancellation Note:</strong> "{b.cancellationReason}"
                    </div>
                  )}

                  {/* Technician Arrival Verification OTP Display (Customer Only) */}
                  {b.status === 'accepted' && b.arrivalOtp && !b.arrivalOtpVerified && !b.arrivedAt && (
                    <div
                      id={`arrival-otp-card-${b._id}`}
                      style={{
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                        padding: '1rem 1.25rem',
                        borderRadius: 'var(--radius-lg)',
                        border: '1.5px solid #a7f3d0',
                        marginBottom: '1rem',
                        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#065f46', fontWeight: 700, fontSize: '0.92rem' }}>
                          <ShieldCheck size={18} style={{ color: '#059669' }} />
                          <span>Technician Arrival Verification Code</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#047857', backgroundColor: '#d1fae5', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                          Share only after arrival
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                        <div
                          id={`arrival-otp-code-${b._id}`}
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '1.65rem',
                            fontWeight: 800,
                            letterSpacing: '0.35em',
                            color: '#064e3b',
                            backgroundColor: '#ffffff',
                            padding: '0.4rem 1.1rem',
                            borderRadius: 'var(--radius-md)',
                            border: '1px dashed #059669',
                            display: 'inline-block'
                          }}
                        >
                          {b.arrivalOtp}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.84rem', color: '#047857', maxWidth: '440px', lineHeight: 1.45 }}>
                          Please share this 6-digit code with the technician <strong>only after they arrive</strong> at your location to confirm arrival.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Technician Arrival Confirmed Banner */}
                  {(b.arrivalOtpVerified || b.arrivedAt) && b.status !== 'completed' && (
                    <div
                      id={`arrival-verified-banner-${b._id}`}
                      style={{
                        backgroundColor: '#f0fdf4',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.88rem',
                        color: '#166534',
                        marginBottom: '1rem',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                      }}
                    >
                      <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <div>
                        <strong>Technician Arrival Verified</strong>
                        {b.arrivedAt && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: '#15803d' }}>
                            — technician confirmed arrival on {new Date(b.arrivedAt).toLocaleDateString()} at {new Date(b.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Service Completed Banner */}
                  {b.status === 'completed' && (
                    <div
                      id={`service-completed-banner-${b._id}`}
                      style={{
                        backgroundColor: '#f0fdf4',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.88rem',
                        color: '#166534',
                        marginBottom: '1rem',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                      }}
                    >
                      <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <div>
                        <strong>Service Completed</strong>
                        {b.completedAt && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.82rem', color: '#15803d' }}>
                            — finished on {new Date(b.completedAt).toLocaleDateString()} at {new Date(b.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '0.85rem',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      Request ID: <code style={{ color: 'var(--color-text-body)' }}>{b._id}</code>
                    </span>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancellingId(b._id);
                            setCancelReason('');
                            setActionError(null);
                          }}
                          className="btn btn-outline btn-sm"
                          style={{
                            color: 'var(--color-danger)',
                            borderColor: '#fca5a5'
                          }}
                        >
                          <XCircle size={14} /> Cancel Appointment
                        </button>
                      )}

                      <Button
                        to={`/customer/map?bookingId=${b._id}`}
                        variant="outline"
                        size="sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <MapPin size={14} /> Map Location
                      </Button>

                      <Button
                        to={`/customer/messages?bookingId=${b._id}`}
                        variant="primary"
                        size="sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <MessageSquare size={14} /> Message
                      </Button>

                      {/* Review Action for Completed Bookings */}
                      {b.status === 'completed' && (
                        myReviews[b._id] ? (
                          <button
                            type="button"
                            id={`view-review-btn-${b._id}`}
                            onClick={() => setViewingReview(myReviews[b._id])}
                            className="btn btn-outline btn-sm"
                            style={{
                              color: '#b45309',
                              borderColor: '#fde68a',
                              backgroundColor: '#fffbeb',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Star size={14} fill="#d97706" stroke="#d97706" />
                            <span>Rated {myReviews[b._id].rating}★ (View)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            id={`rate-booking-btn-${b._id}`}
                            onClick={() => {
                              setReviewingBooking(b);
                              setReviewRating(5);
                              setHoverRating(0);
                              setReviewComment('');
                              setReviewError(null);
                              setReviewSuccess(null);
                            }}
                            className="btn btn-primary btn-sm"
                            style={{
                              backgroundColor: '#d97706',
                              borderColor: '#d97706',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <Star size={14} fill="#ffffff" stroke="#ffffff" />
                            <span>Rate & Review</span>
                          </button>
                        )
                      )}

                      {b.provider?._id && (
                        <Button
                          to={`/provider/${b.provider._id}`}
                          variant="outline"
                          size="sm"
                        >
                          View Technician
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Cancellation Confirmation Dialog Modal */}
        {cancellingId && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '460px',
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                padding: '1.75rem',
                boxShadow: 'var(--shadow-xl)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', marginBottom: '0.75rem' }}>
                <AlertCircle size={22} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-title)' }}>
                  Cancel Appointment?
                </h3>
              </div>

              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                Are you sure you want to cancel this service visit? The technician will be notified immediately.
              </p>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Reason for Cancellation (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule conflict, problem resolved..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="form-control"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button
                  variant="outline"
                  disabled={isCancelling}
                  onClick={() => setCancellingId(null)}
                >
                  Keep Booking
                </Button>
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleConfirmCancel}
                  className="btn btn-primary"
                  style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                >
                  {isCancelling ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel Booking'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review Submission Dialog Modal */}
        {reviewingBooking && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '520px',
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                padding: '2rem',
                boxShadow: 'var(--shadow-xl)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Star size={22} fill="#d97706" stroke="#d97706" /> Rate & Review Service
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>
                    {reviewingBooking.serviceName} • {reviewingBooking.provider?.name || 'Technician'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isSubmittingReview && setReviewingBooking(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}
                >
                  ✕
                </button>
              </div>

              {reviewError && (
                <div className="alert-box alert-error" style={{ marginBottom: '1.25rem' }}>
                  <AlertCircle size={18} />
                  <span>{reviewError}</span>
                </div>
              )}

              {reviewSuccess && (
                <div className="alert-box alert-success" style={{ marginBottom: '1.25rem' }}>
                  <CheckCircle2 size={18} />
                  <span>{reviewSuccess}</span>
                </div>
              )}

              <form onSubmit={handleReviewSubmit}>
                {/* 1-5 Star Selector */}
                <div className="form-group" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <label className="form-label" style={{ fontSize: '0.9rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                    How would you rate your overall experience?
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', margin: '0.5rem 0' }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive = (hoverRating || reviewRating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          id={`star-btn-${star}`}
                          onClick={() => setReviewRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          aria-label={`${star} star${star > 1 ? 's' : ''}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            transform: isActive ? 'scale(1.15)' : 'scale(1)',
                            transition: 'transform 0.15s ease'
                          }}
                        >
                          <Star
                            size={32}
                            fill={isActive ? '#d97706' : '#e2e8f0'}
                            stroke={isActive ? '#d97706' : '#cbd5e1'}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#d97706', minHeight: '1.2rem' }}>
                    {['1 - Poor', '2 - Fair', '3 - Good', '4 - Very Good', '5 - Excellent!'][((hoverRating || reviewRating) || 5) - 1]}
                  </div>
                </div>

                {/* Review Text Area */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                      Written Review / Feedback (Optional)
                    </label>
                    <span style={{ fontSize: '0.78rem', color: reviewComment.length > 900 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {reviewComment.length} / 1000
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={1000}
                    placeholder="Share helpful feedback about punctuality, problem resolution, pricing fairness, and quality..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="form-control"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <Button
                    variant="outline"
                    disabled={isSubmittingReview}
                    onClick={() => setReviewingBooking(null)}
                  >
                    Cancel
                  </Button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview || Boolean(reviewSuccess)}
                    id="submit-review-btn"
                    className="btn btn-primary"
                    style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}
                  >
                    {isSubmittingReview ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Submitting...
                      </>
                    ) : (
                      'Submit Verified Review'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View Review Details Modal */}
        {viewingReview && (
          <div
            className="modal-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-xl)',
                padding: '2rem',
                boxShadow: 'var(--shadow-xl)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-title)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={20} style={{ color: '#16a34a' }} /> Your Verified Review
                </h3>
                <button
                  type="button"
                  onClick={() => setViewingReview(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}
                >
                  ✕
                </button>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginBottom: '1rem',
                backgroundColor: '#fffbeb',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #fde68a'
              }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={18}
                      fill={s <= viewingReview.rating ? '#d97706' : '#e2e8f0'}
                      stroke={s <= viewingReview.rating ? '#d97706' : '#cbd5e1'}
                    />
                  ))}
                </div>
                <strong style={{ marginLeft: '0.5rem', color: '#92400e', fontSize: '0.95rem' }}>
                  {viewingReview.rating} out of 5 stars
                </strong>
              </div>

              {viewingReview.comment ? (
                <div style={{ marginBottom: '1.5rem', color: 'var(--color-text-body)', fontSize: '0.92rem', lineHeight: 1.6 }}>
                  "{viewingReview.comment}"
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', fontStyle: 'italic', marginBottom: '1.5rem' }}>
                  No written comments provided.
                </p>
              )}

              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
                Submitted on {new Date(viewingReview.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="outline" onClick={() => setViewingReview(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
