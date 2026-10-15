import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

/**
 * Legacy Find Providers Route (/providers)
 * 
 * Safely redirects customers to the unified Discover Services page (/services)
 * while preserving all search query parameters (city, category, q, available).
 */
export default function FindProviders() {
  const location = useLocation();
  return <Navigate to={`/services${location.search}`} replace />;
}
