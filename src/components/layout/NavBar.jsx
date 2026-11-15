import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Menu, Bell, Settings } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import { useQuery } from '@tanstack/react-query';
import ThemeToggle from './ThemeToggle';

export default function NavBar({ user, profile, isAuthenticated, onMenuToggle, menuOpen, onHamburgerToggle }) {
  // Fetch unread notifications count
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl border-b border-cc-border"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--cc-bg) 95%, transparent)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="w-full px-4 h-16 flex items-center justify-between">
        {/* Left — Logo */}
        <Link to={createPageUrl('Landing')} className="flex items-center gap-2 flex-shrink-0">
          <img
            src="/content_connect_logo.png"
            alt="Content Connect X logo"
            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
          />
          <span className="font-semibold text-lg hidden sm:block" style={{ color: 'var(--cc-text-primary)' }}>Content Connect X</span>
        </Link>

        {/* Center — Desktop public nav */}
        {!isAuthenticated && (
          <nav className="hidden md:flex items-center gap-6">
            <Link to={createPageUrl('HowItWorks')} className="text-sm font-medium transition-colors" style={{ color: 'var(--cc-text-secondary)' }}>
              How it Works
            </Link>
            <Link to={createPageUrl('Pricing')} className="text-sm font-medium transition-colors" style={{ color: 'var(--cc-text-secondary)' }}>
              Pricing
            </Link>
            <Link to={createPageUrl('FAQ')} className="text-sm font-medium transition-colors" style={{ color: 'var(--cc-text-secondary)' }}>
              FAQ
            </Link>
          </nav>
        )}

        {/* Right — Icons */}
        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <>
              <ThemeToggle />

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

              {/* Hamburger Menu for Mobile — rightmost */}
              <button
                onClick={onHamburgerToggle}
                className="md:hidden p-3 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: 'var(--cc-text-primary)' }}
                aria-label="Open menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </>
          ) : profile ? (
            <>
              <ThemeToggle />

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
              <ThemeToggle />

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
        className="md:hidden overflow-hidden bg-cc-bg border-t border-cc-border"
      >
        <nav className="p-4 space-y-2">
          {!isAuthenticated ? (
            <>
              <Link to={createPageUrl('HowItWorks')} className="block px-4 py-2 rounded-lg" style={{ color: 'var(--cc-text-secondary)' }}>
                How it Works
              </Link>
              <Link to={createPageUrl('Pricing')} className="block px-4 py-2 rounded-lg" style={{ color: 'var(--cc-text-secondary)' }}>
                Pricing
              </Link>
              <Link to={createPageUrl('FAQ')} className="block px-4 py-2 rounded-lg" style={{ color: 'var(--cc-text-secondary)' }}>
                FAQ
              </Link>
            </>
          ) : null}
        </nav>
      </motion.div>
    </header>
  );
}