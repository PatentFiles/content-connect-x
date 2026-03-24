/**
 * MobileHeader — iOS/Android-style top navigation bar.
 *
 * - Shows only on native / narrow viewports (hidden on md+ desktop)
 * - Reads title + back action from MobileNavContext
 * - On iOS: back chevron + centered title
 * - On Android: back arrow + left-aligned title
 * - On web narrow: same as iOS style
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ArrowLeft } from 'lucide-react';
import { useMobileNav } from '@/lib/MobileNavContext';
import { usePlatform } from '@/lib/usePlatform';
import { cn } from '@/lib/utils';

export default function MobileHeader({ className }) {
  const { title, backAction, rightAction } = useMobileNav();
  const { isAndroid } = usePlatform();

  // Don't render if there's nothing to show
  if (!title && !backAction) return null;

  const BackIcon = isAndroid ? ArrowLeft : ChevronLeft;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'md:hidden fixed z-30 left-0 right-0 flex items-center justify-between px-2',
        'bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]',
        'h-11',
        className
      )}
      style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
    >
      {/* Back button */}
      <div className="w-20 flex items-center">
        {backAction && (
          <button
            onClick={backAction}
            className="flex items-center gap-0.5 text-[#4F8CFF] min-h-[44px] min-w-[44px] -ml-1"
            aria-label="Go back"
          >
            <BackIcon className="w-5 h-5" />
            {!isAndroid && (
              <span className="text-sm font-medium">Back</span>
            )}
          </button>
        )}
      </div>

      {/* Title — centered on iOS, left on Android */}
      <h1 className={cn(
        'text-base font-semibold text-[#E8EEF9] truncate',
        isAndroid ? 'flex-1 text-left ml-1' : 'absolute left-1/2 -translate-x-1/2 max-w-[55%] text-center'
      )}>
        {title}
      </h1>

      {/* Right action */}
      <div className="w-20 flex justify-end">
        {rightAction && (
          <button
            onClick={rightAction.onPress}
            className="text-[#4F8CFF] text-sm font-medium min-h-[44px] flex items-center"
            aria-label={rightAction.label}
          >
            {rightAction.icon
              ? <rightAction.icon className="w-5 h-5" />
              : rightAction.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}