import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Simple inline tooltip with hover/focus reveal.
 * Usage: <CCTooltip text="This is why we ask for X" />
 *        or wrap any trigger: <CCTooltip text="..." trigger={<span>?</span>} />
 */
export default function CCTooltip({ text, children, className, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  const posClasses = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children || (
        <button
          type="button"
          tabIndex={0}
          className="text-[#6B7A94] hover:text-[#4F8CFF] transition-colors focus:outline-none"
          aria-label="Help"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            'absolute z-50 w-56 px-3 py-2 text-xs text-[#E8EEF9] bg-[#1A2438] border border-[#263248] rounded-lg shadow-xl pointer-events-none',
            posClasses[position]
          )}
        >
          {text}
          {/* arrow */}
          <span className={cn(
            'absolute w-2 h-2 bg-[#1A2438] border-[#263248] rotate-45',
            position === 'top' && 'border-b border-r -bottom-1 left-1/2 -translate-x-1/2',
            position === 'bottom' && 'border-t border-l -top-1 left-1/2 -translate-x-1/2',
            position === 'left' && 'border-t border-r -right-1 top-1/2 -translate-y-1/2',
            position === 'right' && 'border-b border-l -left-1 top-1/2 -translate-y-1/2',
          )} />
        </span>
      )}
    </span>
  );
}