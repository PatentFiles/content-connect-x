import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { collaboration_id } = await req.json();

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id required' }, { status: 400 });
    }

    // Get testing requirement
    const requirements = await base44.asServiceRole.entities.TestingRequirement.filter({
      collaboration_id
    });

    if (requirements.length === 0) {
      return Response.json({ 
        status: 'no_requirement',
        message: 'No testing requirement found'
      });
    }

    const requirement = requirements[0];

    if (!requirement.is_required) {
      return Response.json({
        status: 'not_required',
        message: 'Testing not required for this collaboration'
      });
    }

    // Get collaboration
    const collaborations = await base44.asServiceRole.entities.Collaboration.filter({
      id: collaboration_id
    });

    if (collaborations.length === 0) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    const collaboration = collaborations[0];
    const participantIds = collaboration.participant_ids || [];

    // Get all testing credentials
    const allCredentials = await base44.asServiceRole.entities.TestingCredential.list();

    // Check each participant
    let allSatisfied = true;
    const participantStatus = [];

    for (const participantId of participantIds) {
      const participantCreds = allCredentials.filter(c => c.user_id === participantId);
      
      let satisfied = false;

      if (requirement.require_new_upload) {
        // Must have credential uploaded for this collaboration
        const collabCred = participantCreds.find(
          c => c.submitted_for_collaboration_id === collaboration_id
        );
        satisfied = collabCred && collabCred.status_badge === 'valid';
      } else if (requirement.require_valid_credential) {
        // Must have any valid credential
        const validCred = participantCreds.find(c => c.status_badge === 'valid');
        satisfied = !!validCred;
      }

      participantStatus.push({
        user_id: participantId,
        satisfied
      });

      if (!satisfied) {
        allSatisfied = false;
      }
    }

    // Update requirement if all satisfied
    if (allSatisfied && requirement.status !== 'SATISFIED') {
      await base44.asServiceRole.entities.TestingRequirement.update(requirement.id, {
        status: 'SATISFIED',
        satisfied_at: new Date().toISOString()
      });

      // Log satisfaction
      await base44.asServiceRole.entities.CollaborationActivityLog.create({
        collaboration_id,
        activity_type: 'TESTING_SATISFIED',
        user_id: 'SYSTEM',
        details: {
          requirement_id: requirement.id,
          satisfied_at: new Date().toISOString(),
          participants: participantStatus
        }
      });

      // Create compliance score event
      for (const participantId of participantIds) {
        await base44.asServiceRole.entities.ComplianceScoreEvent.create({
          user_id: participantId,
          event_type: 'testing_satisfied',
          score_change: 5,
          details: { collaboration_id }
        });
      }

      return Response.json({
        status: 'satisfied',
        satisfied_at: new Date().toISOString(),
        participants: participantStatus
      });
    }

    return Response.json({
      status: allSatisfied ? 'satisfied' : 'pending',
      all_satisfied: allSatisfied,
      participants: participantStatus
    });

  } catch (error) {
    console.error('Mark testing satisfied error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});