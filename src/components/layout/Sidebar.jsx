import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { 
  LogOut,
  ChevronRight,
  Shield,
  ExternalLink,
  Bot,
  Home
} from 'lucide-react';
import CCAvatar from '../ui-custom/CCAvatars';
import CCBadge from '../ui-custom/CCBadge';
import { getNavigationForRole } from '../utils/roleNavConfig';
import AdminRoleViewSwitcher from '../admin/AdminRoleViewSwitcher';

const adminNavItems = [
  { name: 'Dashboard', page: 'Dashboard', icon: Home },
  { name: 'Admin Dashboard', page: 'AdminDashboard', icon: Shield },
  { name: 'Agent Management', page: 'AgentManagement', icon: Bot },
];

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function Sidebar({ currentPage, profile, onLogout, adminRoleView, onAdminRoleViewChange }) {
  // Determine which role's navigation to show
  const isAdmin = profile?.is_admin;
  const effectiveRoleView = isAdmin && adminRoleView ? adminRoleView : (profile?.role_type || 'creator');
  const showAdminNav = isAdmin && effectiveRoleView === 'admin';
  const roleType = showAdminNav ? 'creator' : effectiveRoleView;
  const navItems = getNavigationForRole(roleType);

  // Fetch unread message count
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', profile?.user_id],
    queryFn: async () => {
      const allConvs = await base44.entities.Conversation.list();
      return allConvs.filter(c => c.participant_ids?.includes(profile?.user_id));
    },
    enabled: !!profile?.user_id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: allMessages = [] } = useQuery({
    queryKey: ['allMessages'],
    queryFn: () => base44.entities.Message.list(),
    enabled: !!profile?.user_id,
    refetchInterval: 30000,
  });

  const unreadCount = conversations.reduce((total, conv) => {
    const convMessages = allMessages.filter(m => m.conversation_id === conv.id);
    const unread = convMessages.filter(m => 
      m.sender_id !== profile?.user_id && 
      (!m.read_by || !m.read_by.includes(profile?.user_id))
    ).length;
    return total + unread;
  }, 0);
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
              <CCBadge variant="outline" size="sm" className="mt-1 capitalize">
                {profile.role_type}
              </CCBadge>
            </div>
            <ChevronRight className="w-4 h-4 text-[#6B7A94]" />
          </Link>
          <Link 
            to={createPageUrl(`ViewProfile?id=${profile.user_id}`)} 
            className="mt-2 flex items-center gap-2 text-xs text-[#4F8CFF] hover:text-[#3A7AEE] px-2"
          >
            <ExternalLink className="w-3 h-3" />
            View Public Profile
          </Link>
        </div>
      )}

      {/* Admin Role View Switcher */}
      {isAdmin && (
        <AdminRoleViewSwitcher 
          currentView={effectiveRoleView}
          onViewChange={onAdminRoleViewChange}
        />
      )}

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {showAdminNav && (
          <>
            <p className="text-xs font-medium text-[#6B7A94] uppercase tracking-wider px-3 mb-2">Admin</p>
            {adminNavItems.map((item) => {
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
                </Link>
              );
            })}
            <div className="pb-2 mb-2 border-b border-[#263248]" />
          </>
        )}
        {!showAdminNav && isAdmin && (
          <p className="text-xs font-medium text-[#6B7A94] uppercase tracking-wider px-3 mb-2">
            {effectiveRoleView.charAt(0).toUpperCase() + effectiveRoleView.slice(1)} View
          </p>
        )}
        {navItems.filter(item => item.path !== 'Dashboard' || !showAdminNav).map((item) => {
          const isActive = currentPage === item.path;
          const isMessagesPage = item.path === 'Messages';
          return (
            <Link
              key={item.path}
              to={createPageUrl(item.path)}
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
              <span className="text-sm font-medium">
                {item.label}
                {isMessagesPage && unreadCount > 0 && (
                  <span className="ml-1.5 text-xs">({unreadCount})</span>
                )}
              </span>
            </Link>
          );
        })}
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