import React, { useState, useEffect } from 'react';
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
  'Shortlists',
  'AdminDashboard',
  'CompliancePortal'
];

export default function Layout({ children, currentPageName }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [adminRoleView, setAdminRoleView] = useState('admin');
  const isPublicPage = publicPages.includes(currentPageName);
  const isAppPage = appPages.includes(currentPageName);

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
          {children}
        </main>
      </div>
    );
  }

  // For app pages, show full layout with sidebar and bottom nav
  if (isAppPage && isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <Toaster position="top-center" theme="dark" />
        <NavBar 
          user={user}
          profile={{...profile, verified: isVerified}}
          isAuthenticated={isAuthenticated}
          onMenuToggle={() => setMenuOpen(!menuOpen)}
          menuOpen={menuOpen}
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
        <main className={cn(
          "pt-16 md:pl-64 min-h-screen",
          isAdmin && adminRoleView !== 'admin' && "pt-28"
        )}>
          {children}
        </main>
        <BottomNav currentPage={currentPageName} />
      </div>
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
        {children}
      </main>
    </div>
  );
}