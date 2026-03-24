import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Backend guard: call this to verify a user is not banned or suspended.
 * Returns { allowed: true } or { allowed: false, reason, suspensionReason }
 * Can be invoked by other backend functions or called directly from frontend.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await base44.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];

    if (!profile) {
      // No profile yet — allow (new user)
      return Response.json({ allowed: true });
    }

    if (profile.banned === true) {
      return Response.json({
        allowed: false,
        reason: 'banned',
        suspensionReason: null,
        message: 'Your account has been permanently banned.'
      }, { status: 403 });
    }

    if (profile.suspended === true) {
      return Response.json({
        allowed: false,
        reason: 'suspended',
        suspensionReason: profile.suspension_reason || null,
        message: `Your account has been suspended. Reason: ${profile.suspension_reason || 'Policy violation.'}`
      }, { status: 403 });
    }

    return Response.json({ allowed: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});