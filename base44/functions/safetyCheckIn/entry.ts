/**
 * SAFETY CHECK-IN SYSTEM
 *
 * Handles safety workflow for in-person collaborations:
 *  - check_in: User checks in before a collaboration
 *  - mark_safe: User marks themselves safe after
 *  - escalate: Admin or system escalates a missed check-in
 *  - get_status: Get check-in status for a collaboration
 *  - list_missed: Admin — find overdue check-ins
 *
 * NOTE: action is passed in the request BODY as { action: '...' }
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

    const body = await req.json();
    // action comes from body (SDK invoke doesn't support query params)
    const action = body.action;
    const svc = base44.asServiceRole;

    // Check user is not banned
    const profiles = await svc.entities.UserProfile.filter({ user_id: user.email }).catch(() => []);
    const profile = profiles[0];
    if (profile?.banned || profile?.suspended) {
      return Response.json({ error: 'Account restricted' }, { status: 403 });
    }

    switch (action) {

      case 'check_in': {
        const { collaboration_id, expected_end_time, trusted_contact_name, location_shared, notes } = body;
        if (!collaboration_id) return Response.json({ error: 'collaboration_id required' }, { status: 400 });

        // Verify user is participant
        const collabs = await svc.entities.Collaboration.filter({ id: collaboration_id }).catch(() => []);
        const collab = collabs[0];
        if (!collab?.participant_ids?.includes(user.email)) {
          return Response.json({ error: 'Not a participant in this collaboration' }, { status: 403 });
        }

        // Check for existing active check-in
        const existing = await svc.entities.SafetyCheckIn.filter({
          user_id: user.email,
          collaboration_id,
        }).catch(() => []);
        const activeExisting = existing.filter(c => ['pending', 'checked_in'].includes(c.status));
        if (activeExisting.length > 0) {
          return Response.json({ error: 'Check-in already active for this collaboration' }, { status: 409 });
        }

        const checkIn = await svc.entities.SafetyCheckIn.create({
          user_id: user.email,
          collaboration_id,
          status: 'checked_in',
          checkin_time: new Date().toISOString(),
          expected_end_time: expected_end_time || null,
          trusted_contact_name: trusted_contact_name || null,
          location_shared: location_shared || null,
          notes: notes || null,
          admin_notified: false,
        });

        // Create notification for self reminder if expected end time set
        if (expected_end_time) {
          await svc.entities.Notification.create({
            user_id: user.email,
            type: 'safety_checkin',
            title: 'Safety Reminder',
            body: `Don't forget to mark yourself safe after your collaboration ends around ${new Date(expected_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            action_url: `/CollaborationDetail?id=${collaboration_id}`,
          }).catch(() => {});
        }

        // Log
        await svc.entities.AdminActionLog.create({
          admin_user_id: 'SYSTEM_SAFETY',
          target_type: 'SafetyCheckIn',
          target_id: checkIn.id,
          action: 'safety_checkin_started',
          reason: 'User initiated safety check-in',
          metadata_json: { user_id: user.email, collaboration_id, timestamp: new Date().toISOString() },
        }).catch(() => {});

        return Response.json({ success: true, data: checkIn });
      }

      case 'mark_safe': {
        const { check_in_id } = body;
        if (!check_in_id) return Response.json({ error: 'check_in_id required' }, { status: 400 });

        const checkIns = await svc.entities.SafetyCheckIn.filter({ id: check_in_id, user_id: user.email }).catch(() => []);
        const checkIn = checkIns[0];
        if (!checkIn) return Response.json({ error: 'Check-in not found' }, { status: 404 });
        if (checkIn.status === 'safe') return Response.json({ success: true, data: checkIn, already_safe: true });

        const updated = await svc.entities.SafetyCheckIn.update(check_in_id, {
          status: 'safe',
          checkout_time: new Date().toISOString(),
        });

        await svc.entities.AdminActionLog.create({
          admin_user_id: 'SYSTEM_SAFETY',
          target_type: 'SafetyCheckIn',
          target_id: check_in_id,
          action: 'safety_marked_safe',
          reason: 'User marked themselves safe',
          metadata_json: { user_id: user.email, timestamp: new Date().toISOString() },
        }).catch(() => {});

        return Response.json({ success: true, data: updated });
      }

      case 'escalate': {
        // Admin-only or system escalation
        const { check_in_id, reason } = body;
        if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

        const checkIns = await svc.entities.SafetyCheckIn.filter({ id: check_in_id }).catch(() => []);
        const checkIn = checkIns[0];
        if (!checkIn) return Response.json({ error: 'Not found' }, { status: 404 });

        const updated = await svc.entities.SafetyCheckIn.update(check_in_id, {
          status: 'escalated',
          escalated_at: new Date().toISOString(),
          escalation_reason: reason || 'Missed check-out — admin escalated',
          admin_notified: true,
        });

        await svc.entities.Report.create({
          reporter_id: 'SYSTEM_SAFETY_CHECKIN',
          target_user_id: checkIn.user_id,
          reason: 'other',
          details: `[SAFETY CHECK-IN ESCALATION] User missed safety check-out for collaboration ${checkIn.collaboration_id}. Check-in ID: ${check_in_id}. Expected end: ${checkIn.expected_end_time}. Escalated: ${new Date().toISOString()}.`,
          status: 'investigating',
          admin_notes: '⚠️ SAFETY CHECK-IN MISSED — Admin review recommended. Contact user to confirm safety.',
        }).catch(() => {});

        return Response.json({ success: true, data: updated });
      }

      case 'get_status': {
        const { collaboration_id } = body;
        if (!collaboration_id) return Response.json({ error: 'collaboration_id required' }, { status: 400 });

        const checkIns = await svc.entities.SafetyCheckIn.filter({
          user_id: user.email,
          collaboration_id,
        }).catch(() => []);

        // Return most recent
        const sorted = checkIns.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        return Response.json({ success: true, data: sorted[0] || null });
      }

      case 'list_missed': {
        // Admin: find missed check-ins
        if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const allCheckIns = await svc.entities.SafetyCheckIn.list('-checkin_time', 100).catch(() => []);
        const missed = allCheckIns.filter(c =>
          c.status === 'checked_in' &&
          c.expected_end_time &&
          c.expected_end_time < twoDaysAgo
        );
        return Response.json({ success: true, data: missed });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('safetyCheckIn error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});