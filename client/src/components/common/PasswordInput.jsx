import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Reusable password input with a Show/Hide toggle.
 * Fully integrated with ServeEase theme system, accessible, and responsive.
 * 
 * Props:
 *   - id: Element id linked to <label htmlFor="...">
 *   - name: Form input name (default: 'password')
 *   - value: Controlled value
 *   - onChange: Change handler
 *   - placeholder: Input placeholder (default: '••••••••')
 *   - required: boolean (default: true)
 *   - disabled: boolean (default: false)
 *   - autoComplete: string (e.g. 'current-password', 'new-password')
 *   - className: Additional input class names
 *   - style: Optional inline styles for the wrapper container
 */
export default function PasswordInput({
  id,
  name = 'password',
  value,
  onChange,
  placeholder = '••••••••',
  required = true,
  disabled = false,
  autoComplete = 'current-password',
  className = '',
  style = {},
  ...restProps
}) {
  const [show, setShow] = useState(false);

  const toggle = () => {
    if (!disabled) setShow((prev) => !prev);
  };

  return (
    <div className="password-input-wrapper" style={style}>
      <input
        id={id || name}
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`form-input ${className}`.trim()}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        {...restProps}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className="password-toggle-btn"
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        tabIndex={disabled ? -1 : 0}
      >
        {show ? (
          <EyeOff size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
