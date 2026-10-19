import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MailCheck, AlertCircle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import Button from '../components/common/Button';
import { validateEmail } from '../utils/validation';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * VerifyEmail Page Component (/verify-email)
 * Enables customers to verify their email address via 6-digit OTP
 * to unlock booking permissions on ServeEase.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, verifyEmailOtp, refreshUser } = useAuth();

  const initialEmail = location.state?.email || user?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [formError, setFormError] = useState('');
  const [statusMsg, setStatusMsg] = useState(
    location.state?.registered
      ? 'A 6-digit verification code has been sent to your email address.'
      : ''
  );

  const handleVerify = async (e) => {
    e.preventDefault();
    setFormError('');
    setStatusMsg('');

    const targetEmail = email.trim() || user?.email || '';
    const emailCheck = validateEmail(targetEmail);
    if (!emailCheck.isValid) {
      setFormError(emailCheck.error || 'Please provide a valid email address.');
      return;
    }

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setFormError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await verifyEmailOtp(emailCheck.normalized, cleanOtp);
      if (res && res.success) {
        setStatusMsg('Email verified and account created successfully! Redirecting...');
        if (refreshUser) await refreshUser();
        setTimeout(() => {
          const destination = res?.user?.role === 'provider' || location.state?.role === 'provider'
            ? '/provider/dashboard'
            : '/customer/dashboard';
          navigate(destination, { replace: true });
        }, 1200);
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

    const targetEmail = email.trim() || user?.email || '';
    const emailCheck = validateEmail(targetEmail);
    if (!emailCheck.isValid) {
      setFormError('Please provide a valid email address to resend the code.');
      return;
    }

    try {
      setIsResending(true);
      const res = await authApi.resendEmailOtp(emailCheck.normalized);
      if (res && res.success) {
        setStatusMsg(res.message || 'A new 6-digit verification code has been sent to your email.');
      } else {
        setFormError(res?.error || 'Failed to resend verification code. Please try again.');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to resend verification code.');
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
            Email Verification
          </span>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>Verify Your Email</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Enter the 6-digit verification code sent to{' '}
            <strong style={{ color: 'var(--color-text-title)' }}>
              {email || user?.email || 'your email address'}
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
          {(!location.state?.email && !user?.email) && (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="verify-email-input" className="form-label">
                Email Address
              </label>
              <input
                id="verify-email-input"
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
            <label htmlFor="email-otp-code" className="form-label">
              6-Digit Verification Code
            </label>
            <input
              id="email-otp-code"
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
            <span className="form-helper" style={{ textAlign: 'center', display: 'block', marginTop: '0.5rem' }}>
              Verification codes expire in 15 minutes.
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={isLoading || otp.length !== 6}
            loading={isLoading}
            style={{ marginBottom: '1.25rem' }}
          >
            <MailCheck size={18} />
            Verify & Complete Registration
          </Button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', fontSize: '0.88rem' }}>
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
        </div>
      </div>
    </div>
  );
}
