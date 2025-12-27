import { base44 } from '@/api/base44Client';

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
 * Trigger notification: New collaboration invite
 */
export async function notifyCollaborationInvite(inviteeId, collaboration, inviterProfile) {
  return createNotification({
    userId: inviteeId,
    type: 'collaboration_invites',
    actorUserId: collaboration.created_by,
    title: 'New Collaboration Invite',
    body: `${inviterProfile?.display_name || 'Someone'} invited you to join "${collaboration.collaboration_name}"`,
    relatedEntityType: 'Collaboration',
    relatedEntityId: collaboration.id,
    actionUrl: `/CollaborationDetail?id=${collaboration.id}`
  });
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
 * Trigger notification: Contract created
 */
export async function notifyContractCreated(userId, contract, collaboration, creatorProfile) {
  return createNotification({
    userId,
    type: 'contract_updates',
    actorUserId: creatorProfile.user_id,
    title: 'New Contract',
    body: `${creatorProfile?.display_name || 'Someone'} created a contract for "${collaboration.collaboration_name}"`,
    relatedEntityType: 'Contract',
    relatedEntityId: contract.id,
    actionUrl: `/ViewContract?id=${contract.id}`
  });
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
 * Trigger notification: Verification status updated
 */
export async function notifyVerificationStatus(userId, status) {
  const titles = {
    approved: 'Verification Approved',
    rejected: 'Verification Rejected'
  };

  const bodies = {
    approved: 'Your identity verification has been approved. You now have full access to the platform.',
    rejected: 'Your identity verification was rejected. Please review the feedback and resubmit.'
  };

  return createNotification({
    userId,
    type: 'verification_status',
    actorUserId: null,
    title: titles[status] || 'Verification Update',
    body: bodies[status] || 'Your verification status has been updated.',
    relatedEntityType: 'VerificationRecord',
    relatedEntityId: userId,
    actionUrl: '/Verification'
  });
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