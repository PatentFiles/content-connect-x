import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';

/**
 * Mobile-friendly replacement for native <select>.
 * On mobile: opens a bottom-sheet. On desktop: behaves like a styled dropdown.
 */
export default function BottomSheetSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  label,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <>
      {label && (
        <label className="block text-xs mb-1" style={{ color: 'var(--cc-text-muted)' }}>{label}</label>
      )}
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 transition-colors border ${className}`}
        style={{ backgroundColor: 'var(--cc-bg)', borderColor: 'var(--cc-border)', color: selected ? 'var(--cc-text-primary)' : 'var(--cc-text-muted)' }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" style={{ color: 'var(--cc-text-muted)' }} />
      </button>

      {/* Bottom Sheet Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[9999] flex flex-col justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            {/* Backdrop */}
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative rounded-t-2xl shadow-2xl max-h-[70vh] flex flex-col border-t"
              style={{ backgroundColor: 'var(--cc-surface)', borderColor: 'var(--cc-border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--cc-border)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--cc-border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--cc-text-primary)' }}>
                  {label || placeholder}
                </span>
                <button onClick={() => setOpen(false)} className="p-1" style={{ color: 'var(--cc-text-muted)' }}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Options list */}
              <div className="overflow-y-auto flex-1">
                {options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className="w-full flex items-center justify-between px-5 py-4 text-sm transition-colors text-left border-b last:border-0"
                      style={{
                        borderColor: 'var(--cc-border)',
                        backgroundColor: isSelected ? 'color-mix(in srgb, var(--cc-blue) 10%, transparent)' : 'transparent',
                        color: isSelected ? 'var(--cc-blue)' : 'var(--cc-text-primary)',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}