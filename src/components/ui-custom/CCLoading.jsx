import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function CCLoading({ size = 'md', className }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <motion.div
        className={cn(
          'rounded-full border-2 border-[#263248] border-t-[#4F8CFF]',
          sizes[size]
        )}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

export function CCLoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <CCLoading size="lg" className="mb-4" />
        <p className="text-[#9AA6BC] text-sm">{message}</p>
      </motion.div>
    </div>
  );
}

export function CCSkeletonLoader({ className, ...props }) {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={cn('bg-[#263248] rounded-lg', className)}
      {...props}
    />
  );
}

export function CCProfileCardSkeleton() {
  return (
    <div className="bg-[#151D2B] border border-[#263248] rounded-xl p-4 space-y-3">
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