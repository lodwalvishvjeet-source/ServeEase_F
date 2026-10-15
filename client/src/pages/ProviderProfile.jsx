import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  ShieldAlert, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Save, 
  RefreshCw, 
  Lock, 
  Power
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';
import DashboardLayout from '../components/layout/DashboardLayout';
import Autocomplete from '../components/common/Autocomplete';
import { SUPPORTED_CITIES, getCityDisplayName, getCityById } from '../data/cities';
import { SERVICE_CATEGORIES } from '../data/sampleData';
import { providerApi } from '../services/api';
import { validateIndianMobile } from '../utils/validation';

/**
 * Service Provider Profile Page
 * Comprehensive workbench for technicians to configure their contact details,
 * primary trade, service areas, offered packages, pricing, and active availability.
 */
export default function ProviderProfile() {
  const { user, updateProfile } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    city: 'sangli',
    category: 'Plumbing Services',
    title: '',
    servicesOffered: '',
    experienceYears: 3,
    serviceArea: '',
    startingPrice: 299,
    hourlyRate: 350,
    isAvailable: true,
    bio: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fetchError, setFetchError] = useState(false);

  // Initialize form state from user object
  useEffect(() => {
    if (user) {
      const details = user.providerDetails || {};
      const servicesString = Array.isArray(details.servicesOffered)
        ? details.servicesOffered.join(', ')
        : (details.servicesOffered || '');

      setFormData({
        name: user.name || '',
        phoneNumber: user.phoneNumber || '',
        city: user.city || details.city || 'sangli',
        category: details.category || 'Plumbing Services',
        title: details.title || '',
        servicesOffered: servicesString,
        experienceYears: details.experienceYears !== undefined ? details.experienceYears : 3,
        serviceArea: details.serviceArea || '',
        startingPrice: details.startingPrice !== undefined ? details.startingPrice : 299,
        hourlyRate: details.hourlyRate !== undefined ? details.hourlyRate : 350,
        isAvailable: details.isAvailable !== false,
        bio: details.bio || '',
        latitude: details.location?.latitude ?? '',
        longitude: details.location?.longitude ?? '',
        locationAddress: details.location?.address || ''
      });
    }
  }, [user]);

  // Optional server reload
  const reloadProfile = async () => {
    try {
      setFetchError(false);
      const data = await providerApi.getProfile();
      if (data?.user) {
        const u = data.user;
        const details = u.providerDetails || {};
        const servicesString = Array.isArray(details.servicesOffered)
          ? details.servicesOffered.join(', ')
          : (details.servicesOffered || '');

        setFormData({
          name: u.name || '',
          phoneNumber: u.phoneNumber || '',
          city: u.city || details.city || 'sangli',
          category: details.category || 'Plumbing Services',
          title: details.title || '',
          servicesOffered: servicesString,
          experienceYears: details.experienceYears !== undefined ? details.experienceYears : 3,
          serviceArea: details.serviceArea || '',
          startingPrice: details.startingPrice !== undefined ? details.startingPrice : 299,
          hourlyRate: details.hourlyRate !== undefined ? details.hourlyRate : 350,
          isAvailable: details.isAvailable !== false,
          bio: details.bio || '',
          latitude: details.location?.latitude ?? '',
          longitude: details.location?.longitude ?? '',
          locationAddress: details.location?.address || ''
        });
      }
    } catch (err) {
      console.warn('Could not refresh provider profile:', err.message);
      setFetchError(true);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleReset = () => {
    if (user) {
      const details = user.providerDetails || {};
      const servicesString = Array.isArray(details.servicesOffered)
        ? details.servicesOffered.join(', ')
        : (details.servicesOffered || '');

      setFormData({
        name: user.name || '',
        phoneNumber: user.phoneNumber || '',
        city: user.city || details.city || 'sangli',
        category: details.category || 'Plumbing Services',
        title: details.title || '',
        servicesOffered: servicesString,
        experienceYears: details.experienceYears !== undefined ? details.experienceYears : 3,
        serviceArea: details.serviceArea || '',
        startingPrice: details.startingPrice !== undefined ? details.startingPrice : 299,
        hourlyRate: details.hourlyRate !== undefined ? details.hourlyRate : 350,
        isAvailable: details.isAvailable !== false,
        bio: details.bio || ''
      });
    }
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Approved locality suggestions for provider's chosen city
  const activeCityMeta = useMemo(() => getCityById(formData.city), [formData.city]);
  const localityOptions = useMemo(() => {
    if (!activeCityMeta?.popularLocalities) return [];
    return activeCityMeta.popularLocalities.map(loc => ({
      id: loc,
      label: loc,
      description: `${activeCityMeta.name} Area`
    }));
  }, [activeCityMeta]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    // Validations
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters long.');
      return;
    }

    if (!formData.city) {
      setErrorMessage('Please select your primary base city.');
      return;
    }

    const phoneValidation = validateIndianMobile(formData.phoneNumber);
    if (!phoneValidation.isValid) {
      setErrorMessage(phoneValidation.error || 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    if (!formData.category.trim()) {
      setErrorMessage('Primary service category is required.');
      return;
    }

    if (Number(formData.experienceYears) < 0) {
      setErrorMessage('Experience years cannot be negative.');
      return;
    }

    if (Number(formData.startingPrice) < 0) {
      setErrorMessage('Starting price must be a non-negative number.');
      return;
    }

    if (Number(formData.hourlyRate) < 0) {
      setErrorMessage('Hourly rate must be a non-negative number.');
      return;
    }

    // Convert comma-separated string to array
    const parsedServices = formData.servicesOffered
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      setIsSubmitting(true);
      const updatePayload = {
        name: formData.name.trim(),
        phoneNumber: phoneValidation.normalized,
        city: formData.city,
        providerDetails: {
          category: formData.category.trim(),
          title: formData.title.trim(),
          servicesOffered: parsedServices,
          experienceYears: Number(formData.experienceYears) || 0,
          serviceArea: formData.serviceArea.trim(),
          startingPrice: Number(formData.startingPrice) || 0,
          hourlyRate: Number(formData.hourlyRate) || 0,
          isAvailable: Boolean(formData.isAvailable),
          bio: formData.bio.trim(),
          location: (formData.latitude !== '' && formData.longitude !== '')
            ? {
                latitude: Number(formData.latitude),
                longitude: Number(formData.longitude),
                address: (formData.locationAddress || '').trim()
              }
            : null
        }
      };

      await updateProfile(updatePayload);
      setSuccessMessage(`Provider profile updated successfully! Changes are live across provider discovery for ${getCityDisplayName(formData.city)}.`);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update provider profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerified = Boolean(user?.providerDetails?.isVerified);
  const isDemo = Boolean(user?.providerDetails?.isDemo);
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : 'P';

  return (
    <DashboardLayout
      title="Business Profile"
      subtitle="Configure contact details, trade category, service areas, and pricing packages"
    >
      <div className="provider-profile-content" style={{ maxWidth: '1040px' }}>

        {/* Network / Fetch Warning Alert */}
        {fetchError && (
          <div className="alert-box alert-warning" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <div style={{ flex: 1 }}>
              <span>Could not refresh latest profile from backend. Showing local session data.</span>
            </div>
            <button 
              onClick={reloadProfile} 
              className="btn btn-outline btn-sm"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="alert-box alert-success" style={{ marginBottom: '1.5rem' }}>
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="alert-box alert-danger" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid-2" style={{ gridTemplateColumns: '1fr 2.2fr', gap: '2rem', alignItems: 'start' }}>
          {/* Left Column: Public Badge & Security Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Account Card */}
            <div className="card" style={{ padding: '1.75rem', textAlign: 'center' }}>
              <div style={{
                width: '5.2rem',
                height: '5.2rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary-100)',
                color: 'var(--primary-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.2rem',
                fontWeight: 800,
                margin: '0 auto 1.25rem'
              }}>
                {userInitial}
              </div>

              <h2 style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>{user?.name || 'Service Provider'}</h2>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>
                <Briefcase size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                {formData.category || 'Tradesperson'}
              </p>

              {/* Status Pill */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.8rem',
                borderRadius: 'var(--radius-full)',
                backgroundColor: formData.isAvailable ? '#f0fdf4' : '#fef2f2',
                color: formData.isAvailable ? '#15803d' : '#991b1b',
                fontWeight: 700,
                fontSize: '0.8rem',
                marginBottom: '1.25rem'
              }}>
                <Power size={13} />
                <span>{formData.isAvailable ? "Online • Accepting Calls" : "Offline • Taking a Break"}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '1rem 0' }} />

              <div style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <MapPin size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  <span>Base City: <strong>{getCityDisplayName(formData.city)}</strong></span>
                </div>
                <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  <span>Tel: <strong>{user?.phoneNumber || 'Not set'}</strong></span>
                </div>
                <div style={{ marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  <span style={{ wordBreak: 'break-all' }}>{user?.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  <span>Experience: <strong>{formData.experienceYears} Years</strong></span>
                </div>
              </div>
            </div>

            {/* Platform Security Rules Callout */}
            <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--color-text-title)', fontWeight: 700, fontSize: '0.9rem' }}>
                <ShieldCheck size={16} style={{ color: 'var(--primary-600)' }} />
                <span>Verification & Integrity Rules</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', lineHeight: 1.5, margin: 0 }}>
                Verification badges, average platform ratings, and account status are strictly audited by ServeEase administrators. Providers cannot self-verify or forge review scores.
              </p>
            </div>
          </div>

          {/* Right Column: Comprehensive Edit Form */}
          <div className="card" style={{ padding: '2rem' }}>
            <form onSubmit={handleSubmit}>
              {/* SECTION 1: Personal & Contact Details */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  1. Personal & Contact Details
                </h3>

                <div className="grid-2" style={{ gap: '1rem' }}>
                  {/* Name */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="name">
                      Business or Full Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      className="form-input"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      minLength={2}
                      maxLength={100}
                      disabled={isSubmitting}
                      placeholder="e.g. Sunil Patil Plumbing"
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="phoneNumber">
                      Primary Phone Number <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      className="form-input"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                      placeholder="Phone number"
                    />
                  </div>
                </div>

                <div className="grid-2" style={{ gap: '1rem' }}>
                  {/* Email (Read-Only) */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="email">
                      Account Email <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', fontWeight: 'normal' }}>(Read-only)</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="form-input"
                        value={user?.email || ''}
                        disabled
                        style={{ backgroundColor: 'var(--color-bg-subtle)', cursor: 'not-allowed', color: 'var(--color-text-muted)' }}
                      />
                      <Lock size={15} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-subtle)' }} />
                    </div>
                  </div>

                  {/* Base City */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="city">
                      Base City <span className="required">*</span>
                    </label>
                    <select
                      id="city"
                      name="city"
                      className="form-select"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    >
                      {SUPPORTED_CITIES.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Trade & Service Details */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  2. Trade & Service Details
                </h3>

                <div className="grid-2" style={{ gap: '1rem' }}>
                  {/* Category */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="category">
                      Primary Service Category <span className="required">*</span>
                    </label>
                    <select
                      id="category"
                      name="category"
                      className="form-select"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      disabled={isSubmitting}
                    >
                      {SERVICE_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                      <option value="Carpentry Services">Carpentry Services</option>
                      <option value="Painting Services">Painting Services</option>
                      <option value="Appliance Repair">Appliance Repair</option>
                      <option value="Mechanic Services">Mechanic Services</option>
                      <option value="Driver & Transport">Driver & Transport</option>
                    </select>
                  </div>

                  {/* Experience in Years */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="experienceYears">
                      Experience in Years <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      id="experienceYears"
                      name="experienceYears"
                      className="form-input"
                      value={formData.experienceYears}
                      onChange={handleChange}
                      min={0}
                      max={60}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Professional Title */}
                <div className="form-group">
                  <label className="form-label" htmlFor="title">
                    Professional Headline / Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    className="form-input"
                    value={formData.title}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="e.g. Senior Pipe Fitting & Leakage Specialist"
                  />
                  <span className="form-helper">Displayed under your name on search listings and cards.</span>
                </div>

                {/* Service Area */}
                <div className="form-group">
                  <label className="form-label" htmlFor="serviceArea">
                    Specific Service Localities <span className="required">*</span>
                  </label>
                  <Autocomplete
                    id="serviceArea"
                    name="serviceArea"
                    value={formData.serviceArea}
                    onChange={(val) => setFormData(prev => ({ ...prev, serviceArea: val }))}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, serviceArea: opt ? (opt.label || opt.id) : '' }))}
                    options={localityOptions}
                    placeholder={activeCityMeta ? `e.g. ${activeCityMeta.popularLocalities.slice(0, 3).join(', ')}` : 'Enter neighborhoods or localities'}
                    disabled={isSubmitting}
                    allowCustom={true}
                    clearable={true}
                    emptyMessage={activeCityMeta ? `No known localities for ${activeCityMeta.name}. You can type any locality manually.` : 'Select base city.'}
                  />
                  <span className="form-helper">Neighborhoods and suburbs where you travel for client appointments.</span>
                </div>

                {/* Services Offered */}
                <div className="form-group">
                  <label className="form-label" htmlFor="servicesOffered">
                    Services Offered (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="servicesOffered"
                    name="servicesOffered"
                    className="form-input"
                    value={formData.servicesOffered}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="e.g. Pipe leak repair, tap replacement, drainage unclogging, geyser fitting"
                  />
                  <span className="form-helper">Separate multiple services with commas.</span>
                </div>
              </div>

              {/* SECTION 3: Pricing & Working Availability */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  3. Pricing & Working Availability
                </h3>

                <div className="grid-2" style={{ gap: '1rem' }}>
                  {/* Starting Price */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="startingPrice">
                      Starting Inspection / Visit Fee (₹) <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      id="startingPrice"
                      name="startingPrice"
                      className="form-input"
                      value={formData.startingPrice}
                      onChange={handleChange}
                      min={0}
                      step={10}
                      required
                      disabled={isSubmitting}
                    />
                    <span className="form-helper">Base service or visiting charge.</span>
                  </div>

                  {/* Hourly Rate */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="hourlyRate">
                      Hourly Labor Rate (₹)
                    </label>
                    <input
                      type="number"
                      id="hourlyRate"
                      name="hourlyRate"
                      className="form-input"
                      value={formData.hourlyRate}
                      onChange={handleChange}
                      min={0}
                      step={25}
                      disabled={isSubmitting}
                    />
                    <span className="form-helper">Approximate hourly rate for extended repairs.</span>
                  </div>
                </div>

                {/* Availability Toggle */}
                <div style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--color-text-title)' }}>
                      Accept Incoming Service Bookings
                    </strong>
                    <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                      When enabled, your profile appears as "Available" in customer search filters.
                    </span>
                  </div>

                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      name="isAvailable"
                      checked={formData.isAvailable}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary-600)' }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: formData.isAvailable ? 'var(--primary-700)' : 'var(--color-text-muted)' }}>
                      {formData.isAvailable ? 'Online' : 'Offline'}
                    </span>
                  </label>
                </div>
              </div>

              {/* SECTION 4: Professional Bio */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  4. Professional Bio & Background
                </h3>

                <div className="form-group">
                  <label className="form-label" htmlFor="bio">
                    About Your Experience & Working Standards
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    className="form-textarea"
                    rows={4}
                    value={formData.bio}
                    onChange={handleChange}
                    maxLength={500}
                    disabled={isSubmitting}
                    placeholder="Briefly describe your years of trade experience, special tools used, emergency availability, or warranty guarantees..."
                  />
                  <span className="form-helper">
                    {formData.bio.length}/500 characters. Shown on your public technician detail page.
                  </span>
                </div>
              </div>

              {/* SECTION 5: Optional Public Service Location & Map Pin */}
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
                  5. Map Pin & Geographic Coordinates (Optional)
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Provide GPS coordinates if you wish to display an interactive pin on the customer discovery map. Leave blank if you only offer doorstep visits.
                </p>

                <div className="grid-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="latitude">
                      Latitude (-90 to 90)
                    </label>
                    <input
                      type="number"
                      step="any"
                      id="latitude"
                      name="latitude"
                      className="form-input"
                      value={formData.latitude}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      placeholder="e.g. 16.8524"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="longitude">
                      Longitude (-180 to 180)
                    </label>
                    <input
                      type="number"
                      step="any"
                      id="longitude"
                      name="longitude"
                      className="form-input"
                      value={formData.longitude}
                      onChange={handleChange}
                      disabled={isSubmitting}
                      placeholder="e.g. 74.5815"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label className="form-label" htmlFor="locationAddress">
                    Public Landmark / Service Office Address
                  </label>
                  <input
                    type="text"
                    id="locationAddress"
                    name="locationAddress"
                    className="form-input"
                    value={formData.locationAddress}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    placeholder="e.g. Near Vishrambag Chowk, Sangli"
                  />
                  <span className="form-helper">This address will be visible on the public map popup.</span>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="spin-animation" /> Saving Profile...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Provider Profile
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleReset}
                  disabled={isSubmitting}
                >
                  Cancel / Revert
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
