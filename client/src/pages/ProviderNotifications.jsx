import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Clock, 
  ArrowRight, 
  Check, 
  CheckCheck, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  Inbox,
  Wrench
} from 'lucide-react';
import Button from '../components/common/Button';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';

/**
 * Helper: Icon selector by notification type
 */
const getNotificationIcon = (type) => {
  switch (type) {
    case 'booking_created':
      return <Calendar size={18} style={{ color: 'var(--primary-600)' }} />;
    case 'booking_accepted':
      return <CheckCircle2 size={18} style={{ color: '#16a34a' }} />;
    case 'booking_rejected':
      return <XCircle size={18} style={{ color: '#dc2626' }} />;
    case 'booking_cancelled':
      return <AlertCircle size={18} style={{ color: '#d97706' }} />;
    case 'booking_completed':
      return <ShieldCheck size={18} style={{ color: '#0284c7' }} />;
    default:
      return <Bell size={18} style={{ color: 'var(--primary-600)' }} />;
  }
};

/**
 * Provider Notifications Page (/provider/notifications)
 */
export default function ProviderNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationApi.getNotifications();
      if (res.success && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      } else {
        setError(res.error || 'Failed to load technician notifications.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Mark single notification as read
  const handleMarkAsRead = async (id) => {
    setActionLoading(true);
    try {
      const res = await notificationApi.markAsRead(id);
      if (res.success && res.notification) {
        setNotifications(prev =>
          prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.warn('Could not mark notification as read:', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setActionLoading(true);
    try {
      const res = await notificationApi.markAllAsRead();
      if (res.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.warn('Could not mark all as read:', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DashboardLayout
      title="Technician Notifications"
      subtitle="Stay updated on new customer booking requests, schedule cancellations, and regional service alerts"
    >
      <div className="provider-notifications-content" style={{ maxWidth: '840px' }}>

        {/* Toolbar Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--color-text-title)' }}>
              Technician Activity Inbox
            </h3>
            {unreadCount > 0 && (
              <span className="badge badge-primary" style={{ fontWeight: 700 }}>
                {unreadCount} Unread
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleMarkAllAsRead}
                className="btn btn-outline btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <CheckCheck size={15} /> Mark All as Read
              </button>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={fetchNotifications}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
              Loading technician notifications...
            </p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <AlertCircle size={36} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
              Unable to Load Notifications
            </h3>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.92rem' }}>
              {error}
            </p>
            <Button variant="primary" onClick={fetchNotifications}>
              <RefreshCw size={16} /> Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && notifications.length === 0 && (
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
              <Inbox size={28} />
            </div>

            <h3 style={{ fontSize: '1.35rem', color: 'var(--color-text-title)', marginBottom: '0.5rem' }}>
              No Activity Notices Yet
            </h3>

            <p style={{ color: 'var(--color-text-muted)', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.6, fontSize: '0.92rem' }}>
              When customers book your trade services or appointments update, incoming notifications will appear here.
            </p>

            <Button to="/provider/requests" variant="primary">
              View Booking Requests
            </Button>
          </div>
        )}

        {/* Notifications List */}
        {!loading && !error && notifications.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {notifications.map((n) => {
              const isUnread = !n.isRead;
              const isBookingRequest = n.type === 'booking_created';
              const targetRoute = isBookingRequest ? '/provider/requests' : '/provider/bookings';

              return (
                <div
                  key={n._id}
                  id={`notif-${n._id}`}
                  className="card"
                  style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    backgroundColor: isUnread ? 'var(--color-success-bg)' : 'var(--color-bg-card)',
                    border: isUnread ? '1px solid var(--color-success)' : '1px solid var(--color-border)',
                    boxShadow: isUnread ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Event Icon */}
                  <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    backgroundColor: isUnread ? 'var(--color-success-bg)' : 'var(--color-bg-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <h4 style={{
                          margin: 0,
                          fontSize: '1rem',
                          color: isUnread ? 'var(--primary-600)' : 'var(--color-text-title)',
                          fontWeight: isUnread ? 700 : 600
                        }}>
                          {n.title}
                        </h4>
                        {isUnread && (
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#16a34a',
                            display: 'inline-block'
                          }} title="Unread" />
                        )}
                      </div>

                      <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(n.createdAt).toLocaleDateString()} • {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p style={{
                      margin: '0 0 0.65rem',
                      color: isUnread ? 'var(--color-text-body)' : 'var(--color-text-muted)',
                      fontSize: '0.88rem',
                      lineHeight: 1.5
                    }}>
                      {n.message}
                    </p>

                    {/* Actions and Workbench Link */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <Button
                        to={targetRoute}
                        variant="outline"
                        size="sm"
                        style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
                      >
                        {isBookingRequest ? 'Review Request' : 'View Schedule'} <ArrowRight size={13} />
                      </Button>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(n._id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--primary-700)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem'
                          }}
                        >
                          <Check size={14} /> Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
