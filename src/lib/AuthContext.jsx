import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { requireSupabase } from '@/api/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [blockStatus, setBlockStatus] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const [verification, setVerification] = useState(null);

  const applySession = useCallback(async (session) => {
    const nextUser = session?.user ?? null;
    setUser(nextUser);
    setIsAuthenticated(Boolean(nextUser));
    setAuthError(null);
    setBlockStatus(null);
    setSubscriptionBlocked(false);

    if (!nextUser) {
      setSubscription(null);
      setVerification(null);
      return;
    }

    const client = requireSupabase();
    const [subscriptionResult, verificationResult, securityResult] = await Promise.all([
      client.from('member_subscriptions').select('status,plan_id,period_end').eq('user_id', nextUser.id).maybeSingle(),
      client.from('age_verification_requests').select('status,expires_at').eq('user_id', nextUser.id).order('created_at', { ascending: false }).limit(1),
      client.from('account_security').select('banned,suspended,suspension_reason,suspension_end_at').eq('user_id', nextUser.id).maybeSingle(),
    ]);

    if (securityResult.data?.banned) {
      setBlockStatus({ reason: 'banned', suspensionReason: null });
      setIsAuthenticated(false);
      return;
    }
    if (securityResult.data?.suspended) {
      const endAt = securityResult.data.suspension_end_at ? new Date(securityResult.data.suspension_end_at) : null;
      if (!endAt || endAt > new Date()) {
        setBlockStatus({ reason: 'suspended', suspensionReason: securityResult.data.suspension_reason, suspensionEndAt: securityResult.data.suspension_end_at });
        setIsAuthenticated(false);
        return;
      }
    }

    setSubscription(subscriptionResult.data ?? null);
    setVerification(verificationResult.data?.[0] ?? null);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data, error } = await requireSupabase().auth.getSession();
      if (error) throw error;
      await applySession(data.session);
    } catch (error) {
      setAuthError({ type: 'unknown', message: error.message || 'Unable to check your session.' });
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
      setIsLoadingAuth(false);
    }
  }, [applySession]);

  useEffect(() => {
    let active = true;
    checkUserAuth();
    const { data: listener } = requireSupabase().auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!active) return;
        try {
          await applySession(session);
        } catch (error) {
          if (active) setAuthError({ type: 'unknown', message: error.message || 'Unable to load your account.' });
        } finally {
          if (active) {
            setAuthChecked(true);
            setIsLoadingAuth(false);
          }
        }
      })();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession, checkUserAuth]);

  const logout = async () => {
    await requireSupabase().auth.signOut();
  };

  const navigateToLogin = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, authChecked, blockStatus, subscription, subscriptionBlocked, verification, logout, navigateToLogin, checkAppState: checkUserAuth, checkUserAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
