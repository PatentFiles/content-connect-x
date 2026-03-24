/**
 * BottomSheet — a generic bottom sheet built on vaul's Drawer.
 *
 * Usage:
 *   <BottomSheet open={open} onOpenChange={setOpen} title="Options">
 *     <div>...content...</div>
 *   </BottomSheet>
 */

import React from 'react';
import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';

export default function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  snapPoints,
  className,
}) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
    >
      <Drawer.Portal>
        {/* Backdrop */}
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990]" />

        {/* Sheet */}
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-[9991]',
            'flex flex-col bg-[#151D2B] border-t border-[#263248]',
            'rounded-t-2xl outline-none',
            'max-h-[92vh]',
            className
          )}
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-[#263248]" />
          </div>

          {/* Header */}
          {(title || description) && (
            <div className="px-6 pb-3 pt-1 flex-shrink-0">
              {title && (
                <Drawer.Title className="text-lg font-semibold text-[#E8EEF9]">
                  {title}
                </Drawer.Title>
              )}
              {description && (
                <Drawer.Description className="text-sm text-[#9AA6BC] mt-0.5">
                  {description}
                </Drawer.Description>
              )}
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-4 pb-4">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Convenience: BottomSheetItem for lists */
export function BottomSheetItem({ onClick, icon: Icon, label, variant = 'default', disabled }) {
  const colors = {
    default:     'text-[#E8EEF9] hover:bg-[#1A2438]',
    danger:      'text-[#EF4444] hover:bg-[#EF4444]/10',
    warning:     'text-[#F59E0B] hover:bg-[#F59E0B]/10',
    primary:     'text-[#4F8CFF] hover:bg-[#4F8CFF]/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-colors',
        'text-sm font-medium text-left min-h-[56px]',
        colors[variant],
        disabled && 'opacity-40 pointer-events-none'
      )}
    >
      {Icon && React.createElement(Icon, { className: 'w-5 h-5 flex-shrink-0' })}
      <span>{label}</span>
    </button>
  );
}