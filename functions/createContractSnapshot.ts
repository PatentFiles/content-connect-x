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

    // Get collaboration with all details
    const collaborations = await base44.asServiceRole.entities.Collaboration.filter({
      id: collaboration_id
    });

    if (collaborations.length === 0) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    const collaboration = collaborations[0];

    // Get participant profiles
    const profiles = await base44.asServiceRole.entities.UserProfile.list();
    const participantProfiles = profiles.filter(p => 
      collaboration.participant_ids?.includes(p.user_id)
    );

    // Get roles
    const roles = await base44.asServiceRole.entities.CollaborationParticipantRole.filter({
      collaboration_id
    });

    // Build snapshot
    const snapshot = {
      snapshot_created_at: new Date().toISOString(),
      collaboration_id,
      collaboration_name: collaboration.collaboration_name,
      
      // Participants
      participants: participantProfiles.map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        real_name: p.real_name,
        role_type: p.role_type,
        collaboration_role: roles.find(r => r.user_id === p.user_id)?.role || 'member'
      })),

      // Scene details
      scene_pairings: collaboration.scene_selected || [],
      standard_acts: collaboration.standard_acts || [],
      fetish_acts: collaboration.fetish_acts || [],
      kink_edge_acts: collaboration.kink_edge_acts || [],

      // Boundaries
      boundaries: collaboration.boundaries || {},

      // Schedule & Location
      schedule: collaboration.schedule || {},
      location: collaboration.location || {},

      // Compensation
      compensation_type: collaboration.compensation_type,
      compensation_details: collaboration.compensation_details || {},

      // Deliverables
      deliverables: collaboration.deliverables || {},

      // Usage Rights
      usage_rights: collaboration.usage_rights || {},

      // Testing requirements
      testing_requirements: collaboration.testing_requirements || {},

      // Representation info
      representations: []
    };

    // Get representation info for each participant
    const agentReps = await base44.asServiceRole.entities.AgentRepresentation.list();
    const studioReps = await base44.asServiceRole.entities.StudioRepresentation.list();

    for (const participantId of collaboration.participant_ids || []) {
      const agentRep = agentReps.find(r => r.creator_id === participantId);
      const studioRep = studioReps.find(r => r.creator_id === participantId);

      if (agentRep) {
        snapshot.representations.push({
          creator_id: participantId,
          type: 'agent',
          representative_id: agentRep.agent_id,
          revenue_percentage: agentRep.commission_rate || 0
        });
      }

      if (studioRep) {
        snapshot.representations.push({
          creator_id: participantId,
          type: 'studio',
          representative_id: studioRep.studio_id,
          revenue_percentage: studioRep.revenue_percentage || 0,
          exclusivity: studioRep.exclusivity_type
        });
      }
    }

    return Response.json({
      success: true,
      snapshot
    });

  } catch (error) {
    console.error('Contract snapshot error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});