import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable Button Component
 * Supports standard button actions or react-router Link navigation
 * 
 * @param {string} variant - 'primary' | 'secondary' | 'outline' | 'white'
 * @param {string} size - 'sm' | 'md' | 'lg'
 * @param {boolean} block - full width button
 * @param {string} to - if provided, renders as a Link component
 * @param {boolean} disabled - disabled state
 * @param {React.ReactNode} children - button label and icons
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  to,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  const variantClass = `btn-${variant}`;
  const blockClass = block ? 'btn-block' : '';
  const disabledClass = disabled ? 'btn-disabled' : '';

  const classes = `btn ${variantClass} ${sizeClass} ${blockClass} ${disabledClass} ${className}`.trim();

  if (to && !disabled) {
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
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
