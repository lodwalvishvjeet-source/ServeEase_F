import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, LogIn, CheckCircle2 } from 'lucide-react';
import PasswordInput from '../components/common/PasswordInput';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import { validateEmail } from '../utils/validation';

/**
 * Login Page Component
 * Connects with Express JWT Authentication & MongoDB Atlas
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [role, setRole] = useState('customer'); // 'customer' | 'provider' | 'admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (selectedRole) => {
    setRole(selectedRole);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!email.trim() || !password.trim()) {
      setFormError('Please enter both email address and password.');
      return;
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setFormError(emailCheck.error);
      return;
    }

    try {
      setIsLoading(true);
      const user = await login(emailCheck.normalized, password, role);

      // Determine redirect path:
      // Priority 1: original requested location (if protected route redirected here and is role-compatible)
      // Priority 2: role-specific dashboard
      const requestedFrom = location.state?.from?.pathname;
      const isCompatibleRedirect =
        requestedFrom &&
        requestedFrom !== '/login' &&
        ((user.role === 'customer' && !requestedFrom.startsWith('/provider') && !requestedFrom.startsWith('/admin')) ||
         (user.role === 'provider' && !requestedFrom.startsWith('/customer') && !requestedFrom.startsWith('/admin')) ||
         (user.role === 'admin' && !requestedFrom.startsWith('/customer') && !requestedFrom.startsWith('/provider')));

      if (isCompatibleRedirect) {
        navigate(requestedFrom, { replace: true });
        return;
      }

      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (user.role === 'provider') {
        navigate('/provider/dashboard', { replace: true });
      } else {
        navigate('/customer/dashboard', { replace: true });
      }
    } catch (err) {
      setFormError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>
            Secure Sign In
          </span>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Sign in to access your ServeEase bookings and service requests
          </p>
        </div>

        {/* Role Selection Tabs */}
        <div className="auth-tabs" role="tablist" aria-label="Select Account Type" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'customer'}
            className={`auth-tab-btn ${role === 'customer' ? 'active' : ''}`}
            onClick={() => handleTabChange('customer')}
          >
            Customer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'provider'}
            className={`auth-tab-btn ${role === 'provider' ? 'active' : ''}`}
            onClick={() => handleTabChange('provider')}
          >
            Provider
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'admin'}
            className={`auth-tab-btn ${role === 'admin' ? 'active' : ''}`}
            onClick={() => handleTabChange('admin')}
          >
            Admin
          </button>
        </div>

        {/* Validation Error Message */}
        {formError && (
          <div className="alert-box" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginBottom: '1.25rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address <span className="required">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder={
                role === 'admin' 
                  ? 'e.g. admin@serveease.com' 
                  : role === 'provider' 
                    ? 'e.g. provider@example.com' 
                    : 'e.g. rahul@example.com'
              }
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password">
                Password <span className="required">*</span>
              </label>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)' }}>
                Min 6 characters
              </span>
            </div>
            <PasswordInput
              id="login-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              required
              autoComplete="current-password"
            />
            {/* Forgot Password Link */}
            <div style={{ marginBottom: '0.75rem', textAlign: 'right' }}>
              <Link to="/forgot-password" className="forgot-link" style={{ fontSize: '0.85rem', color: 'var(--primary-600)' }}>Forgot password?</Link>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              id="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: 'var(--primary-600)', width: '1rem', height: '1rem' }}
            />
            <label htmlFor="remember-me" style={{ color: 'var(--color-text-body)', cursor: 'pointer' }}>
              Remember this device (HttpOnly session)
            </label>
          </div>

          <Button type="submit" variant="primary" size="lg" block disabled={isLoading}>
            {isLoading ? (
              'Authenticating...'
            ) : (
              <>
                <LogIn size={18} />
                Sign In as {role === 'admin' ? 'Administrator' : role === 'provider' ? 'Provider' : 'Customer'}
              </>
            )}
          </Button>
        </form>

        {/* Footer Links */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ color: 'var(--primary-700)', fontWeight: 700 }}>
            Register here
          </Link>
        </div>

        {/* Admin Bootstrap Note */}
        {role === 'admin' && (
          <div style={{ marginTop: '1.25rem', padding: '0.85rem', backgroundColor: 'var(--color-bg-subtle)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            🛡️ <strong>Admin Notice:</strong> Admin accounts are created via <code>npm run bootstrap:admin</code> on the backend. Public registration cannot create administrator accounts.
          </div>
        )}
      </div>
    </div>
  );
}
