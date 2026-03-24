/**
 * useProtectedMutation
 * 
 * A wrapper around all sensitive mutations that:
 * 1. Re-checks ban/suspend status BEFORE every mutation (closes stale-session bypass)
 * 2. Routes through the protected backend function (closes SDK/devtools bypass)
 * 3. Returns a consistent error for blocked users
 * 4. Triggers logout + blocked screen if user was just banned mid-session
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

/**
 * Re-checks if the current user is banned/suspended.
 * Call this before any sensitive mutation.
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function revalidateBanStatus(userEmail) {
  if (!userEmail) return { allowed: false, reason: 'unauthenticated' };

  try {
    const profiles = await base44.entities.UserProfile.filter({ user_id: userEmail });
    const profile = profiles[0];

    if (profile?.banned === true) {
      return { allowed: false, reason: 'banned' };
    }
    if (profile?.suspended === true) {
      return { allowed: false, reason: 'suspended', suspensionReason: profile.suspension_reason };
    }
    return { allowed: true };
  } catch (error) {
    console.error('Ban revalidation error:', error);
    // Fail closed: if we can't verify, block the action
    return { allowed: false, reason: 'error' };
  }
}

/**
 * Hook that wraps mutations with ban enforcement.
 * 
 * Usage:
 *   const { protectedMutate } = useProtectedMutation();
 *   await protectedMutate('send_message', { conversation_id, body });
 */
export function useProtectedMutation() {
  const { checkAppState } = useAuth();

  const protectedMutate = async (action, payload, { onSuccess, onError } = {}) => {
    // Step 1: Get current user email from cache (fast, no network)
    const user = await base44.auth.me().catch(() => null);
    if (!user?.email) {
      toast.error('You must be logged in to do that.');
      return null;
    }

    // Step 2: Re-check ban status BEFORE the mutation (closes stale-session bypass)
    const banStatus = await revalidateBanStatus(user.email);
    if (!banStatus.allowed) {
      // If the user was JUST banned during the session, trigger re-auth to show blocked screen
      if (banStatus.reason === 'banned' || banStatus.reason === 'suspended') {
        toast.error('Your account has been blocked. Refreshing your session...');
        // Force re-auth so the blocked screen shows
        setTimeout(() => checkAppState(), 1500);
      } else {
        toast.error('Unable to complete this action.');
      }
      if (onError) onError(banStatus);
      return null;
    }

    // Step 3: Route through protected backend function (closes direct SDK/devtools bypass)
    try {
      const result = await base44.functions.invoke('protectedActions', payload, {
        queryParams: { action }
      });

      // Check if backend also returned a blocked response
      if (result?.data?.blocked || result?.data?.code === 'banned' || result?.data?.code === 'suspended') {
        toast.error(result?.data?.error || 'Your account is blocked.');
        setTimeout(() => checkAppState(), 1500);
        if (onError) onError(result.data);
        return null;
      }

      if (onSuccess) onSuccess(result?.data?.data);
      return result?.data?.data;
    } catch (error) {
      console.error('Protected mutation error:', error);
      if (onError) onError(error);
      throw error;
    }
  };

  return { protectedMutate };
}