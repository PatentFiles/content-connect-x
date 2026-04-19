/**
 * manageSoloSession
 *
 * Unified session management backend for SoloSession records.
 * Handles: create, confirm, sign_contract, activate, complete, cancel, upgrade_to_collaboration
 *
 * Architecture:
 *  - SoloSession is a first-class auditable record (not a lightweight booking stub).
 *  - Every status transition writes to AdminActionLog (same pattern as Collaboration).
 *  - Contract is created via the existing Contract entity — no parallel contract system.
 *  - upgrade_to_collaboration converts a SoloSession into a full Collaboration without
 *    data loss — the SoloSession record is preserved with collaboration_id set.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

     // HARD ENFORCEMENT: Age verification + subscription
     const isAdminEarly = user?.role === 'admin' || user?.role_type === 'admin';
     if (!isAdminEarly) {
       if (profile?.age_verified !== true) {
         return Response.json({ error: 'Age verification required', code: 'VERIFICATION_REQUIRED' }, { status: 403 });
       }
       // Fetch subscription status
       const subs = await svc.entities.Subscription.filter({ user_id: user.email }).catch(() => []);
       const sub = subs[0];
       if (!sub || !['active', 'trial'].includes(sub.status)) {
         return Response.json({ error: 'Active subscription required', code: 'SUBSCRIPTION_REQUIRED' }, { status: 403 });
       }
     }

    const body = await req.json();
    const { action } = body;

    // ─── CREATE ────────────────────────────────────────────────────────────────
    if (action === 'create') {
      const {
        session_type = 'solo_session',
        booking_mode = 'solo',
        participant_mode = 'on_platform',
        host_user_id,
        schedule,
        location,
        compensation,
        external_participants,
        session_name,
        schedule_entry_id,
        booking_request_id,
        agreement_text_snapshot,
        tags = [],
      } = body;

      if (!host_user_id) return Response.json({ error: 'host_user_id required' }, { status: 400 });

      // Verify host exists and is not banned
      const hostProfiles = await svc.entities.UserProfile.filter({ user_id: host_user_id }).catch(() => []);
      const hostProfile = hostProfiles[0];
      if (!hostProfile) return Response.json({ error: 'Host not found' }, { status: 404 });
      if (hostProfile?.banned || hostProfile?.suspended) {
        return Response.json({ error: 'Host account is restricted' }, { status: 403 });
      }

      const sessionName = session_name ||
        `${session_type === 'location_booking' ? 'Location' : session_type === 'service_booking' ? 'Service' : 'Solo'} Session — ${schedule?.confirmed_date || new Date().toISOString().split('T')[0]}`;

      const session = await svc.entities.SoloSession.create({
        session_type,
        booking_mode,
        participant_mode,
        host_user_id,
        guest_user_id: user.email,
        external_participants: external_participants || [],
        status: host_user_id === user.email ? 'confirmed' : 'pending_host',
        session_name: sessionName,
        schedule: schedule || {},
        location: location || {},
        compensation: compensation || {},
        schedule_entry_id: schedule_entry_id || null,
        booking_request_id: booking_request_id || null,
        agreement_text_snapshot: agreement_text_snapshot || null,
        agreement_accepted_at: agreement_text_snapshot ? new Date().toISOString() : null,
        tags: [...tags, 'solo_session', session_type],
        internal_notes: `Created by ${user.email} on ${new Date().toISOString()}`,
      });

      // Reserve schedule entry if provided
      if (schedule_entry_id) {
        await svc.entities.ScheduleEntry.update(schedule_entry_id, {
          status: 'BOOKED',
          collaboration_id: session.id,
        }).catch(() => {});
      }

      // Notify host if different from guest
      if (host_user_id !== user.email) {
        await svc.entities.Notification.create({
          user_id: host_user_id,
          type: 'collaboration_invites',
          actor_user_id: user.email,
          title: 'New Session Booking Request',
          body: `${profile?.display_name || 'A user'} has requested to book your space/service on ${schedule?.confirmed_date || 'TBD'}.`,
          related_entity_type: 'SoloSession',
          related_entity_id: session.id,
          action_url: `/SoloSessionDetail?id=${session.id}`,
        }).catch(() => {});
      }

      // Immutable log
      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_SESSION',
        target_type: 'SoloSession',
        target_id: session.id,
        action: 'solo_session_created',
        reason: `${session_type} created by ${user.email}`,
        metadata_json: {
          session_id: session.id,
          session_type,
          booking_mode,
          participant_mode,
          guest: user.email,
          host: host_user_id,
          date: schedule?.confirmed_date || null,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      return Response.json({ success: true, session_id: session.id, session });
    }

    // ─── Fetch session for all other actions ───────────────────────────────────
    const { session_id } = body;
    if (!session_id) return Response.json({ error: 'session_id required' }, { status: 400 });

    const sessions = await svc.entities.SoloSession.filter({ id: session_id }).catch(() => []);
    const session = sessions[0];
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

    const isHost = session.host_user_id === user.email;
    const isGuest = session.guest_user_id === user.email;
    const isAdmin = profile?.is_admin || profile?.role_type === 'admin';

    if (!isHost && !isGuest && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // ─── CONFIRM (host accepts the request) ────────────────────────────────────
    if (action === 'confirm') {
      if (!isHost && !isAdmin) return Response.json({ error: 'Only the host can confirm' }, { status: 403 });
      if (session.status !== 'pending_host') {
        return Response.json({ error: `Session is already ${session.status}` }, { status: 409 });
      }

      await svc.entities.SoloSession.update(session_id, { status: 'confirmed' });

      await svc.entities.Notification.create({
        user_id: session.guest_user_id,
        type: 'collaboration_invites',
        actor_user_id: user.email,
        title: 'Session Booking Confirmed',
        body: `Your session booking for ${session.schedule?.confirmed_date || 'TBD'} has been confirmed.`,
        related_entity_type: 'SoloSession',
        related_entity_id: session_id,
        action_url: `/SoloSessionDetail?id=${session_id}`,
      }).catch(() => {});

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_SESSION',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'solo_session_confirmed',
        reason: `Host ${user.email} confirmed session`,
        metadata_json: { session_id, host: user.email, guest: session.guest_user_id, timestamp: new Date().toISOString() },
      }).catch(() => {});

      return Response.json({ success: true, status: 'confirmed' });
    }

    // ─── ATTACH CONTRACT ───────────────────────────────────────────────────────
    if (action === 'attach_contract') {
      if (!isHost && !isGuest && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { contract_id } = body;
      if (!contract_id) return Response.json({ error: 'contract_id required' }, { status: 400 });

      await svc.entities.SoloSession.update(session_id, {
        contract_id,
        status: 'contract_pending',
      });

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_SESSION',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'solo_session_contract_attached',
        reason: `Contract ${contract_id} attached to session`,
        metadata_json: { session_id, contract_id, actor: user.email, timestamp: new Date().toISOString() },
      }).catch(() => {});

      return Response.json({ success: true, status: 'contract_pending', contract_id });
    }

    // ─── MARK CONTRACT SIGNED ──────────────────────────────────────────────────
    if (action === 'contract_signed') {
      if (!isHost && !isGuest && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

      await svc.entities.SoloSession.update(session_id, { status: 'contract_signed' });

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_SESSION',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'solo_session_contract_signed',
        reason: `Contract signed by ${user.email}`,
        metadata_json: { session_id, actor: user.email, timestamp: new Date().toISOString() },
      }).catch(() => {});

      return Response.json({ success: true, status: 'contract_signed' });
    }

    // ─── COMPLETE ──────────────────────────────────────────────────────────────
    if (action === 'complete') {
      if (!isHost && !isGuest && !isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      if (!['active', 'contract_signed', 'confirmed'].includes(session.status)) {
        return Response.json({ error: `Cannot complete a session with status: ${session.status}` }, { status: 409 });
      }

      await svc.entities.SoloSession.update(session_id, {
        status: 'completed',
      });

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_SESSION',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'solo_session_completed',
        reason: `Session marked complete by ${user.email}`,
        metadata_json: {
          session_id,
          session_type: session.session_type,
          actor: user.email,
          guest: session.guest_user_id,
          host: session.host_user_id,
          compensation: session.compensation,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      // Notify both parties
      const otherParty = isGuest ? session.host_user_id : session.guest_user_id;
      await svc.entities.Notification.create({
        user_id: otherParty,
        type: 'collaboration_invites',
        actor_user_id: user.email,
        title: 'Session Completed',
        body: `Your session on ${session.schedule?.confirmed_date || 'TBD'} has been marked as completed.`,
        related_entity_type: 'SoloSession',
        related_entity_id: session_id,
        action_url: `/SoloSessionDetail?id=${session_id}`,
      }).catch(() => {});

      return Response.json({ success: true, status: 'completed' });
    }

    // ─── CANCEL ────────────────────────────────────────────────────────────────
    if (action === 'cancel') {
      const { reason } = body;
      if (!['draft', 'pending_host', 'confirmed', 'contract_pending'].includes(session.status)) {
        return Response.json({ error: `Cannot cancel a session with status: ${session.status}` }, { status: 409 });
      }

      await svc.entities.SoloSession.update(session_id, { status: 'cancelled' });

      // Release schedule entry
      if (session.schedule_entry_id) {
        await svc.entities.ScheduleEntry.update(session.schedule_entry_id, {
          status: 'AVAILABLE',
          collaboration_id: null,
        }).catch(() => {});
      }

      const otherParty = isGuest ? session.host_user_id : session.guest_user_id;
      await svc.entities.Notification.create({
        user_id: otherParty,
        type: 'collaboration_invites',
        actor_user_id: user.email,
        title: 'Session Cancelled',
        body: `A session booking for ${session.schedule?.confirmed_date || 'TBD'} was cancelled.${reason ? ` Reason: ${reason}` : ''}`,
        related_entity_type: 'SoloSession',
        related_entity_id: session_id,
      }).catch(() => {});

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_SESSION',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'solo_session_cancelled',
        reason: reason || `Cancelled by ${user.email}`,
        metadata_json: { session_id, actor: user.email, previous_status: session.status, timestamp: new Date().toISOString() },
      }).catch(() => {});

      return Response.json({ success: true, status: 'cancelled' });
    }

    // ─── UPGRADE TO COLLABORATION ──────────────────────────────────────────────
    if (action === 'upgrade_to_collaboration') {
      if (session.upgraded_to_collaboration) {
        return Response.json({ error: 'Session already upgraded to collaboration' }, { status: 409 });
      }

      // Build a Collaboration from the session data
      const collabPayload = {
        collaboration_name: session.session_name || `Upgraded: ${session.session_type}`,
        participant_ids: [session.guest_user_id, session.host_user_id].filter(Boolean),
        creator_ids: [session.guest_user_id],
        status: 'active',
        created_by_user_id: user.email,
        created_by_role: profile?.role_type || 'creator',
        schedule: session.schedule || {},
        location: session.location || {},
        compensation_type: session.compensation?.amount > 0 ? 'paid' : 'free',
        compensation_details: {
          amount: session.compensation?.amount || 0,
          currency: session.compensation?.currency || 'USD',
          notes: session.compensation?.notes || '',
        },
        tags: [...(session.tags || []), 'upgraded_from_solo_session'],
        internal_notes: `Upgraded from SoloSession ${session_id}. Original type: ${session.session_type}.`,
      };

      const collaboration = await svc.entities.Collaboration.create(collabPayload);

      // Mark the SoloSession as upgraded
      await svc.entities.SoloSession.update(session_id, {
        upgraded_to_collaboration: true,
        collaboration_id: collaboration.id,
        status: 'completed',
      });

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_SESSION',
        target_type: 'SoloSession',
        target_id: session_id,
        action: 'solo_session_upgraded_to_collaboration',
        reason: `Session upgraded to Collaboration by ${user.email}`,
        metadata_json: {
          session_id,
          collaboration_id: collaboration.id,
          actor: user.email,
          session_type: session.session_type,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      // Notify both parties
      for (const uid of [session.guest_user_id, session.host_user_id]) {
        if (!uid || uid === user.email) continue;
        await svc.entities.Notification.create({
          user_id: uid,
          type: 'collaboration_invites',
          actor_user_id: user.email,
          title: 'Session Upgraded to Collaboration',
          body: `Your session has been expanded into a full collaboration.`,
          related_entity_type: 'Collaboration',
          related_entity_id: collaboration.id,
          action_url: `/CollaborationDetail?id=${collaboration.id}`,
        }).catch(() => {});
      }

      return Response.json({
        success: true,
        collaboration_id: collaboration.id,
        collaboration,
      });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('manageSoloSession error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});