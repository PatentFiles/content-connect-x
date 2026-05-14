import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/useTheme';
import { cn } from '@/lib/utils';

export default function ThemeToggle({ className }) {
  const { isDark, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center',
        'text-[#9AA6BC] hover:text-[#E8EEF9] hover:bg-[#151D2B]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F8CFF]',
        className
      )}
    >
      {isDark ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
}