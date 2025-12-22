import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import CCButton from './CCButton';

export default function CCModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
  className,
}) {
  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-full mx-4',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'w-full bg-[#151D2B] border border-[#263248] rounded-2xl shadow-2xl my-8 max-h-[90vh] flex flex-col',
                sizes[size],
                className
              )}
            >
              {/* Header */}
              {(title || showClose) && (
                <div className="flex items-start justify-between p-6 border-b border-[#263248]">
                  <div>
                    {title && (
                      <h2 className="text-xl font-semibold text-[#E8EEF9]">{title}</h2>
                    )}
                    {description && (
                      <p className="mt-1 text-sm text-[#9AA6BC]">{description}</p>
                    )}
                  </div>
                  {showClose && (
                    <CCButton
                      variant="ghost"
                      size="icon"
                      onClick={onClose}
                      className="text-[#6B7A94] hover:text-[#E8EEF9] -mr-2 -mt-2"
                    >
                      <X className="w-5 h-5" />
                    </CCButton>
                  )}
                </div>
              )}
              
              {/* Content */}
              <div className="p-6 overflow-y-auto flex-1">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export function CCDrawer({
  isOpen,
  onClose,
  title,
  children,
  side = 'right',
  className,
}) {
  const sideStyles = {
    right: 'right-0 top-0 h-full rounded-l-2xl',
    left: 'left-0 top-0 h-full rounded-r-2xl',
    bottom: 'bottom-0 left-0 w-full rounded-t-2xl max-h-[90vh]',
  };

  const animations = {
    right: { x: '100%' },
    left: { x: '-100%' },
    bottom: { y: '100%' },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />
          
          <motion.div
            initial={animations[side]}
            animate={{ x: 0, y: 0 }}
            exit={animations[side]}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed bg-[#151D2B] border border-[#263248] shadow-2xl z-50',
              side === 'bottom' ? 'max-w-lg mx-auto' : 'w-full max-w-md',
              sideStyles[side],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#263248]">
              {title && (
                <h2 className="text-lg font-semibold text-[#E8EEF9]">{title}</h2>
              )}
              <CCButton
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-[#6B7A94] hover:text-[#E8EEF9]"
              >
                <X className="w-5 h-5" />
              </CCButton>
            </div>
            
            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(100%-60px)]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}