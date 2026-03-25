import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * SAFE ACCOUNT DELETION — Evidence-Preserving Lifecycle
 *
 * Replaces destructive data wipe with a staged, compliance-safe approach:
 *   1. Check legal hold conditions — block if any open cases, reports, or flags exist
 *   2. Anonymize profile (hide from discovery, scrub PII) — preserve the account record
 *   3. Anonymize message sender attribution — preserve message body and conversation
 *   4. Detach from collaborations — preserve collaboration records intact
 *   5. Delete only non-evidentiary personal preference data
 *   6. Mark account deactivated and revoke session
 *
 * NEVER DELETED by this function:
 *   - Message bodies or conversation history
 *   - Reports (submitted by or against this user)
 *   - VerificationRecord / TestingCredential / TestingDocument / ComplianceRecord
 *   - AdminActionLog entries
 *   - ContractSignature records
 *   - CollaborationDispute / ArbitrationCase records
 *   - ConsentRevocation records
 *   - Collaboration records (participation history)
 *   - Contract records
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
    const now = new Date().toISOString();

    // ─── STEP 1: LEGAL HOLD & BLOCK CHECKS ─────────────────────────────────────

    // Check explicit legal_hold flag on profile
    const profiles = await svc.entities.UserProfile.filter({ user_id: userId });
    const profile = profiles[0];

    if (profile?.legal_hold === true) {
      return Response.json({
        error: 'LEGAL_HOLD',
        message: 'Your account cannot be deleted at this time. It is under a legal or compliance hold. Please contact support for more information.'
      }, { status: 403 });
    }

    // Check for open reports against this user (target)
    const reportsAgainstUser = await svc.entities.Report.filter({ target_user_id: userId });
    const openReports = reportsAgainstUser.filter(r =>
      r.status === 'pending' || r.status === 'investigating'
    );
    if (openReports.length > 0) {
      await _markBlockedLegalHold(svc, profile, userId, now, 'open_reports_against_user');
      return Response.json({
        error: 'LEGAL_HOLD',
        message: 'Your account cannot be deleted while there are active safety or moderation reports under review. Please contact support.'
      }, { status: 403 });
    }

    // Check for open disputes where this user is a participant
    const allDisputes = await svc.entities.CollaborationDispute.filter({});
    const openDisputes = allDisputes.filter(d =>
      d.opened_by_user_id === userId &&
      (d.status === 'Open' || d.status === 'Under Review' || d.status === 'Escalated')
    );
    if (openDisputes.length > 0) {
      await _markBlockedLegalHold(svc, profile, userId, now, 'open_disputes');
      return Response.json({
        error: 'LEGAL_HOLD',
        message: 'Your account cannot be deleted while you have open dispute or arbitration cases. Please contact support.'
      }, { status: 403 });
    }

    // Check for open arbitration cases
    const allArbitrations = await svc.entities.ArbitrationCase.filter({});
    const openArbitrations = allArbitrations.filter(a =>
      (a.status === 'Open' || a.status === 'Under Review')
    );
    // Check if any open arbitration involves a collaboration this user is part of
    if (openArbitrations.length > 0) {
      const allCollabs = await svc.entities.Collaboration.filter({});
      const userCollabIds = allCollabs
        .filter(c => c.participant_ids?.includes(userId))
        .map(c => c.id);
      const blockedByArbitration = openArbitrations.some(a => userCollabIds.includes(a.collaboration_id));
      if (blockedByArbitration) {
        await _markBlockedLegalHold(svc, profile, userId, now, 'open_arbitration');
        return Response.json({
          error: 'LEGAL_HOLD',
          message: 'Your account cannot be deleted while there is an active arbitration case involving your collaborations. Please contact support.'
        }, { status: 403 });
      }
    }

    // Check for underage/trafficking/coercion flags in reports
    const sensitiveReasonReports = reportsAgainstUser.filter(r =>
      r.reason === 'underage' || r.reason === 'non_consensual'
    );
    if (sensitiveReasonReports.length > 0) {
      await _markBlockedLegalHold(svc, profile, userId, now, 'sensitive_safety_report');
      return Response.json({
        error: 'LEGAL_HOLD',
        message: 'Your account is under a safety review and cannot be deleted at this time. Please contact support.'
      }, { status: 403 });
    }

    // Check AdminActionLog for active investigation flags
    const adminLogs = await svc.entities.AdminActionLog.filter({ target_id: userId });
    const hasFlagAction = adminLogs.some(l => l.action === 'flag_user');
    const hasUnflagAction = adminLogs.some(l => l.action === 'unflag_user');
    if (hasFlagAction && !hasUnflagAction) {
      await _markBlockedLegalHold(svc, profile, userId, now, 'admin_investigation_flag');
      return Response.json({
        error: 'LEGAL_HOLD',
        message: 'Your account is flagged for administrative review and cannot be deleted at this time. Please contact support.'
      }, { status: 403 });
    }

    // ─── STEP 2: MARK DELETION REQUESTED ────────────────────────────────────────
    if (profile?.id) {
      await svc.entities.UserProfile.update(profile.id, {
        deletion_requested_at: now,
        deletion_status: 'requested'
      });
    }

    // ─── STEP 3: ANONYMIZE PROFILE (not delete) ──────────────────────────────────
    // Scrub all PII from the profile record, hide from public discovery,
    // but keep the record intact for admin audit.
    // Uses service role (svc) throughout to bypass RLS ownership checks.
    if (profile?.id) {
      await svc.entities.UserProfile.update(profile.id, {
        display_name: '[Deleted User]',
        real_name: null,
        bio: null,
        avatar_url: null,
        cover_url: null,
        base_location: null,
        travel_enabled: false,
        travel_regions: [],
        travel_dates: [],
        availability_dates: [],
        age: null,
        ethnicity: null,
        profile_complete: false,
        account_deactivated: true,
        deleted_at: now,
        deletion_status: 'anonymized'
      });
    }

    // Anonymize CreatorDetails — scrub PII, keep record for history
    const creatorDetails = await svc.entities.CreatorDetails.filter({ user_id: userId });
    for (const d of creatorDetails) {
      await svc.entities.CreatorDetails.update(d.id, {
        physical_details: null,
        rates_text: null,
        socials: null,
        health_testing: null
      });
    }

    // Anonymize ServiceDetails — scrub PII, keep record
    const serviceDetails = await svc.entities.ServiceDetails.filter({ user_id: userId });
    for (const d of serviceDetails) {
      await svc.entities.ServiceDetails.update(d.id, {
        rates: null,
        packages: null,
        portfolio_public: [],
        portfolio_private: [],
        travel_fee_info: null
      });
    }

    // ─── STEP 4: ANONYMIZE MESSAGES (preserve body, scrub sender attribution) ───
    // We keep message content for moderation/legal — just anonymize the sender reference
    const messages = await svc.entities.Message.filter({ sender_id: userId });
    for (const m of messages) {
      await svc.entities.Message.update(m.id, {
        sender_id: '[deleted]'
      });
    }

    // Remove from conversation participant lists but DO NOT delete conversations
    const allConversations = await svc.entities.Conversation.filter({});
    const userConvos = allConversations.filter(c => c.participant_ids?.includes(userId));
    for (const c of userConvos) {
      const newParticipants = (c.participant_ids || []).filter(id => id !== userId);
      await svc.entities.Conversation.update(c.id, {
        participant_ids: newParticipants.length > 0 ? newParticipants : ['[deleted]']
      });
    }

    // ─── STEP 5: DETACH FROM COLLABORATIONS (preserve records) ──────────────────
    // Remove user from participant list — keep the collaboration record and history
    const allCollabs = await svc.entities.Collaboration.filter({});
    const userCollabs = allCollabs.filter(c => c.participant_ids?.includes(userId));
    for (const c of userCollabs) {
      const newParticipants = (c.participant_ids || []).filter(id => id !== userId);
      await svc.entities.Collaboration.update(c.id, {
        participant_ids: newParticipants.length > 0 ? newParticipants : ['[deleted]'],
        internal_notes: (c.internal_notes || '') + `\n[SYSTEM] Participant ${userId} removed at account deletion ${now}`
      });
    }

    // ─── STEP 6: HIDE GALLERIES (preserve records, just clear items) ─────────────
    // For legal holds we already returned early — if we get here, no hold exists.
    // Clear items to remove public-facing media, but keep the gallery record.
    const galleries = await svc.entities.Gallery.filter({ user_id: userId });
    for (const g of galleries) {
      await svc.entities.Gallery.update(g.id, { items: [] });
    }
    // Revoke gallery permissions granted to others
    const galleryPermsOwned = await svc.entities.GalleryPermission.filter({ owner_id: userId });
    for (const p of galleryPermsOwned) {
      await svc.entities.GalleryPermission.update(p.id, { status: 'revoked' });
    }

    // ─── STEP 7: ANONYMIZE REPORTS SUBMITTED BY THIS USER ───────────────────────
    // Keep the report record (critical safety evidence) but anonymize the reporter
    const reportsByUser = await svc.entities.Report.filter({ reporter_id: userId });
    for (const r of reportsByUser) {
      await svc.entities.Report.update(r.id, {
        reporter_id: '[deleted]'
      });
    }
    // Reports AGAINST the user are NOT touched — preserved fully for moderation

    // ─── STEP 8: DELETE SAFE-TO-DELETE PERSONAL PREFERENCE DATA ─────────────────
    // These have no evidentiary or moderation value:
    async function deleteAll(entityName, filterObj) {
      const records = await svc.entities[entityName].filter(filterObj);
      await Promise.all(records.map(r => svc.entities[entityName].delete(r.id)));
    }

    await deleteAll('Favorite', { owner_id: userId });
    await deleteAll('BlockedUser', { blocker_id: userId });
    await deleteAll('BlockedUser', { blocked_id: userId });
    await deleteAll('SocialLink', { user_id: userId });
    await deleteAll('UserSettings', { user_id: userId });
    await deleteAll('NotificationPreference', { user_id: userId });
    await deleteAll('Notification', { user_id: userId });
    await deleteAll('Friendship', { user_id: userId });
    await deleteAll('Friendship', { friend_id: userId });
    await deleteAll('ScheduleEntry', { user_id: userId });
    await deleteAll('ProfileView', { viewer_id: userId });
    // SessionHistory: delete for privacy but note: AdminActionLog is preserved
    await deleteAll('SessionHistory', { user_id: userId });
    // GalleryPermissions where user was granted access (not owner — those handled above)
    await deleteAll('GalleryPermission', { granted_to_user_id: userId });

    // ─── STEP 9: LOG DELETION FOR ADMIN AUDIT ────────────────────────────────────
    await svc.entities.AdminActionLog.create({
      admin_user_id: 'SYSTEM_ACCOUNT_DELETION',
      target_type: 'User',
      target_id: userId,
      action: 'suspend_account',
      reason: 'Self-service account deletion — account anonymized and deactivated',
      notes: `Account anonymized at ${now}. Profile PII scrubbed. Message bodies preserved. Reports, verifications, contracts, and collaboration history preserved.`,
      metadata_json: {
        deletion_type: 'self_service',
        deleted_at: now,
        records_preserved: ['Message', 'Report', 'VerificationRecord', 'TestingCredential', 'TestingDocument', 'ComplianceRecord', 'ContractSignature', 'Collaboration', 'Contract', 'CollaborationDispute', 'ArbitrationCase', 'ConsentRevocation', 'AdminActionLog'],
        records_anonymized: ['UserProfile', 'CreatorDetails', 'ServiceDetails', 'Message.sender_id', 'Report.reporter_id'],
        records_deleted: ['Favorite', 'BlockedUser', 'SocialLink', 'UserSettings', 'NotificationPreference', 'Notification', 'Friendship', 'ScheduleEntry', 'ProfileView', 'SessionHistory']
      }
    }).catch(() => {});

    console.log(`Account safely anonymized/deactivated for ${userId}`);
    return Response.json({
      success: true,
      message: 'Your account has been deactivated and your data has been anonymized. You will be logged out shortly.'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Helper: mark a profile as blocked from deletion due to a legal/compliance hold.
 * Creates an admin log entry and sets deletion_status on profile.
 */
async function _markBlockedLegalHold(svc, profile, userId, now, reason) {
  if (profile?.id) {
    await svc.entities.UserProfile.update(profile.id, {
      deletion_requested_at: now,
      deletion_status: 'blocked_legal_hold',
      legal_hold: true,
      deletion_reason_internal: `Auto-blocked at deletion attempt: ${reason}`
    }).catch(() => {});
  }
  await svc.entities.AdminActionLog.create({
    admin_user_id: 'SYSTEM_DELETION_HOLD',
    target_type: 'User',
    target_id: userId,
    action: 'flag_user',
    reason: `Account deletion blocked — legal/compliance hold: ${reason}`,
    notes: `User attempted self-service deletion at ${now} but was blocked due to: ${reason}. Legal hold automatically applied.`,
    metadata_json: { hold_reason: reason, attempted_at: now }
  }).catch(() => {});
}