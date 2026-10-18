import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Customer Messages Page
 * Standalone messages section has been removed.
 * Redirects to My Bookings, optionally opening the chat modal for the specified booking.
 */
export default function CustomerMessages() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId') || searchParams.get('chatBookingId');

  useEffect(() => {
    if (bookingId) {
      navigate(`/customer/bookings?chatBookingId=${encodeURIComponent(bookingId)}`, { replace: true });
    } else {
      navigate('/customer/bookings', { replace: true });
    }
  }, [navigate, bookingId]);

  return null;
}
