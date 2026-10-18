import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Provider Map & Location Page
 * 
 * Standalone map section has been removed in accordance with ServeEase booking-based location sharing rules.
 * Automatically forwards to My Bookings, opening the booking-scoped map modal if bookingId is provided.
 */
export default function ProviderMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId') || searchParams.get('mapBookingId');

  useEffect(() => {
    if (bookingId) {
      navigate(`/provider/bookings?mapBookingId=${encodeURIComponent(bookingId)}`, { replace: true });
    } else {
      navigate('/provider/bookings', { replace: true });
    }
  }, [navigate, bookingId]);

  return null;
}
