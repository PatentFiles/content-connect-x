import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // BAN CHECK - banned/suspended users cannot query verification status for others
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
      const profile = profiles[0];
      if (profile?.banned === true || profile?.suspended === true) {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM_BAN_ENFORCEMENT', action_type: 'blocked_action_attempt',
          target_user_id: user.email,
          details: { action_attempted: 'validate_verification_status', block_reason: profile?.banned ? 'banned' : 'suspended', timestamp: new Date().toISOString() },
          reason: `Blocked ${profile?.banned ? 'banned' : 'suspended'} user from: validate_verification_status`
        });
        return Response.json({ error: 'Account is blocked', code: profile?.banned ? 'banned' : 'suspended', blocked: true }, { status: 403 });
      }
    } catch (e) { return Response.json({ error: 'Unable to verify account status', blocked: true }, { status: 403 }); }

    const { action, target_user_id } = await req.json();

    // Get verification record for target user (or current user if not specified)
    const userId = target_user_id || user.email;
    const verifications = await base44.entities.VerificationRecord.filter({ 
      user_id: userId 
    });

    if (verifications.length === 0) {
      return Response.json({
        verified: false,
        status: 'unverified',
        message: 'No verification record found'
      });
    }

    const verification = verifications[0];
    const now = new Date();

    // Check if verification has expired
    if (verification.expires_at && new Date(verification.expires_at) < now) {
      // Update status to expired if not already
      if (verification.status !== 'expired') {
        await base44.asServiceRole.entities.VerificationRecord.update(verification.id, {
          status: 'expired'
        });

        // Log the expiry
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM',
          action_type: 'verification_expired',
          target_user_id: userId,
          details: { verification_id: verification.id },
          reason: 'Verification expired automatically'
        });

        // Pause active collaborations
        const activeCollabs = await base44.asServiceRole.entities.Collaboration.filter({
          participant_ids: userId,
          status: 'active'
        });

        for (const collab of activeCollabs) {
          await base44.asServiceRole.entities.Collaboration.update(collab.id, {
            status: 'paused'
          });

          await base44.asServiceRole.entities.CollaborationActivityLog.create({
            collaboration_id: collab.id,
            activity_type: 'VERIFICATION_EXPIRED',
            user_id: 'SYSTEM',
            details: { 
              affected_user: userId,
              reason: 'Participant verification expired'
            }
          });
        }
      }

      return Response.json({
        verified: false,
        status: 'expired',
        message: 'Verification has expired',
        requires_reverification: true
      });
    }

    // Check verification status
    const isVerified = verification.status === 'approved';

    // Map actions to required verification
    const requiresVerification = [
      'browse_profiles',
      'send_message',
      'join_collaboration',
      'sign_contract',
      'create_collaboration',
      'view_profile'
    ].includes(action);

    if (requiresVerification && !isVerified) {
      return Response.json({
        verified: false,
        status: verification.status,
        message: `Action '${action}' requires verified status. Current status: ${verification.status}`,
        blocked: true
      });
    }

    return Response.json({
      verified: isVerified,
      status: verification.status,
      expires_at: verification.expires_at,
      verified_at: verification.verified_at,
      blocked: false
    });

  } catch (error) {
    console.error('Verification validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});