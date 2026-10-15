import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from './Button';

/**
 * Protected Route Guard Component
 * 
 * Enforces authentication and role-based access control (RBAC).
 * 1. Shows loading indicator while session check is in flight.
 * 2. Redirects unauthenticated visitors to /login.
 * 3. Restricts role access (e.g. customers cannot view provider or admin portals).
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--primary-600)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Verifying authentication credentials...</p>
      </div>
    );
  }

  // Not logged in -> redirect to login page
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If specific roles are required, ensure user has an allowed role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const userRoleDashboard = 
      user.role === 'admin' 
        ? '/admin/dashboard' 
        : user.role === 'provider' 
          ? '/provider/dashboard' 
          : '/customer/dashboard';

    return (
      <div className="section-spacing container" style={{ maxWidth: '640px', margin: '4rem auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{
            width: '4.5rem',
            height: '4.5rem',
            borderRadius: '50%',
            backgroundColor: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem'
          }}>
            <ShieldAlert size={36} />
          </div>

          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', color: 'var(--color-text-title)' }}>
            Access Restricted
          </h2>
          
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            This page requires <strong>{allowedRoles.join(' or ')}</strong> privileges. 
            You are currently signed in as a <strong style={{ textTransform: 'capitalize' }}>{user.role}</strong> ({user.email}).
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button to={userRoleDashboard} variant="primary" size="md">
              Go to My {user.role === 'admin' ? 'Admin' : user.role === 'provider' ? 'Provider' : 'Customer'} Dashboard
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
