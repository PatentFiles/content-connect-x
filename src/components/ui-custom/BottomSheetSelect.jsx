import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';

/**
 * Mobile-friendly replacement for native <select>.
 * On mobile: opens a bottom-sheet. On desktop: behaves like a styled dropdown.
 *
 * Props:
 *   value        - current selected value
 *   onChange     - (value) => void
 *   options      - [{ value, label }]
 *   placeholder  - string
 *   label        - optional label string
 *   className    - extra classes for the trigger button
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
        <label className="block text-xs text-[#6B7A94] mb-1">{label}</label>
      )}
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-colors hover:border-[#3A4A6B] ${className}`}
      >
        <span className={selected ? 'text-[#E8EEF9]' : 'text-[#6B7A94]'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-[#6B7A94] flex-shrink-0 ml-2" />
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
            <div className="absolute inset-0 bg-black/60" />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#151D2B] rounded-t-2xl border-t border-[#263248] shadow-2xl max-h-[70vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#263248]" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#263248]">
                <span className="text-sm font-semibold text-[#E8EEF9]">
                  {label || placeholder}
                </span>
                <button onClick={() => setOpen(false)} className="text-[#6B7A94] hover:text-[#E8EEF9] p-1">
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
                      className={`w-full flex items-center justify-between px-5 py-4 text-sm transition-colors text-left border-b border-[#1E2A3A] last:border-0 ${
                        isSelected
                          ? 'bg-[#4F8CFF]/10 text-[#4F8CFF]'
                          : 'text-[#E8EEF9] hover:bg-[#1A2438]'
                      }`}
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