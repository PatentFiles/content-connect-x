import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config.jsx'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
const SoloSessionDetail = lazy(() => import('./pages/SoloSessionDetail'));
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { FeatureFlagProvider } from '@/lib/featureFlags';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AccountBlockedScreen from '@/components/auth/AccountBlockedScreen';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, blockStatus, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
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
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
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
  )
}

export default App