import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/**
 * Accessible Theme Toggle Button
 * Smoothly toggles between light and dark modes with clear tooltips and keyboard support
 */
export default function ThemeToggle({ className = '', style = {}, size = 'md' }) {
  const { theme, toggleTheme, isDark } = useTheme();

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode (currently ${theme})`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size === 'sm' ? '32px' : '38px',
        height: size === 'sm' ? '32px' : '38px',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-subtle)',
        color: isDark ? '#fbbf24' : 'var(--color-text-body)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        ...style
      }}
    >
      {isDark ? (
        <Sun size={iconSize} className="theme-toggle-icon sun-icon" />
      ) : (
        <Moon size={iconSize} className="theme-toggle-icon moon-icon" />
      )}
    </button>
  );
}
