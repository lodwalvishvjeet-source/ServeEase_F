import React from 'react';
import { Sparkles, X, Info } from 'lucide-react';
import Button from './Button';

/**
 * Feature Notice Modal Component
 */
export default function PhaseNoticeModal({
  isOpen,
  onClose,
  title = "Platform Feature Notice",
  featureName = "This feature",
  description = "Thank you for using ServeEase! This action has been recorded successfully."
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-50)',
              color: 'var(--primary-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <span className="badge badge-primary" style={{ marginBottom: '0.2rem' }}>ServeEase Notice</span>
              <h3 style={{ fontSize: '1.2rem', margin: 0 }}>{title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{ color: 'var(--color-text-subtle)', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="alert-box alert-info" style={{ marginBottom: '1.25rem' }}>
          <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Service Notice:</strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
              {featureName} is an active feature of the ServeEase platform.
            </p>
          </div>
        </div>

        <p style={{ color: 'var(--color-text-body)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {description}
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <Button variant="primary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
