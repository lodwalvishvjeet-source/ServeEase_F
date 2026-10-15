import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Legacy Provider Explore Services Route (/provider/explore)
 * 
 * Safely redirects providers back to their core business management dashboard (/provider/dashboard).
 */
export default function ProviderExploreServices() {
  return <Navigate to="/provider/dashboard" replace />;
}
