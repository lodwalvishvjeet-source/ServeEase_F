import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import Button from '../components/common/Button';
import { validateEmail } from '../utils/validation';
import { authApi } from '../services/api';

/**
 * ForgotPassword Page Component
 * Allows users to enter email to request a 6-digit password reset OTP
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setFormError(emailCheck.error);
      return;
    }

    try {
      setIsLoading(true);
      const res = await authApi.forgotPassword(emailCheck.normalized);
      if (res && res.success) {
        setSuccessMsg(res.message || 'Verification code sent to your email.');
        setTimeout(() => {
          navigate('/verify-otp', { state: { email: emailCheck.normalized } });
        }, 1500);
      } else {
        setFormError(res?.error || 'Failed to send verification code. Please try again.');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to send verification code. Please try again.');
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
            Account Recovery
          </span>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Forgot Password</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Enter your registered email address to receive a 6-digit verification code.
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
            <span>{successMsg} Redirecting to verification...</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="recovery-email" className="form-label">
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="recovery-email"
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading}
            style={{ width: '100%', marginBottom: '1.25rem', padding: '0.75rem' }}
          >
            {isLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 size={18} className="animate-spin" />
                Getting OTP...
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={18} />
                Get OTP
              </span>
            )}
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
