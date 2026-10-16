import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import Button from '../components/common/Button';
import { validateEmail } from '../utils/validation';
import { authApi } from '../services/api';

/**
 * VerifyOtp Page Component
 * Allows user to verify 6-digit OTP code sent to their email
 */
export default function VerifyOtp() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formError, setFormError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setFormError('');
    setStatusMsg('');

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setFormError(emailCheck.error);
      return;
    }

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setFormError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await authApi.verifyOtp(emailCheck.normalized, cleanOtp);
      if (res && res.success && res.resetToken) {
        setStatusMsg('Code verified successfully! Redirecting...');
        setTimeout(() => {
          navigate('/reset-password', {
            state: {
              email: emailCheck.normalized,
              resetToken: res.resetToken
            }
          });
        }, 1000);
      } else {
        setFormError(res?.error || 'Invalid or expired verification code.');
      }
    } catch (err) {
      setFormError(err.message || 'Invalid or expired verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setFormError('');
    setStatusMsg('');

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setFormError('Please provide a valid email address to resend code.');
      return;
    }

    try {
      setIsResending(true);
      const res = await authApi.forgotPassword(emailCheck.normalized);
      if (res && res.success) {
        setStatusMsg(res.message || 'A new verification code has been sent to your email.');
      } else {
        setFormError(res?.error || 'Failed to resend code. Please try again.');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <span className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>
            Two-Step Verification
          </span>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Enter Verification Code</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            We sent a 6-digit code to{' '}
            <strong style={{ color: 'var(--color-text-title)' }}>
              {email || 'your email address'}
            </strong>
          </p>
        </div>

        {/* Feedback Alerts */}
        {formError && (
          <div className="alert alert-error" role="alert" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        {statusMsg && (
          <div className="alert alert-success" role="alert" style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{statusMsg}</span>
          </div>
        )}

        <form onSubmit={handleVerify} noValidate>
          {!location.state?.email && (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="otp-email" className="form-label">
                Email Address
              </label>
              <input
                id="otp-email"
                type="email"
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="otp-code" className="form-label">
              6-Digit Code
            </label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="form-input"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              disabled={isLoading}
              autoFocus
              style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                letterSpacing: '0.5rem',
                fontWeight: 700
              }}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={isLoading || otp.length !== 6}
            style={{ width: '100%', marginBottom: '1.25rem', padding: '0.75rem' }}
          >
            {isLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 size={18} className="animate-spin" />
                Verifying Code...
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} />
                Verify & Continue
              </span>
            )}
          </Button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.88rem' }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--primary-600)',
              cursor: isResending ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 500,
              fontSize: '0.85rem'
            }}
          >
            <RotateCcw size={14} className={isResending ? 'animate-spin' : ''} />
            {isResending ? 'Resending...' : 'Resend Code'}
          </button>

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
