import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { collaboration_id, reason_text } = await req.json();

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id required' }, { status: 400 });
    }

    // Re-check ban status before proceeding
    const profile = await base44.entities.UserProfile.filter({
      user_id: user.email
    });
    const userProfile = profile[0];

    if (userProfile?.banned || userProfile?.suspended) {
      return Response.json(
        { error: 'Your account is blocked', code: 'BLOCKED' },
        { status: 403 }
      );
    }

    // Fetch collaboration
    const collabs = await base44.entities.Collaboration.filter({
      id: collaboration_id
    });
    const collaboration = collabs[0];

    if (!collaboration) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    // Verify user is a participant (not just observer/rep)
    if (!collaboration.participant_ids?.includes(user.email)) {
      return Response.json(
        { error: 'Only collaboration participants can complete' },
        { status: 403 }
      );
    }

    // Validate state: must be signed or active (already agreed and signed)
    const validStates = ['signed', 'active', 'agreed'];
    if (!validStates.includes(collaboration.status)) {
      return Response.json(
        {
          error: `Collaboration must be signed or active to complete (current: ${collaboration.status})`,
          code: 'INVALID_STATE'
        },
        { status: 400 }
      );
    }

    // Check if contract is signed (if one exists)
    const contracts = await base44.entities.Contract.filter({
      collaboration_id
    });
    const signedContract = contracts.find(c => c.status === 'signed');

    if (contracts.length > 0 && !signedContract) {
      return Response.json(
        {
          error: 'All contracts must be signed before completion',
          code: 'CONTRACTS_NOT_SIGNED'
        },
        { status: 400 }
      );
    }

    // Update collaboration status to completed
    const updated = await base44.entities.Collaboration.update(collaboration_id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: user.email,
    });

    // Log activity
    await base44.entities.CollaborationActivityLog.create({
      collaboration_id,
      actor_user_id: user.email,
      activity_type: 'COMPLETED',
      description: `Collaboration marked as completed by ${user.email}${reason_text ? ': ' + reason_text : ''}`,
      metadata: { completed_at: new Date().toISOString() },
    });

    // Notify all participants that collaboration is now completed
    const otherParticipants = collaboration.participant_ids.filter(id => id !== user.email);
    for (const participantId of otherParticipants) {
      try {
        await base44.entities.Notification.create({
          user_id: participantId,
          type: 'collaboration_completed',
          actor_user_id: user.email,
          title: 'Collaboration Completed',
          body: `${userProfile?.display_name || user.email} marked "${collaboration.collaboration_name || 'the collaboration'}" as completed. Earnings will be generated shortly.`,
          related_entity_type: 'Collaboration',
          related_entity_id: collaboration_id,
          action_url: `/CollaborationDetail?id=${collaboration_id}`,
        });
      } catch (e) {
        console.error('Notification send failed:', e);
      }
    }

    return Response.json({
      success: true,
      collaboration: updated,
      message: 'Collaboration completed. Earnings will be generated automatically.',
    });
  } catch (error) {
    console.error('[completeCollaboration]', error.message);
    return Response.json(
      { error: error.message || 'Failed to complete collaboration' },
      { status: 500 }
    );
  }
});