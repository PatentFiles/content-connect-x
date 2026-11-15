import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Scheduled / workflow-invoked maintenance function — admin only.
    // Fails closed: with no authenticated admin (or with any non-admin caller)
    // nothing runs and no data is mutated.
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    
    // Fetch all active testing requirements with deadlines
    const allTestingReqs = await base44.asServiceRole.entities.TestingRequirement.filter({
      is_required: true,
      status: 'ACTIVE'
    });

    const expiredReqs = allTestingReqs.filter(req => {
      if (!req.deadline_at) return false;
      const deadline = new Date(req.deadline_at);
      return deadline < now;
    });

    const results = [];

    for (const testingReq of expiredReqs) {
      // Fetch collaboration
      const collaborations = await base44.asServiceRole.entities.Collaboration.filter({
        id: testingReq.collaboration_id
      });
      const collaboration = collaborations[0];

      if (!collaboration) {
        console.log(`Collaboration ${testingReq.collaboration_id} not found, skipping`);
        continue;
      }

      // Skip if already cancelled or completed
      if (collaboration.status === 'CANCELLED_TESTING_FAILED' || 
          collaboration.status === 'completed' ||
          collaboration.status === 'cancelled') {
        continue;
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
          const collabSpecific = participantCredentials.find(c => 
            c.submitted_for_collaboration_id === testingReq.collaboration_id &&
            c.status_badge === 'valid'
          );
          
          if (collabSpecific) {
            satisfied = true;
          }
        } else if (testingReq.require_valid_credential) {
          const validCredential = participantCredentials.find(c => {
            if (c.status_badge !== 'valid') return false;
            
            if (c.expires_at) {
              const expirationDate = new Date(c.expires_at);
              if (expirationDate < now) return false;
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

      // If testing requirements not satisfied, auto-cancel
      if (failedParticipants.length > 0) {
        // Update collaboration status
        await base44.asServiceRole.entities.Collaboration.update(collaboration.id, {
          status: 'CANCELLED_TESTING_FAILED'
        });

        // Update testing requirement status
        await base44.asServiceRole.entities.TestingRequirement.update(testingReq.id, {
          status: 'FAILED'
        });

        // Release booking locks (call existing function)
        try {
          await base44.asServiceRole.functions.invoke('releaseCollaborationBooking', {
            collaboration_id: collaboration.id
          });
        } catch (error) {
          console.error('Failed to release booking locks:', error);
        }

        // Create audit log
        await base44.asServiceRole.entities.CollaborationActivityLog.create({
          collaboration_id: collaboration.id,
          action_type: 'TESTING_FAILED_AUTO_CANCEL',
          actor_user_id: 'system',
          metadata_json: {
            deadline_at: testingReq.deadline_at,
            failed_participant_ids: failedParticipants,
            requirement_settings: {
              require_valid_credential: testingReq.require_valid_credential,
              require_new_upload: testingReq.require_new_upload,
              visibility_level: testingReq.visibility_level
            }
          }
        });

        // Create compliance score events for failed participants (with idempotency check)
        const existingScoreEvents = await base44.asServiceRole.entities.ComplianceScoreEvent.filter({
          collaboration_id: collaboration.id,
          event_type: 'MISSED_TESTING_DEADLINE'
        });
        const existingParticipantIds = new Set(existingScoreEvents.map(e => e.user_id));

        for (const participantId of failedParticipants) {
          if (!existingParticipantIds.has(participantId)) {
            await base44.asServiceRole.entities.ComplianceScoreEvent.create({
              user_id: participantId,
              score_type: 'TESTING_COMPLIANCE',
              event_type: 'MISSED_TESTING_DEADLINE',
              collaboration_id: collaboration.id,
              points: -10,
              note: 'Missed testing deadline for collaboration'
            });
          }
        }

        // Send notifications to all participants
        for (const participantId of participantIds) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: participantId,
            type: 'collaboration_cancelled_testing',
            title: 'Collaboration Cancelled',
            body: 'A collaboration was cancelled because a required testing deadline was missed.',
            metadata: {
              collaboration_id: collaboration.id,
              collaboration_name: collaboration.collaboration_name
            },
            read_at: null
          });
        }

        results.push({
          collaboration_id: collaboration.id,
          action: 'auto_cancelled',
          failed_participants: failedParticipants
        });
      }
    }

    return Response.json({
      success: true,
      message: `Processed ${expiredReqs.length} expired testing requirements`,
      results,
      cancelled_count: results.length
    });

  } catch (error) {
    console.error('Testing deadline check error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});