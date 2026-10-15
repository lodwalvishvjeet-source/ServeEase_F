import React from 'react';
import { SearchX } from 'lucide-react';
import Button from './Button';

/**
 * Empty State Component
 * Displayed when filters yield zero results or lists are empty
 */
export default function EmptyState({
  title = "No Results Found",
  message = "We couldn't find any services matching your criteria. Try adjusting your filters or search keywords.",
  actionText,
  onAction,
  icon: Icon = SearchX
}) {
  return (
    <div className="empty-state-box">
      <div className="empty-state-icon">
        <Icon size={28} />
      </div>
      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{title}</h3>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '440px', fontSize: '0.92rem' }}>
        {message}
      </p>
      {actionText && onAction && (
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
