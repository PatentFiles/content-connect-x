/**
 * CRITICAL: Shared ban/suspend enforcement utility for all backend functions.
 * Every sensitive function MUST call checkUserBanStatus() before proceeding.
 * 
 * This prevents:
 * - Direct SDK/entity mutations by banned users
 * - Stale-session mutations
 * - Browser devtools bypasses
 * - Backend function bypass attacks
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Check if user is banned or suspended.
 * Call this at the START of every sensitive backend function.
 * 
 * @param {Request} req - The incoming request
 * @param {string} actionName - Name of the action being attempted (for logging)
 * @returns {Promise<{allowed: boolean, user, reason?, message?}>}
 */
export async function checkUserBanStatus(req, actionName = 'unknown_action') {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return { allowed: false, reason: 'unauthorized', message: 'User not authenticated' };
    }

    // Fetch user profile to check ban/suspend status
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({
      user_id: user.email
    });
    const profile = profiles[0];

    // If no profile, allow (new user)
    if (!profile) {
      return { allowed: true, user };
    }

    // Check banned status
    if (profile.banned === true) {
      // Log blocked action
      try {
        await logBlockedAction(base44, user.email, actionName, 'banned');
      } catch (e) {
        console.error('Failed to log blocked action:', e);
      }
      return {
        allowed: false,
        reason: 'banned',
        message: 'Your account has been permanently banned. You cannot perform this action.'
      };
    }

    // Check suspended status
    if (profile.suspended === true) {
      // Log blocked action
      try {
        await logBlockedAction(base44, user.email, actionName, 'suspended');
      } catch (e) {
        console.error('Failed to log blocked action:', e);
      }
      return {
        allowed: false,
        reason: 'suspended',
        message: `Your account is temporarily suspended. ${profile.suspension_reason ? `Reason: ${profile.suspension_reason}` : 'Contact support for more information.'}`
      };
    }

    // User is allowed
    return { allowed: true, user };
  } catch (error) {
    console.error('Error checking ban status:', error);
    // Fail secure - if we can't verify, block the action
    return {
      allowed: false,
      reason: 'error',
      message: 'Unable to verify account status. Please try again.'
    };
  }
}

/**
 * Log blocked actions for audit trail
 */
async function logBlockedAction(base44, userId, actionName, blockReason) {
  try {
    await base44.asServiceRole.entities.AdminActionLog.create({
      admin_id: 'SYSTEM_BAN_ENFORCEMENT',
      action_type: 'blocked_action_attempt',
      target_user_id: userId,
      details: {
        action_attempted: actionName,
        block_reason: blockReason,
        timestamp: new Date().toISOString()
      },
      reason: `Blocked ${blockReason} user from: ${actionName}`
    });
  } catch (e) {
    console.error('Failed to log blocked action:', e);
  }
}

/**
 * Error response format for blocked users
 */
export function createBlockedUserResponse(result) {
  return Response.json(
    {
      error: result.message,
      code: result.reason,
      blocked: true
    },
    { status: 403 }
  );
}