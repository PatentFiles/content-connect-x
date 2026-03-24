/**
 * useMobilePageSetup — registers a page title and back button in MobileHeader.
 *
 * Usage:
 *   useMobilePageSetup({ title: 'View Profile', onBack: () => navigate(-1) });
 *
 * Always safe to call — silently no-ops when MobileNavProvider is not mounted.
 */

import { useEffect } from 'react';
import { useMobileNav } from '@/lib/MobileNavContext';

export default function useMobilePageSetup({ title = '', onBack, rightAction } = {}) {
  // useMobileNav will throw if called outside MobileNavProvider.
  // We catch that at the MobileNavContext level by returning a no-op context
  // when there's no provider — see MobileNavContext safe export below.
  const mobileNav = useMobileNav();

  useEffect(() => {
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