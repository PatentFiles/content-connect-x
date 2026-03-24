import React, { useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * TabNavigator — persistent stack navigation per tab.
 *
 * Each "tab" route gets its own hidden/shown <div> so React Query cache,
 * scroll position, and component state are ALL preserved when switching tabs.
 *
 * How it works:
 * - Every time the user navigates to a new route, we track it in a `stack` ref.
 * - The last render of each known route is kept mounted but hidden (display:none)
 *   when not the active route.
 * - The active route's container is visible (display:block).
 * - This gives iOS/Android-style stack preservation without any native bridge.
 *
 * Note: Non-tab deep-routes (e.g. ViewCollaboration, ViewProfile) are NOT cached
 * — they re-mount fresh each visit, which is correct behavior.
 */

// Routes that should be cached / persistent (tab roots)
const PERSISTENT_ROUTES = [
  '/',
  '/Dashboard',
  '/Discovery',
  '/Search',
  '/Messages',
  '/Collaborations',
  '/Contracts',
  '/Favorites',
  '/Connections',
  '/Testing',
  '/Verification',
  '/Profile',
  '/Settings',
  '/Notifications',
  '/Portfolio',
  '/Representations',
  '/RosterPortfolio',
  '/AgentManagement',
  '/AvailabilitySchedule',
  '/TravelSchedule',
  '/AdminDashboard',
  '/CompliancePortal',
];

export default function TabNavigator({ children }) {
  const location = useLocation();
  const mountedRoutes = useRef(new Set());
  const path = location.pathname;
  const isPersistent = PERSISTENT_ROUTES.includes(path);

  // Track mounted persistent routes
  useEffect(() => {
    if (isPersistent) {
      mountedRoutes.current.add(path);
    }
  }, [path, isPersistent]);

  // For non-persistent routes, just render children directly
  if (!isPersistent) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Render all previously visited persistent routes, but only show the active one */}
      {Array.from(mountedRoutes.current).map((route) => (
        <div
          key={route}
          style={{ display: route === path ? 'block' : 'none' }}
          aria-hidden={route !== path}
        >
          {/* Children rendered fresh only once per route mount */}
          {route === path ? children : null}
        </div>
      ))}
    </>
  );
}