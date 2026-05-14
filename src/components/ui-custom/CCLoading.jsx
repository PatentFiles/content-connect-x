import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function CCLoading({ size = 'md', className, label = 'Loading…' }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex items-center justify-center', className)}
    >
      <motion.div
        className={cn(
          'rounded-full border-2 border-[var(--cc-border)] border-t-[var(--cc-blue)]',
          sizes[size]
        )}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function CCLoadingScreen({ message = 'Loading…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--cc-bg)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <CCLoading size="lg" className="mb-4" label={message} />
        <p className="text-sm" style={{ color: 'var(--cc-text-secondary)' }} aria-hidden="true">{message}</p>
      </motion.div>
    </div>
  );
}

export function CCSkeletonLoader({ className, ...props }) {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={cn('rounded-lg', className)}
      style={{ backgroundColor: 'var(--cc-border)' }}
      aria-hidden="true"
      {...props}
    />
  );
}

export function CCProfileCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{ backgroundColor: 'var(--cc-surface)', borderColor: 'var(--cc-border)' }}>
      <div className="flex items-center gap-3">
        <CCSkeletonLoader className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <CCSkeletonLoader className="h-4 w-24" />
          <CCSkeletonLoader className="h-3 w-16" />
        </div>
      </div>
      <CCSkeletonLoader className="h-20 w-full" />
      <div className="flex gap-2">
        <CCSkeletonLoader className="h-6 w-16 rounded-full" />
        <CCSkeletonLoader className="h-6 w-16 rounded-full" />
        <CCSkeletonLoader className="h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}