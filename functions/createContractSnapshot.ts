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

    // Build immutable snapshot - captures all critical contract terms
    const snapshot = {
      snapshot_id: `snapshot_${collaboration_id}_${Date.now()}`,
      snapshot_created_at: new Date().toISOString(),
      collaboration_id,
      collaboration_name: collaboration.collaboration_name,
      collaboration_status: collaboration.status,
      
      // Participants with full details
      participants: participantProfiles.map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        real_name: p.real_name,
        role_type: p.role_type,
        collaboration_role: roles.find(r => r.user_id === p.user_id)?.role || 'member',
        email: p.user_id,
        location: p.base_location
      })),

      // Scene details - what is being performed
      scene_pairings: collaboration.scene_selected || [],
      standard_acts: collaboration.standard_acts || [],
      fetish_acts: collaboration.fetish_acts || [],
      kink_edge_acts: collaboration.kink_edge_acts || [],

      // Boundaries - what is NOT allowed
      boundaries: collaboration.boundaries || {},
      hard_limits: collaboration.hard_limits || [],

      // Schedule & Location - when and where
      schedule: {
        shoot_date: collaboration.shoot_date,
        start_time: collaboration.start_time,
        end_time: collaboration.end_time,
        timezone: collaboration.timezone,
        duration_hours: collaboration.duration_hours
      },
      location: {
        address: collaboration.location?.address,
        city: collaboration.location?.city,
        state: collaboration.location?.state,
        country: collaboration.location?.country,
        venue_type: collaboration.location?.venue_type
      },

      // Compensation - payment terms
      compensation_type: collaboration.compensation_type,
      compensation_details: {
        amount: collaboration.compensation_details?.amount,
        currency: collaboration.compensation_details?.currency || 'USD',
        payment_terms: collaboration.compensation_details?.payment_terms,
        payment_method: collaboration.compensation_details?.payment_method
      },

      // Deliverables - what will be produced
      deliverables: {
        platforms: collaboration.platforms || [],
        content_types: collaboration.content_types || [],
        delivery_format: collaboration.deliverables?.delivery_format,
        delivery_timeline: collaboration.deliverables?.delivery_timeline
      },

      // Usage Rights - how content can be used
      usage_rights: {
        ownership_model: collaboration.usage_rights?.ownership_model,
        ownership_split: collaboration.usage_rights?.ownership_split || {},
        revenue_split: collaboration.usage_rights?.revenue_split || {},
        exclusive_period: collaboration.usage_rights?.exclusive_period,
        platforms_allowed: collaboration.usage_rights?.platforms_allowed || [],
        embargo_until: collaboration.usage_rights?.embargo_until,
        takedown_policy: collaboration.usage_rights?.takedown_policy,
        crediting_rules: collaboration.usage_rights?.crediting_rules,
        ai_use_policy: collaboration.usage_rights?.ai_use_policy
      },

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

    // Log snapshot creation
    await base44.asServiceRole.entities.CollaborationActivityLog.create({
      collaboration_id,
      activity_type: 'CONTRACT_SNAPSHOT_CREATED',
      user_id: user.email,
      details: {
        snapshot_id: snapshot.snapshot_id,
        participant_count: snapshot.participants.length,
        created_at: snapshot.snapshot_created_at
      }
    });

    return Response.json({
      success: true,
      snapshot,
      snapshot_id: snapshot.snapshot_id,
      immutable: true
    });

  } catch (error) {
    console.error('Contract snapshot error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});