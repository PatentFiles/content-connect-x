import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { 
  Compass, 
  Search, 
  MessageCircle, 
  FileText, 
  User,
  Briefcase,
  Heart
} from 'lucide-react';

const navItems = [
  { name: 'Discover', page: 'Discovery', icon: Compass },
  { name: 'Search', page: 'Search', icon: Search },
  { name: 'Messages', page: 'Messages', icon: MessageCircle },
  { name: 'Deals', page: 'DealRooms', icon: Briefcase },
  { name: 'Profile', page: 'Profile', icon: User },
];

export default function BottomNav({ currentPage }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F14]/95 backdrop-blur-xl border-t border-[#263248] md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
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
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}