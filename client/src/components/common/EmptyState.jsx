import React from 'react';
import { SearchX } from 'lucide-react';
import Button from './Button';

/**
 * Empty State Component
 * Displayed when filters yield zero results or lists are empty
 * 
 * @param {string} title - Heading for empty state
 * @param {string} message - Explanatory message
 * @param {string} actionText - Optional call to action button label
 * @param {Function} onAction - Optional action handler
 * @param {string} actionTo - Optional navigation route
 * @param {string} actionVariant - 'primary' | 'secondary' | 'outline'
 * @param {React.ComponentType} icon - Lucide icon component
 */
export default function EmptyState({
  title = "No Results Found",
  message = "We couldn't find any services matching your criteria. Try adjusting your filters or search keywords.",
  actionText,
  onAction,
  actionTo,
  actionVariant = 'secondary',
  icon: Icon = SearchX
}) {
  return (
    <div className="empty-state-box fade-in">
      <div className="empty-state-icon">
        <Icon size={26} aria-hidden="true" />
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.25rem 0 0 0', color: 'var(--color-text-title)' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '440px', fontSize: '0.925rem', lineHeight: 1.55, margin: 0 }}>
        {message}
      </p>
      {actionText && (onAction || actionTo) && (
        <div style={{ marginTop: '0.5rem' }}>
          <Button 
            variant={actionVariant} 
            size="sm" 
            onClick={onAction}
            to={actionTo}
          >
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
