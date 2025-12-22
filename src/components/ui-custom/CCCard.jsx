import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function CCCard({
  children,
  className,
  hover = false,
  clickable = false,
  padding = 'md',
  onClick,
  ...props
}) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  const Component = clickable ? motion.div : 'div';
  const motionProps = clickable ? {
    whileHover: { scale: 1.01, y: -2 },
    whileTap: { scale: 0.99 },
    transition: { duration: 0.15 },
  } : {};

  return (
    <Component
      onClick={onClick}
      className={cn(
        'bg-[#151D2B] border border-[#263248] rounded-xl',
        'transition-all duration-200',
        hover && 'hover:bg-[#1A2438] hover:border-[#3A4A6B]',
        clickable && 'cursor-pointer',
        paddings[padding],
        className
      )}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CCCardHeader({ children, className }) {
  return (
    <div className={cn('border-b border-[#263248] pb-4 mb-4', className)}>
      {children}
    </div>
  );
}

export function CCCardTitle({ children, className }) {
  return (
    <h3 className={cn('text-lg font-semibold text-[#E8EEF9]', className)}>
      {children}
    </h3>
  );
}

export function CCCardDescription({ children, className }) {
  return (
    <p className={cn('text-sm text-[#9AA6BC] mt-1', className)}>
      {children}
    </p>
  );
}

export function CCCardContent({ children, className }) {
  return (
    <div className={cn('', className)}>
      {children}
    </div>
  );
}

export function CCCardFooter({ children, className }) {
  return (
    <div className={cn('border-t border-[#263248] pt-4 mt-4', className)}>
      {children}
    </div>
  );
}