import React, { createContext, useContext, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * TabNavigator — Persistent scroll position and back-stack per tab.
 *
 * This implements native-app-like tab navigation:
 * - Each tab remembers its scroll position when you leave and restores it when you return.
 * - Tapping the same tab again scrolls back to the top (native iOS/Android behavior).
 * - Deep-link routes (ViewCollaboration, ViewProfile, etc.) push onto the current tab's stack.
 * - The back button within a tab pops back to the previous route in that tab's stack.
 *
 * Usage:
 *   Wrap the layout with <TabNavigatorProvider>.
 *   Use useTabNavigator().navigate(path) to navigate and push to the current tab stack.
 *   BottomNav calls useTabNavigator().switchTab(tabPath) to switch tabs.
 */

const TAB_ROOTS = [
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

const TabNavigatorContext = createContext(null);

export function TabNavigatorProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  // scrollPositions[tabRoot] = scrollY
  const scrollPositions = useRef({});
  // tabStacks[tabRoot] = [path1, path2, ...]
  const tabStacks = useRef({});

  // Determine which tab root the current path belongs to
  const getActiveTab = useCallback((path) => {
    // Exact match first
    if (TAB_ROOTS.includes(path)) return path;
    // Default to Dashboard
    return '/Dashboard';
  }, []);

  const activeTab = getActiveTab(location.pathname);

  // Save scroll position for the current route before leaving
  const saveScroll = useCallback((path) => {
    scrollPositions.current[path] = window.scrollY;
  }, []);

  // Restore scroll position for a route
  const restoreScroll = useCallback((path) => {
    const y = scrollPositions.current[path] ?? 0;
    // Defer to next frame so the DOM has rendered
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
  }, []);

  /**
   * Switch to a different tab.
   * If already on that tab, scroll back to top (native tab-tap behavior).
   */
  const switchTab = useCallback((tabPath) => {
    const currentPath = location.pathname;
    if (currentPath === tabPath) {
      // Already on this tab — scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Save current scroll
    saveScroll(currentPath);
    // Navigate to tab (restoring last visited sub-route if available)
    const stack = tabStacks.current[tabPath];
    const dest = stack?.length ? stack[stack.length - 1] : tabPath;
    navigate(dest);
    // Restore scroll on next tick
    setTimeout(() => restoreScroll(dest), 50);
  }, [location.pathname, navigate, saveScroll, restoreScroll]);

  /**
   * Push a new route onto the current tab's stack.
   */
  const pushRoute = useCallback((path) => {
    const tab = activeTab;
    if (!tabStacks.current[tab]) tabStacks.current[tab] = [tab];
    saveScroll(location.pathname);
    tabStacks.current[tab].push(path);
    navigate(path);
  }, [activeTab, location.pathname, navigate, saveScroll]);

  /**
   * Pop back within the current tab's stack.
   * Falls back to the tab root if stack is empty.
   */
  const popRoute = useCallback(() => {
    const tab = activeTab;
    const stack = tabStacks.current[tab] || [];
    if (stack.length > 1) {
      stack.pop();
      const dest = stack[stack.length - 1];
      navigate(dest);
      setTimeout(() => restoreScroll(dest), 50);
    } else {
      navigate(tab);
    }
  }, [activeTab, navigate, restoreScroll]);

  return (
    <TabNavigatorContext.Provider value={{ switchTab, pushRoute, popRoute, activeTab, TAB_ROOTS }}>
      {children}
    </TabNavigatorContext.Provider>
  );
}

export function useTabNavigator() {
  const ctx = useContext(TabNavigatorContext);
  if (!ctx) throw new Error('useTabNavigator must be used inside TabNavigatorProvider');
  return ctx;
}

export default TabNavigatorProvider;