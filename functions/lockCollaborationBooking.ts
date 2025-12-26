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

    // Fetch collaboration details
    const collaborations = await base44.asServiceRole.entities.Collaboration.filter({ 
      id: collaboration_id 
    });
    const collaboration = collaborations[0];

    if (!collaboration) {
      return Response.json({ error: 'Collaboration not found' }, { status: 404 });
    }

    // Verify collaboration has confirmed dates
    if (!collaboration.schedule?.proposed_dates || collaboration.schedule.proposed_dates.length === 0) {
      return Response.json({ 
        error: 'Collaboration has no scheduled dates' 
      }, { status: 400 });
    }

    const participantIds = collaboration.participant_ids || [];
    if (participantIds.length === 0) {
      return Response.json({ 
        error: 'Collaboration has no participants' 
      }, { status: 400 });
    }

    const scheduledDates = collaboration.schedule.proposed_dates;
    const startDate = scheduledDates[0];
    const endDate = scheduledDates[scheduledDates.length - 1];
    const timezone = collaboration.schedule.timezone || 'UTC';

    // Check for existing booking locks for this collaboration
    const existingBookings = await base44.asServiceRole.entities.ScheduleEntry.filter({
      collaboration_id,
      entry_type: 'BOOKING'
    });

    const existingParticipants = new Set(existingBookings.map(b => b.user_id));

    // Check for conflicting bookings for participants
    const allScheduleEntries = await base44.asServiceRole.entities.ScheduleEntry.filter({});
    
    const conflicts = [];
    for (const participantId of participantIds) {
      if (existingParticipants.has(participantId)) {
        continue; // Already has booking lock, skip
      }

      // Check for overlapping BOOKED entries
      const participantEntries = allScheduleEntries.filter(entry => 
        entry.user_id === participantId &&
        entry.status === 'BOOKED' &&
        entry.collaboration_id !== collaboration_id
      );

      for (const entry of participantEntries) {
        const entryStart = entry.start_date;
        const entryEnd = entry.end_date;
        
        // Check if dates overlap
        const overlaps = (startDate >= entryStart && startDate <= entryEnd) ||
                        (endDate >= entryStart && endDate <= entryEnd) ||
                        (startDate <= entryStart && endDate >= entryEnd);

        if (overlaps) {
          conflicts.push({
            user_id: participantId,
            conflicting_collaboration_id: entry.collaboration_id,
            conflicting_dates: `${entryStart} to ${entryEnd}`
          });
        }
      }
    }

    // If conflicts exist, block the operation
    if (conflicts.length > 0) {
      return Response.json({
        error: 'Participant already booked',
        conflicts
      }, { status: 409 });
    }

    // Create booking locks for participants who don't have one
    const createdEntries = [];
    for (const participantId of participantIds) {
      if (existingParticipants.has(participantId)) {
        continue; // Skip if already exists
      }

      const bookingEntry = await base44.asServiceRole.entities.ScheduleEntry.create({
        user_id: participantId,
        entry_type: 'BOOKING',
        status: 'BOOKED',
        source: 'COLLABORATION',
        collaboration_id,
        title: 'Booked Collaboration',
        start_date: startDate,
        end_date: endDate,
        timezone,
        location_city: collaboration.location?.city || null,
        location_region: collaboration.location?.region || null,
        location_country: collaboration.location?.country || null,
        is_locked: true,
        lock_reason: 'Collaboration booking lock'
      });

      createdEntries.push(bookingEntry);
    }

    // Create audit log entry
    if (createdEntries.length > 0) {
      await base44.asServiceRole.entities.CollaborationActivityLog.create({
        collaboration_id,
        action_type: 'BOOKING_LOCKED',
        actor_user_id: user.email,
        metadata_json: {
          dates: scheduledDates,
          participant_ids: participantIds,
          created_entry_ids: createdEntries.map(e => e.id)
        }
      });
    }

    return Response.json({
      success: true,
      message: `Created ${createdEntries.length} booking locks`,
      created_entries: createdEntries.length,
      skipped_existing: existingParticipants.size
    });

  } catch (error) {
    console.error('Booking lock error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});