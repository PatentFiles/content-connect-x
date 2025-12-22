import React from 'react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-[#263248] text-[#E8EEF9]',
  primary: 'bg-[#4F8CFF]/20 text-[#4F8CFF] border border-[#4F8CFF]/30',
  accent: 'bg-[#FF2DAA]/20 text-[#FF2DAA] border border-[#FF2DAA]/30',
  success: 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30',
  warning: 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30',
  danger: 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30',
  outline: 'bg-transparent border border-[#263248] text-[#9AA6BC]',
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