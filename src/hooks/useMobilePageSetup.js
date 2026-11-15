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
  const { setTitle, setBackAction, setRightAction } = useMobileNav();

  useEffect(() => {
    setTitle(title);
    setBackAction(onBack ?? null);
    setRightAction(rightAction ?? null);

    return () => {
      setTitle('');
      setBackAction(null);
      setRightAction(null);
    };
  }, [title, onBack, rightAction, setTitle, setBackAction, setRightAction]);
}