import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // BAN CHECK - blocked users cannot trigger notifications
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
      const profile = profiles[0];
      if (profile?.banned === true || profile?.suspended === true) {
        await base44.asServiceRole.entities.AdminActionLog.create({
          admin_id: 'SYSTEM_BAN_ENFORCEMENT', action_type: 'blocked_action_attempt',
          target_user_id: user.email,
          details: { action_attempted: 'send_testing_notification', block_reason: profile?.banned ? 'banned' : 'suspended', timestamp: new Date().toISOString() },
          reason: `Blocked ${profile?.banned ? 'banned' : 'suspended'} user from: send_testing_notification`
        });
        return Response.json({ error: 'Account is blocked', code: profile?.banned ? 'banned' : 'suspended', blocked: true }, { status: 403 });
      }
    } catch (e) { return Response.json({ error: 'Unable to verify account status', blocked: true }, { status: 403 }); }

    const { collaboration_id, notification_type } = await req.json();

    if (!collaboration_id || !notification_type) {
      return Response.json({ 
        error: 'collaboration_id and notification_type are required' 
      }, { status: 400 });
    }

    // Fetch collaboration
    const collaborations = await base44.asServiceRole.entities.Collaboration.filter({ 
      id: collaboration_id 
    });
    const collaboration = collaborations[0];

    if (!collaboration) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    const participantIds = collaboration.participant_ids || [];
    const notifications = [];

    // Define notification content based on type
    let title, body;
    
    switch (notification_type) {
      case 'testing_enabled':
        title = 'Testing Required';
        body = `Testing credentials are required for "${collaboration.collaboration_name || 'your collaboration'}". Please submit before the deadline.`;
        break;
        
      case 'deadline_approaching':
        title = 'Testing Deadline Approaching';
        body = `Reminder: Testing credentials deadline for "${collaboration.collaboration_name || 'your collaboration'}" is in 24 hours.`;
        break;
        
      case 'testing_satisfied':
        title = 'Testing Requirements Met';
        body = `Your testing credentials for "${collaboration.collaboration_name || 'your collaboration'}" have been verified.`;
        break;
        
      default:
        return Response.json({ error: 'Invalid notification_type' }, { status: 400 });
    }

    // Send notifications to participants
    for (const participantId of participantIds) {
      // For deadline_approaching, only send if participant hasn't satisfied requirements
      if (notification_type === 'deadline_approaching') {
        // Check if participant has satisfied requirements
        const testingReqs = await base44.asServiceRole.entities.TestingRequirement.filter({
          collaboration_id
        });
        const testingReq = testingReqs[0];
        
        if (testingReq) {
          const allCredentials = await base44.asServiceRole.entities.TestingCredential.filter({
            user_id: participantId
          });
          
          let satisfied = false;
          
          if (testingReq.require_new_upload) {
            const collabSpecific = allCredentials.find(c => 
              c.submitted_for_collaboration_id === collaboration_id &&
              c.status_badge === 'valid'
            );
            if (collabSpecific) satisfied = true;
          } else if (testingReq.require_valid_credential) {
            const validCredential = allCredentials.find(c => {
              if (c.status_badge !== 'valid') return false;
              if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
              return true;
            });
            if (validCredential) satisfied = true;
          }
          
          if (satisfied) continue; // Skip notification for satisfied participants
        }
      }

      const notification = await base44.asServiceRole.entities.Notification.create({
        user_id: participantId,
        type: `collaboration_${notification_type}`,
        title,
        body,
        metadata: {
          collaboration_id,
          collaboration_name: collaboration.collaboration_name
        },
        read_at: null
      });
      
      notifications.push(notification);
    }

    return Response.json({
      success: true,
      message: `Sent ${notifications.length} notifications`,
      notification_count: notifications.length
    });

  } catch (error) {
    console.error('Testing notification error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});