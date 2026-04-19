import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ban/suspension check — always enforced regardless of feature flags
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
    const profile = profiles[0];
    if (profile?.banned === true || profile?.suspended === true) {
      return Response.json({ error: 'Account is blocked', code: profile?.banned ? 'banned' : 'suspended', blocked: true }, { status: 403 });
    }

    // Load verification feature flag — if OFF, bypass all verification enforcement
    let verificationEnabled = true;
    try {
      const flags = await base44.asServiceRole.entities.PlatformFeatureFlag.list();
      const vFlag = flags.find(f => f.flag_key === 'verification');
      if (vFlag && vFlag.value_type === 'boolean') {
        verificationEnabled = vFlag.bool_value !== false;
      }
    } catch { /* fail safe — keep true */ }

    const { action, target_user_id } = await req.json();

    // When verification is OFF — return pass-through for all actions
    if (!verificationEnabled) {
      return Response.json({
        verified: true,
        status: 'approved',
        blocked: false,
        flag_bypassed: true,
      });
    }

    // Get verification record for target user (or current user if not specified)
    const userId = target_user_id || user.email;
    const verifications = await base44.entities.VerificationRecord.filter({ user_id: userId });

    if (verifications.length === 0) {
      return Response.json({
        verified: false,
        status: 'unverified',
        message: 'No verification record found',
      });
    }

    const verification = verifications[0];
    const now = new Date();

    // Check if verification has expired
    if (verification.expires_at && new Date(verification.expires_at) < now) {
      if (verification.status !== 'expired') {
        await base44.asServiceRole.entities.VerificationRecord.update(verification.id, {
          status: 'expired',
        });

        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM',
          action_type: 'verification_expired',
          target_user_id: userId,
          details: { verification_id: verification.id },
          reason: 'Verification expired automatically',
        });

        // Only pause collaborations when verification enforcement is ON
        const activeCollabs = await base44.asServiceRole.entities.Collaboration.filter({
          participant_ids: userId,
          status: 'active',
        });

        for (const collab of activeCollabs) {
          await base44.asServiceRole.entities.Collaboration.update(collab.id, { status: 'paused' });
          await base44.asServiceRole.entities.CollaborationActivityLog.create({
            collaboration_id: collab.id,
            activity_type: 'VERIFICATION_EXPIRED',
            user_id: 'SYSTEM',
            details: { affected_user: userId, reason: 'Participant verification expired' },
          });
        }
      }

      return Response.json({
        verified: false,
        status: 'expired',
        message: 'Verification has expired',
        requires_reverification: true,
      });
    }

    const isVerified = verification.status === 'approved';

    // Map actions to required verification — only enforced when flag is ON
    const requiresVerification = [
      'browse_profiles',
      'send_message',
      'join_collaboration',
      'sign_contract',
      'create_collaboration',
      'view_profile',
    ].includes(action);

    if (requiresVerification && !isVerified) {
      return Response.json({
        verified: false,
        status: verification.status,
        message: `Action '${action}' requires verified status. Current status: ${verification.status}`,
        blocked: true,
      });
    }

    return Response.json({
      verified: isVerified,
      status: verification.status,
      expires_at: verification.expires_at,
      verified_at: verification.verified_at,
      blocked: false,
    });

  } catch (error) {
    console.error('Verification validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});