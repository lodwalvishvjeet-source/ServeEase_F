import React, { useEffect } from 'react';
import ChatInterface from './ChatInterface';

/**
 * BookingChatModal
 * Modal dialog displaying the booking-scoped real-time chat interface.
 * Accessible solely from My Bookings for an authorized service appointment.
 */
export default function BookingChatModal({
  booking,
  role = 'customer',
  onClose
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!booking) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat regarding booking ${booking.serviceName || ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
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
          maxWidth: '780px',
          height: 'min(88vh, 680px)',
          padding: 0,
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--color-border)',
          position: 'relative'
        }}
      >
        <ChatInterface
          role={role}
          bookingId={booking._id}
          initialBooking={booking}
          isBookingScoped={true}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
