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
  Home,
  FileText
} from 'lucide-react';
import CCAvatar from '../ui-custom/CCAvatars';
import CCBadge from '../ui-custom/CCBadge';
import { getNavigationForRole } from '../utils/roleNavConfig';
import { useFilteredNav, useFeatureFlag } from '@/lib/featureFlags';
import AdminRoleViewSwitcher from '../admin/AdminRoleViewSwitcher';

const adminNavItems = [
  { name: 'Dashboard', page: 'Dashboard', icon: Home },
  { name: 'Admin Dashboard', page: 'AdminDashboard', icon: Shield },
  { name: 'Agent Management', page: 'AgentManagement', icon: Bot },
  { name: 'Developer ReadMe', page: 'DeveloperReadMe', icon: FileText },
];

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function Sidebar({ currentPage, profile, user, onLogout, adminRoleView, onAdminRoleViewChange }) {
  // Determine which role's navigation to show
  const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';
  const effectiveRoleView = isAdmin && adminRoleView ? adminRoleView : (profile?.role_type || 'creator');
  const showAdminNav = isAdmin && effectiveRoleView === 'admin';
  const roleType = showAdminNav ? 'creator' : effectiveRoleView;
  const rawNavItems = getNavigationForRole(roleType);
  const navItems = useFilteredNav(rawNavItems);

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
    <aside
      className="hidden md:flex fixed left-0 bottom-0 w-64 flex-col border-r"
      style={{
        top: 'calc(4rem + env(safe-area-inset-top, 0px))',
        backgroundColor: 'var(--cc-surface)',
        borderColor: 'var(--cc-border)',
      }}
    >
      {/* Profile Section */}
      {profile && (
        <div className="p-4 border-b" style={{ borderColor: 'var(--cc-border)' }}>
          <Link
            to={createPageUrl(roleType === 'host' ? 'HostProfile' : 'Profile')}
            className="flex items-center gap-3 p-2 rounded-lg transition-colors"
            style={{ ':hover': { backgroundColor: 'var(--cc-surface-hover)' } }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
          >
            <CCAvatar
              src={profile.avatar_url}
              alt={profile.display_name}
              size="md"
              verified={profile.verified}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--cc-text-primary)' }}>
                {profile.display_name || 'Set up profile'}
              </p>
              <CCBadge variant="outline" size="sm" className="mt-1 capitalize">
                {profile.role_type}
              </CCBadge>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--cc-text-muted)' }} />
          </Link>
          <Link
            to={createPageUrl(`ViewProfile?id=${profile.user_id}`)}
            className="mt-2 flex items-center gap-2 text-xs px-2"
            style={{ color: 'var(--cc-blue)' }}
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
            <p className="text-xs font-medium uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--cc-text-muted)' }}>Admin</p>
            {adminNavItems.map((item) => {
              const isActive = currentPage === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200"
                  style={{
                    backgroundColor: isActive ? 'rgba(79,140,255,0.12)' : '',
                    color: isActive ? 'var(--cc-blue)' : 'var(--cc-text-secondary)',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'; e.currentTarget.style.color = 'var(--cc-text-primary)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--cc-text-secondary)'; } }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebarIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                      style={{ backgroundColor: 'var(--cc-blue)' }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
            <div className="pb-2 mb-2 border-b" style={{ borderColor: 'var(--cc-border)' }} />
          </>
        )}
        {!showAdminNav && isAdmin && (
          <p className="text-xs font-medium uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--cc-text-muted)' }}>
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
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200"
              style={{
                backgroundColor: isActive ? 'rgba(79,140,255,0.12)' : '',
                color: isActive ? 'var(--cc-blue)' : 'var(--cc-text-secondary)',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'; e.currentTarget.style.color = 'var(--cc-text-primary)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--cc-text-secondary)'; } }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarIndicatorMain"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                  style={{ backgroundColor: 'var(--cc-blue)' }}
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
      <div className="p-4 border-t" style={{ borderColor: 'var(--cc-border)' }}>
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full"
          style={{ color: 'var(--cc-text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#EF4444'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--cc-text-secondary)'; }}
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Log Out</span>
        </button>
      </div>
    </aside>
  );
}