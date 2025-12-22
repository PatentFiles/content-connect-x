import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const CCInput = forwardRef(({
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
  ...props
}, ref) => {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-[#E8EEF9]">
          {label}
          {required && <span className="text-[#FF2DAA] ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A94]">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={cn(
            'w-full bg-[#121824] border border-[#263248] rounded-lg',
            'text-[#E8EEF9] placeholder-[#6B7A94]',
            'focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            Icon ? 'pl-10' : 'pl-4',
            IconRight ? 'pr-10' : 'pr-4',
            'py-2.5 text-sm',
            error && 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/50',
            inputClassName
          )}
          {...props}
        />
        {IconRight && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7A94]">
            <IconRight className="w-4 h-4" />
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="text-xs text-[#6B7A94]">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-[#EF4444]">{error}</p>
      )}
    </div>
  );
});

CCInput.displayName = 'CCInput';

export default CCInput;