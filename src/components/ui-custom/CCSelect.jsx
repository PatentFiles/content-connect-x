import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

export default function CCSelect({
  label,
  error,
  hint,
  options = [],
  placeholder = 'Select an option',
  className,
  required,
  disabled,
  value,
  onChange,
  ...props
}) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const selectedOption = options.find(o => o.value === value);

  const handleSelect = (optValue) => {
    // Simulate a synthetic change event
    onChange?.({ target: { value: optValue } });
    setDrawerOpen(false);
  };

  if (isMobile) {
    return (
      <div className={cn('space-y-1.5', className)}>
        {label && (
          <label className="block text-sm font-medium text-[#E8EEF9]">
            {label}
            {required && <span className="text-[#FF2DAA] ml-1">*</span>}
          </label>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setDrawerOpen(true)}
          className={cn(
            'w-full bg-[#121824] border border-[#263248] rounded-lg',
            'flex items-center justify-between',
            'pl-4 pr-3 py-2.5 text-sm text-left',
            'focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            error && 'border-[#EF4444]',
            !value ? 'text-[#6B7A94]' : 'text-[#E8EEF9]'
          )}
        >
          <span>{selectedOption?.label || placeholder}</span>
          <ChevronDown className="w-4 h-4 text-[#6B7A94] flex-shrink-0" />
        </button>
        {hint && !error && <p className="text-xs text-[#6B7A94]">{hint}</p>}
        {error && <p className="text-xs text-[#EF4444]">{error}</p>}

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent className="bg-[#151D2B] border-t border-[#263248]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-[#E8EEF9] text-base">{label || placeholder}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8 max-h-[60vh] overflow-y-auto space-y-1">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors text-left',
                    opt.value === value
                      ? 'bg-[#4F8CFF]/20 text-[#4F8CFF]'
                      : 'text-[#E8EEF9] hover:bg-[#1A2438]'
                  )}
                >
                  <span>{opt.label}</span>
                  {opt.value === value && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // Desktop: native select
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-sm font-medium text-[#E8EEF9]">
          {label}
          {required && <span className="text-[#FF2DAA] ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            'w-full bg-[#121824] border border-[#263248] rounded-lg appearance-none',
            'text-[#E8EEF9] placeholder-[#6B7A94]',
            'focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            'pl-4 pr-10 py-2.5 text-sm',
            error && 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/50',
            !value && 'text-[#6B7A94]'
          )}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94] pointer-events-none" />
      </div>
      {hint && !error && <p className="text-xs text-[#6B7A94]">{hint}</p>}
      {error && <p className="text-xs text-[#EF4444]">{error}</p>}
    </div>
  );
}