import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Backend guard: verify a user is not banned or suspended.
 * Uses service role so it cannot be spoofed.
 * Returns { allowed: true } or { allowed: false, reason, message }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to fetch profile (cannot be spoofed by user)
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];

    if (!profile) {
      return Response.json({ allowed: true });
    }

    if (profile.banned === true) {
      // Log the access attempt
      try {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM_BAN_ENFORCEMENT',
          action_type: 'blocked_access_check',
          target_user_id: user.email,
          details: { block_reason: 'banned', timestamp: new Date().toISOString() },
          reason: 'Blocked banned user from access check'
        });
      } catch (e) {}

      return Response.json({
        allowed: false,
        reason: 'banned',
        message: 'Your account has been permanently banned.'
      }, { status: 403 });
    }

    if (profile.suspended === true) {
      try {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM_BAN_ENFORCEMENT',
          action_type: 'blocked_access_check',
          target_user_id: user.email,
          details: { block_reason: 'suspended', timestamp: new Date().toISOString() },
          reason: 'Blocked suspended user from access check'
        });
      } catch (e) {}

      return Response.json({
        allowed: false,
        reason: 'suspended',
        suspensionReason: profile.suspension_reason || null,
        message: `Your account has been suspended. ${profile.suspension_reason ? `Reason: ${profile.suspension_reason}` : 'Contact support.'}`
      }, { status: 403 });
    }

    return Response.json({ allowed: true });
  } catch (error) {
    // Fail secure: if we cannot verify, deny access
    return Response.json({ error: error.message, allowed: false }, { status: 500 });
  }
});