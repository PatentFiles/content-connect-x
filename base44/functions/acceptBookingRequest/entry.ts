/**
 * acceptBookingRequest
 *
 * Handles the full booking lifecycle server-side:
 *  - accept: validate, create Collaboration, link back, notify, log
 *  - decline: update status, notify requester, log
 *  - cancel: requester cancels their own pending request
 *
 * Studio bookings set booking_type='studio', carry studio_location_name,
 * studio_notes, and wire studio_id into the created Collaboration.
 * All actions enforce ban/suspension checks.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;

    // Ban/suspension check
    const profiles = await svc.entities.UserProfile.filter({ user_id: user.email }).catch(() => []);
    const profile = profiles[0];
    if (profile?.banned || profile?.suspended) {
      return Response.json({ error: 'Account restricted' }, { status: 403 });
    }

    const body = await req.json();
    const { action, booking_id, response_message } = body;

    if (!booking_id) return Response.json({ error: 'booking_id required' }, { status: 400 });

    // Fetch booking
    const bookings = await svc.entities.BookingRequest.filter({ id: booking_id }).catch(() => []);
    const booking = bookings[0];
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 });

    const isStudioBooking = booking.booking_type === 'studio';
    const isPhotographerBooking = booking.booking_type === 'photographer';
    const isVideographerBooking = booking.booking_type === 'videographer';

    // ─── ACCEPT ────────────────────────────────────────────────────────────────
    if (action === 'accept') {
      // Only recipient can accept
      if (booking.recipient_user_id !== user.email) {
        return Response.json({ error: 'Only the recipient can accept this request' }, { status: 403 });
      }
      if (booking.status !== 'pending') {
        return Response.json({ error: `Booking is already ${booking.status}` }, { status: 409 });
      }

      // Verify requester is not banned
      const requesterProfiles = await svc.entities.UserProfile.filter({ user_id: booking.requester_user_id }).catch(() => []);
      const requesterProfile = requesterProfiles[0];
      if (requesterProfile?.banned || requesterProfile?.suspended) {
        return Response.json({ error: 'Requester account is restricted — cannot accept' }, { status: 403 });
      }

      // Build collaboration name
      const collabName = isStudioBooking
        ? `Studio Booking: ${booking.studio_location_name || profile?.display_name || 'Studio'} — ${booking.requested_date}`
        : isPhotographerBooking
        ? `Photography Booking: ${booking.requested_date}`
        : isVideographerBooking
        ? `Videography Booking: ${booking.requested_date}`
        : `Booking: ${booking.requested_date}`;

      // Build tags
      const tags = ['from_booking'];
      if (isStudioBooking) tags.push('from_studio_booking', 'created_from_studio_booking');

      // Build location from booking / schedule entry
      let locationData = null;
      if (isStudioBooking) {
        locationData = {
          type: 'studio',
          address: booking.studio_location_name || null,
          notes: booking.studio_notes || null,
        };
      }

      // Create the Collaboration
      const collaborationPayload = {
        collaboration_name: collabName,
        participant_ids: [booking.requester_user_id, booking.recipient_user_id],
        creator_ids: [booking.requester_user_id],
        status: 'agreed',
        created_by_user_id: booking.recipient_user_id,
        created_by_role: isStudioBooking ? 'studio' : (profile?.role_type || 'creator'),
        schedule: {
          confirmed_date: booking.requested_date,
          start_time: booking.requested_time || null,
          end_time: booking.requested_end_time || null,
        },
        internal_notes: `Created from BookingRequest ${booking_id}${booking.studio_notes ? `. Studio notes: ${booking.studio_notes}` : ''}`,
        tags,
        ...(locationData && { location: locationData }),
        ...(isStudioBooking && { studio_id: booking.recipient_user_id }),
        ...(isPhotographerBooking && { photographer_id: booking.recipient_user_id }),
        ...(isVideographerBooking && { videographer_id: booking.recipient_user_id }),
      };

      const collaboration = await svc.entities.Collaboration.create(collaborationPayload);

      // If there's a schedule entry, mark it as BOOKED and increment booking count
      if (booking.schedule_entry_id) {
        const entries = await svc.entities.ScheduleEntry.filter({ id: booking.schedule_entry_id }).catch(() => []);
        const entry = entries[0];
        if (entry) {
          const maxBookings = entry.max_bookings || 1;
          const currentCount = (entry.current_booking_count || 0) + 1;
          const newStatus = currentCount >= maxBookings ? 'BOOKED' : 'AVAILABLE';
          await svc.entities.ScheduleEntry.update(booking.schedule_entry_id, {
            collaboration_id: collaboration.id,
            current_booking_count: currentCount,
            status: newStatus,
          }).catch(() => {});
        }
      }

      // Update BookingRequest — link collaboration
      await svc.entities.BookingRequest.update(booking_id, {
        status: 'accepted',
        responded_at: new Date().toISOString(),
        response_message: response_message || null,
        collaboration_id: collaboration.id,
      });

      // Notify requester
      const notifBody = isStudioBooking
        ? `Your studio booking request at ${booking.studio_location_name || 'the studio'} for ${booking.requested_date} was accepted. A collaboration has been created.`
        : `Your booking request for ${booking.requested_date} was accepted. A collaboration has been created.`;

      await svc.entities.Notification.create({
        user_id: booking.requester_user_id,
        type: 'collaboration_invites',
        actor_user_id: user.email,
        title: isStudioBooking ? 'Studio Booking Accepted!' : 'Booking Request Accepted!',
        body: notifBody,
        related_entity_type: 'Collaboration',
        related_entity_id: collaboration.id,
        action_url: `/CollaborationDetail?id=${collaboration.id}`,
      }).catch(() => {});

      // Log
      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_BOOKING',
        target_type: 'BookingRequest',
        target_id: booking_id,
        action: isStudioBooking ? 'studio_booking_accepted' : 'booking_accepted',
        reason: 'Recipient accepted booking request',
        metadata_json: {
          booking_id,
          booking_type: booking.booking_type || 'creator',
          collaboration_id: collaboration.id,
          requester: booking.requester_user_id,
          recipient: booking.recipient_user_id,
          date: booking.requested_date,
          studio_location: booking.studio_location_name || null,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      return Response.json({
        success: true,
        status: 'accepted',
        collaboration_id: collaboration.id,
        collaboration,
      });
    }

    // ─── DECLINE ───────────────────────────────────────────────────────────────
    if (action === 'decline') {
      if (booking.recipient_user_id !== user.email) {
        return Response.json({ error: 'Only the recipient can decline this request' }, { status: 403 });
      }
      if (booking.status !== 'pending') {
        return Response.json({ error: `Booking is already ${booking.status}` }, { status: 409 });
      }

      await svc.entities.BookingRequest.update(booking_id, {
        status: 'declined',
        responded_at: new Date().toISOString(),
        response_message: response_message || null,
      });

      const declineBody = isStudioBooking
        ? `Your studio booking request for ${booking.requested_date} was declined.${response_message ? ` Reason: ${response_message}` : ''}`
        : `Your booking request for ${booking.requested_date} was declined.`;

      await svc.entities.Notification.create({
        user_id: booking.requester_user_id,
        type: 'collaboration_invites',
        actor_user_id: user.email,
        title: isStudioBooking ? 'Studio Booking Declined' : 'Booking Request Declined',
        body: declineBody,
        related_entity_type: 'BookingRequest',
        related_entity_id: booking_id,
        action_url: 'Dashboard',
      }).catch(() => {});

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_BOOKING',
        target_type: 'BookingRequest',
        target_id: booking_id,
        action: isStudioBooking ? 'studio_booking_declined' : 'booking_declined',
        reason: 'Recipient declined booking request',
        metadata_json: {
          booking_id,
          booking_type: booking.booking_type || 'creator',
          requester: booking.requester_user_id,
          recipient: booking.recipient_user_id,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      return Response.json({ success: true, status: 'declined' });
    }

    // ─── CANCEL ────────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      if (booking.requester_user_id !== user.email) {
        return Response.json({ error: 'Only the requester can cancel this request' }, { status: 403 });
      }
      if (!['pending'].includes(booking.status)) {
        return Response.json({ error: `Cannot cancel a booking that is ${booking.status}` }, { status: 409 });
      }

      await svc.entities.BookingRequest.update(booking_id, {
        status: 'cancelled',
        responded_at: new Date().toISOString(),
      });

      // Notify studio of cancellation
      if (isStudioBooking) {
        await svc.entities.Notification.create({
          user_id: booking.recipient_user_id,
          type: 'collaboration_invites',
          actor_user_id: booking.requester_user_id,
          title: 'Studio Booking Cancelled',
          body: `A studio booking request for ${booking.requested_date} was cancelled by the requester.`,
          related_entity_type: 'BookingRequest',
          related_entity_id: booking_id,
          action_url: 'Dashboard',
        }).catch(() => {});
      }

      return Response.json({ success: true, status: 'cancelled' });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('acceptBookingRequest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});