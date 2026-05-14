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
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={cn(
        'rounded-xl transition-all duration-200',
        'border',
        hover && 'cursor-pointer',
        clickable && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-blue)]',
        paddings[padding],
        className
      )}
      style={{
        backgroundColor: 'var(--cc-surface)',
        borderColor: 'var(--cc-border)',
      }}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CCCardHeader({ children, className }) {
  return (
    <div className={cn('border-b pb-4 mb-4', className)} style={{ borderColor: 'var(--cc-border)' }}>
      {children}
    </div>
  );
}

export function CCCardTitle({ children, className }) {
  return (
    <h3 className={cn('text-lg font-semibold', className)} style={{ color: 'var(--cc-text-primary)' }}>
      {children}
    </h3>
  );
}

export function CCCardDescription({ children, className }) {
  return (
    <p className={cn('text-sm mt-1', className)} style={{ color: 'var(--cc-text-secondary)' }}>
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
    <div className={cn('border-t pt-4 mt-4', className)} style={{ borderColor: 'var(--cc-border)' }}>
      {children}
    </div>
  );
}