import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config.jsx'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
const SoloSessionDetail = lazy(() => import('./pages/SoloSessionDetail'));
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { FeatureFlagProvider } from '@/lib/featureFlags';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AccountBlockedScreen from '@/components/auth/AccountBlockedScreen';
import SubscriptionBlockedScreen from '@/components/auth/SubscriptionBlockedScreen';
import VerificationRequiredScreen from '@/components/auth/VerificationRequiredScreen';
import { useFeatureFlag } from '@/lib/featureFlags';
import { base44 } from '@/api/base44Client';
import { ThemeProvider } from '@/lib/ThemeContext';
import ContactPage from './pages/Contact';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, blockStatus, subscriptionBlocked, isAuthenticated, navigateToLogin } = useAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const verificationEnabled = useFeatureFlag('verification');

  // Check verification status on auth change
   useEffect(() => {
     const checkVerification = async () => {
       if (!isAuthenticated || !user?.email) {
         setIsVerified(false);
         setVerificationLoading(false);
         return;
       }

       try {
         const profiles = await base44.entities.UserProfile.filter({ user_id: user.email });
         const profile = profiles[0];
         // SINGLE SOURCE OF TRUTH: age_verified
         setIsVerified(profile?.age_verified === true);
       } catch (error) {
         console.error('Failed to check verification:', error);
         setIsVerified(false);
       } finally {
         setVerificationLoading(false);
       }
     };

     checkVerification();
   }, [isAuthenticated, user?.email]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth || verificationLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle banned/suspended users — shown before any route
  if (blockStatus) {
    return (
      <AccountBlockedScreen
        blockReason={blockStatus.reason}
        suspensionReason={blockStatus.suspensionReason}
        suspensionEndAt={blockStatus.suspensionEndAt}
      />
    );
  }

  // CRITICAL GATE 1: Verification Required (BEFORE subscription check)
  // When verification flag is ON, ALL non-admin users must be verified
  const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';
  if (isAuthenticated && verificationEnabled && !isAdmin && !isVerified) {
    return <VerificationRequiredScreen />;
  }

  // CRITICAL GATE 2: Subscription Required (AFTER verification)
  // When authenticated and not admin, check subscription
  if (isAuthenticated && subscriptionBlocked && !isAdmin) {
    // Only allow access to Settings and Pricing pages for resubscription
    const allowedRoutes = ['/Settings', '/Pricing', '/Billing'];
    const currentPath = window.location.pathname;
    
    if (!allowedRoutes.some(route => currentPath.startsWith(route))) {
      return <SubscriptionBlockedScreen reason="subscription_inactive" />;
    }
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      {/* Explicit route for SoloSessionDetail — not in pagesConfig loop because it needs layout wrapping */}
      <Route
        path="/SoloSessionDetail"
        element={
          <LayoutWrapper currentPageName="SoloSessionDetail">
            <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-[#0B0F14]"><div className="w-8 h-8 border-4 border-[#263248] border-t-[#4F8CFF] rounded-full animate-spin" /></div>}>
              <SoloSessionDetail />
            </Suspense>
          </LayoutWrapper>
        }
      />
      <Route
        path="/Contact"
        element={
          <LayoutWrapper currentPageName="Contact">
            <ContactPage />
          </LayoutWrapper>
        }
      />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <FeatureFlagProvider>
            <Router>
              <NavigationTracker />
              <AuthenticatedApp />
            </Router>
            <Toaster />
          </FeatureFlagProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App