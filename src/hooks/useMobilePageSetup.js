/**
 * useMobilePageSetup — convenience hook to register a page title and back button
 * in the global MobileHeader.
 *
 * Usage:
 *   useMobilePageSetup({ title: 'Profile Details', onBack: () => navigate(-1) });
 *
 * The hook handles cleanup on unmount automatically.
 * Safe to call outside MobileNavProvider (no-op in that case).
 */

import { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMobileNav } from '@/lib/MobileNavContext';

export default function useMobilePageSetup({ title = '', onBack, rightAction } = {}) {
  let mobileNav = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    mobileNav = useMobileNav();
  } catch {
    // MobileNavProvider not mounted (e.g. public pages) — silently skip
  }

  useEffect(() => {
    if (!mobileNav) return;
    mobileNav.setTitle(title);
    mobileNav.setBackAction(onBack ?? null);
    mobileNav.setRightAction(rightAction ?? null);

    return () => {
      mobileNav.setTitle('');
      mobileNav.setBackAction(null);
      mobileNav.setRightAction(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}