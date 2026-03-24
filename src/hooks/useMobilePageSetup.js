/**
 * useMobilePageSetup — convenience hook to set the MobileHeader title and back action
 * for sub-pages (detail views, settings sub-sections, etc.).
 *
 * Usage:
 *   useMobilePageSetup({ title: 'Profile', onBack: () => navigate(-1) });
 *
 * The hook handles cleanup on unmount automatically.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Gracefully handle cases where MobileNavContext is not mounted
// (e.g. public pages that don't use the full layout)
let _useMobileNav = null;
try {
  const ctx = require('@/lib/MobileNavContext');
  _useMobileNav = ctx.useMobileNav;
} catch {}

export default function useMobilePageSetup({ title, onBack, rightAction } = {}) {
  const navigate = useNavigate();

  let mobileNav = null;
  try {
    if (_useMobileNav) mobileNav = _useMobileNav();
  } catch {}

  useEffect(() => {
    if (!mobileNav) return;
    if (title)       mobileNav.setTitle(title);
    if (onBack)      mobileNav.setBackAction(onBack);
    else if (onBack === null) mobileNav.setBackAction(null); // explicit clear
    if (rightAction) mobileNav.setRightAction(rightAction);

    return () => {
      mobileNav.setTitle('');
      mobileNav.setBackAction(null);
      mobileNav.setRightAction(null);
    };
  }, [title]); // re-run only when title changes
}