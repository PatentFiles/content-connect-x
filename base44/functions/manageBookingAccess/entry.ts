/**
 * manageBookingAccess
 *
 * Backend function for all access/check-in/checkout/code-reset events on a SoloSession.
 * Integrates with existing SoloSession, AdminActionLog, and Notification architecture.
 *
 * Actions:
 *   get_access        – Returns whether caller is in valid booking window + reveals address
 *   request_code      – Issues an access code (valid within booking window only)
 *   reset_code        – Resets/regenerates code (only valid inside booking window, logs event)
 *   checkin           – Records GPS or manual check-in event
 *   report_issue      – Logs an access issue (feeds into existing AdminActionLog + Notification)
 *   checkout          – Marks checkout, uploads evidence, logs event
 *   get_events        – Returns access event log for session (host/guest/admin)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Simple deterministic code from session ID + timestamp seed + salt
// NOT cryptographically strong — this is a convenience code, not a security secret.
// For smart lock integrations, the provider API handles actual security.
function generateCode(sessionId, seed) {
  const raw = `${sessionId}-${seed}-${Deno.env.get('BASE44_APP_ID') || 'cc'}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return String(h % 900000 + 100000); // 6-digit code
}

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function isWithinBookingWindow(session, property) {
  const confirmedDate = session.schedule?.confirmed_date;
  const startTime = session.schedule?.start_time;
  const endTime = session.schedule?.end_time;
  if (!confirmedDate) return false;

  const now = new Date();
  const bufferBefore = (property?.access_settings?.access_code_window_minutes_before ?? 30) * 60 * 1000;
  const bufferAfter = (property?.access_settings?.access_code_window_minutes_after ?? 15) * 60 * 1000;

  const startStr = startTime ? `${confirmedDate}T${startTime}:00` : `${confirmedDate}T00:00:00`;
  const endStr = endTime ? `${confirmedDate}T${endTime}:00` : `${confirmedDate}T23:59:59`;

  const windowStart = new Date(new Date(startStr).getTime() - bufferBefore);
  const windowEnd = new Date(new Date(endStr).getTime() + bufferAfter);

  return now >= windowStart && now <= windowEnd;
}

function isAfterBookingEnd(session) {
  const confirmedDate = session.schedule?.confirmed_date;
  const endTime = session.schedule?.end_time;
  if (!confirmedDate) return false;
  const endStr = endTime ? `${confirmedDate}T${endTime}:00` : `${confirmedDate}T23:59:59`;
  return new Date() > new Date(endStr);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const body = await req.json();
    const { action, session_id } = body;

    if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });

    // Fetch session
    const sessions = await svc.entities.SoloSession.filter({ id: session_id });
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const isHost = session.host_user_id === user.email;
    const isGuest = session.guest_user_id === user.email;

    // Fetch profile for admin check
    const profiles = await svc.entities.UserProfile.filter({ user_id: user.email }).catch(() => []);
    const isAdmin = profiles[0]?.is_admin || profiles[0]?.role_type === 'admin';

    if (!isHost && !isGuest && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Fetch property if available
    const propertyId = session.booking_snapshot?.property_id;
    let property = null;
    if (propertyId) {
      const props = await svc.entities.Property.filter({ id: propertyId }).catch(() => []);
      property = props[0] || null;
    }

    const now = new Date().toISOString();

    // ─── GET_ACCESS ────────────────────────────────────────────────────────────
    if (action === 'get_access') {
      const inWindow = isWithinBookingWindow(session, property);
      const afterEnd = isAfterBookingEnd(session);
      const confirmedStatuses = ['confirmed','contract_pending','contract_signed','active','completed'];
      const isConfirmed = confirmedStatuses.includes(session.status);

      // Reveal address only if confirmed and in window (or past, for audit)
      const canSeeAddress = isConfirmed && (inWindow || afterEnd);

      // Log address_revealed event if first reveal within session
      if (canSeeAddress && (isHost || isGuest)) {
        await svc.entities.BookingAccessEvent.create({
          session_id,
          property_id: propertyId || null,
          actor_user_id: user.email,
          event_type: 'address_revealed',
          timestamp: now,
          metadata: { role: isHost ? 'host' : 'guest' },
        }).catch(() => {});
      }

      return Response.json({
        in_window: inWindow,
        after_end: afterEnd,
        is_confirmed: isConfirmed,
        can_see_address: canSeeAddress,
        exact_address: canSeeAddress ? (property?.exact_address || session.location?.address || null) : null,
        session_status: session.status,
        booking_date: session.schedule?.confirmed_date,
        start_time: session.schedule?.start_time,
        end_time: session.schedule?.end_time,
        gps_required: property?.access_settings?.gps_checkin_required || false,
        checkout_evidence_required: property?.access_settings?.checkout_evidence_required || false,
      });
    }

    // ─── REQUEST_CODE ──────────────────────────────────────────────────────────
    if (action === 'request_code') {
      if (!isGuest && !isHost && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!isWithinBookingWindow(session, property)) {
        return Response.json({ error: 'Access code is only available during your booking window.' }, { status: 403 });
      }

      const seed = session.schedule?.confirmed_date || 'default';
      const code = generateCode(session_id, seed);
      const codeHash = await sha256(code);

      const confirmedDate = session.schedule?.confirmed_date;
      const endTime = session.schedule?.end_time;
      const bufferAfter = (property?.access_settings?.access_code_window_minutes_after ?? 15) * 60 * 1000;
      const endStr = endTime ? `${confirmedDate}T${endTime}:00` : `${confirmedDate}T23:59:59`;
      const expiresAt = new Date(new Date(endStr).getTime() + bufferAfter).toISOString();

      await svc.entities.BookingAccessEvent.create({
        session_id,
        property_id: propertyId || null,
        actor_user_id: user.email,
        event_type: 'access_code_issued',
        timestamp: now,
        access_code_hash: codeHash,
        code_issued_at: now,
        code_expires_at: expiresAt,
        metadata: { role: isHost ? 'host' : 'guest' },
      }).catch(() => {});

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_ACCESS',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'access_code_issued',
        reason: `Code issued to ${user.email}`,
        metadata_json: { session_id, actor: user.email, expires_at: expiresAt, timestamp: now },
      }).catch(() => {});

      return Response.json({ success: true, code, expires_at: expiresAt });
    }

    // ─── RESET_CODE ────────────────────────────────────────────────────────────
    if (action === 'reset_code') {
      if (!isGuest && !isHost && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

      // Block resets after booking end (no grace window for resets)
      if (isAfterBookingEnd(session) && !isAdmin) {
        return Response.json({ error: 'Code reset is not available after booking end time.' }, { status: 403 });
      }
      if (!isWithinBookingWindow(session, property) && !isAdmin) {
        return Response.json({ error: 'Code reset is only available during your booking window.' }, { status: 403 });
      }

      const { reset_reason } = body;
      const seed = `${session.schedule?.confirmed_date || 'default'}-reset-${Date.now()}`;
      const code = generateCode(session_id, seed);
      const codeHash = await sha256(code);

      const confirmedDate = session.schedule?.confirmed_date;
      const endTime = session.schedule?.end_time;
      const bufferAfter = (property?.access_settings?.access_code_window_minutes_after ?? 15) * 60 * 1000;
      const endStr = endTime ? `${confirmedDate}T${endTime}:00` : `${confirmedDate}T23:59:59`;
      const expiresAt = new Date(new Date(endStr).getTime() + bufferAfter).toISOString();

      await svc.entities.BookingAccessEvent.create({
        session_id,
        property_id: propertyId || null,
        actor_user_id: user.email,
        event_type: 'access_code_reset',
        timestamp: now,
        access_code_hash: codeHash,
        code_issued_at: now,
        code_expires_at: expiresAt,
        reset_reason: reset_reason || 'User requested reset',
        metadata: { role: isHost ? 'host' : 'guest' },
      }).catch(() => {});

      // Log to AdminActionLog for audit
      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_ACCESS',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'access_code_reset',
        reason: reset_reason || `Code reset by ${user.email}`,
        metadata_json: { session_id, actor: user.email, role: isHost ? 'host' : 'guest', timestamp: now },
      }).catch(() => {});

      // Notify host if guest reset (and vice versa)
      const notifyUserId = isGuest ? session.host_user_id : session.guest_user_id;
      if (notifyUserId) {
        await svc.entities.Notification.create({
          user_id: notifyUserId,
          type: 'messages',
          actor_user_id: user.email,
          title: 'Access Code Reset',
          body: `The access code for your session on ${session.schedule?.confirmed_date || 'TBD'} was reset. Reason: ${reset_reason || 'Code not working'}.`,
          related_entity_type: 'SoloSession',
          related_entity_id: session_id,
        }).catch(() => {});
      }

      return Response.json({ success: true, code, expires_at: expiresAt });
    }

    // ─── CHECKIN ───────────────────────────────────────────────────────────────
    if (action === 'checkin') {
      if (!isGuest && !isAdmin) return Response.json({ error: 'Only the guest can check in' }, { status: 403 });
      if (!isWithinBookingWindow(session, property)) {
        return Response.json({ error: 'Check-in is only available during your booking window.' }, { status: 403 });
      }

      const { gps_lat, gps_lng, gps_accuracy_meters } = body;
      let distanceFromProperty = null;
      let withinGeofence = null;

      // Calculate distance if GPS provided and property has coordinates
      if (gps_lat && gps_lng && property?.lat && property?.lng) {
        const R = 6371000; // metres
        const φ1 = property.lat * Math.PI / 180;
        const φ2 = gps_lat * Math.PI / 180;
        const Δφ = (gps_lat - property.lat) * Math.PI / 180;
        const Δλ = (gps_lng - property.lng) * Math.PI / 180;
        const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        distanceFromProperty = Math.round(R * c);
        const radius = property?.access_settings?.gps_geofence_radius_meters ?? 200;
        withinGeofence = distanceFromProperty <= radius;
      }

      const eventType = (gps_lat && gps_lng) ? 'checkin_gps' : 'checkin_manual';

      await svc.entities.BookingAccessEvent.create({
        session_id,
        property_id: propertyId || null,
        actor_user_id: user.email,
        event_type: eventType,
        timestamp: now,
        gps_lat: gps_lat || null,
        gps_lng: gps_lng || null,
        gps_accuracy_meters: gps_accuracy_meters || null,
        distance_from_property_meters: distanceFromProperty,
        within_geofence: withinGeofence,
        metadata: { role: 'guest' },
      }).catch(() => {});

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_ACCESS',
        target_type: 'SoloSession',
        target_id: session_id,
        action: eventType,
        reason: `Guest ${user.email} checked in`,
        metadata_json: {
          session_id, actor: user.email,
          gps_provided: !!(gps_lat && gps_lng),
          within_geofence: withinGeofence,
          distance_meters: distanceFromProperty,
          timestamp: now,
        },
      }).catch(() => {});

      // Notify host
      await svc.entities.Notification.create({
        user_id: session.host_user_id,
        type: 'messages',
        actor_user_id: user.email,
        title: 'Guest Checked In',
        body: `Your guest has checked in for their session${session.schedule?.confirmed_date ? ` on ${session.schedule.confirmed_date}` : ''}.`,
        related_entity_type: 'SoloSession',
        related_entity_id: session_id,
      }).catch(() => {});

      return Response.json({
        success: true,
        event_type: eventType,
        within_geofence: withinGeofence,
        distance_meters: distanceFromProperty,
      });
    }

    // ─── REPORT_ISSUE ──────────────────────────────────────────────────────────
    if (action === 'report_issue') {
      const { issue_description, evidence_urls = [] } = body;

      await svc.entities.BookingAccessEvent.create({
        session_id,
        property_id: propertyId || null,
        actor_user_id: user.email,
        event_type: 'checkin_issue_reported',
        timestamp: now,
        condition_notes: issue_description || '',
        evidence_urls,
        metadata: { role: isHost ? 'host' : 'guest' },
      }).catch(() => {});

      // Feed into existing AdminActionLog + Report system
      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_ACCESS',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'access_issue_reported',
        reason: issue_description || `Access issue reported by ${user.email}`,
        metadata_json: { session_id, actor: user.email, evidence_count: evidence_urls.length, timestamp: now },
      }).catch(() => {});

      // Notify the other party
      const notifyUserId = isGuest ? session.host_user_id : session.guest_user_id;
      if (notifyUserId) {
        await svc.entities.Notification.create({
          user_id: notifyUserId,
          type: 'messages',
          actor_user_id: user.email,
          title: 'Access Issue Reported',
          body: `An access issue has been reported for your session on ${session.schedule?.confirmed_date || 'TBD'}. Please check the session details.`,
          related_entity_type: 'SoloSession',
          related_entity_id: session_id,
        }).catch(() => {});
      }

      return Response.json({ success: true });
    }

    // ─── CHECKOUT ──────────────────────────────────────────────────────────────
    if (action === 'checkout') {
      const { condition_notes, evidence_urls = [] } = body;

      await svc.entities.BookingAccessEvent.create({
        session_id,
        property_id: propertyId || null,
        actor_user_id: user.email,
        event_type: evidence_urls.length > 0 ? 'checkout_evidence_uploaded' : 'checkout_completed',
        timestamp: now,
        condition_notes: condition_notes || '',
        evidence_urls,
        metadata: { role: isHost ? 'host' : 'guest' },
      }).catch(() => {});

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_ACCESS',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'checkout_completed',
        reason: `${user.email} completed checkout`,
        metadata_json: {
          session_id, actor: user.email, role: isHost ? 'host' : 'guest',
          evidence_count: evidence_urls.length,
          has_notes: !!condition_notes,
          timestamp: now,
        },
      }).catch(() => {});

      // Notify other party
      const notifyUserId = isGuest ? session.host_user_id : session.guest_user_id;
      if (notifyUserId) {
        await svc.entities.Notification.create({
          user_id: notifyUserId,
          type: 'messages',
          actor_user_id: user.email,
          title: isGuest ? 'Guest Checked Out' : 'Host Submitted Checkout',
          body: `Checkout has been submitted for your session on ${session.schedule?.confirmed_date || 'TBD'}.${evidence_urls.length > 0 ? ' Evidence has been uploaded.' : ''}`,
          related_entity_type: 'SoloSession',
          related_entity_id: session_id,
        }).catch(() => {});
      }

      return Response.json({ success: true });
    }

    // ─── GET_EVENTS ────────────────────────────────────────────────────────────
    if (action === 'get_events') {
      const events = await svc.entities.BookingAccessEvent.filter({ session_id }, '-timestamp', 50);
      // Strip raw GPS coords for guest view — only admin and host can see them
      const sanitized = events.map(e => {
        if (isAdmin || isHost) return e;
        // Guest sees events but not raw GPS coords
        const { gps_lat, gps_lng, ...rest } = e;
        return rest;
      });
      return Response.json({ events: sanitized });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('manageBookingAccess error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});