import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_a, user_b } = await req.json();

    const friendships = await base44.asServiceRole.entities.Friendship.filter({
      status: 'ACCEPTED',
      $or: [
        { requester_user_id: user_a, addressee_user_id: user_b },
        { requester_user_id: user_b, addressee_user_id: user_a }
      ]
    });

    return Response.json({
      is_friends: friendships.length > 0,
      friendship: friendships[0] || null
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});