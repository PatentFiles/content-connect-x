import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import NavBar from '@/components/layout/NavBar';
import BottomNav from '@/components/layout/BottomNav';
import Sidebar from '@/components/layout/Sidebar';
import MobileNavMenu from '@/components/layout/MobileNavMenu';
import AdminContextBanner from '@/components/admin/AdminContextBanner';
import PageTransition from '@/components/layout/PageTransition';
import TabNavigatorProvider from '@/components/layout/TabNavigator';
import { MobileNavProvider } from '@/lib/MobileNavContext';
import MobileHeader from '@/components/layout/MobileHeader';
import { getPlatform } from '@/lib/usePlatform';

// Public pages that don't need auth
const publicPages = [
  'Landing', 
  'HowItWorks', 
  'Pricing', 
  'FAQ', 
  'Terms', 
  'Privacy',
  'Login',
  'Signup'
];

// Pages that show the full app layout (sidebar, bottom nav)
const appPages = [
  'Dashboard',
  'Discovery',
  'Search',
  'Testing',
  'Messages',
  'Collaborations',
  'CreateCollaboration',
  'ViewCollaboration',
  'Contracts',
  'ViewContract',
  'Profile',
  'ViewProfile',
  'Settings',
  'Verification',
  'Favorites',
  'Connections',
  'AdminDashboard',
  'CompliancePortal',
  'RosterPortfolio',
  'Representations',
  'Portfolio',
  'AgentManagement',
  'DeveloperReadMe',
  'AvailabilitySchedule',
  'TravelSchedule',
  'Notifications',
  'ModerationFlags',
  'HostingMarketplace',
  'PropertyDetail',
  'HostDashboard',
  'HostProfile',
  'HostSettings',
  'SoloSessionDetail',
];

export default function Layout({ children, currentPageName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminRoleView, setAdminRoleView] = useState('admin');
  const isPublicPage = publicPages.includes(currentPageName);
  const isAppPage = appPages.includes(currentPageName);

  // Apply platform class to <html> once so CSS can target it
  useEffect(() => {
    const platform = getPlatform();
    document.documentElement.classList.add(`platform-${platform}`);
    if (platform === 'ios') document.documentElement.classList.add('platform-native');
    if (platform === 'android') document.documentElement.classList.add('platform-native');
  }, []);

  // Fetch user data
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return null;
      return base44.auth.me();
    },
  });

  // Fetch user profile
  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch verification status
  const { data: verifications = [] } = useQuery({
    queryKey: ['myVerification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles[0];
  const isVerified = verifications[0]?.status === 'approved';
  const isAuthenticated = !!user;
  const isAdmin = profile?.is_admin;

  // Update last_active_at once per session per day
  useEffect(() => {
    if (!user || !profile) return;
    const activeKey = `cc_active_${user.email}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(activeKey)) return;
    sessionStorage.setItem(activeKey, '1');
    if (profile?.id) {
      base44.entities.UserProfile.update(profile.id, {
        last_active_at: new Date().toISOString(),
      }).catch(() => {});
    }
  }, [user, profile]);

  // Record session history once per calendar day per user
  const sessionRecorded = useRef(false);
  useEffect(() => {
    if (!user || sessionRecorded.current) return;
    sessionRecorded.current = true;
    const sessionKey = `cc_session_${user.email}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    base44.entities.SessionHistory.create({
      user_id: user.email,
      session_id: `${user.email}_${Date.now()}`,
      ip_address: 'client-side',
      user_agent: navigator.userAgent,
      login_at: new Date().toISOString(),
      actions_count: 0,
    }).catch(() => {});
  }, [user]);

  // Handle redirect after login
  useEffect(() => {
    if (isAuthenticated && !userLoading) {
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath && window.location.pathname !== redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        window.location.href = redirectPath;
      }
    }
  }, [isAuthenticated, userLoading]);

  const handleLogout = async () => {
    await base44.auth.logout();
    window.location.href = createPageUrl('Landing');
  };

  // For public pages, show minimal layout
  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <Toaster position="top-center" theme="dark" />
        <NavBar 
          user={user}
          profile={profile}
          isAuthenticated={isAuthenticated}
          onMenuToggle={() => setMenuOpen(!menuOpen)}
          menuOpen={menuOpen}
          onHamburgerToggle={() => setMobileNavOpen(!mobileNavOpen)}
        />
        <MobileNavMenu
          isOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          profile={profile}
          currentPage={currentPageName}
          onLogout={handleLogout}
          adminRoleView={adminRoleView}
        />
        <main>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    );
  }

  // For app pages, show full layout with sidebar and bottom nav
  if (isAppPage && (isAuthenticated || userLoading)) {
    // Main content must clear NavBar (64px) + safe-area-inset-top
    return (
      <MobileNavProvider>
        <TabNavigatorProvider>
          <div className="min-h-screen bg-[#0B0F14]">
            <Toaster position="top-center" theme="dark" />
            <NavBar 
              user={user}
              profile={{...profile, verified: isVerified}}
              isAuthenticated={isAuthenticated}
              onMenuToggle={() => setMenuOpen(!menuOpen)}
              menuOpen={menuOpen}
              onHamburgerToggle={() => setMobileNavOpen(!mobileNavOpen)}
            />
            <MobileNavMenu
              isOpen={mobileNavOpen}
              onClose={() => setMobileNavOpen(false)}
              profile={profile}
              currentPage={currentPageName}
              onLogout={handleLogout}
              adminRoleView={adminRoleView}
            />
            {isAdmin && (
              <AdminContextBanner 
                currentView={adminRoleView}
                onReturnToAdmin={() => setAdminRoleView('admin')}
              />
            )}
            <Sidebar 
              currentPage={currentPageName}
              profile={{...profile, verified: isVerified}}
              onLogout={handleLogout}
              adminRoleView={adminRoleView}
              onAdminRoleViewChange={setAdminRoleView}
            />
            {/* Per-page dynamic header (back button + title) — mobile only */}
            <MobileHeader />
            <main
              className={cn(
                "md:pl-64 min-h-screen",
                "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0",
                isAdmin && adminRoleView !== 'admin' ? "pt-36" : "pt-16"
              )}
              style={{ paddingTop: isAdmin && adminRoleView !== 'admin' ? undefined : 'calc(4rem + env(safe-area-inset-top, 0px))' }}
            >
              <PageTransition>{children}</PageTransition>
            </main>
            <BottomNav currentPage={currentPageName} />
          </div>
        </TabNavigatorProvider>
      </MobileNavProvider>
    );
  }

  // Default layout
  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <Toaster position="top-center" theme="dark" />
      <NavBar 
        user={user}
        profile={profile}
        isAuthenticated={isAuthenticated}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        menuOpen={menuOpen}
        onHamburgerToggle={() => setMobileNavOpen(!mobileNavOpen)}
      />
      <MobileNavMenu
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        profile={profile}
        currentPage={currentPageName}
        onLogout={handleLogout}
        adminRoleView={adminRoleView}
      />
      <main className="pt-16">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}