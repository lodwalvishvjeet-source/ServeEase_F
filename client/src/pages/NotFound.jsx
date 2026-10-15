import React from 'react';
import { Compass, Home, ArrowLeft } from 'lucide-react';
import Button from '../components/common/Button';

/**
 * 404 Not Found Page
 */
export default function NotFound() {
  return (
    <div className="section-spacing container" style={{ textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        width: '5rem',
        height: '5rem',
        borderRadius: '50%',
        backgroundColor: 'var(--primary-50)',
        color: 'var(--primary-600)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.5rem'
      }}>
        <Compass size={36} />
      </div>

      <span className="badge badge-prototype" style={{ marginBottom: '0.75rem' }}>Error 404</span>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Page Not Found</h1>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '480px', marginBottom: '2rem', fontSize: '1rem' }}>
        The page you are looking for might have been moved, removed, or does not exist on this ServeEase prototype.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button to="/" variant="primary">
          <Home size={16} /> Return to Home
        </Button>
        <Button to="/services" variant="outline">
          <ArrowLeft size={16} /> Browse Services Catalog
        </Button>
      </div>
    </div>
  );
}
