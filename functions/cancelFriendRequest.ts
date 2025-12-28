import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { friendship_id } = await req.json();

    // Get friendship
    const friendships = await base44.asServiceRole.entities.Friendship.filter({ id: friendship_id });
    
    if (friendships.length === 0) {
      return Response.json({ error: 'Friendship not found' }, { status: 404 });
    }

    const friendship = friendships[0];

    // Only requester can cancel
    if (friendship.requester_user_id !== user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (friendship.status !== 'PENDING') {
      return Response.json({ error: 'Can only cancel pending requests' }, { status: 400 });
    }

    // Update friendship
    const updatedFriendship = await base44.asServiceRole.entities.Friendship.update(
      friendship_id,
      { 
        status: 'CANCELLED',
        last_interaction_at: new Date().toISOString()
      }
    );

    // Log activity
    await base44.asServiceRole.entities.FriendActivityLog.create({
      actor_user_id: user.email,
      target_user_id: friendship.addressee_user_id,
      friendship_id: friendship_id,
      action_type: 'REQUEST_CANCELLED'
    });

    return Response.json({
      success: true,
      friendship: updatedFriendship
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});