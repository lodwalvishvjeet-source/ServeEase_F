import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Phone, 
  User, 
  Loader2,
  Check,
  DollarSign,
  MessageSquare,
  Play
} from 'lucide-react';
import Button from '../components/common/Button';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { getCityDisplayName } from '../data/cities';
import { bookingApi } from '../services/api';
import { connectSocket } from '../services/socket';

/**
 * Provider Bookings & Schedule Page (/provider/bookings)
 */
export default function ProviderBookings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'completed' | 'cancelled' | 'all'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Completion action state
  const [completingId, setCompletingId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  // Start service action state
  const [startingId, setStartingId] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  const city = user?.city ? getCityDisplayName(user.city) : 'Sangli';

  // Fetch provider bookings
  const fetchBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookingApi.getProviderBookings();
      if (res.success && Array.isArray(res.bookings)) {
        setBookings(res.bookings);
      } else {
        setError(res.error || 'Failed to load booking schedule.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to bookings server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // Listen for real-time booking status changes via Socket.IO
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

  // Handle Start Service
  const handleStartService = async (id) => {
    setStartingId(id);
    setIsStarting(true);
    setActionNotice(null);
    try {
      const res = await bookingApi.startBooking(id);
      if (res.success && res.booking) {
        setBookings(prev => prev.map(b => (b._id === id ? res.booking : b)));
        setActionNotice({ type: 'success', message: 'Service started! Job status is now In Progress.' });
      } else {
        setActionNotice({ type: 'error', message: res.error || 'Could not start service.' });
      }
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Error executing start service.' });
    } finally {
      setIsStarting(false);
      setStartingId(null);
    }
  };

  // Handle Mark as Completed
  const handleConfirmComplete = async () => {
    if (!completingId) return;
    setIsCompleting(true);
    setActionNotice(null);
    try {
      const res = await bookingApi.completeBooking(completingId);
      if (res.success && res.booking) {
        setBookings(prev => prev.map(b => (b._id === completingId ? res.booking : b)));
        setActionNotice({ type: 'success', message: 'Service marked as completed! Job finished.' });
        setCompletingId(null);
      } else {
        setActionNotice({ type: 'error', message: res.error || 'Could not mark service as completed.' });
      }
    } catch (err) {
      setActionNotice({ type: 'error', message: err.message || 'Error executing complete action.' });
    } finally {
      setIsCompleting(false);
    }
  };

  // Filter based on activeTab
  const filteredBookings = bookings.filter(b => {
    if (activeTab === 'all') return true;
    if (activeTab === 'upcoming') return ['accepted', 'in_progress'].includes(b.status);
    if (activeTab === 'completed') return b.status === 'completed';
    if (activeTab === 'cancelled') return ['cancelled', 'rejected'].includes(b.status);
    return true;
  });

  return (
    <DashboardLayout
      title="Job Schedule & Bookings"
      subtitle="Keep track of upcoming on-site visits and completed technician jobs"
    >
      <div className="provider-bookings-content">

        {/* Global Feedback Banner */}
        {actionNotice && (
          <div
            className={`alert-box alert-${actionNotice.type === 'error' ? 'error' : 'success'}`}
            style={{ marginBottom: '1.5rem' }}
          >
            {actionNotice.type === 'error' ? (
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            )}
            <span>{actionNotice.message}</span>
            <button
              onClick={() => setActionNotice(null)}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.4rem',
            borderBottom: '1px solid var(--color-border)',
            flexWrap: 'wrap'
          }}>
            {[
              { id: 'upcoming', label: `Upcoming Jobs (${bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length})` },
              { id: 'completed', label: `Completed Jobs (${bookings.filter(b => b.status === 'completed').length})` },
              { id: 'cancelled', label: `Booking History (${bookings.filter(b => ['cancelled', 'rejected'].includes(b.status)).length})` },
              { id: 'all', label: `All Jobs (${bookings.length})` }
            ].map(tab => (
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
              Loading your technician schedule...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <AlertCircle size={36} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
              Unable to Load Schedule
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
              {activeTab === 'upcoming'
                ? 'No Upcoming Confirmed Jobs'
                : activeTab === 'completed'
                  ? 'No Completed Jobs Yet'
                  : 'No Bookings Found'}
            </h3>

            <p style={{ color: 'var(--color-text-muted)', maxWidth: '520px', margin: '0 auto 1.75rem', lineHeight: 1.6, fontSize: '0.95rem' }}>
              {activeTab === 'upcoming'
                ? `You have no accepted service visits pending execution. Review incoming leads on your Booking Requests page.`
                : `Your history of ${activeTab} visits in ${city} will appear here.`}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Button to="/provider/requests" variant="primary">
                Review Booking Requests
              </Button>
              <Button to="/provider/dashboard" variant="outline">
                Dashboard Overview
              </Button>
            </div>
          </div>
        )}

        {/* Bookings List */}
        {!loading && !error && filteredBookings.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {filteredBookings.map(b => {
              const customer = b.customer || {};
              const isAccepted = b.status === 'accepted';
              const isInProgress = b.status === 'in_progress';
              const isCompleted = b.status === 'completed';

              return (
                <article
                  key={b._id}
                  id={`schedule-card-${b._id}`}
                  className="card"
                  style={{
                    padding: '1.5rem',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)'
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
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-text-title)' }}>
                        {b.serviceName}
                      </h4>
                      <div style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
                        Customer: <strong style={{ color: 'var(--color-text-body)' }}>{customer.name || 'Registered Customer'}</strong>
                        {customer.phoneNumber && (
                          <span style={{ marginLeft: '0.75rem', color: 'var(--primary-700)' }}>
                            <Phone size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                            {customer.phoneNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span style={{
                      display: 'inline-block',
                      padding: '0.3rem 0.8rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      backgroundColor: isCompleted ? '#dcfce7' : isInProgress ? '#f3e8ff' : isAccepted ? '#dbeafe' : '#fee2e2',
                      color: isCompleted ? '#166534' : isInProgress ? '#6b21a8' : isAccepted ? '#1e40af' : '#991b1b',
                      border: `1px solid ${isCompleted ? '#bbf7d0' : isInProgress ? '#e9d5ff' : isAccepted ? '#bfdbfe' : '#fecaca'}`
                    }}>
                      {isCompleted ? 'COMPLETED' : isInProgress ? 'IN PROGRESS' : isAccepted ? 'CONFIRMED APPOINTMENT' : b.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Grid details */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.88rem',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                        Scheduled Visit Time
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
                        Destination Address
                      </span>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', color: 'var(--color-text-body)', marginTop: '0.2rem' }}>
                        <MapPin size={15} style={{ color: 'var(--primary-600)', flexShrink: 0, marginTop: '2px' }} />
                        <span>{b.serviceAddress}, {b.cityName || getCityDisplayName(b.city)}</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>
                        Agreed Starting Price
                      </span>
                      <div style={{ marginTop: '0.2rem', fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary-700)' }}>
                        {b.price > 0 ? `₹${b.price}` : 'On Inspection Quote'}
                      </div>
                    </div>
                  </div>

                  {/* Customer Instructions */}
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
                      <strong>Customer Instructions:</strong> "{b.description}"
                    </div>
                  )}

                  {/* Actions Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '0.85rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Button
                        to={`/provider/map?bookingId=${b._id}`}
                        variant="outline"
                        size="sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <MapPin size={14} /> View Location
                      </Button>

                      <Button
                        to={`/provider/messages?bookingId=${b._id}`}
                        variant="outline"
                        size="sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <MessageSquare size={14} /> Message Client
                      </Button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isAccepted && (
                        <button
                          type="button"
                          id={`start-service-btn-${b._id}`}
                          disabled={isStarting && startingId === b._id}
                          onClick={() => handleStartService(b._id)}
                          className="btn btn-primary btn-sm"
                          style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          {isStarting && startingId === b._id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Starting...
                            </>
                          ) : (
                            <>
                              <Play size={14} /> Start Service
                            </>
                          )}
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          type="button"
                          id={`complete-service-btn-${b._id}`}
                          onClick={() => setCompletingId(b._id)}
                          className="btn btn-primary btn-sm"
                          style={{ backgroundColor: '#15803d', borderColor: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <CheckCircle2 size={15} /> Mark Service as Completed
                        </button>
                      )}

                      {isCompleted && (
                        <div style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <CheckCircle2 size={14} /> Completed
                        </div>
                      )}
                    </div>
                  </div>

                  {isCompleted && b.completedAt && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                      Completed on {new Date(b.completedAt).toLocaleString()}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* Completion Confirmation Dialog */}
        {completingId && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#15803d', marginBottom: '0.75rem' }}>
                <CheckCircle2 size={24} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--color-text-title)' }}>
                  Complete Service Appointment?
                </h3>
              </div>

              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                Confirm that the on-site service has been fully delivered and payment settled with the customer.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button
                  variant="outline"
                  disabled={isCompleting}
                  onClick={() => setCompletingId(null)}
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  disabled={isCompleting}
                  onClick={handleConfirmComplete}
                  className="btn btn-primary"
                  style={{ backgroundColor: '#15803d', borderColor: '#15803d' }}
                >
                  {isCompleting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Completing...
                    </>
                  ) : (
                    'Confirm Service Completion'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
