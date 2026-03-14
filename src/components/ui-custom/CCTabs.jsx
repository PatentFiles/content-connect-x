import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export function CCTabs({ children, className }) {
  return (
    <div className={cn('space-y-4', className)}>
      {children}
    </div>
  );
}

export function CCTabsList({ tabs, activeTab, onChange, className, children }) {
  // If children are provided, render them directly (old API)
  if (children) {
    return (
      <div className={cn(
        'flex gap-1 p-1 bg-[#121824] rounded-lg border border-[#263248]',
        className
      )}>
        {children}
      </div>
    );
  }

  // Otherwise use tabs array (new API)
  return (
    <div className={cn(
      'flex gap-1 p-1 bg-[#121824] rounded-lg border border-[#263248]',
      className
    )}>
      {(tabs || []).map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'relative flex-1 min-w-0 px-2 py-2 text-xs md:text-sm font-medium rounded-md transition-colors',
            activeTab === tab.value
              ? 'text-[#E8EEF9]'
              : 'text-[#6B7A94] hover:text-[#9AA6BC]'
          )}
        >
          {activeTab === tab.value && (
            <motion.div
              layoutId={`activeTab-${tab.value}`}
              className="absolute inset-0 bg-[#151D2B] rounded-md"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            />
          )}
          <span className="relative z-10 flex items-center justify-center gap-1 truncate">
            {tab.icon && <tab.icon className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />}
            <span className="truncate">{tab.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function CCTabsContent({ value, activeTab, children, className }) {
  if (value !== activeTab) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}