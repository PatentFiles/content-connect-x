import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

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
  ...props
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-[#E8EEF9]">
          {label}
          {required && <span className="text-[#FF2DAA] ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            'w-full bg-[#121824] border border-[#263248] rounded-lg appearance-none',
            'text-[#E8EEF9] placeholder-[#6B7A94]',
            'focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            'pl-4 pr-10 py-2.5 text-sm',
            error && 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/50',
            !value && 'text-[#6B7A94]'
          )}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {(options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94] pointer-events-none" />
      </div>
      {hint && !error && (
        <p className="text-xs text-[#6B7A94]">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[#EF4444]">{error}</p>
      )}
    </div>
  );
}