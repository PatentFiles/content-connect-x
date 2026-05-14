import React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-[var(--cc-border)] text-[var(--cc-text-primary)]',
  primary: 'bg-[var(--cc-blue)]/20 text-[var(--cc-blue)] border border-[var(--cc-blue)]/30',
  accent: 'bg-[var(--cc-pink)]/20 text-[var(--cc-pink)] border border-[var(--cc-pink)]/30',
  success: 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30',
  warning: 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30',
  danger: 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30',
  outline: 'bg-transparent border border-[var(--cc-border)] text-[var(--cc-text-secondary)]',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

export default function CCBadge({
  children,
  variant = 'default',
  size = 'md',
  icon: Icon,
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}