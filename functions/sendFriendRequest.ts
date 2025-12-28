import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { target_id, dm_thread_id } = await req.json();

    // Validate eligibility
    const validation = await base44.functions.invoke('validateFriendRequestEligibility', {
      requester_id: user.email,
      target_id
    });

    if (!validation.data.eligible) {
      return Response.json({
        success: false,
        error: validation.data.reason_code,
        details: validation.data.details_json
      }, { status: 400 });
    }

    const gatingMode = validation.data.details_json.gating_mode;
    const conversationId = validation.data.details_json.dm_thread_id || dm_thread_id;

    // Check for existing friendship to update or create new
    const existing = await base44.asServiceRole.entities.Friendship.filter({
      $or: [
        { requester_user_id: user.email, addressee_user_id: target_id },
        { requester_user_id: target_id, addressee_user_id: user.email }
      ]
    });

    let friendship;
    if (existing.length > 0 && (existing[0].status === 'DECLINED' || existing[0].status === 'CANCELLED')) {
      // Update existing friendship
      friendship = await base44.asServiceRole.entities.Friendship.update(existing[0].id, {
        status: 'PENDING',
        requester_user_id: user.email,
        addressee_user_id: target_id,
        requested_at: new Date().toISOString(),
        responded_at: null,
        dm_thread_id: conversationId,
        gating_mode_at_request: gatingMode,
        decline_cooldown_until: null
      });
    } else {
      // Create new friendship
      friendship = await base44.asServiceRole.entities.Friendship.create({
        requester_user_id: user.email,
        addressee_user_id: target_id,
        status: 'PENDING',
        requested_at: new Date().toISOString(),
        dm_thread_id: conversationId,
        gating_mode_at_request: gatingMode
      });
    }

    // Log activity
    await base44.asServiceRole.entities.FriendActivityLog.create({
      actor_user_id: user.email,
      target_user_id: target_id,
      friendship_id: friendship.id,
      action_type: 'REQUEST_SENT',
      metadata_json: {
        dm_thread_id: conversationId,
        gating_mode: gatingMode
      }
    });

    // Create notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: target_id,
      type: 'friend_request',
      actor_user_id: user.email,
      title: 'New Friend Request',
      body: `${user.full_name || user.email} sent you a friend request`,
      related_entity_type: 'Friendship',
      related_entity_id: friendship.id,
      action_url: `/profile?user=${user.email}`
    });

    return Response.json({
      success: true,
      friendship
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});