import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  const [blockStatus, setBlockStatus] = useState(null); // { reason: 'banned'|'suspended', suspensionReason: string }
  const [subscription, setSubscription] = useState(null);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

  useEffect(() => {
    checkAppState();
  }, []);

  // REAL-TIME BAN POLLING: Re-check every 60 seconds while session is active.
  // This closes the stale-session bypass where a user is banned mid-session.
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        const currentUser = await base44.auth.me().catch(() => null);
        if (!currentUser?.email) return;

        const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.email });
        const profile = profiles[0];

        if (profile?.banned === true) {
          setBlockStatus({ reason: 'banned', suspensionReason: null });
          setIsAuthenticated(false);
        } else if (profile?.suspended === true) {
          // Auto-expire check: if suspension_end_at is in the past, treat as cleared
          const endAt = profile.suspension_end_at ? new Date(profile.suspension_end_at) : null;
          if (endAt && new Date() > endAt) {
            // Expired — allow access; backend will clean up on next API call
            setBlockStatus(null);
          } else {
            setBlockStatus({ reason: 'suspended', suspensionReason: profile?.suspension_reason, suspensionEndAt: profile?.suspension_end_at });
            setIsAuthenticated(false);
          }
        }
      } catch (e) {
        // Silently ignore poll errors — don't disrupt the session
      }
    }, 60000); // every 60 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      
      // First, check app public settings (with token if available)
      // This will tell us if auth is required, user not registered, etc.
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: {
          'X-App-Id': appParams.appId
        },
        token: appParams.token, // Include token if available
        interceptResponses: true
      });
      
      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);
        
        // If we got the app public settings successfully, check if user is authenticated
        if (appParams.token) {
          await checkUserAuth();
        } else {
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);
      } catch (appError) {
        console.error('App state check failed:', appError);
        
        // Handle app-level errors
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            setAuthError({
              type: 'auth_required',
              message: 'Authentication required'
            });
          } else if (reason === 'user_not_registered') {
            setAuthError({
              type: 'user_not_registered',
              message: 'User not registered for this app'
            });
          } else {
            setAuthError({
              type: reason,
              message: appError.message
            });
          }
        } else {
          setAuthError({
            type: 'unknown',
            message: appError.message || 'Failed to load app'
          });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'An unexpected error occurred'
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Check if user is banned or suspended
      try {
        const profiles = await base44.entities.UserProfile.filter({ user_id: currentUser.email });
        const profile = profiles[0];
        
        if (profile?.banned) {
          setBlockStatus({ reason: 'banned', suspensionReason: null });
          setIsAuthenticated(false);
          setIsLoadingAuth(false);
          return;
        }
        
        if (profile?.suspended) {
          // Auto-expire check
          const endAt = profile.suspension_end_at ? new Date(profile.suspension_end_at) : null;
          if (endAt && new Date() > endAt) {
            // Expired — allow through; backend will clean on next call
          } else {
            setBlockStatus({ reason: 'suspended', suspensionReason: profile?.suspension_reason, suspensionEndAt: profile?.suspension_end_at });
            setIsAuthenticated(false);
            setIsLoadingAuth(false);
            return;
          }
        }
      } catch (profileError) {
        console.error('Failed to fetch user profile:', profileError);
      }
      
      // Fetch subscription status
      try {
        const subs = await base44.entities.Subscription.filter({ user_id: currentUser.email });
        const sub = subs[0] || null;
        setSubscription(sub);
        
        // Determine if subscription blocks access
        const isActive = sub?.status === 'active' || sub?.status === 'trial';
        setSubscriptionBlocked(!isActive);
      } catch (subError) {
        console.error('Failed to fetch subscription:', subError);
        setSubscription(null);
        setSubscriptionBlocked(true); // Block if we can't check subscription
      }
      
      setBlockStatus(null);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      // Use the SDK's logout method which handles token cleanup and redirect
      base44.auth.logout(window.location.href);
    } else {
      // Just remove the token without redirect
      base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    // Use the SDK's redirectToLogin method
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      blockStatus,
      appPublicSettings,
      subscription,
      subscriptionBlocked,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};