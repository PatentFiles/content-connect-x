import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Shield, Home, Bot, BookOpen } from 'lucide-react';
import { getNavigationForRole } from '@/components/utils/roleNavConfig';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCButton from '@/components/ui-custom/CCButton';

const adminNavItems = [
  { path: 'Dashboard', label: 'Dashboard', icon: Home },
  { path: 'AdminDashboard', label: 'Admin Dashboard', icon: Shield },
  { path: 'AgentManagement', label: 'Agent Management', icon: Bot },
  { path: 'DeveloperReadMe', label: 'Developer ReadMe', icon: BookOpen },
];

export default function MobileNavMenu({ isOpen, onClose, profile, currentPage, onLogout, adminRoleView }) {
  const roleType = adminRoleView !== 'admin' ? adminRoleView : profile?.role_type;
  const navItems = getNavigationForRole(roleType);
  const isAdmin = profile?.is_admin || profile?.role_type === 'admin';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50 md:hidden"
          />

          {/* Menu Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-[#0B0F14] border-r border-[#263248] z-50 md:hidden overflow-y-auto"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#263248] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CCAvatar
                  src={profile?.avatar_url}
                  alt={profile?.display_name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[#E8EEF9] font-medium truncate">
                    {profile?.display_name || 'User'}
                  </p>
                  <p className="text-xs text-[#6B7A94] capitalize">
                    {roleType}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-[#151D2B] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9AA6BC]" />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-[#4F8CFF]/20 to-[#FF2DAA]/20 text-[#E8EEF9] border border-[#4F8CFF]/30'
                        : 'text-[#9AA6BC] hover:text-[#E8EEF9] hover:bg-[#151D2B]'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-[#263248] mt-auto">
              <CCButton
                variant="outline"
                icon={LogOut}
                fullWidth
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                Logout
              </CCButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}