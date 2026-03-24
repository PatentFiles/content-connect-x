import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getNavigationForRole } from '../utils/roleNavConfig';
import { useTabNavigator } from './TabNavigator';
import { useNavigate } from 'react-router-dom';

export default function BottomNav({ currentPage }) {
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const tabNav = useTabNavigator();

  const profile = profiles[0];
  const roleType = profile?.role_type || 'creator';
  const allNavItems = getNavigationForRole(roleType);
  const navItems = allNavItems.slice(0, 5);

  const handleTabPress = (path) => {
    const tabPath = `/${path}`;
    if (tabNav?.switchTab) {
      tabNav.switchTab(tabPath);
    } else {
      navigate(tabPath);
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F14]/95 backdrop-blur-xl border-t border-[#263248] md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-stretch justify-around px-1" style={{ minHeight: '56px' }}>
        {navItems.map((item) => {
          const isActive = currentPage === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleTabPress(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center flex-1 gap-0.5 py-2 px-1',
                'transition-colors duration-200',
                'min-h-[44px] min-w-[44px]',
                'focus:outline-none active:opacity-70',
                isActive ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#4F8CFF] rounded-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <item.icon
                className={cn('w-5 h-5 flex-shrink-0', isActive ? 'text-[#4F8CFF]' : 'text-[#6B7A94]')}
              />
              <span className={cn(
                'text-[10px] font-medium leading-none',
                isActive ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}