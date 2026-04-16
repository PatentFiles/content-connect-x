import { base44 } from '@/api/base44Client';

const APP_NAME = 'Content Connect';
const APP_COLOR_PRIMARY = '#4F8CFF';
const APP_COLOR_ACCENT = '#FF2DAA';
const APP_BG = '#0B0F14';

/**
 * Send a branded email alert for key events.
 * Only sends if the user has email notifications enabled.
 */
async function sendBrandedEmail({ toEmail, subject, headline, bodyText, ctaLabel, ctaUrl }) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:${APP_BG};font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${APP_BG};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#151D2B;border-radius:16px;border:1px solid #263248;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,${APP_COLOR_PRIMARY}22,${APP_COLOR_ACCENT}22);padding:32px 32px 24px;text-align:center;border-bottom:1px solid #263248;">
            <span style="font-size:22px;font-weight:800;background:linear-gradient(135deg,${APP_COLOR_PRIMARY},${APP_COLOR_ACCENT});-webkit-background-clip:text;color:transparent;">${APP_NAME}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#E8EEF9;">${headline}</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#9AA6BC;line-height:1.6;">${bodyText}</p>
            ${ctaLabel && ctaUrl ? `
            <table cellpadding="0" cellspacing="0"><tr><td>
              <a href="${ctaUrl}" style="display:inline-block;background:${APP_COLOR_PRIMARY};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">${ctaLabel}</a>
            </td></tr></table>` : ''}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #263248;text-align:center;">
            <p style="margin:0;font-size:12px;color:#6B7A94;">You are receiving this because you have email notifications enabled. <br/>Manage preferences in your <a href="/Settings" style="color:${APP_COLOR_PRIMARY};">Settings</a>.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await base44.integrations.Core.SendEmail({ to: toEmail, subject, body: html, from_name: APP_NAME });
  } catch (err) {
    console.error('Failed to send branded email:', err);
  }
}

/**
 * Check if user has email channel enabled for a notification type.
 */
async function isEmailEnabled(userId, notificationType) {
  try {
    const prefs = await base44.entities.NotificationPreference.filter({ user_id: userId, notification_type: notificationType });
    if (!prefs.length) return true;
    return prefs[0].channels?.email !== false;
  } catch {
    return true;
  }
}

/**
 * Check if user has notifications enabled for a specific type
 */
export async function isNotificationEnabled(userId, notificationType) {
  try {
    const prefs = await base44.entities.NotificationPreference.filter({
      user_id: userId,
      notification_type: notificationType
    });
    
    if (prefs.length === 0) {
      // Default: all notifications enabled except system announcements
      return notificationType !== 'system_announcements';
    }
    
    return prefs[0].enabled !== false;
  } catch (error) {
    console.error('Error checking notification preference:', error);
    return true; // Default to enabled
  }
}

/**
 * Create a notification respecting user preferences
 */
export async function createNotification({
  userId,
  type,
  actorUserId,
  title,
  body,
  relatedEntityType,
  relatedEntityId,
  actionUrl
}) {
  try {
    // Check if user has this notification type enabled
    const enabled = await isNotificationEnabled(userId, type);
    
    if (!enabled) {
      console.log(`Notification type ${type} disabled for user ${userId}`);
      return null;
    }

    // Create the notification
    const notification = await base44.entities.Notification.create({
      user_id: userId,
      type,
      actor_user_id: actorUserId,
      title,
      body,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      action_url: actionUrl
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Trigger notification: New collaboration invite  (+ email)
 */
export async function notifyCollaborationInvite(inviteeId, collaboration, inviterProfile) {
  const notification = await createNotification({
    userId: inviteeId,
    type: 'collaboration_invites',
    actorUserId: collaboration.created_by,
    title: 'New Collaboration Invite',
    body: `${inviterProfile?.display_name || 'Someone'} invited you to join "${collaboration.collaboration_name}"`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });

  // Send email if enabled
  const emailOk = await isEmailEnabled(inviteeId, 'collaboration_invites');
  if (emailOk) {
    // Fetch invitee email from User entity
    try {
      const users = await base44.entities.User.filter({ id: inviteeId });
      const email = users[0]?.email || inviteeId;
      await sendBrandedEmail({
        toEmail: email,
        subject: `New Collaboration Invite – ${collaboration.collaboration_name}`,
        headline: "You've been invited to collaborate!",
        bodyText: `${inviterProfile?.display_name || 'Someone'} has invited you to join <strong style="color:#E8EEF9;">${collaboration.collaboration_name}</strong>. Log in to review the details and accept or decline the invite.`,
        ctaLabel: 'View Collaboration',
        ctaUrl: `${window.location.origin}/CollaborationDetail?id=${collaboration.id}`,
      });
    } catch (err) { console.error('Email send failed:', err); }
  }

  return notification;
}

/**
 * Trigger notification: Invite accepted
 */
export async function notifyInviteAccepted(creatorId, collaboration, accepterProfile) {
  return createNotification({
    userId: creatorId,
    type: 'collaboration_invites',
    actorUserId: accepterProfile.user_id,
    title: 'Invite Accepted',
    body: `${accepterProfile?.display_name || 'Someone'} accepted your collaboration invite`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });
}

/**
 * Trigger notification: Role changed
 */
export async function notifyRoleChange(userId, collaboration, newRole, actorProfile) {
  return createNotification({
    userId,
    type: 'role_changes',
    actorUserId: actorProfile.user_id,
    title: 'Role Updated',
    body: `${actorProfile?.display_name || 'Admin'} changed your role to ${newRole} in "${collaboration.collaboration_name}"`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });
}

/**
 * Trigger notification: New message
 */
export async function notifyNewMessage(recipientId, senderId, senderProfile, conversationType, conversationId) {
  const titleMap = {
    discovery: 'New Message',
    negotiation: 'New Negotiation Message',
    contract: 'New Contract Message'
  };

  return createNotification({
    userId: recipientId,
    type: 'messages',
    actorUserId: senderId,
    title: titleMap[conversationType] || 'New Message',
    body: `${senderProfile?.display_name || 'Someone'} sent you a message`,
    relatedEntityType: 'Conversation',
    relatedEntityId: conversationId,
    actionUrl: `/Messages?conversation=${conversationId}`
  });
}

/**
 * Trigger notification: Testing deadline approaching
 */
export async function notifyTestingDeadline(userId, collaboration, daysRemaining) {
  return createNotification({
    userId,
    type: 'testing_deadlines',
    actorUserId: null,
    title: daysRemaining === 0 ? 'Testing Due Today!' : `Testing Due in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`,
    body: `Your testing credentials for "${collaboration.collaboration_name}" are due soon. Please upload your credentials.`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });
}

/**
 * Trigger notification: Testing overdue
 */
export async function notifyTestingOverdue(userId, collaboration) {
  return createNotification({
    userId,
    type: 'testing_deadlines',
    actorUserId: null,
    title: 'Testing Overdue',
    body: `Your testing credentials for "${collaboration.collaboration_name}" are overdue. This collaboration may be at risk.`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });
}

/**
 * Trigger notification: Contract pending review  (+ email)
 */
export async function notifyContractCreated(userId, contract, collaboration, creatorProfile) {
  const notification = await createNotification({
    userId,
    type: 'contract_updates',
    actorUserId: creatorProfile.user_id,
    title: 'Contract Pending Your Review',
    body: `${creatorProfile?.display_name || 'Someone'} created a contract for "${collaboration.collaboration_name}" — your signature is required.`,
    relatedEntityType: 'Contract',
    relatedEntityId: contract.id,
    actionUrl: `/ViewContract?id=${contract.id}`
  });

  // Send email if enabled
  const emailOk = await isEmailEnabled(userId, 'contract_updates');
  if (emailOk) {
    try {
      const users = await base44.entities.User.filter({ id: userId });
      const email = users[0]?.email || userId;
      await sendBrandedEmail({
        toEmail: email,
        subject: `Contract Pending Review – ${collaboration.collaboration_name}`,
        headline: 'A contract is waiting for your review',
        bodyText: `${creatorProfile?.display_name || 'Someone'} has created a contract for <strong style="color:#E8EEF9;">${collaboration.collaboration_name}</strong>. Please review and sign at your earliest convenience.`,
        ctaLabel: 'Review Contract',
        ctaUrl: `${window.location.origin}/ViewContract?id=${contract.id}`,
      });
    } catch (err) { console.error('Email send failed:', err); }
  }

  return notification;
}

/**
 * Trigger notification: Contract signed
 */
export async function notifyContractSigned(userId, contract, collaboration, signerProfile) {
  return createNotification({
    userId,
    type: 'contract_updates',
    actorUserId: signerProfile.user_id,
    title: 'Contract Signed',
    body: `${signerProfile?.display_name || 'Someone'} signed the contract for "${collaboration.collaboration_name}"`,
    relatedEntityType: 'Contract',
    relatedEntityId: contract.id,
    actionUrl: `/ViewContract?id=${contract.id}`
  });
}

/**
 * Trigger notification: Consent revocation raised
 */
export async function notifyConsentRevocation(userId, collaboration, revokerProfile, revocationType) {
  return createNotification({
    userId,
    type: 'dispute_updates',
    actorUserId: revokerProfile.user_id,
    title: 'Consent Revocation Raised',
    body: `${revokerProfile?.display_name || 'A participant'} has raised a consent revocation (${revocationType}) for "${collaboration.collaboration_name}". The collaboration is paused.`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });
}

/**
 * Trigger notification: Dispute created
 */
export async function notifyDisputeCreated(userId, dispute, collaboration, creatorProfile) {
  return createNotification({
    userId,
    type: 'dispute_updates',
    actorUserId: creatorProfile.user_id,
    title: 'Dispute Raised',
    body: `${creatorProfile?.display_name || 'A participant'} raised a dispute in "${collaboration.collaboration_name}": ${dispute.issue_type}`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });
}

/**
 * Trigger notification: Verification status updated  (+ email)
 */
export async function notifyVerificationStatus(userId, status) {
  const titles = {
    approved: 'Verification Approved ✓',
    rejected: 'Verification Rejected'
  };

  const bodies = {
    approved: 'Your identity verification has been approved. You now have full access to the platform.',
    rejected: 'Your identity verification was rejected. Please review the feedback and resubmit.'
  };

  const notification = await createNotification({
    userId,
    type: 'verification_status',
    actorUserId: null,
    title: titles[status] || 'Verification Update',
    body: bodies[status] || 'Your verification status has been updated.',
    relatedEntityType: 'VerificationRecord',
    relatedEntityId: userId,
    actionUrl: '/Verification'
  });

  // Send email if enabled
  const emailOk = await isEmailEnabled(userId, 'verification_status');
  if (emailOk) {
    try {
      const users = await base44.entities.User.filter({ id: userId });
      const email = users[0]?.email || userId;
      const isApproved = status === 'approved';
      await sendBrandedEmail({
        toEmail: email,
        subject: isApproved ? '🎉 Your Verification is Approved!' : 'Verification Update – Action Required',
        headline: isApproved ? 'Your identity has been verified!' : 'Verification was not approved',
        bodyText: bodies[status] || 'Your verification status has been updated. Log in to check your status.',
        ctaLabel: isApproved ? 'Explore the Platform' : 'Resubmit Verification',
        ctaUrl: `${window.location.origin}/Verification`,
      });
    } catch (err) { console.error('Email send failed:', err); }
  }

  return notification;
}

/**
 * Trigger notification: Representation action (agent/studio invite, etc.)
 */
export async function notifyRepresentationAction(userId, action, representativeName) {
  const titles = {
    agent_invite: 'Agent Representation Invite',
    studio_invite: 'Studio Representation Invite',
    representation_ended: 'Representation Ended'
  };

  const bodies = {
    agent_invite: `${representativeName} has invited you to join their roster as a represented creator.`,
    studio_invite: `${representativeName} has invited you to join their studio roster.`,
    representation_ended: `Your representation with ${representativeName} has ended.`
  };

  return createNotification({
    userId,
    type: 'representation_actions',
    actorUserId: null,
    title: titles[action] || 'Representation Update',
    body: bodies[action] || 'Your representation status has been updated.',
    relatedEntityType: 'Representation',
    relatedEntityId: userId,
    actionUrl: '/Profile'
  });
}

/**
 * Trigger notification: Friend request received
 */
export async function notifyFriendRequest(userId, senderProfile, friendshipId) {
  return createNotification({
    userId,
    type: 'friend_request',
    actorUserId: senderProfile.user_id,
    title: 'New Friend Request',
    body: `${senderProfile?.display_name || senderProfile?.full_name || 'Someone'} sent you a friend request`,
    relatedEntityType: 'Friendship',
    relatedEntityId: friendshipId,
    actionUrl: '/Connections?tab=requests'
  });
}

/**
 * Trigger notification: Friend request accepted
 */
export async function notifyFriendRequestAccepted(userId, accepterProfile, friendshipId) {
  return createNotification({
    userId,
    type: 'friend_request_accepted',
    actorUserId: accepterProfile.user_id,
    title: 'Friend Request Accepted',
    body: `${accepterProfile?.display_name || accepterProfile?.full_name || 'Someone'} accepted your friend request`,
    relatedEntityType: 'Friendship',
    relatedEntityId: friendshipId,
    actionUrl: '/Connections'
  });
}