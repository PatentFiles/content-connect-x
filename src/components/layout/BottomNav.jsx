import React from 'react';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getNavigationForRole } from '../utils/roleNavConfig';
import { useTabNavigator } from './TabNavigator';

export default function BottomNav({ currentPage }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  // TabNavigator may not be available on public pages — guard it
  let switchTab = null;
  try {
    const nav = useTabNavigator();
    switchTab = nav.switchTab;
  } catch (_) {
    // Outside TabNavigatorProvider (public pages) — fallback to null
  }

  const profile = profiles[0];
  const roleType = profile?.role_type || 'creator';
  const allNavItems = getNavigationForRole(roleType);
  const navItems = allNavItems.slice(0, 5);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F14]/95 backdrop-blur-xl border-t border-[#263248] md:hidden fixed-bottom-nav">
      <div className="flex items-center justify-around px-2" style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {navItems.map((item) => {
          const isActive = currentPage === item.path;
          const dest = createPageUrl(item.path);
          return (
            <button
              key={item.path}
              onClick={() => switchTab ? switchTab(`/${item.path}`) : (window.location.href = dest)}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 h-full gap-1',
                'transition-colors duration-200 min-h-[44px] min-w-[44px]',
                isActive ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#4F8CFF] rounded-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <item.icon className={cn('w-5 h-5', isActive && 'text-[#4F8CFF]')} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}