import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Find collaborations that are signed/active but not completed for > 7 days
    const allCollabs = await base44.entities.Collaboration.list();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const eligibleCollabs = allCollabs.filter(collab => {
      // Must be signed or active
      if (!['signed', 'active'].includes(collab.status)) return false;

      // Must not be completed
      if (collab.completed_at) return false;

      // Must have been in this state for > 7 days
      const createdDate = new Date(collab.created_date);
      const lastStatusChangeDate = new Date(collab.updated_date || collab.created_date);

      // If status is signed/active, check when it was last updated
      // Use updated_date as proxy for status change
      return lastStatusChangeDate < sevenDaysAgo;
    });

    console.log(`Found ${eligibleCollabs.length} collaborations eligible for completion reminders`);

    let sentCount = 0;
    for (const collab of eligibleCollabs) {
      try {
        // Send reminder to all participants
        const participants = collab.participant_ids || [];
        for (const participantId of participants) {
          // Check if we already sent a reminder recently
          const existingReminders = await base44.entities.Notification.filter({
            user_id: participantId,
            related_entity_id: collab.id,
            type: 'collaboration_completion_reminder',
          });

          // Don't spam — only send if no reminder in last 3 days
          const recentReminder = existingReminders.find(notif => {
            const notifDate = new Date(notif.created_date);
            return now.getTime() - notifDate.getTime() < 3 * 24 * 60 * 60 * 1000;
          });

          if (!recentReminder) {
            await base44.entities.Notification.create({
              user_id: participantId,
              type: 'collaboration_completion_reminder',
              actor_user_id: 'system',
              title: 'Collaboration Awaiting Completion',
              body: `"${collab.collaboration_name || 'Your collaboration'}" has been signed for 7+ days. Please mark it as complete to finalize earnings.`,
              related_entity_type: 'Collaboration',
              related_entity_id: collab.id,
              action_url: `/CollaborationDetail?id=${collab.id}`,
            });
            sentCount++;
          }
        }
      } catch (e) {
        console.error(`Failed to send reminder for collab ${collab.id}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      checked: eligibleCollabs.length,
      sent: sentCount,
      message: `Checked ${eligibleCollabs.length} collaborations, sent ${sentCount} reminders`,
    });
  } catch (error) {
    console.error('[checkCompletionReminders]', error.message);
    return Response.json(
      { error: error.message || 'Failed to check completion reminders' },
      { status: 500 }
    );
  }
});