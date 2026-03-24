import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Menu, X, Bell, Settings } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCAvatar from '../ui-custom/CCAvatars';
import { useQuery } from '@tanstack/react-query';
import CCBadge from '../ui-custom/CCBadge';

export default function NavBar({ user, profile, isAuthenticated, onMenuToggle, menuOpen, onHamburgerToggle }) {
  // Fetch unread notifications count
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={createPageUrl('Landing')} className="flex items-center gap-2">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69495df631e52046b1356040/51f211167_image.png"
            alt="Content Connect"
            className="w-8 h-8 rounded-lg object-contain"
          />
          <span className="text-[#E8EEF9] font-semibold text-lg hidden sm:block">Content Connect</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {!isAuthenticated ? (
            <>
              <Link to={createPageUrl('HowItWorks')} className="text-[#9AA6BC] hover:text-[#E8EEF9] text-sm font-medium transition-colors">
                How it Works
              </Link>
              <Link to={createPageUrl('Pricing')} className="text-[#9AA6BC] hover:text-[#E8EEF9] text-sm font-medium transition-colors">
                Pricing
              </Link>
              <Link to={createPageUrl('FAQ')} className="text-[#9AA6BC] hover:text-[#E8EEF9] text-sm font-medium transition-colors">
                FAQ
              </Link>
            </>
          ) : null}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              {/* Hamburger Menu for Mobile (authenticated users only) */}
              <button
                onClick={onHamburgerToggle}
                className="md:hidden p-2 hover:bg-[#151D2B] rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-[#E8EEF9]" />
              </button>
              
              <Link to={createPageUrl('Notifications')} className="relative">
                <CCButton variant="ghost" size="icon">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </CCButton>
              </Link>

              <Link to={createPageUrl('Settings')} className="hidden md:block">
                <CCButton variant="ghost" size="icon">
                  <Settings className="w-5 h-5" />
                </CCButton>
              </Link>
            </>
          ) : profile ? (
            <>
              <Link to={createPageUrl('Notifications')} className="relative">
                <CCButton variant="ghost" size="icon">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#EF4444] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </CCButton>
              </Link>
            </>
          ) : (
            <>
              <CCButton 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  sessionStorage.setItem('redirectAfterLogin', createPageUrl('Discovery'));
                  base44.auth.redirectToLogin();
                }}
              >
                Log In
              </CCButton>
              <CCButton 
                variant="primary" 
                size="sm"
                onClick={() => {
                  sessionStorage.setItem('redirectAfterLogin', createPageUrl('Discovery'));
                  base44.auth.redirectToLogin();
                }}
              >
                Get Started
              </CCButton>
            </>
          )}


        </div>
      </div>

      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={{ height: menuOpen ? 'auto' : 0 }}
        className="md:hidden overflow-hidden bg-[#121824] border-t border-[#263248]"
      >
        <nav className="p-4 space-y-2">
          {!isAuthenticated ? (
            <>
              <Link to={createPageUrl('HowItWorks')} className="block px-4 py-2 text-[#9AA6BC] hover:text-[#E8EEF9] hover:bg-[#151D2B] rounded-lg">
                How it Works
              </Link>
              <Link to={createPageUrl('Pricing')} className="block px-4 py-2 text-[#9AA6BC] hover:text-[#E8EEF9] hover:bg-[#151D2B] rounded-lg">
                Pricing
              </Link>
              <Link to={createPageUrl('FAQ')} className="block px-4 py-2 text-[#9AA6BC] hover:text-[#E8EEF9] hover:bg-[#151D2B] rounded-lg">
                FAQ
              </Link>
            </>
          ) : null}
        </nav>
      </motion.div>
    </header>
  );
}