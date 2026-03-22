import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { initiator_id, target_id, context } = await req.json();

    const {
      created_by_role = 'creator',
      collaboration_id = null
    } = context || {};

    // Check if they are friends
    const friendsCheck = await base44.functions.invoke('isFriends', {
      user_a: initiator_id,
      user_b: target_id
    });

    if (friendsCheck.data.is_friends) {
      return Response.json({
        allowed: true,
        reason_code: 'FRIENDS',
        suggested_action: null
      });
    }

    // Check if they share an existing collaboration
    const sharedCollabs = await base44.asServiceRole.entities.Collaboration.filter({
      participant_ids: { $all: [initiator_id, target_id] },
      status: { $in: ['agreed', 'active', 'completed'] }
    });

    if (sharedCollabs.length > 0) {
      return Response.json({
        allowed: true,
        reason_code: 'SHARED_COLLABORATION',
        suggested_action: null
      });
    }

    // Get target settings
    const targetSettings = await base44.asServiceRole.entities.FriendSettings.filter({
      user_id: target_id
    });

    const settings = targetSettings[0] || {
      allow_collaboration_invites_non_friends: false
    };

    // Check if target allows non-friend collaborations
    if (settings.allow_collaboration_invites_non_friends) {
      return Response.json({
        allowed: true,
        reason_code: 'TARGET_ALLOWS_NON_FRIENDS',
        suggested_action: null
      });
    }

    // If created by Agent/Studio, allow but require approvals
    if (created_by_role === 'agent' || created_by_role === 'studio') {
      return Response.json({
        allowed: true,
        reason_code: 'AGENT_STUDIO_INVITE',
        suggested_action: 'Requires creator approval',
        requires_approval: true
      });
    }

    // Check if eligible to send friend request
    const eligibility = await base44.functions.invoke('validateFriendRequestEligibility', {
      requester_id: initiator_id,
      target_id: target_id
    });

    let suggestedAction = 'Send a message first';
    if (eligibility.data.eligible) {
      suggestedAction = 'Send friend request';
    } else if (eligibility.data.reason_code === 'NOT_ALLOWED_NO_DM') {
      suggestedAction = 'Send a message first';
    } else if (eligibility.data.reason_code === 'NOT_ALLOWED_NO_REPLY') {
      suggestedAction = 'Wait for a reply';
    }

    // Log enforcement block
    if (collaboration_id) {
      await base44.asServiceRole.entities.CollaborationActivityLog.create({
        collaboration_id,
        actor_id: initiator_id,
        action: 'FRIEND_GATE_BLOCK',
        description: `Collaboration invite blocked - not friends with ${target_id}`,
        metadata: {
          target_id,
          reason: 'NOT_FRIENDS',
          suggested_action: suggestedAction
        }
      });
    }

    return Response.json({
      allowed: false,
      reason_code: 'NOT_FRIENDS',
      suggested_action: suggestedAction,
      eligibility: eligibility.data
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});