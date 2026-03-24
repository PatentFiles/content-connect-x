/**
 * MobileNavContext — provides per-page title and back-button config
 * for the MobileHeader component.
 *
 * Usage in any page:
 *   import { useMobileNav } from '@/lib/MobileNavContext';
 *   const { setTitle, setBackAction } = useMobileNav();
 *   useEffect(() => {
 *     setTitle('My Page');
 *     setBackAction(() => navigate(-1));
 *     return () => { setTitle(''); setBackAction(null); };
 *   }, []);
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

const MobileNavContext = createContext(null);

export function MobileNavProvider({ children }) {
  const [title, _setTitle]       = useState('');
  const [backAction, _setBack]   = useState(null);
  const [rightAction, _setRight] = useState(null); // { icon, onPress, label }

  const setTitle       = useCallback((t)  => _setTitle(t), []);
  const setBackAction  = useCallback((fn) => _setBack(fn ? () => fn : null), []);
  const setRightAction = useCallback((obj) => _setRight(obj ? () => obj : null), []);

  return (
    <MobileNavContext.Provider value={{ title, backAction, rightAction, setTitle, setBackAction, setRightAction }}>
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error('useMobileNav must be used inside MobileNavProvider');
  return ctx;
}