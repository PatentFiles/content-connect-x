import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // BAN CHECK
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
      const profile = profiles[0];
      if (profile?.banned === true || profile?.suspended === true) {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM_BAN_ENFORCEMENT', action_type: 'blocked_action_attempt',
          target_user_id: user.email,
          details: { action_attempted: 'validate_contract_initiation', block_reason: profile?.banned ? 'banned' : 'suspended', timestamp: new Date().toISOString() },
          reason: `Blocked ${profile?.banned ? 'banned' : 'suspended'} user from: validate_contract_initiation`
        });
        return Response.json({ error: 'Account is blocked', code: profile?.banned ? 'banned' : 'suspended', blocked: true }, { status: 403 });
      }
    } catch (e) { return Response.json({ error: 'Unable to verify account status', blocked: true }, { status: 403 }); }

    const { collaboration_id } = await req.json();

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id required' }, { status: 400 });
    }

    const validationErrors = [];

    // Get collaboration
    const collaborations = await base44.asServiceRole.entities.Collaboration.filter({
      id: collaboration_id
    });

    if (collaborations.length === 0) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    const collaboration = collaborations[0];
    const participantIds = collaboration.participant_ids || [];

    // ── Authorization: caller must be a participant or an admin ──────────────
    if (!participantIds.includes(user.email) && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check 1: All participants must be verified
    const verifications = await base44.asServiceRole.entities.VerificationRecord.list();
    
    for (const participantId of participantIds) {
      const verification = verifications.find(v => v.user_id === participantId);
      
      if (!verification || verification.status !== 'approved') {
        validationErrors.push({
          type: 'verification',
          user_id: participantId,
          message: `Participant ${participantId} is not verified`
        });
      }

      // Check expiry
      if (verification && verification.expires_at) {
        const expiryDate = new Date(verification.expires_at);
        if (expiryDate < new Date()) {
          validationErrors.push({
            type: 'verification_expired',
            user_id: participantId,
            message: `Participant ${participantId} verification has expired`
          });
        }
      }
    }

    // Check 2: Testing requirement must be satisfied (if required)
    const testingRequirements = await base44.asServiceRole.entities.TestingRequirement.filter({
      collaboration_id
    });

    if (testingRequirements.length > 0) {
      const requirement = testingRequirements[0];
      
      if (requirement.is_required && requirement.status !== 'SATISFIED') {
        validationErrors.push({
          type: 'testing_not_satisfied',
          message: 'Testing requirements have not been satisfied by all participants'
        });
      }
    }

    // Check 3: Collaboration must be in valid state
    const validStatuses = ['confirmed', 'active', 'in_progress'];
    if (!validStatuses.includes(collaboration.status)) {
      validationErrors.push({
        type: 'invalid_collaboration_status',
        message: `Collaboration status must be one of: ${validStatuses.join(', ')}. Current: ${collaboration.status}`
      });
    }

    // Check 4: All participants must have approved (if approval tracking exists)
    // This could be enhanced with a participant approval entity

    const canInitiate = validationErrors.length === 0;

    return Response.json({
      can_initiate: canInitiate,
      validation_errors: validationErrors,
      collaboration_status: collaboration.status,
      participant_count: participantIds.length
    });

  } catch (error) {
    console.error('Contract validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});