import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  Edit3,
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  MapPin, 
  Tag, 
  Clock, 
  ArrowLeft,
  Briefcase,
  Save,
  X,
  Power,
  Sliders,
  DollarSign
} from 'lucide-react';
import SectionHeading from '../components/common/SectionHeading';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import DashboardLayout from '../components/layout/DashboardLayout';
import Autocomplete from '../components/common/Autocomplete';
import { getCityById } from '../data/cities';
import { useAuth } from '../context/AuthContext';
import { providerApi } from '../services/api';

/**
 * Provider "My Services" Management Page (/provider/services)
 * 
 * Allows verified service professionals to:
 * 1. View their offered services and live catalog details
 * 2. Add new service tasks to their catalog
 * 3. Edit / rename existing service offerings
 * 4. Update pricing (starting consultation, hourly rate), experience, and service area
 * 5. Toggle active provider availability directly from the dashboard
 * 
 * Backed by real REST endpoints:
 * - GET /api/providers/my-services
 * - POST /api/providers/my-services
 * - PUT /api/providers/my-services (and /api/providers/my-services/:serviceName)
 * - DELETE /api/providers/my-services/:serviceName
 */
export default function ProviderMyServices() {
  const { user, refreshUser } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add Service State
  const [newServiceName, setNewServiceName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  // Inline Service Editing State
  const [editingService, setEditingService] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [isUpdatingService, setIsUpdatingService] = useState(false);

  // Service Settings State (Rates, Area, Experience, Availability)
  const [rateForm, setRateForm] = useState({
    startingPrice: '',
    hourlyRate: '',
    experienceYears: '',
    serviceArea: '',
    isAvailable: true
  });
  const [isSavingRates, setIsSavingRates] = useState(false);

  // Fetch provider's current service catalog from backend API
  const loadMyServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await providerApi.getMyServices();
      if (data && data.success) {
        setCatalog(data);
        setRateForm({
          startingPrice: data.startingPrice ?? 0,
          hourlyRate: data.hourlyRate ?? 0,
          experienceYears: data.experienceYears ?? 0,
          serviceArea: data.serviceArea || '',
          isAvailable: data.isAvailable !== false
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load your service catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyServices();
  }, []);

  // Handle adding a new service
  const handleAddService = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    const trimmed = newServiceName.trim();
    if (!trimmed || trimmed.length < 2) {
      setActionError('Service name must be at least 2 characters long.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await providerApi.addMyService(trimmed);
      if (res && res.success) {
        setActionSuccess(`"${trimmed}" has been added to your service catalog.`);
        setNewServiceName('');
        setCatalog(prev => ({
          ...prev,
          services: res.services
        }));
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to add service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start editing a service
  const handleStartEdit = (serviceName) => {
    setEditingService(serviceName);
    setEditedName(serviceName);
    setActionError('');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingService(null);
    setEditedName('');
  };

  // Save renamed service
  const handleSaveEdit = async (oldName) => {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed.length < 2) {
      setActionError('Updated service name must be at least 2 characters long.');
      return;
    }

    if (trimmed.toLowerCase() === oldName.toLowerCase()) {
      handleCancelEdit();
      return;
    }

    try {
      setIsUpdatingService(true);
      setActionError('');
      const res = await providerApi.updateMyService(
        { oldService: oldName, newService: trimmed },
        oldName
      );

      if (res && res.success) {
        setActionSuccess(`Service renamed from "${oldName}" to "${trimmed}".`);
        setCatalog(prev => ({
          ...prev,
          services: res.services
        }));
        handleCancelEdit();
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to update service.');
    } finally {
      setIsUpdatingService(false);
    }
  };

  // Handle deleting a service
  const handleDeleteService = async (serviceName) => {
    if (!window.confirm(`Are you sure you want to remove "${serviceName}" from your offerings?`)) {
      return;
    }

    setActionError('');
    setActionSuccess('');

    try {
      const res = await providerApi.deleteMyService(serviceName);
      if (res && res.success) {
        setActionSuccess(`"${serviceName}" has been removed.`);
        setCatalog(prev => ({
          ...prev,
          services: res.services
        }));
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to remove service.');
    }
  };

  // Handle saving service rates, area, and availability settings
  const handleSaveRates = async (e) => {
    e.preventDefault();
    setActionError('');
    setActionSuccess('');

    const startingPrice = Number(rateForm.startingPrice);
    const hourlyRate = Number(rateForm.hourlyRate);
    const experienceYears = Number(rateForm.experienceYears);

    if (isNaN(startingPrice) || startingPrice < 0) {
      setActionError('Starting visit price must be a valid non-negative number.');
      return;
    }
    if (isNaN(hourlyRate) || hourlyRate < 0) {
      setActionError('Hourly rate must be a valid non-negative number.');
      return;
    }
    if (isNaN(experienceYears) || experienceYears < 0) {
      setActionError('Experience years must be a valid non-negative number.');
      return;
    }

    try {
      setIsSavingRates(true);
      const res = await providerApi.updateMyService({
        startingPrice,
        hourlyRate,
        experienceYears,
        serviceArea: rateForm.serviceArea.trim(),
        isAvailable: rateForm.isAvailable
      });

      if (res && res.success) {
        setActionSuccess('Service rates and coverage area updated successfully.');
        setCatalog(prev => ({
          ...prev,
          startingPrice: res.startingPrice,
          hourlyRate: res.hourlyRate,
          experienceYears: res.experienceYears,
          serviceArea: res.serviceArea,
          isAvailable: res.isAvailable
        }));
        if (refreshUser) {
          refreshUser().catch(() => {});
        }
        setTimeout(() => setActionSuccess(''), 4000);
      }
    } catch (err) {
      setActionError(err.message || 'Failed to update service rates.');
    } finally {
      setIsSavingRates(false);
    }
  };

  const providerCity = user?.city || catalog?.city || 'sangli';
  const activeCityMeta = useMemo(() => getCityById(providerCity), [providerCity]);
  const localityOptions = useMemo(() => {
    if (!activeCityMeta?.popularLocalities) return [];
    return activeCityMeta.popularLocalities.map(loc => ({
      id: loc,
      label: loc,
      description: `${activeCityMeta.name} Locality`
    }));
  }, [activeCityMeta]);

  // Suggested discrete repair tasks
  const taskSuggestions = useMemo(() => {
    const commonTasks = [
      'Tap Leakage & Washer Replacement',
      'Geyser Inlet Pipe & Valve Fitting',
      'Kitchen Sink Blockage Removal',
      'Water Tank Cleaning & Overflow Sensor Fix',
      'Ceiling Fan Installation & Regulator Repair',
      'Switchboard Wiring & Short Circuit Fix',
      'AC Filter Cleaning & Gas Charging',
      'Sofa & Upholstery Deep Steam Cleaning',
      'Bathroom Acid Wash & Tile Stain Removal',
      'Door Lock Replacement & Hinge Greasing'
    ];
    return commonTasks.map(t => ({
      id: t,
      label: t,
      description: 'Suggested Task'
    }));
  }, []);

  const servicesList = catalog?.services || [];

  return (
    <DashboardLayout
      title="My Services Catalog"
      subtitle="Customize your specific repair offerings, consultation rates, and service coverage area"
    >
      <div className="provider-my-services-content">

        {/* Global Feedback Notifications */}
        {actionSuccess && (
          <div className="alert-box alert-success" style={{ marginBottom: '1.5rem' }}>
            <CheckCircle2 size={18} />
            <div>{actionSuccess}</div>
          </div>
        )}

        {actionError && (
          <div className="alert-box alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} />
            <div>{actionError}</div>
          </div>
        )}

        {/* Trade Context & Live Overview Card */}
        {catalog && (
          <div className="card" style={{
            padding: '1.5rem',
            marginBottom: '2rem',
            backgroundColor: 'var(--color-bg-page)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem',
            border: '1px solid var(--color-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Primary Trade</span>
                <p style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text-title)', margin: 0 }}>{catalog.category || 'General Services'}</p>
              </div>

              <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Coverage Area</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-body)', margin: 0 }}>{catalog.serviceArea || 'Local City Area'}</p>
              </div>

              <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Base Rates</span>
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-body)', margin: 0 }}>
                  {catalog.startingPrice > 0 ? `₹${catalog.startingPrice} visit` : 'Inspection only'}
                  {catalog.hourlyRate > 0 && ` • ₹${catalog.hourlyRate}/hr`}
                </p>
              </div>

              <div style={{ borderLeft: '1px solid var(--color-border)', paddingLeft: '1.25rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Status</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: catalog.isAvailable ? '#16a34a' : '#94a3b8'
                  }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: catalog.isAvailable ? '#15803d' : '#64748b' }}>
                    {catalog.isAvailable ? 'Available Now' : 'Currently Busy'}
                  </span>
                </div>
              </div>
            </div>

            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Live in MongoDB Atlas
            </span>
          </div>
        )}

        {/* 2-Column Dashboard Sections: Add Service / Rate Configuration */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: '2rem', marginBottom: '2.5rem' }}>
          {/* Left: Add New Service Form */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)', marginBottom: '0.35rem' }}>
              Add a Service Offering
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Add discrete repair or maintenance tasks you perform (e.g. "Bathroom Leakage Fix", "Ceiling Fan Installation").
            </p>

            <form onSubmit={handleAddService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Autocomplete
                id="add-service-input"
                name="newServiceName"
                value={newServiceName}
                onChange={setNewServiceName}
                onSelect={(opt) => setNewServiceName(opt ? (opt.label || opt.id) : '')}
                options={taskSuggestions}
                placeholder="e.g. Geyser Installation & Testing"
                icon={<Wrench size={18} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />}
                disabled={isSubmitting}
                allowCustom={true}
                clearable={true}
                emptyMessage="Type any custom repair task name."
              />

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !newServiceName.trim()}
                id="add-service-submit-btn"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Adding to Catalog...
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Add to Catalog
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Right: Service Rates & Coverage Configuration Panel */}
          <div className="card" style={{ padding: '1.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-text-title)', marginBottom: '0.35rem' }}>
              Service Rates & Availability
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Set your consultation pricing and coverage area shown to customers.
            </p>

            <form onSubmit={handleSaveRates} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-body)', display: 'block', marginBottom: '0.25rem' }}>
                    Visit Charge (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={rateForm.startingPrice}
                    onChange={(e) => setRateForm({ ...rateForm, startingPrice: e.target.value })}
                    placeholder="299"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-body)', display: 'block', marginBottom: '0.25rem' }}>
                    Hourly Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={rateForm.hourlyRate}
                    onChange={(e) => setRateForm({ ...rateForm, hourlyRate: e.target.value })}
                    placeholder="350"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-body)', display: 'block', marginBottom: '0.25rem' }}>
                  Coverage Area (Neighborhoods / Localities)
                </label>
                <Autocomplete
                  id="service-coverage-area-input"
                  name="serviceArea"
                  value={rateForm.serviceArea}
                  onChange={(val) => setRateForm(prev => ({ ...prev, serviceArea: val }))}
                  onSelect={(opt) => setRateForm(prev => ({ ...prev, serviceArea: opt ? (opt.label || opt.id) : '' }))}
                  options={localityOptions}
                  placeholder={activeCityMeta ? `e.g. ${activeCityMeta.popularLocalities.slice(0, 3).join(', ')}` : 'Enter neighborhoods or localities'}
                  allowCustom={true}
                  clearable={true}
                  emptyMessage={activeCityMeta ? `No known localities for ${activeCityMeta.name}. You can type any locality manually.` : 'Select operating city.'}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-title)' }}>
                  Availability Status
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rateForm.isAvailable}
                    onChange={(e) => setRateForm({ ...rateForm, isAvailable: e.target.checked })}
                    style={{ accentColor: 'var(--primary-600)', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: rateForm.isAvailable ? '#15803d' : '#64748b' }}>
                    {rateForm.isAvailable ? 'Available Now' : 'Currently Busy'}
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={isSavingRates}
                style={{ marginTop: '0.25rem' }}
              >
                {isSavingRates ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Updating Rates...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save Service Rates & Coverage
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Current Services Offerings List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--color-text-title)', margin: 0 }}>
              Active Service Offerings ({servicesList.length})
            </h2>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Click edit to modify a task or remove to unlist
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary-600)', margin: '0 auto 0.75rem' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>Loading your service offerings...</p>
            </div>
          ) : error ? (
            <div className="alert-box alert-error">
              <AlertCircle size={20} />
              <div>{error}</div>
            </div>
          ) : servicesList.length > 0 ? (
            <div className="grid-2" style={{ gap: '1rem' }}>
              {servicesList.map((service, index) => {
                const isEditingThis = editingService === service;

                return (
                  <div
                    key={index}
                    className="card"
                    style={{
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      flexDirection: isEditingThis ? 'column' : 'row',
                      alignItems: isEditingThis ? 'stretch' : 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      backgroundColor: '#ffffff',
                      border: isEditingThis ? '2px solid var(--primary-600)' : '1px solid var(--color-border)',
                      boxShadow: 'var(--shadow-xs)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isEditingThis ? (
                      /* Inline Editing View */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          Edit Service Name:
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            disabled={isUpdatingService}
                            style={{
                              flex: 1,
                              padding: '0.6rem 0.8rem',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              fontSize: '0.92rem'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(service)}
                            disabled={isUpdatingService || !editedName.trim()}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Save size={14} />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isUpdatingService}
                            className="btn btn-outline btn-sm"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Display View */
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'var(--primary-100)',
                            color: 'var(--primary-700)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Wrench size={16} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '1rem', color: 'var(--color-text-title)', fontWeight: 600, margin: 0 }}>
                              {service}
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              Active under {catalog?.category || 'General Services'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(service)}
                            title={`Edit ${service}`}
                            className="btn btn-outline btn-sm"
                            style={{
                              padding: '0.4rem 0.65rem',
                              fontSize: '0.8rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <Edit3 size={14} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteService(service)}
                            title={`Remove ${service}`}
                            style={{
                              background: 'transparent',
                              border: '1px solid #fee2e2',
                              color: '#dc2626',
                              padding: '0.4rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontSize: '0.8rem'
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No services added yet"
              message="Add your first service offering above to display it to prospective customers in your city."
              actionText="Add Sample Service"
              onAction={() => setNewServiceName('General Inspection & Diagnosis')}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
