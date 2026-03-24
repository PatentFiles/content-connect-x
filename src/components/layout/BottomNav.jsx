import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getNavigationForRole } from '../utils/roleNavConfig';

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

  const profile = profiles[0];
  const roleType = profile?.role_type || 'creator';
  const allNavItems = getNavigationForRole(roleType);
  const navItems = allNavItems.slice(0, 5);
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F14]/95 backdrop-blur-xl border-t border-[#263248] md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.path;
          return (
            <Link
              key={item.path}
              to={createPageUrl(item.path)}
              className={cn(
                'relative flex flex-col items-center justify-center w-full h-full gap-1',
                'transition-colors duration-200',
                isActive ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'
              )}
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}