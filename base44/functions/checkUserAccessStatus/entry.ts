import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Backend guard: verify a user is not banned or suspended.
 * Handles auto-expiry of timed suspensions.
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

    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];

    if (!profile) {
      return Response.json({ allowed: true });
    }

    // --- Permanent ban check ---
    if (profile.banned === true) {
      try {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_user_id: 'SYSTEM_BAN_ENFORCEMENT',
          action: 'blocked_access_check',
          target_type: 'User',
          target_id: user.email,
          reason: 'Blocked banned user from access check',
          metadata_json: { block_reason: 'banned', timestamp: new Date().toISOString() },
        });
      } catch (e) {}

      return Response.json({
        allowed: false,
        reason: 'banned',
        message: 'Your account has been permanently banned.',
      }, { status: 403 });
    }

    // --- Timed suspension check with auto-expiry ---
    if (profile.suspended === true) {
      const now = new Date();
      const endAt = profile.suspension_end_at ? new Date(profile.suspension_end_at) : null;

      // Auto-expire if end date has passed
      if (endAt && now > endAt) {
        try {
          await base44.asServiceRole.entities.UserProfile.update(profile.id, {
            suspended: false,
            reinstated_at: now.toISOString(),
            reinstated_by_admin_id: 'SYSTEM_AUTO_EXPIRY',
          });
          await base44.asServiceRole.entities.AdminActionLog.create({
            admin_user_id: 'SYSTEM_AUTO_EXPIRY',
            action: 'auto_unsuspend',
            target_type: 'User',
            target_id: user.email,
            reason: 'Suspension period expired automatically',
            metadata_json: { suspension_end_at: profile.suspension_end_at, timestamp: now.toISOString() },
          });
        } catch (e) {}

        return Response.json({ allowed: true, auto_reinstated: true });
      }

      // Still suspended
      try {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_user_id: 'SYSTEM_BAN_ENFORCEMENT',
          action: 'blocked_access_check',
          target_type: 'User',
          target_id: user.email,
          reason: 'Blocked suspended user from access check',
          metadata_json: { block_reason: 'suspended', suspension_end_at: profile.suspension_end_at, timestamp: now.toISOString() },
        });
      } catch (e) {}

      return Response.json({
        allowed: false,
        reason: 'suspended',
        suspensionReason: profile.suspension_reason || null,
        suspensionEndAt: profile.suspension_end_at || null,
        message: `Your account has been suspended. ${profile.suspension_reason ? `Reason: ${profile.suspension_reason}` : 'Contact support.'}`,
      }, { status: 403 });
    }

    return Response.json({ allowed: true, on_probation: profile.on_probation || false, probation_restrictions: profile.probation_restrictions || null });
  } catch (error) {
    return Response.json({ error: error.message, allowed: false }, { status: 500 });
  }
});