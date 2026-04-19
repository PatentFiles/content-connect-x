/**
 * pages.config.jsx — Code-split page registry.
 * Every page is lazy-loaded via React.lazy() so each route is a
 * separate JS chunk, reducing the initial bundle size significantly.
 */

import React, { lazy, Suspense } from 'react';
import __Layout from './Layout.jsx';

// --- Lazy page imports ---
const AdminDashboard       = lazy(() => import('./pages/AdminDashboard'));
const AgentManagement      = lazy(() => import('./pages/AgentManagement'));
const AvailabilitySchedule = lazy(() => import('./pages/AvailabilitySchedule'));
const CollaborationDetail  = lazy(() => import('./pages/CollaborationDetail'));
const Collaborations       = lazy(() => import('./pages/Collaborations'));
const CompliancePortal     = lazy(() => import('./pages/CompliancePortal'));
const Connections          = lazy(() => import('./pages/Connections'));
const Contracts            = lazy(() => import('./pages/Contracts'));
const CreateCollaboration  = lazy(() => import('./pages/CreateCollaboration'));
const Dashboard            = lazy(() => import('./pages/Dashboard'));
const Discovery            = lazy(() => import('./pages/Discovery'));
const FAQ                  = lazy(() => import('./pages/FAQ'));
const Favorites            = lazy(() => import('./pages/Favorites'));
const HowItWorks           = lazy(() => import('./pages/HowItWorks'));
const Landing              = lazy(() => import('./pages/Landing'));
const Messages             = lazy(() => import('./pages/Messages'));
const Notifications        = lazy(() => import('./pages/Notifications'));
const Portfolio            = lazy(() => import('./pages/Portfolio'));
const Pricing              = lazy(() => import('./pages/Pricing'));
const Privacy              = lazy(() => import('./pages/Privacy'));
const Profile              = lazy(() => import('./pages/Profile'));
const Representations      = lazy(() => import('./pages/Representations'));
const RosterPortfolio      = lazy(() => import('./pages/RosterPortfolio'));
const Search               = lazy(() => import('./pages/Search'));
const Settings             = lazy(() => import('./pages/Settings'));
const Terms                = lazy(() => import('./pages/Terms'));
const Testing              = lazy(() => import('./pages/Testing'));
const TravelSchedule       = lazy(() => import('./pages/TravelSchedule'));
const Verification         = lazy(() => import('./pages/Verification'));
const ViewContract         = lazy(() => import('./pages/ViewContract'));
const ViewProfile          = lazy(() => import('./pages/ViewProfile'));
const DeveloperReadMe      = lazy(() => import('./pages/DeveloperReadMe'));
const ModerationFlags      = lazy(() => import('./pages/ModerationFlags'));
const HostingMarketplace   = lazy(() => import('./pages/HostingMarketplace'));
const PropertyDetail       = lazy(() => import('./pages/PropertyDetail'));
const HostDashboard        = lazy(() => import('./pages/HostDashboard'));
const HostProfile          = lazy(() => import('./pages/HostProfile'));
const HostSettings         = lazy(() => import('./pages/HostSettings'));
const SoloSessionDetail    = lazy(() => import('./pages/SoloSessionDetail'));

// Fullscreen spinner shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0B0F14]">
      <div className="w-8 h-8 border-4 border-[#263248] border-t-[#4F8CFF] rounded-full animate-spin" />
    </div>
  );
}

/** Wrap every lazy page in Suspense so chunk loading is handled globally */
function withSuspense(Component) {
  return function SuspenseWrapper(props) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

export const PAGES = {
  AdminDashboard:       withSuspense(AdminDashboard),
  AgentManagement:      withSuspense(AgentManagement),
  AvailabilitySchedule: withSuspense(AvailabilitySchedule),
  CollaborationDetail:  withSuspense(CollaborationDetail),
  Collaborations:       withSuspense(Collaborations),
  CompliancePortal:     withSuspense(CompliancePortal),
  Connections:          withSuspense(Connections),
  Contracts:            withSuspense(Contracts),
  CreateCollaboration:  withSuspense(CreateCollaboration),
  Dashboard:            withSuspense(Dashboard),
  Discovery:            withSuspense(Discovery),
  FAQ:                  withSuspense(FAQ),
  Favorites:            withSuspense(Favorites),
  HowItWorks:           withSuspense(HowItWorks),
  Landing:              withSuspense(Landing),
  Messages:             withSuspense(Messages),
  Notifications:        withSuspense(Notifications),
  Portfolio:            withSuspense(Portfolio),
  Pricing:              withSuspense(Pricing),
  Privacy:              withSuspense(Privacy),
  Profile:              withSuspense(Profile),
  Representations:      withSuspense(Representations),
  RosterPortfolio:      withSuspense(RosterPortfolio),
  Search:               withSuspense(Search),
  Settings:             withSuspense(Settings),
  Terms:                withSuspense(Terms),
  Testing:              withSuspense(Testing),
  TravelSchedule:       withSuspense(TravelSchedule),
  Verification:         withSuspense(Verification),
  ViewContract:         withSuspense(ViewContract),
  ViewProfile:          withSuspense(ViewProfile),
  DeveloperReadMe:      withSuspense(DeveloperReadMe),
  ModerationFlags:      withSuspense(ModerationFlags),
  HostingMarketplace:   withSuspense(HostingMarketplace),
  PropertyDetail:       withSuspense(PropertyDetail),
  HostDashboard:        withSuspense(HostDashboard),
  HostProfile:          withSuspense(HostProfile),
  HostSettings:         withSuspense(HostSettings),
  SoloSessionDetail:    withSuspense(SoloSessionDetail),
};

export const pagesConfig = {
  mainPage: 'Landing',
  Pages: PAGES,
  Layout: __Layout,
};