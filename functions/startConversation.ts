import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Get sender profile for notification
    const senderProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
    const senderProfile = senderProfiles[0];

    // Check if recipient has this notification type enabled
    const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
      user_id: recipient_id,
      notification_type: 'messages'
    });
    
    const shouldNotify = !prefs.length || prefs[0].enabled !== false;

    // Create notification for recipient
    if (shouldNotify) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: recipient_id,
        type: 'messages',
        actor_user_id: user.email,
        title: 'New Message',
        body: `${senderProfile?.display_name || 'Someone'} started a conversation with you`,
        related_entity_type: 'Conversation',
        related_entity_id: conversation.id,
        action_url: `/Messages?conversation=${conversation.id}`
      });
    }

    return Response.json({ 
      conversation,
      isNew: true 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});