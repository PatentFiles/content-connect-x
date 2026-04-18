import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * activateHostAccount
 * Securely activates host status for the current user.
 * Validates the request server-side before setting host_account_active.
 * Replaces the direct frontend entity mutation in HostOnboardingGateModal.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;

    // Fetch user profile
    const profiles = await svc.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];

    if (!profile) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.banned || profile.suspended) {
      return Response.json({ error: 'Account restricted' }, { status: 403 });
    }

    if (profile.host_account_active) {
      return Response.json({ success: true, already_active: true });
    }

    const body = await req.json().catch(() => ({}));
    const { terms_accepted } = body;

    if (!terms_accepted) {
      return Response.json({ error: 'Host terms must be accepted' }, { status: 400 });
    }

    // Activate host account
    await svc.entities.UserProfile.update(profile.id, {
      host_account_active: true,
      host_terms_accepted_at: new Date().toISOString(),
    });

    // Audit log
    await svc.entities.AdminActionLog.create({
      admin_user_id: 'SYSTEM_HOST_ONBOARDING',
      target_type: 'UserProfile',
      target_id: profile.id,
      action: 'host_account_activated',
      reason: `Host account activated by ${user.email} after terms acceptance`,
      metadata_json: {
        user_id: user.email,
        activated_at: new Date().toISOString(),
      },
    }).catch(() => {});

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});