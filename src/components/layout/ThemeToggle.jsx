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
        'text-cc-text-secondary hover:text-cc-text-primary hover:bg-cc-surface',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-blue)]',
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