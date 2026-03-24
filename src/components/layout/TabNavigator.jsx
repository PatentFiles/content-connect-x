import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * TabNavigator — Persistent back-stack and scroll position per tab.
 *
 * Native-app-like behavior:
 * - Each tab has its own route stack and scroll memory.
 * - Tapping the active tab scrolls to top (iOS/Android tap-to-top).
 * - Deep-link routes push onto the current tab's stack.
 * - popRoute() pops back within the tab, falling back to the tab root.
 * - navigationDirection is exposed so PageTransition can animate correctly.
 */

export const TAB_ROOTS = [
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

// Sub-routes that belong to a specific tab root
const SUB_ROUTE_MAP = {
  '/ViewProfile':       '/Discovery',
  '/ViewCollaboration': '/Collaborations',
  '/CollaborationDetail': '/Collaborations',
  '/CreateCollaboration': '/Collaborations',
  '/ViewContract':      '/Contracts',
};

const TabNavigatorContext = createContext(null);

export function TabNavigatorProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // scrollPositions[path] = scrollY
  const scrollPositions = useRef({});
  // tabStacks[tabRoot] = [path, ...]
  const tabStacks = useRef({});
  // navigation direction for transition animation
  const navigationDirection = useRef('forward'); // 'forward' | 'back' | 'tab'

  /** Return the tab root this path belongs to */
  const getTabForPath = useCallback((path) => {
    const clean = path.split('?')[0];
    if (TAB_ROOTS.includes(clean)) return clean;
    // Check explicit sub-route map
    for (const [sub, tab] of Object.entries(SUB_ROUTE_MAP)) {
      if (clean.startsWith(sub)) return tab;
    }
    return '/Dashboard';
  }, []);

  const activeTab = getTabForPath(location.pathname);

  const saveScroll = useCallback((path) => {
    scrollPositions.current[path] = window.scrollY;
  }, []);

  const restoreScroll = useCallback((path) => {
    const y = scrollPositions.current[path] ?? 0;
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
  }, []);

  /**
   * Switch to a tab root.
   * - Already on this tab? Scroll to top.
   * - Otherwise: save scroll, navigate to tab's last sub-route or root, restore scroll.
   */
  const switchTab = useCallback((tabPath) => {
    const currentPath = location.pathname;
    const currentClean = currentPath.split('?')[0];
    const currentTab = getTabForPath(currentClean);

    if (currentTab === tabPath && currentClean === tabPath) {
      // Already on this exact tab root — scroll to top (native tap-to-top)
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    saveScroll(currentPath);
    navigationDirection.current = 'tab';

    // Restore to the deepest route in the target tab's stack
    const stack = tabStacks.current[tabPath];
    const dest = stack?.length ? stack[stack.length - 1] : tabPath;

    navigate(dest);
    setTimeout(() => restoreScroll(dest), 80);
  }, [location.pathname, navigate, saveScroll, restoreScroll, getTabForPath]);

  /**
   * Push a new route onto the current tab's stack (forward navigation).
   */
  const pushRoute = useCallback((path) => {
    const tab = activeTab;
    if (!tabStacks.current[tab]) tabStacks.current[tab] = [tab];
    saveScroll(location.pathname);
    tabStacks.current[tab].push(path);
    navigationDirection.current = 'forward';
    navigate(path);
  }, [activeTab, location.pathname, navigate, saveScroll]);

  /**
   * Pop back within the current tab's stack.
   * Falls back to the tab root if stack is empty.
   * Also supports native browser back (window.history.back).
   */
  const popRoute = useCallback(() => {
    const tab = activeTab;
    const stack = tabStacks.current[tab] || [];
    navigationDirection.current = 'back';
    if (stack.length > 1) {
      stack.pop();
      const dest = stack[stack.length - 1];
      navigate(dest);
      setTimeout(() => restoreScroll(dest), 80);
    } else {
      navigate(tab);
      setTimeout(() => restoreScroll(tab), 80);
    }
  }, [activeTab, navigate, restoreScroll]);

  // Listen to native browser back/forward so direction is set correctly
  useEffect(() => {
    const handlePopState = () => {
      navigationDirection.current = 'back';
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  /**
   * Sync the stack when the location changes externally (e.g. browser back/forward, Link clicks).
   */
  useEffect(() => {
    const path = location.pathname;
    const tab = getTabForPath(path);
    if (!tabStacks.current[tab]) tabStacks.current[tab] = [tab];
    const stack = tabStacks.current[tab];
    // Only push if not already top of stack
    if (stack[stack.length - 1] !== path) {
      stack.push(path);
    }
  }, [location.pathname, getTabForPath]);

  return (
    <TabNavigatorContext.Provider value={{
      switchTab,
      pushRoute,
      popRoute,
      activeTab,
      navigationDirection,
      TAB_ROOTS,
      getTabForPath,
    }}>
      {children}
    </TabNavigatorContext.Provider>
  );
}

export function useTabNavigator() {
  return useContext(TabNavigatorContext);
}

export default TabNavigatorProvider;