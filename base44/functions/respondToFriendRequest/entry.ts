import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { friendship_id, response } = await req.json();

    if (!['ACCEPT', 'DECLINE'].includes(response)) {
      return Response.json({ error: 'Invalid response' }, { status: 400 });
    }

    // Get friendship
    const friendships = await base44.asServiceRole.entities.Friendship.filter({ id: friendship_id });
    
    if (friendships.length === 0) {
      return Response.json({ error: 'Friendship not found' }, { status: 404 });
    }

    const friendship = friendships[0];

    // Only addressee can respond
    if (friendship.addressee_user_id !== user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (friendship.status !== 'PENDING') {
      return Response.json({ error: 'Request already responded to' }, { status: 400 });
    }

    const now = new Date().toISOString();
    let updateData = {
      responded_at: now,
      last_interaction_at: now
    };

    let actionType;
    let notificationTitle;
    let notificationBody;

    if (response === 'ACCEPT') {
      updateData.status = 'ACCEPTED';
      actionType = 'REQUEST_ACCEPTED';
      notificationTitle = 'Friend Request Accepted';
      notificationBody = `${user.full_name || user.email} accepted your friend request`;
    } else {
      updateData.status = 'DECLINED';
      const cooldownDate = new Date();
      cooldownDate.setDate(cooldownDate.getDate() + 30);
      updateData.decline_cooldown_until = cooldownDate.toISOString();
      actionType = 'REQUEST_DECLINED';
      notificationTitle = 'Friend Request Declined';
      notificationBody = `Your friend request was declined`;
    }

    // Update friendship
    const updatedFriendship = await base44.asServiceRole.entities.Friendship.update(
      friendship_id,
      updateData
    );

    // Log activity
    await base44.asServiceRole.entities.FriendActivityLog.create({
      actor_user_id: user.email,
      target_user_id: friendship.requester_user_id,
      friendship_id: friendship_id,
      action_type: actionType,
      metadata_json: {
        response,
        cooldown_until: updateData.decline_cooldown_until
      }
    });

    // Create notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: friendship.requester_user_id,
      type: response === 'ACCEPT' ? 'friend_request_accepted' : 'friend_request_declined',
      actor_user_id: user.email,
      title: notificationTitle,
      body: notificationBody,
      related_entity_type: 'Friendship',
      related_entity_id: friendship_id,
      action_url: response === 'ACCEPT' ? `/profile?user=${user.email}` : null
    });

    return Response.json({
      success: true,
      friendship: updatedFriendship
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});