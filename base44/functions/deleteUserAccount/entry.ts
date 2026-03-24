import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Full account deletion backend function.
 * Deletes all data for the requesting user across all entities.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.email;
    const svc = base44.asServiceRole;

    // Helper: delete all records matching a filter
    async function deleteAll(entityName, filterObj) {
      try {
        const records = await svc.entities[entityName].filter(filterObj);
        await Promise.all(records.map(r => svc.entities[entityName].delete(r.id)));
      } catch (e) {
        console.warn(`Failed deleting ${entityName}:`, e.message);
      }
    }

    // 1. Profile data
    await deleteAll('UserProfile', { user_id: userId });
    await deleteAll('CreatorDetails', { user_id: userId });
    await deleteAll('ServiceDetails', { user_id: userId });
    await deleteAll('AgentDetails', { user_id: userId });
    await deleteAll('StudioDetails', { user_id: userId });

    // 2. Verification & compliance
    await deleteAll('VerificationRecord', { user_id: userId });
    await deleteAll('TestingCredential', { user_id: userId });
    await deleteAll('TestingDocument', { user_id: userId });
    await deleteAll('ComplianceRecord', { user_id: userId });

    // 3. Subscription & billing
    await deleteAll('Subscription', { user_id: userId });
    await deleteAll('CouponRedemption', { user_id: userId });

    // 4. Messaging
    await deleteAll('Message', { sender_id: userId });
    const conversations = await svc.entities.Conversation.filter({});
    const userConvos = conversations.filter(c => c.participant_ids?.includes(userId));
    await Promise.all(userConvos.map(async (c) => {
      // If the user is the only participant, delete conversation
      if ((c.participant_ids || []).length <= 1) {
        await svc.entities.Conversation.delete(c.id);
      } else {
        // Remove user from participant list
        const newParticipants = c.participant_ids.filter(id => id !== userId);
        await svc.entities.Conversation.update(c.id, { participant_ids: newParticipants });
      }
    }));

    // 5. Collaborations — remove user from participant lists
    const collabs = await svc.entities.Collaboration.filter({});
    const userCollabs = collabs.filter(c => c.participant_ids?.includes(userId));
    await Promise.all(userCollabs.map(async (c) => {
      const newParticipants = (c.participant_ids || []).filter(id => id !== userId);
      if (newParticipants.length === 0) {
        await svc.entities.Collaboration.delete(c.id);
      } else {
        await svc.entities.Collaboration.update(c.id, { participant_ids: newParticipants });
      }
    }));

    // 6. Galleries
    await deleteAll('Gallery', { user_id: userId });
    await deleteAll('GalleryPermission', { owner_id: userId });
    await deleteAll('GalleryPermission', { granted_to_user_id: userId });

    // 7. Contracts & signatures
    await deleteAll('ContractSignature', { signer_id: userId });

    // 8. Social links & settings
    await deleteAll('SocialLink', { user_id: userId });
    await deleteAll('UserSettings', { user_id: userId });
    await deleteAll('NotificationPreference', { user_id: userId });

    // 9. Notifications
    await deleteAll('Notification', { user_id: userId });

    // 10. Favorites, blocks, reports
    await deleteAll('Favorite', { user_id: userId });
    await deleteAll('BlockedUser', { blocker_id: userId });
    await deleteAll('BlockedUser', { blocked_id: userId });
    await deleteAll('Report', { reporter_id: userId });

    // 11. Friendship
    await deleteAll('Friendship', { user_id: userId });
    await deleteAll('Friendship', { friend_id: userId });

    // 12. Profile views, session history, analytics
    await deleteAll('ProfileView', { viewer_id: userId });
    await deleteAll('SessionHistory', { user_id: userId });

    // 13. Scheduling & availability
    await deleteAll('ScheduleEntry', { user_id: userId });
    await deleteAll('AvailabilitySchedule', { user_id: userId });

    console.log(`Full account deletion completed for ${userId}`);
    return Response.json({ success: true, message: 'Account data deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});