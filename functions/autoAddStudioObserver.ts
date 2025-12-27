import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { collaboration_id, participant_ids } = await req.json();

    if (!collaboration_id || !participant_ids || !Array.isArray(participant_ids)) {
      return Response.json({ error: 'collaboration_id and participant_ids required' }, { status: 400 });
    }

    const addedStudios = [];

    // Check each participant for exclusive studio representation
    for (const participantId of participant_ids) {
      const studioReps = await base44.asServiceRole.entities.StudioRepresentation.filter({
        creator_user_id: participantId,
        active: true
      });

      const exclusiveRep = studioReps.find(r => r.representation_type === 'Exclusive');

      if (exclusiveRep) {
        // Check if studio is already added as participant or observer
        const collaboration = await base44.asServiceRole.entities.Collaboration.filter({
          id: collaboration_id
        });

        if (collaboration.length === 0) continue;

        const currentParticipants = collaboration[0].participant_ids || [];
        if (currentParticipants.includes(exclusiveRep.studio_id)) continue;

        // Check if studio observer role already exists
        const existingRoles = await base44.asServiceRole.entities.CollaborationParticipantRole.filter({
          collaboration_id,
          user_id: exclusiveRep.studio_id
        });

        if (existingRoles.length === 0) {
          // Add studio as RepObserver
          await base44.asServiceRole.entities.CollaborationParticipantRole.create({
            collaboration_id,
            user_id: exclusiveRep.studio_id,
            role: 'RepObserver',
            auto_added: true,
            represented_creator_id: participantId,
            permissions: {
              can_view: true,
              can_message: false,
              can_edit: false
            }
          });

          // Log the auto-add
          await base44.asServiceRole.entities.CollaborationActivityLog.create({
            collaboration_id,
            activity_type: 'STUDIO_OBSERVER_AUTO_ADDED',
            user_id: 'SYSTEM',
            details: {
              studio_id: exclusiveRep.studio_id,
              creator_id: participantId,
              reason: 'Exclusive studio representation'
            }
          });

          addedStudios.push({
            studio_id: exclusiveRep.studio_id,
            creator_id: participantId
          });
        }
      }
    }

    return Response.json({
      success: true,
      studios_added: addedStudios
    });

  } catch (error) {
    console.error('Auto-add studio observer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});