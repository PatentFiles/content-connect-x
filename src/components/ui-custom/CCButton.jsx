import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  primary: 'bg-[#4F8CFF] hover:bg-[#3A7AEE] text-white shadow-lg hover:shadow-[0_0_20px_rgba(79,140,255,0.3)]',
  accent: 'bg-[#FF2DAA] hover:bg-[#E6229A] text-white shadow-lg hover:shadow-[0_0_20px_rgba(255,45,170,0.3)]',
  outline: 'border border-[#263248] bg-transparent hover:bg-[#151D2B] text-[#E8EEF9]',
  ghost: 'bg-transparent hover:bg-[#151D2B] text-[#9AA6BC] hover:text-[#E8EEF9]',
  success: 'bg-[#22C55E] hover:bg-[#1EA550] text-white',
  danger: 'bg-[#EF4444] hover:bg-[#DC2626] text-white',
  warning: 'bg-[#F59E0B] hover:bg-[#D97706] text-black',
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
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:ring-offset-2 focus:ring-offset-[#0B0F14]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
      {IconRight && !loading && <IconRight className="w-4 h-4" />}
    </motion.button>
  );
}