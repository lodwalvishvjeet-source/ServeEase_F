import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Button Component
 * Supports standard button actions, loading indicators, or react-router Link navigation
 * 
 * @param {string} variant - 'primary' | 'secondary' | 'outline' | 'white' | 'danger'
 * @param {string} size - 'xs' | 'sm' | 'md' | 'lg'
 * @param {boolean} block - full width button
 * @param {boolean} loading - displays inline spinner and disables interaction
 * @param {string} to - if provided, renders as a Link component
 * @param {boolean} disabled - disabled state
 * @param {React.ReactNode} children - button label and icons
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  to,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  const sizeClass = 
    size === 'xs' ? 'btn-xs' : 
    size === 'sm' ? 'btn-sm' : 
    size === 'lg' ? 'btn-lg' : '';

  const variantClass = `btn-${variant}`;
  const blockClass = block ? 'btn-block' : '';
  const isDisabled = disabled || loading;
  const disabledClass = isDisabled ? 'btn-disabled' : '';

  const classes = `btn ${variantClass} ${sizeClass} ${blockClass} ${disabledClass} ${className}`.trim();

  const spinnerSize = size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'lg' ? 18 : 16;

  if (to && !isDisabled) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : undefined}
      {...props}
    >
      {loading && <Loader2 size={spinnerSize} className="btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
