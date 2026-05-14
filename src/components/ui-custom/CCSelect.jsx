import React from 'react';
import { cn } from '@/lib/utils';
import BottomSheetSelect from './BottomSheetSelect';

/**
 * CCSelect — wraps BottomSheetSelect for native-like mobile UX.
 * Accepts the same props as before (value, onChange with e.target.value interface)
 * plus direct onChange(value) via BottomSheetSelect.
 */
export default function CCSelect({
  label,
  error,
  hint,
  options = [],
  placeholder = 'Select an option',
  className,
  required,
  disabled,
  value,
  onChange,
}) {
  // Support both onChange(e) and onChange(value) call signatures
  const handleChange = (val) => {
    if (typeof onChange === 'function') {
      // Simulate event-like object for backwards compat
      onChange({ target: { value: val } });
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>
          {label}
          {required && <span className="ml-1" style={{ color: 'var(--cc-pink)' }}>*</span>}
        </label>
      )}
      <BottomSheetSelect
        value={value}
        onChange={handleChange}
        options={options}
        placeholder={placeholder}
        className={cn(
          'min-h-[44px]',
          disabled && 'opacity-50 pointer-events-none',
          error && 'border-[#EF4444]'
        )}
      />
      {hint && !error && <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{hint}</p>}
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  );
}