import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { collaboration_id } = await req.json();

    if (!collaboration_id) {
      return Response.json({ error: 'collaboration_id is required' }, { status: 400 });
    }

    // Fetch existing booking locks for this collaboration
    const bookingEntries = await base44.asServiceRole.entities.ScheduleEntry.filter({
      collaboration_id,
      entry_type: 'BOOKING',
      source: 'COLLABORATION'
    });

    // If no booking entries exist, return success (idempotent)
    if (bookingEntries.length === 0) {
      return Response.json({
        success: true,
        message: 'No booking locks to release',
        released_entries: 0
      });
    }

    // Delete all booking entries
    const releasedEntryIds = [];
    for (const entry of bookingEntries) {
      await base44.asServiceRole.entities.ScheduleEntry.delete(entry.id);
      releasedEntryIds.push(entry.id);
    }

    // Create audit log entry
    await base44.asServiceRole.entities.CollaborationActivityLog.create({
      collaboration_id,
      action_type: 'BOOKING_RELEASED',
      actor_user_id: user.email,
      metadata_json: {
        removed_entry_ids: releasedEntryIds,
        entry_count: releasedEntryIds.length
      }
    });

    return Response.json({
      success: true,
      message: `Released ${releasedEntryIds.length} booking locks`,
      released_entries: releasedEntryIds.length
    });

  } catch (error) {
    console.error('Booking release error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});