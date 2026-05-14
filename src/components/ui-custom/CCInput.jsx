import React, { useId } from 'react';
import { cn } from '@/lib/utils';

function CCInput({
  label,
  error,
  hint,
  icon: Icon,
  iconRight: IconRight,
  className,
  inputClassName,
  required,
  disabled,
  type = 'text',
  id: externalId,
  ...props
}) {
  const generatedId = useId();
  const inputId = externalId ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  // Build aria-describedby from whichever descriptors are present
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--cc-text-primary)]"
        >
          {label}
          {required && (
            <span className="text-[var(--cc-pink)] ml-1" aria-hidden="true">*</span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)]" aria-hidden="true">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            'w-full bg-[var(--cc-surface)] border border-[var(--cc-border)] rounded-lg',
            'text-[var(--cc-text-primary)] placeholder:text-[var(--cc-text-muted)]',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-blue)]/60 focus-visible:border-[var(--cc-blue)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            Icon ? 'pl-10' : 'pl-4',
            IconRight ? 'pr-10' : 'pr-4',
            'py-2.5 text-sm',
            error && 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/50',
            inputClassName
          )}
          {...props}
        />
        {IconRight && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-muted)]" aria-hidden="true">
            <IconRight className="w-4 h-4" />
          </div>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--cc-text-muted)]">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

export default CCInput;