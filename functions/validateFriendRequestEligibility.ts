import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requester_id, target_id } = await req.json();

    // Self-friending check
    if (requester_id === target_id) {
      return Response.json({
        eligible: false,
        reason_code: 'SELF_FRIEND',
        details_json: { message: 'Cannot send friend request to yourself' }
      });
    }

    // Check if blocked
    const blocks = await base44.asServiceRole.entities.BlockedUser.filter({
      $or: [
        { blocker_id: target_id, blocked_id: requester_id },
        { blocker_id: requester_id, blocked_id: target_id }
      ]
    });

    if (blocks.length > 0) {
      return Response.json({
        eligible: false,
        reason_code: 'BLOCKED',
        details_json: { message: 'Cannot send friend request to blocked user' }
      });
    }

    // Check existing friendship
    const existingFriendship = await base44.asServiceRole.entities.Friendship.filter({
      $or: [
        { requester_user_id: requester_id, addressee_user_id: target_id },
        { requester_user_id: target_id, addressee_user_id: requester_id }
      ]
    });

    if (existingFriendship.length > 0) {
      const friendship = existingFriendship[0];
      if (friendship.status === 'ACCEPTED') {
        return Response.json({
          eligible: false,
          reason_code: 'ALREADY_FRIENDS',
          details_json: { message: 'Already friends' }
        });
      }
      if (friendship.status === 'PENDING') {
        return Response.json({
          eligible: false,
          reason_code: 'PENDING_REQUEST',
          details_json: { message: 'Friend request already pending' }
        });
      }
      // Check cooldown after decline
      if (friendship.status === 'DECLINED' && friendship.decline_cooldown_until) {
        const cooldownDate = new Date(friendship.decline_cooldown_until);
        if (cooldownDate > new Date()) {
          return Response.json({
            eligible: false,
            reason_code: 'COOLDOWN_ACTIVE',
            details_json: { 
              message: 'Must wait before sending another request',
              cooldown_until: friendship.decline_cooldown_until
            }
          });
        }
      }
    }

    // Get target settings
    const targetSettings = await base44.asServiceRole.entities.FriendSettings.filter({
      user_id: target_id
    });

    const settings = targetSettings[0] || {
      friend_request_policy: 'MESSAGE_FIRST',
      friend_request_daily_limit: 10
    };

    // Check policy
    if (settings.friend_request_policy === 'NO_ONE') {
      return Response.json({
        eligible: false,
        reason_code: 'TARGET_POLICY_NO_ONE',
        details_json: { message: 'User does not accept friend requests' }
      });
    }

    if (settings.friend_request_policy === 'EVERYONE') {
      // Check rate limit
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayRequests = await base44.asServiceRole.entities.Friendship.filter({
        requester_user_id: requester_id,
        requested_at: { $gte: today.toISOString() }
      });

      if (todayRequests.length >= settings.friend_request_daily_limit) {
        return Response.json({
          eligible: false,
          reason_code: 'RATE_LIMITED',
          details_json: { 
            message: 'Daily friend request limit reached',
            rate_limit_remaining: 0
          }
        });
      }

      return Response.json({
        eligible: true,
        reason_code: 'OK',
        details_json: { 
          gating_mode: 'EVERYONE_ALLOWED',
          rate_limit_remaining: settings.friend_request_daily_limit - todayRequests.length
        }
      });
    }

    // MESSAGE_FIRST policy - check DM thread and reply
    const conversations = await base44.asServiceRole.entities.Conversation.filter({
      participant_ids: { $all: [requester_id, target_id] },
      type: 'discovery'
    });

    if (conversations.length === 0) {
      return Response.json({
        eligible: false,
        reason_code: 'NOT_ALLOWED_NO_DM',
        details_json: { message: 'Send a message first before requesting' }
      });
    }

    const conversation = conversations[0];

    // Check if target has replied
    const messages = await base44.asServiceRole.entities.Message.filter({
      conversation_id: conversation.id,
      sender_id: target_id
    });

    if (messages.length === 0) {
      return Response.json({
        eligible: false,
        reason_code: 'NOT_ALLOWED_NO_REPLY',
        details_json: { message: 'Wait for a reply before sending friend request' }
      });
    }

    // Check rate limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRequests = await base44.asServiceRole.entities.Friendship.filter({
      requester_user_id: requester_id,
      requested_at: { $gte: today.toISOString() }
    });

    if (todayRequests.length >= settings.friend_request_daily_limit) {
      return Response.json({
        eligible: false,
        reason_code: 'RATE_LIMITED',
        details_json: { 
          message: 'Daily friend request limit reached',
          rate_limit_remaining: 0
        }
      });
    }

    return Response.json({
      eligible: true,
      reason_code: 'OK',
      details_json: { 
        gating_mode: 'MESSAGE_FIRST',
        dm_thread_id: conversation.id,
        rate_limit_remaining: settings.friend_request_daily_limit - todayRequests.length
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});