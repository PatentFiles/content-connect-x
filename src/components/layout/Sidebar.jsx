import React from 'react';
import { Link } from 'react-router-dom';
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
  Heart,
  Settings,
  Shield,
  LogOut,
  ChevronRight,
  Users,
  Building,
  Camera
} from 'lucide-react';
import CCAvatar from '../ui-custom/CCAvatars';
import CCBadge from '../ui-custom/CCBadge';

const mainNavItems = [
  { name: 'Discover', page: 'Discovery', icon: Compass },
  { name: 'Search', page: 'Search', icon: Search },
  { name: 'Messages', page: 'Messages', icon: MessageCircle },
  { name: 'Deal Rooms', page: 'DealRooms', icon: Briefcase },
  { name: 'Contracts', page: 'Contracts', icon: FileText },
  { name: 'Favorites', page: 'Shortlists', icon: Heart },
];

const settingsItems = [
  { name: 'My Profile', page: 'Profile', icon: User },
  { name: 'Settings', page: 'Settings', icon: Settings },
  { name: 'Verification', page: 'Verification', icon: Shield },
];

export default function Sidebar({ currentPage, profile, onLogout }) {
  return (
    <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-64 bg-[#121824] border-r border-[#263248] flex-col">
      {/* Profile Section */}
      {profile && (
        <div className="p-4 border-b border-[#263248]">
          <Link to={createPageUrl('Profile')} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#151D2B] transition-colors">
            <CCAvatar
              src={profile.avatar_url}
              alt={profile.display_name}
              size="md"
              verified={profile.verified}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#E8EEF9] truncate">{profile.display_name || 'Set up profile'}</p>
              <p className="text-xs text-[#6B7A94] capitalize">{profile.role_type}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B7A94]" />
          </Link>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-medium text-[#6B7A94] uppercase tracking-wider px-3 mb-2">Main</p>
        {mainNavItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2.5 rounded-lg',
                'transition-colors duration-200',
                isActive 
                  ? 'bg-[#4F8CFF]/10 text-[#4F8CFF]' 
                  : 'text-[#9AA6BC] hover:bg-[#151D2B] hover:text-[#E8EEF9]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#4F8CFF] rounded-r-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.name}</span>
              {item.badge && (
                <CCBadge variant="accent" size="sm" className="ml-auto">
                  {item.badge}
                </CCBadge>
              )}
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-[#263248]">
          <p className="text-xs font-medium text-[#6B7A94] uppercase tracking-wider px-3 mb-2">Account</p>
          {settingsItems.map((item) => {
            const isActive = currentPage === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg',
                  'transition-colors duration-200',
                  isActive 
                    ? 'bg-[#4F8CFF]/10 text-[#4F8CFF]' 
                    : 'text-[#9AA6BC] hover:bg-[#151D2B] hover:text-[#E8EEF9]'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-[#263248]">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#9AA6BC] hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>
    </aside>
  );
}