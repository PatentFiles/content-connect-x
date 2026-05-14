import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-[var(--cc-blue)] hover:opacity-90 text-white shadow-md',
  accent: 'bg-[var(--cc-pink)] hover:opacity-90 text-white shadow-md',
  outline: 'border border-[var(--cc-border)] bg-transparent hover:bg-[var(--cc-surface-hover)] text-[var(--cc-text-primary)]',
  ghost: 'bg-transparent hover:bg-[var(--cc-surface-hover)] text-[var(--cc-text-secondary)] hover:text-[var(--cc-text-primary)]',
  success: 'bg-[#22C55E] hover:bg-[#1EA550] text-white',
  danger: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
  warning: 'bg-[#F59E0B] hover:bg-[#D97706] text-white',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  xl: 'px-8 py-4 text-lg',
  icon: 'p-2',
};

export default function CCButton({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  className,
  onClick,
  type = 'button',
  ...props
}) {
  return (
    <motion.button
      type={type}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      onClick={onClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cc-bg)]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="w-4 h-4" aria-hidden="true" />
      ) : null}
      {children}
      {IconRight && !loading && <IconRight className="w-4 h-4" aria-hidden="true" />}
    </motion.button>
  );
}