import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import Button from '../components/common/Button';
import PasswordInput from '../components/common/PasswordInput';
import { validatePassword } from '../utils/validation';
import { authApi } from '../services/api';

/**
 * ResetPassword Page Component
 * Allows user to set a new password using verified resetToken
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || '');
  const [resetToken, setResetToken] = useState(location.state?.resetToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    if (!email || !resetToken) {
      setFormError('Your password reset session is missing or expired. Please restart recovery.');
      return;
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.isValid) {
      setFormError(passwordCheck.error);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await authApi.resetPassword(email, resetToken, newPassword);
      if (res && res.success) {
        setSuccessMsg(res.message || 'Password reset successfully! Redirecting to sign in...');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      } else {
        setFormError(res?.error || 'Failed to reset password. The session may have expired.');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to reset password. The session may have expired.');
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
            New Password
          </span>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Set New Password</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Choose a strong password to protect your account.
          </p>
        </div>

        {/* Feedback Alerts */}
        {formError && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success" role="alert" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {(!location.state?.email || !location.state?.resetToken) && (
            <div className="alert-box alert-warning" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              <span>
                No active recovery token detected. If you haven't received a code yet,{' '}
                <Link to="/forgot-password" style={{ color: 'var(--color-accent-gold)', fontWeight: 600, textDecoration: 'underline' }}>request a new code</Link>.
              </span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="new-password" className="form-label">
              New Password
            </label>
            <PasswordInput
              id="new-password"
              name="newPassword"
              placeholder="Min 8 characters (letters, numbers, symbols)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Must include at least 8 characters with upper & lowercase, number, and special character.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="confirm-password" className="form-label">
              Confirm New Password
            </label>
            <PasswordInput
              id="confirm-password"
              name="confirmPassword"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={isLoading || !newPassword || !confirmPassword}
            loading={isLoading}
            style={{ marginBottom: '1.25rem' }}
          >
            <Lock size={18} />
            Update Password
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.88rem' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--color-text-muted)',
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
