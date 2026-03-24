import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CHECK BAN STATUS - Block banned/suspended users
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({
        user_id: user.email
      });
      const profile = profiles[0];

      if (profile?.banned === true) {
        await logBlockedAction(base44, user.email, 'start_conversation', 'banned');
        return Response.json(
          { error: 'Your account has been permanently banned', code: 'banned', blocked: true },
          { status: 403 }
        );
      }

      if (profile?.suspended === true) {
        await logBlockedAction(base44, user.email, 'start_conversation', 'suspended');
        return Response.json(
          { error: 'Your account is temporarily suspended', code: 'suspended', blocked: true },
          { status: 403 }
        );
      }
    } catch (banCheckError) {
      console.error('Ban check failed:', banCheckError);
      return Response.json(
        { error: 'Unable to verify account status', code: 'error', blocked: true },
        { status: 403 }
      );
    }

    const { recipient_id } = await req.json();

    if (!recipient_id) {
      return Response.json({ error: 'recipient_id is required' }, { status: 400 });
    }

    // Check if conversation already exists between these two users
    const existingConvs = await base44.entities.Conversation.list();
    const existingConv = existingConvs.find(conv => 
      conv.participant_ids?.includes(user.email) &&
      conv.participant_ids?.includes(recipient_id) &&
      conv.type === 'discovery'
    );

    if (existingConv) {
      return Response.json({ 
        conversation: existingConv,
        isNew: false 
      });
    }

    // Create new conversation
    const conversation = await base44.entities.Conversation.create({
      type: 'discovery',
      participant_ids: [user.email, recipient_id],
      status: 'active',
      unread_counts: {}
    });

    // Don't send notification when conversation is just created
    // Notification will be sent when first message is sent
    return Response.json({ 
      conversation,
      isNew: true 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper to log blocked action attempts
async function logBlockedAction(base44, userId, actionName, blockReason) {
  try {
    await base44.asServiceRole.entities.AdminActionLog.create({
      admin_id: 'SYSTEM_BAN_ENFORCEMENT',
      action_type: 'blocked_action_attempt',
      target_user_id: userId,
      details: {
        action_attempted: actionName,
        block_reason: blockReason,
        timestamp: new Date().toISOString()
      },
      reason: `Blocked ${blockReason} user from: ${actionName}`
    });
  } catch (e) {
    console.error('Failed to log blocked action:', e);
  }
}