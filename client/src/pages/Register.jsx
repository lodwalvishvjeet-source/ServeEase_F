import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  Briefcase, 
  AlertCircle, 
  UserPlus, 
  MapPin, 
  Mail, 
  Phone, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import PasswordInput from '../components/common/PasswordInput';
import Autocomplete from '../components/common/Autocomplete';
import { SERVICE_CATEGORIES } from '../data/sampleData';
import { SUPPORTED_CITIES } from '../data/cities';
import { validateEmail, validateIndianMobile } from '../utils/validation';

/**
 * Register Page Component (Option B: Ambient Centered Card with Interactive Role Cards)
 * Connects with Express Registration API, Firebase Auth & MongoDB Atlas
 * Supports Customer and Service Provider roles with city-based normalization.
 */
export default function Register() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useAuth();
  const [role, setRole] = useState('customer'); // 'customer' | 'provider'

  // Common Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Provider-Specific Fields
  const [category, setCategory] = useState(SERVICE_CATEGORIES[0]?.name || 'Plumbing');
  const [servicesOffered, setServicesOffered] = useState('');
  const [experience, setExperience] = useState('3');
  const [serviceArea, setServiceArea] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const [agreeTerms, setAgreeTerms] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Field validation hints
  const emailValidation = useMemo(() => {
    if (!email.trim()) return null;
    return validateEmail(email);
  }, [email]);

  // Active city meta for locality placeholders and suggestions
  const activeCityMeta = useMemo(() => {
    return SUPPORTED_CITIES.find(c => c.id === selectedCity);
  }, [selectedCity]);

  const localitiesHint = activeCityMeta
    ? activeCityMeta.popularLocalities.slice(0, 3).join(', ')
    : 'Localities / neighborhoods';

  const localityOptions = useMemo(() => {
    if (!activeCityMeta?.popularLocalities) return [];
    return activeCityMeta.popularLocalities.map(loc => ({
      id: loc,
      label: loc,
      description: `${activeCityMeta.name} locality`
    }));
  }, [activeCityMeta]);

  const handleGoogleSignUp = async () => {
    setErrorMessage('');
    if (role === 'provider' && !selectedCity) {
      setErrorMessage('Please select your operating city before signing up with Google.');
      return;
    }

    try {
      setIsGoogleLoading(true);
      const profileData = {
        city: selectedCity,
        phoneNumber,
        ...(role === 'provider' && {
          providerDetails: {
            category,
            servicesOffered: servicesOffered.trim(),
            experienceYears: Number(experience) || 0,
            city: selectedCity,
            serviceArea: serviceArea.trim() || 'Central City',
            isAvailable: Boolean(isAvailable)
          }
        })
      };

      const user = await loginWithGoogle(role, profileData);
      const dest = user.role === 'provider' ? '/provider/dashboard' : '/customer/dashboard';
      navigate(dest, { replace: true });
    } catch (err) {
      setErrorMessage(err.message || 'Google sign-up failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Frontend validation
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password.trim()) {
      setErrorMessage('Please fill in all required profile fields.');
      return;
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      setErrorMessage(emailCheck.error || 'Please enter a valid email address.');
      return;
    }

    const phoneCheck = validateIndianMobile(phoneNumber);
    if (!phoneCheck.isValid) {
      setErrorMessage(phoneCheck.error || 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!selectedCity) {
      setErrorMessage('Please select your city.');
      return;
    }

    if (role === 'provider') {
      if (!serviceArea.trim()) {
        setErrorMessage('Please specify your operational neighborhood or service locality.');
        return;
      }
      if (!servicesOffered.trim()) {
        setErrorMessage('Please specify the services you offer (e.g., Pipe repair, leak fixing).');
        return;
      }
    }

    if (!agreeTerms) {
      setErrorMessage('Please accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        name: fullName.trim(),
        email: emailCheck.normalized,
        password,
        phoneNumber: phoneCheck.normalized,
        role,
        city: selectedCity,
        agreeTerms: Boolean(agreeTerms),
        ...(role === 'provider' && {
          providerDetails: {
            category,
            servicesOffered: servicesOffered.trim(),
            experienceYears: Number(experience) || 0,
            city: selectedCity,
            serviceArea: serviceArea.trim(),
            isAvailable: Boolean(isAvailable)
          }
        })
      };

      const res = await register(payload);

      if (res?.user) {
        // Direct creation (e.g. Firebase flow)
        const destination = res.user.role === 'provider' ? '/provider/dashboard' : '/customer/dashboard';
        navigate(destination, { replace: true });
        return;
      }

      // Redirect to email OTP verification screen for legacy pending accounts
      navigate('/verify-email', {
        state: {
          email: emailCheck.normalized,
          role,
          registered: true
        },
        replace: true
      });
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please verify your details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ambient-auth-wrapper">
      {/* Ambient background glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      <div className="ambient-auth-card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--color-text-title)' }}>
            Create Your Account
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.92rem', margin: 0 }}>
            Reliable local technicians and home repairs on demand
          </p>
        </div>

        {/* Role Selection Tabs */}
        <div className="auth-tabs" role="tablist" style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'customer'}
            className={`auth-tab-btn ${role === 'customer' ? 'active' : ''}`}
            onClick={() => setRole('customer')}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
              <User size={16} /> I Need Services (Customer)
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'provider'}
            className={`auth-tab-btn ${role === 'provider' ? 'active' : ''}`}
            onClick={() => setRole('provider')}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem' }}>
              <Briefcase size={16} /> I Offer Services (Provider)
            </span>
          </button>
        </div>

        {/* Validation or API Error Box */}
        {errorMessage && (
          <div className="alert-box alert-danger" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Google Quick Sign-Up */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isLoading || isGoogleLoading}
            className="btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              fontWeight: 600,
              fontSize: '0.92rem',
              backgroundColor: 'var(--color-bg-card, #ffffff)',
              color: 'var(--color-text-body, #1e293b)',
              border: '1px solid var(--color-border, #cbd5e1)',
              borderRadius: 'var(--radius-md, 8px)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {isGoogleLoading ? 'Connecting with Google...' : 'Sign up with Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', color: 'var(--color-text-muted)' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border, #e2e8f0)' }} />
            <span style={{ padding: '0 0.75rem', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              or continue with email
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border, #e2e8f0)' }} />
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">
              Full Name <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <User size={16} className="input-icon" />
              <input
                id="register-name"
                type="text"
                className="form-input"
                placeholder={role === 'customer' ? 'e.g. Priya Sharma' : 'e.g. Rajesh Kumar'}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="register-email">
                Email Address <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  id="register-email"
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              {emailValidation && !emailValidation.isValid && (
                <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', marginTop: '0.2rem', display: 'block' }}>
                  {emailValidation.error}
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="register-phone">
                Phone Number <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <Phone size={16} className="input-icon" />
                <input
                  id="register-phone"
                  type="tel"
                  className="form-input"
                  placeholder="10-digit number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">
              Create Password <span className="required">*</span>
            </label>
            <PasswordInput
              id="register-password"
              name="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          {/* Customer City Selection */}
          {role === 'customer' && (
            <div className="form-group">
              <label className="form-label" htmlFor="customer-city">
                Your City <span className="required">*</span>
              </label>
              <div className="input-with-icon">
                <MapPin size={16} className="input-icon" />
                <select
                  id="customer-city"
                  className="form-input"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  required
                  disabled={isLoading}
                >
                  <option value="">-- Select Your City --</option>
                  {SUPPORTED_CITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Conditional Provider Fields */}
          {role === 'provider' && (
            <div style={{
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '1.25rem'
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary-600)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Briefcase size={16} /> Service Provider Profile
              </h3>

              {/* Row 1: Operating City & Localities */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start', marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="provider-city">
                    Operating City <span className="required">*</span>
                  </label>
                  <div className="input-with-icon">
                    <MapPin size={16} className="input-icon" />
                    <select
                      id="provider-city"
                      className="form-input"
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      disabled={isLoading}
                      required
                    >
                      <option value="">-- Select City --</option>
                      {SUPPORTED_CITIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="provider-area">
                    Service Localities <span className="required">*</span>
                  </label>
                  <Autocomplete
                    id="provider-area"
                    name="serviceArea"
                    value={serviceArea}
                    onChange={setServiceArea}
                    onSelect={(opt) => setServiceArea(opt ? (opt.label || opt.id) : '')}
                    options={localityOptions}
                    placeholder={`e.g. ${localitiesHint}`}
                    disabled={isLoading}
                    allowCustom={true}
                    clearable={true}
                    emptyMessage={activeCityMeta ? `No predefined areas for ${activeCityMeta.name}. You can type any area manually.` : 'Select operating city first.'}
                    icon={<MapPin size={16} />}
                  />
                </div>
              </div>

              {/* Row 2: Trade & Experience */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start', marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="provider-category">
                    Primary Trade <span className="required">*</span>
                  </label>
                  <select
                    id="provider-category"
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={isLoading}
                  >
                    {SERVICE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="provider-experience">
                    Experience (Years) <span className="required">*</span>
                  </label>
                  <input
                    id="provider-experience"
                    type="number"
                    min="0"
                    max="50"
                    className="form-input"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" htmlFor="provider-services">
                  Services Offered <span className="required">*</span>
                </label>
                <input
                  id="provider-services"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Tap repair, pipe installation, water heater fitting"
                  value={servicesOffered}
                  onChange={(e) => setServicesOffered(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  List key services or specializations separated by commas
                </small>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="provider-available"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                  disabled={isLoading}
                  style={{ accentColor: 'var(--primary-600)', width: '1rem', height: '1rem', cursor: 'pointer' }}
                />
                <label htmlFor="provider-available" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-body)', cursor: 'pointer' }}>
                  Currently available to accept new customer requests
                </label>
              </div>
            </div>
          )}

          {/* Terms Agreement with Functional Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              style={{ accentColor: 'var(--primary-600)', width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
            />
            <label htmlFor="agree-terms" style={{ color: 'var(--color-text-body)', cursor: 'pointer', lineHeight: 1.4 }}>
              I agree to the ServeEase{' '}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary-600)', textDecoration: 'underline', fontWeight: 600 }}
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary-600)', textDecoration: 'underline', fontWeight: 600 }}
              >
                Privacy Policy
              </Link>
            </label>
          </div>

          <Button type="submit" variant="primary" size="lg" block disabled={isLoading} loading={isLoading}>
            <UserPlus size={18} />
            Create {role === 'customer' ? 'Customer' : 'Provider'} Account
          </Button>
        </form>

        {/* Footer Link */}
        <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary-600)', fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
