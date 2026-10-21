import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Wrench, 
  Zap, 
  Sparkles, 
  Cpu, 
  Hammer, 
  Car, 
  Compass, 
  Paintbrush, 
  Home, 
  ChevronRight,
  CheckCircle2
} from 'lucide-react';

// Icon Map with robust fallbacks
const ICON_MAP = {
  Wrench,
  Zap,
  Sparkles,
  Cpu,
  Hammer,
  Car,
  Compass,
  Paintbrush,
  Home
};

// Trade-specific gradient accents for rich aesthetic appeal
const CATEGORY_THEMES = {
  'plumbing': {
    bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
    color: '#0369a1',
    border: '#7dd3fc'
  },
  'electrical-services': {
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    color: '#b45309',
    border: '#fcd34d'
  },
  'carpentry': {
    bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
    color: '#c2410c',
    border: '#fdba74'
  },
  'home-cleaning': {
    bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    color: '#15803d',
    border: '#86efac'
  },
  'appliance-repair': {
    bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    color: '#6d28d9',
    border: '#c4b5fd'
  },
  'vehicle-mechanic': {
    bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
    color: '#b91c1c',
    border: '#fca5a5'
  },
  'driver-services': {
    bg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
    color: '#4338ca',
    border: '#a5b4fc'
  },
  'painting': {
    bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
    color: '#be185d',
    border: '#f9a8d4'
  },
  'other-home-services': {
    bg: 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 100%)',
    color: '#0f766e',
    border: '#5eead4'
  }
};

/**
 * Service Category Card
 * Displays category name, local vector illustration, short description,
 * starting price, and interactive category selection.
 */
export default function ServiceCard({ category, isSelected = false, onSelect }) {
  const IconComponent = ICON_MAP[category.icon] || Wrench;
  const slug = category.slug || category.id;
  const theme = CATEGORY_THEMES[slug] || {
    bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    color: 'var(--primary-700)',
    border: 'var(--color-border)'
  };

  const cardStyle = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '1.25rem',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: isSelected ? 'var(--primary-50)' : 'var(--color-bg-card)',
    border: `2px solid ${isSelected ? 'var(--primary-600)' : 'var(--color-border)'}`,
    boxShadow: isSelected ? '0 4px 14px rgba(22, 163, 74, 0.18)' : 'var(--shadow-card)',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    textAlign: 'left',
    textDecoration: 'none',
    color: 'inherit',
    height: '100%'
  };

  const innerContent = (
    <>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          {/* Vector Icon Container with Theme Gradient */}
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: 'var(--radius-md)',
            background: theme.bg,
            border: `1px solid ${theme.border}`,
            color: theme.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <IconComponent size={22} />
          </div>

          {/* Active / Selection Badge */}
          {isSelected ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--primary-600)',
              color: '#ffffff'
            }}>
              <CheckCircle2 size={12} /> Selected
            </span>
          ) : (
            <span style={{
              fontSize: 'var(--font-size-xs, 0.76rem)',
              fontWeight: 600,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-bg-subtle)',
              color: 'var(--color-text-muted)',
              border: '1px solid var(--color-border)'
            }}>
              Active
            </span>
          )}
        </div>

        <h3 style={{
          fontSize: 'var(--font-size-md, 1.05rem)',
          fontWeight: 700,
          color: isSelected ? 'var(--primary-800)' : 'var(--color-text-title)',
          marginBottom: '0.35rem'
        }}>
          {category.name}
        </h3>

        <p style={{
          fontSize: 'var(--font-size-sm, 0.85rem)',
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
          marginBottom: '1rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {category.description || category.shortDesc}
        </p>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--color-border)',
        fontSize: 'var(--font-size-sm, 0.85rem)'
      }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--color-text-subtle)', display: 'block' }}>Starts from</span>
          <span style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: '1rem' }}>
            ₹{category.startingPrice || 299}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: isSelected ? 'var(--primary-700)' : 'var(--color-text-body)',
          fontWeight: 600,
          fontSize: 'var(--font-size-sm, 0.82rem)'
        }}>
          <span>Explore</span>
          <ChevronRight size={14} />
        </div>
      </div>
    </>
  );

  // If onSelect handler provided, render as accessible button
  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(category.name || category.slug)}
        style={cardStyle}
        className="category-card-button"
        id={`cat-card-${category.id || category.slug}`}
        aria-pressed={isSelected}
      >
        {innerContent}
      </button>
    );
  }

  // Otherwise link to Discover Services filtered by category
  return (
    <Link
      to={`/services?category=${encodeURIComponent(category.slug || category.name)}`}
      style={cardStyle}
      className="category-card-link"
      id={`cat-card-${category.id || category.slug}`}
    >
      {innerContent}
    </Link>
  );
}

/**
 * Loading Skeleton for Category Cards
 */
export function ServiceCardSkeleton() {
  return (
    <div style={{
      padding: '1.25rem',
      borderRadius: 'var(--radius-lg)',
      backgroundColor: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="skeleton-box" style={{ width: '3rem', height: '3rem', borderRadius: 'var(--radius-md)' }} />
        <div className="skeleton-box" style={{ width: '3rem', height: '1.2rem', borderRadius: 'var(--radius-full)' }} />
      </div>
      <div className="skeleton-box" style={{ width: '70%', height: '1.1rem' }} />
      <div className="skeleton-box" style={{ width: '90%', height: '0.85rem' }} />
      <div className="skeleton-box" style={{ width: '100%', height: '1.5rem', marginTop: '0.5rem' }} />
    </div>
  );
}
