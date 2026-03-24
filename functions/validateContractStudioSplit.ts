import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { collaboration_id, contract_snapshot } = await req.json();

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id required' }, { status: 400 });
    }

    // Get collaboration participants
    const collaborations = await base44.asServiceRole.entities.Collaboration.filter({
      id: collaboration_id
    });

    if (collaborations.length === 0) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    const collaboration = collaborations[0];
    const participantIds = collaboration.participant_ids || [];

    const validationErrors = [];
    const requiredStudioSplits = [];

    // Check each participant for exclusive studio representation
    for (const participantId of participantIds) {
      const studioReps = await base44.asServiceRole.entities.StudioRepresentation.filter({
        creator_user_id: participantId,
        active: true
      });

      const exclusiveRep = studioReps.find(r => r.representation_type === 'Exclusive');

      if (exclusiveRep) {
        requiredStudioSplits.push({
          creator_id: participantId,
          studio_id: exclusiveRep.studio_id,
          required_percentage: exclusiveRep.revenue_share_percentage,
          applies_to: exclusiveRep.applies_to
        });

        // Validate split in contract snapshot
        const snapshotReps = contract_snapshot?.representations || [];
        const studioSplit = snapshotReps.find(r => 
          r.representative_id === exclusiveRep.studio_id && 
          r.creator_id === participantId
        );

        if (!studioSplit) {
          validationErrors.push({
            type: 'missing_studio_split',
            creator_id: participantId,
            studio_id: exclusiveRep.studio_id,
            message: `Missing studio revenue split for exclusive creator ${participantId}`
          });
        } else if (studioSplit.revenue_percentage < exclusiveRep.revenue_share_percentage) {
          validationErrors.push({
            type: 'insufficient_studio_split',
            creator_id: participantId,
            studio_id: exclusiveRep.studio_id,
            required: exclusiveRep.revenue_share_percentage,
            provided: studioSplit.revenue_percentage,
            message: `Studio split for ${participantId} is ${studioSplit.revenue_percentage}% but should be at least ${exclusiveRep.revenue_share_percentage}%`
          });
        }
      }
    }

    const canFinalize = validationErrors.length === 0;

    return Response.json({
      can_finalize: canFinalize,
      validation_errors: validationErrors,
      required_studio_splits: requiredStudioSplits,
      has_exclusive_creators: requiredStudioSplits.length > 0
    });

  } catch (error) {
    console.error('Studio split validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});