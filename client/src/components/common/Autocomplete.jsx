import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

/**
 * Accessible & Polished Autocomplete / Combobox Component
 * 
 * Supports:
 * - Real-time client or asynchronous list filtering
 * - Debounced input handling
 * - Full keyboard navigation (ArrowDown, ArrowUp, Enter to select, Escape to close)
 * - Clear empty states
 * - Manual-entry fallback (typing custom values without forced selection)
 * - Light and Dark theme responsiveness
 */
export default function Autocomplete({
  options = [],
  value = '',
  onChange,
  onSelect,
  placeholder = 'Type to search...',
  label,
  id,
  name,
  icon,
  disabled = false,
  required = false,
  allowCustom = true,
  filterFunction,
  renderOption,
  emptyMessage = 'No matching options found',
  clearable = true,
  className = '',
  inputStyle = {},
  style = {},
  showOnFocus = true,
  autoComplete = 'off',
  debounceMs = 0
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalValue, setInternalValue] = useState(value || '');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync internal input value with external value
  useEffect(() => {
    setInternalValue(value || '');
  }, [value]);

  // Normalize options to { id, label, raw }
  const normalizedOptions = useMemo(() => {
    return options.map((opt, index) => {
      if (typeof opt === 'string') {
        return { id: opt, label: opt, raw: opt };
      }
      return {
        id: opt.id || opt.value || opt.label || String(index),
        label: opt.name || opt.label || opt.title || String(opt),
        description: opt.description || opt.shortDesc || '',
        category: opt.category || '',
        icon: opt.icon || null,
        raw: opt
      };
    });
  }, [options]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const query = (internalValue || '').trim().toLowerCase();
    if (!query) {
      return showOnFocus ? normalizedOptions.slice(0, 20) : [];
    }

    if (filterFunction) {
      return normalizedOptions.filter(opt => filterFunction(opt.raw, query));
    }

    return normalizedOptions.filter(opt => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchDesc = opt.description ? opt.description.toLowerCase().includes(query) : false;
      const matchCat = opt.category ? opt.category.toLowerCase().includes(query) : false;
      return matchLabel || matchDesc || matchCat;
    });
  }, [normalizedOptions, internalValue, filterFunction, showOnFocus]);

  // Handle outside clicks to close the dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.autocomplete-item');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e) => {
    const nextVal = e.target.value;
    setInternalValue(nextVal);
    setIsOpen(true);
    setHighlightedIndex(-1);

    if (debounceMs > 0) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (onChange) onChange(nextVal);
      }, debounceMs);
    } else {
      if (onChange) onChange(nextVal);
    }
  };

  const handleSelectOption = useCallback((option) => {
    setInternalValue(option.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (onChange) onChange(option.label);
    if (onSelect) onSelect(option.raw || option);
  }, [onChange, onSelect]);

  const handleClear = (e) => {
    e.stopPropagation();
    setInternalValue('');
    if (onChange) onChange('');
    if (onSelect) onSelect(null);
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
      } else {
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelectOption(filteredOptions[highlightedIndex]);
      } else if (!allowCustom && isOpen && filteredOptions.length > 0) {
        e.preventDefault();
        handleSelectOption(filteredOptions[0]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  const inputId = id || (name ? `autocomplete-${name}` : undefined);

  return (
    <div
      ref={containerRef}
      className={`autocomplete-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      {label && (
        <label
          htmlFor={inputId}
          className="form-label"
          style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600, color: 'var(--color-text-title)' }}
        >
          {label} {required && <span style={{ color: 'var(--color-danger)' }}>*</span>}
        </label>
      )}

      <div
        className="autocomplete-input-wrapper"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%'
        }}
      >
        {icon && (
          <div
            className="autocomplete-leading-icon"
            style={{
              position: 'absolute',
              left: '12px',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: 'var(--color-text-muted)',
              zIndex: 1
            }}
          >
            {icon}
          </div>
        )}

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          value={internalValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled && (showOnFocus || internalValue.trim())) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? `${inputId}-listbox` : undefined}
          aria-activedescendant={
            highlightedIndex >= 0 && filteredOptions[highlightedIndex]
              ? `${inputId}-option-${filteredOptions[highlightedIndex].id}`
              : undefined
          }
          className="form-input autocomplete-input"
          style={{
            width: '100%',
            paddingLeft: icon ? '2.5rem' : '1rem',
            paddingRight: clearable && internalValue ? '4.5rem' : '2.5rem',
            backgroundColor: 'var(--color-bg-card)',
            color: 'var(--color-text-title)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.92rem',
            transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            ...inputStyle
          }}
        />

        <div
          className="autocomplete-trailing-actions"
          style={{
            position: 'absolute',
            right: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px'
          }}
        >
          {clearable && internalValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              tabIndex={-1}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                borderRadius: 'var(--radius-full)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Clear"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (!disabled) {
                setIsOpen(prev => !prev);
                if (!isOpen && inputRef.current) inputRef.current.focus();
              }
            }}
            tabIndex={-1}
            aria-label="Toggle options"
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--transition-fast)'
            }}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown Listbox */}
      {isOpen && !disabled && (
        <ul
          ref={listRef}
          id={`${inputId}-listbox`}
          role="listbox"
          className="autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '260px',
            overflowY: 'auto',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            padding: '4px 0',
            listStyle: 'none',
            margin: 0
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = option.label.toLowerCase() === (internalValue || '').trim().toLowerCase();
              const isHighlighted = index === highlightedIndex;

              return (
                <li
                  key={option.id || index}
                  id={`${inputId}-option-${option.id}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelectOption(option)}
                  className={`autocomplete-item ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '0.9rem',
                    backgroundColor: isHighlighted
                      ? 'var(--color-bg-subtle)'
                      : isSelected
                        ? 'var(--primary-50)'
                        : 'transparent',
                    color: isHighlighted || isSelected
                      ? 'var(--primary-700)'
                      : 'var(--color-text-title)',
                    transition: 'background-color 100ms ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    {option.icon && (
                      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--primary-600)' }}>
                        {option.icon}
                      </span>
                    )}
                    {renderOption ? (
                      renderOption(option.raw, { isSelected, isHighlighted })
                    ) : (
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: isSelected ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {option.label}
                        </div>
                        {option.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {option.description}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <Check size={15} style={{ color: 'var(--primary-600)', flexShrink: 0 }} />
                  )}
                </li>
              );
            })
          ) : (
            <li
              style={{
                padding: '12px 16px',
                fontSize: '0.88rem',
                color: 'var(--color-text-muted)',
                textAlign: 'center'
              }}
            >
              <div>{emptyMessage}</div>
              {allowCustom && internalValue.trim() && (
                <div style={{ fontSize: '0.78rem', color: 'var(--primary-600)', marginTop: '4px' }}>
                  Press Enter to use "{internalValue}"
                </div>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
