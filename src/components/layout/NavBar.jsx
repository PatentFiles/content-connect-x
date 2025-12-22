import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Menu, X, Bell, Settings } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCAvatar from '../ui-custom/CCAvatars';

export default function NavBar({ user, profile, isAuthenticated, onMenuToggle, menuOpen }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to={createPageUrl('Landing')} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F8CFF] to-[#FF2DAA] flex items-center justify-center">
            <span className="text-white font-bold text-sm">CC</span>
          </div>
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
          {isAuthenticated && profile ? (
            <>
              <CCButton variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF2DAA] rounded-full" />
              </CCButton>
              <Link to={createPageUrl('Settings')}>
                <CCButton variant="ghost" size="icon">
                  <Settings className="w-5 h-5" />
                </CCButton>
              </Link>
              <Link to={createPageUrl('Profile')}>
                <CCAvatar
                  src={profile?.avatar_url}
                  alt={profile?.display_name}
                  size="sm"
                  verified={profile?.verified}
                />
              </Link>
            </>
          ) : (
            <>
              <Link to={createPageUrl('Login')}>
                <CCButton variant="ghost" size="sm">Log In</CCButton>
              </Link>
              <Link to={createPageUrl('Signup')}>
                <CCButton variant="primary" size="sm">Get Started</CCButton>
              </Link>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 text-[#9AA6BC] hover:text-[#E8EEF9]"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
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