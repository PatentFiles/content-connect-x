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
          details: { action_attempted: 'validate_testing_requirements', block_reason: profile?.banned ? 'banned' : 'suspended', timestamp: new Date().toISOString() },
          reason: `Blocked ${profile?.banned ? 'banned' : 'suspended'} user from: validate_testing_requirements`
        });
        return Response.json({ error: 'Account is blocked', code: profile?.banned ? 'banned' : 'suspended', blocked: true }, { status: 403 });
      }
    } catch (e) { return Response.json({ error: 'Unable to verify account status', blocked: true }, { status: 403 }); }

    const { collaboration_id } = await req.json();

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id is required' }, { status: 400 });
    }

    // Fetch collaboration
    const collaborations = await base44.asServiceRole.entities.Collaboration.filter({ 
      id: collaboration_id 
    });
    const collaboration = collaborations[0];

    if (!collaboration) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    // Fetch testing requirement
    const testingReqs = await base44.asServiceRole.entities.TestingRequirement.filter({
      collaboration_id
    });
    const testingReq = testingReqs[0];

    // If no testing requirement or not required, allow transition
    if (!testingReq || !testingReq.is_required) {
      return Response.json({
        valid: true,
        message: 'No testing requirement'
      });
    }

    const participantIds = collaboration.participant_ids || [];
    const failedParticipants = [];

    // Fetch all testing credentials
    const allCredentials = await base44.asServiceRole.entities.TestingCredential.filter({});

    // Check each participant
    for (const participantId of participantIds) {
      const participantCredentials = allCredentials.filter(c => c.user_id === participantId);

      let satisfied = false;

      if (testingReq.require_new_upload) {
        // Must have credential specifically for this collaboration
        const collabSpecific = participantCredentials.find(c => 
          c.submitted_for_collaboration_id === collaboration_id &&
          c.status_badge === 'valid'
        );
        
        if (collabSpecific) {
          satisfied = true;
        }
      } else if (testingReq.require_valid_credential) {
        // Just need any valid credential
        const validCredential = participantCredentials.find(c => {
          if (c.status_badge !== 'valid') return false;
          
          // Check expiration
          if (c.expires_at) {
            const expirationDate = new Date(c.expires_at);
            if (expirationDate < new Date()) return false;
          }
          
          return true;
        });
        
        if (validCredential) {
          satisfied = true;
        }
      }

      if (!satisfied) {
        failedParticipants.push(participantId);
      }
    }

    // If any participants failed, block transition
    if (failedParticipants.length > 0) {
      return Response.json({
        valid: false,
        message: 'Testing requirements not satisfied',
        failed_participants: failedParticipants,
        requirement: {
          require_valid_credential: testingReq.require_valid_credential,
          require_new_upload: testingReq.require_new_upload,
          deadline_at: testingReq.deadline_at
        }
      }, { status: 400 });
    }

    return Response.json({
      valid: true,
      message: 'All testing requirements satisfied'
    });

  } catch (error) {
    console.error('Testing validation error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});