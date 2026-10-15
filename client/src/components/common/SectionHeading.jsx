import React from 'react';

/**
 * Section Heading Component
 * Standardized typography layout for section titles and subtitles
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  centered = true,
  className = ''
}) {
  return (
    <div className={`section-heading-wrap ${centered ? 'centered' : ''} ${className}`}>
      {eyebrow && (
        <div className="section-eyebrow">
          <span>{eyebrow}</span>
        </div>
      )}
      {title && <h2 className="section-main-title">{title}</h2>}
      {subtitle && <p className="section-subtitle">{subtitle}</p>}
    </div>
  );
}
