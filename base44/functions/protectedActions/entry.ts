/**
 * PROTECTED ACTIONS ENDPOINT
 * 
 * All sensitive user-initiated mutations route through here.
 * Banned/suspended users are blocked BEFORE any data operation.
 * 
 * Actions supported (via ?action= query param):
 * - send_message
 * - block_user  
 * - unblock_user
 * - save_favorite
 * - remove_favorite
 * - create_collaboration
 * - start_conversation
 * - submit_report
 * - update_profile
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── INLINE MODERATION (cannot import cross-file in Deno deploy) ─────────────

const UNDERAGE_PATTERNS = [
  /\b(minor|minors|underage|under.?age|u18|under 18|u-18|teen|teenager|jailbait|preteen|pre-teen|lolita|child|children)\b/i,
  /\byoung.{0,10}(girl|boy|man|woman|lady|performer)\b/i,
];
const TRAFFICKING_PATTERNS = [
  /\b(trafficking|traffick|forced|force them|coerce|coercion|exploit|exploitation|pimp|pimping|debt bondage|slave)\b/i,
  /\b(take their passport|confiscate|immigration threat|visa threat)\b/i,
];
const SOLICITATION_PATTERNS = [
  /\b(pay for sex|payment for sex|cash for sex|money for sex|escort|escorting|call girl|hooker|prostitut(e|ion)|full service|GFE|girlfriend experience|p4p|pay.{0,5}play)\b/i,
  /\b(happy ending|extras|in-call|incall|out-call|outcall|donation|roses|rosebuds)\b/i,
];
const THREAT_PATTERNS = [
  /\b(threaten|threat|blackmail|extort|expose you|release your|post your|leak your|revenge porn|doxxing|dox you|hurt you|harm you)\b/i,
];
const PAYMENT_TERMS = /\b(pay|payment|cash|venmo|paypal|cashapp|zelle|crypto|bitcoin|gift card|deposit|fee|rate|price|charge|tips|tip me|send money)\b/i;
const MEETUP_TERMS = /\b(meet(up)?|come over|my place|your place|hotel|motel|visit|in person|hook up|link up|private session|one-on-one)\b/i;
const SEXUAL_TERMS = /\b(sex|sexual|fuck|intercourse|blowjob|handjob|oral|anal|penetrat|naked|nude|strip|adult service|adult meet)\b/i;

function inlineAnalyzeText(text) {
  if (!text || typeof text !== 'string') return { severity: 'none', reasons: [] };
  const flags = [];
  let severity = 'none';

  for (const p of UNDERAGE_PATTERNS) {
    if (p.test(text)) { flags.push('underage_risk'); severity = 'critical'; }
  }
  for (const p of TRAFFICKING_PATTERNS) {
    if (p.test(text)) { flags.push('trafficking_coercion'); severity = 'critical'; }
  }
  for (const p of THREAT_PATTERNS) {
    if (p.test(text)) { flags.push('threat'); if (severity !== 'critical') severity = 'high'; }
  }
  for (const p of SOLICITATION_PATTERNS) {
    if (p.test(text)) { flags.push('direct_solicitation'); if (severity !== 'critical') severity = 'high'; }
  }

  const hasPayment = PAYMENT_TERMS.test(text);
  const hasMeetup = MEETUP_TERMS.test(text);
  const hasSexual = SEXUAL_TERMS.test(text);
  if (hasPayment && hasMeetup && hasSexual) {
    flags.push('combination_solicitation');
    if (severity === 'none') severity = 'high';
  }

  return { severity, reasons: [...new Set(flags)] };
}

async function enforceModerationInline(base44, userId, text, context) {
  const result = inlineAnalyzeText(text);
  if (result.severity === 'none') return null; // pass

  // Always use service role for system-generated reports — bypasses RLS
  const svc = base44.asServiceRole;
  const snippet = text.substring(0, 300);
  const now = new Date().toISOString();

  // Log and create report (service role — SYSTEM_AUTO_MODERATION is reporter)
  await svc.entities.Report.create({
    reporter_id: 'SYSTEM_AUTO_MODERATION',
    target_user_id: userId,
    reason: result.reasons.includes('underage_risk') ? 'underage' : 'other',
    details: `[AUTO-MODERATION] Severity: ${result.severity.toUpperCase()}. Context: ${context}. Flags: ${result.reasons.join(', ')}. Snippet: ${snippet}`,
    status: result.severity === 'critical' ? 'investigating' : 'pending',
    admin_notes: `AUTO-GENERATED. Priority: ${result.severity === 'critical' ? 'IMMEDIATE_REVIEW_REQUIRED' : 'HIGH'}. ${result.reasons.includes('underage_risk') ? '⚠️ UNDERAGE RISK — DO NOT DISMISS WITHOUT STRUCTURED REVIEW' : ''}`,
  }).catch(() => {});

  await svc.entities.AdminActionLog.create({
    admin_user_id: 'SYSTEM_CONTENT_MODERATION',
    target_type: 'User',
    target_id: userId,
    action: 'content_moderation_flag',
    reason: `Content moderation: ${result.severity} — ${result.reasons.join(', ')}`,
    notes: `Context: ${context}. Snippet: ${snippet}`,
    metadata_json: { severity: result.severity, flags: result.reasons, context, timestamp: now },
  }).catch(() => {});

  // Auto-suspend for critical severity
  if (result.severity === 'critical') {
    const profiles = await svc.entities.UserProfile.filter({ user_id: userId });
    const profile = profiles[0];
    if (profile?.id) {
      await svc.entities.UserProfile.update(profile.id, {
        suspended: true,
        suspension_reason: `Automated safety enforcement: ${result.reasons[0]}. Account under review.`,
        legal_hold: true,
      }).catch(() => {});
    }
  }

  return result;
}

// ─── RATE LIMIT CHECK ────────────────────────────────────────────────────────

const RATE_LIMITS = {
  send_message:         [{ window_minutes: 1, max: 30 }, { window_minutes: 60, max: 300 }],
  submit_report:        [{ window_minutes: 60, max: 5 }],
  create_collaboration: [{ window_minutes: 60, max: 10 }],
  update_profile:       [{ window_minutes: 60, max: 20 }],
};

async function checkRateLimit(svc, userId, action) {
  const rules = RATE_LIMITS[action];
  if (!rules) return null; // No limit defined for this action

  const now = Date.now();
  let recentLogs = [];
  try {
    recentLogs = await svc.entities.AdminActionLog.filter({
      target_id: userId,
      action: `rate_limit_action_${action}`,
    });
  } catch (e) {
    return null; // fail open
  }

  for (const rule of rules) {
    const windowMs = rule.window_minutes * 60 * 1000;
    const actionsInWindow = recentLogs.filter(l =>
      new Date(l.created_date).getTime() > now - windowMs
    ).length;

    if (actionsInWindow >= rule.max) {
      // Log violation
      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_RATE_LIMITER',
        target_type: 'User',
        target_id: userId,
        action: 'rate_limit_exceeded',
        reason: `Rate limit exceeded: ${action} (${actionsInWindow}/${rule.max} per ${rule.window_minutes}min)`,
        notes: `User ${userId} exceeded rate limit for action: ${action}`,
        metadata_json: { action, limit: rule.max, window_minutes: rule.window_minutes, actions_in_window: actionsInWindow, timestamp: new Date().toISOString() },
      }).catch(() => {});
      return {
        blocked: true,
        response: Response.json({
          error: `Too many requests. Please wait before trying again.`,
          code: 'rate_limited',
          retry_after_seconds: rule.window_minutes * 60,
        }, { status: 429 }),
      };
    }
  }

  // Log the action for future counting
  await svc.entities.AdminActionLog.create({
    admin_user_id: 'SYSTEM_RATE_LIMITER',
    target_type: 'User',
    target_id: userId,
    action: `rate_limit_action_${action}`,
    reason: `Rate limit tracking: ${action}`,
    notes: `Allowed action: ${action} by ${userId}`,
    metadata_json: { action, timestamp: new Date().toISOString() },
  }).catch(() => {});

  return null; // allowed
}

// ─── BAN CHECK ─────────────────────────────────────────────────────────────────

// Inline ban check - cannot import from other files due to deployment isolation
async function checkBanStatus(base44, userEmail, actionName) {
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({
    user_id: userEmail
  });
  const profile = profiles[0];

  if (profile?.banned === true) {
    await logBlockedAction(base44, userEmail, actionName, 'banned');
    return {
      blocked: true,
      response: Response.json(
        { error: 'Your account has been permanently banned.', code: 'banned', blocked: true },
        { status: 403 }
      )
    };
  }

  if (profile?.suspended === true) {
    await logBlockedAction(base44, userEmail, actionName, 'suspended');
    return {
      blocked: true,
      response: Response.json(
        { error: `Your account is temporarily suspended. ${profile.suspension_reason || ''}`, code: 'suspended', blocked: true },
        { status: 403 }
      )
    };
  }

  return { blocked: false, profile };
}

async function logBlockedAction(base44, userId, actionName, blockReason) {
  try {
    await base44.asServiceRole.entities.AdminActionLog.create({
      admin_id: 'SYSTEM_BAN_ENFORCEMENT',
      action_type: 'blocked_action_attempt',
      target_user_id: userId,
      details: {
        action_attempted: actionName,
        block_reason: blockReason,
        timestamp: new Date().toISOString()
      },
      reason: `Blocked ${blockReason} user from: ${actionName}`
    });
  } catch (e) {
    console.error('Failed to log blocked action:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ban status before ANY action
    const banResult = await checkBanStatus(base44, user.email, action || 'unknown');
    if (banResult.blocked) {
      return banResult.response;
    }

    // Check rate limit for applicable actions
    const RATE_LIMITED_ACTIONS = ['send_message', 'submit_report', 'create_collaboration', 'update_profile'];
    if (RATE_LIMITED_ACTIONS.includes(action)) {
      const rateLimitResult = await checkRateLimit(base44.asServiceRole, user.email, action);
      if (rateLimitResult?.blocked) {
        return rateLimitResult.response;
      }
    }

    const body = await req.json();

    switch (action) {

      // ──────────────── MESSAGES ────────────────
      case 'send_message': {
        const { conversation_id, body: messageBody, attachments } = body;
        if (!conversation_id || !messageBody) {
          return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // ── MODERATION CHECK ──────────────────────────────────────────────────
        const msgModeration = await enforceModerationInline(base44, user.email, messageBody, 'message');
        if (msgModeration && (msgModeration.severity === 'critical' || msgModeration.severity === 'high')) {
          const isCritical = msgModeration.severity === 'critical';
          return Response.json({
            error: isCritical
              ? 'Your account has been placed under review. This message was blocked.'
              : 'This message could not be sent. This platform is for professional content collaboration only. Solicitation, escort services, and meetup-for-payment arrangements are strictly prohibited.',
            code: isCritical ? 'account_suspended' : 'content_blocked',
            blocked: true,
          }, { status: 403 });
        }
        // ─────────────────────────────────────────────────────────────────────

        const message = await base44.entities.Message.create({
          conversation_id,
          sender_id: user.email,
          body: messageBody,
          attachments: attachments || [],
          read_by: []
        });

        // Update conversation
        await base44.entities.Conversation.update(conversation_id, {
          last_message_at: new Date().toISOString(),
          last_message_preview: messageBody.substring(0, 50)
        });

        return Response.json({ success: true, data: message });
      }

      // ──────────────── CONVERSATIONS ────────────────
      case 'start_conversation': {
        const { recipient_id } = body;
        if (!recipient_id) {
          return Response.json({ error: 'recipient_id required' }, { status: 400 });
        }

        const existingConvs = await base44.entities.Conversation.list();
        const existing = existingConvs.find(c =>
          c.participant_ids?.includes(user.email) &&
          c.participant_ids?.includes(recipient_id) &&
          c.type === 'discovery'
        );

        if (existing) {
          return Response.json({ success: true, data: existing, isNew: false });
        }

        const conversation = await base44.entities.Conversation.create({
          type: 'discovery',
          participant_ids: [user.email, recipient_id],
          status: 'active',
          unread_counts: {}
        });

        return Response.json({ success: true, data: conversation, isNew: true });
      }

      // ──────────────── BLOCK USER ────────────────
      case 'block_user': {
        const { blocked_id } = body;
        if (!blocked_id) {
          return Response.json({ error: 'blocked_id required' }, { status: 400 });
        }

        const result = await base44.entities.BlockedUser.create({
          blocker_id: user.email,
          blocked_id,
          reason: body.reason || ''
        });

        return Response.json({ success: true, data: result });
      }

      // ──────────────── FAVORITES ────────────────
      case 'update_favorite': {
        // update (add/remove item) on a favorites list
        const { list_id, items } = body;
        if (!list_id || !items) {
          return Response.json({ error: 'list_id and items required' }, { status: 400 });
        }

        const result = await base44.entities.Favorite.update(list_id, { items });
        return Response.json({ success: true, data: result });
      }

      case 'create_favorite_list': {
        const { name, items } = body;
        const result = await base44.entities.Favorite.create({
          owner_id: user.email,
          name: name || 'My Favorites',
          items: items || []
        });
        return Response.json({ success: true, data: result });
      }

      // ──────────────── COLLABORATIONS ────────────────
      case 'create_collaboration': {
        const collabData = body;

        // ── MODERATION: scan all free-text fields ─────────────────────────────
        const collabFreeText = [
          collabData.collaboration_name,
          collabData.internal_notes,
          collabData.acts_other_text,
          collabData.compensation_details?.notes,
          collabData.compensation_details?.split_details,
          collabData.location?.notes,
          collabData.location?.address,
          collabData.deliverables?.notes,
          collabData.usage_rights?.notes,
          collabData.boundaries?.aftercare_notes,
        ].filter(Boolean).join(' ');

        if (collabFreeText) {
          const collabMod = await enforceModerationInline(base44, user.email, collabFreeText, 'collaboration_create');
          if (collabMod && (collabMod.severity === 'critical' || collabMod.severity === 'high')) {
            return Response.json({
              error: 'This collaboration could not be created. Content in one or more fields violates platform safety policies. This platform is for professional content collaboration only.',
              code: 'content_blocked',
              blocked: true,
            }, { status: 403 });
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        const participant_ids = [
          user.email,
          ...((collabData.participant_ids || []).filter(id => id !== user.email))
        ];

        const collaboration = await base44.entities.Collaboration.create({
          ...collabData,
          participant_ids,
          status: 'draft'
        });

        return Response.json({ success: true, data: collaboration });
      }

      case 'update_collaboration': {
        const { collab_id, ...updateData } = body;
        if (!collab_id) {
          return Response.json({ error: 'collab_id required' }, { status: 400 });
        }

        // ── MODERATION: scan updated free-text ────────────────────────────────
        const updateFreeText = [
          updateData.collaboration_name,
          updateData.internal_notes,
          updateData.acts_other_text,
          updateData.compensation_details?.notes,
          updateData.location?.notes,
          updateData.boundaries?.aftercare_notes,
        ].filter(Boolean).join(' ');

        if (updateFreeText) {
          const updateMod = await enforceModerationInline(base44, user.email, updateFreeText, 'collaboration_update');
          if (updateMod && (updateMod.severity === 'critical' || updateMod.severity === 'high')) {
            return Response.json({
              error: 'This update was blocked. Content in one or more fields violates platform safety policies.',
              code: 'content_blocked',
              blocked: true,
            }, { status: 403 });
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        // Verify the user is a participant
        const collabs = await base44.entities.Collaboration.filter({ id: collab_id });
        const collab = collabs[0];
        if (!collab) {
          return Response.json({ error: 'Collaboration not found' }, { status: 404 });
        }
        if (!collab.participant_ids?.includes(user.email)) {
          return Response.json({ error: 'Not a participant' }, { status: 403 });
        }

        const result = await base44.entities.Collaboration.update(collab_id, updateData);
        return Response.json({ success: true, data: result });
      }

      // ──────────────── REPORTS ────────────────
      case 'submit_report': {
        const { target_user_id, reason, details, target_content_type, target_content_id } = body;
        if (!target_user_id || !reason) {
          return Response.json({ error: 'target_user_id and reason required' }, { status: 400 });
        }

        // Determine severity / escalation level
        const HIGH_RISK_REASONS = ['underage', 'non_consensual', 'solicitation'];
        const CRITICAL_REASONS = ['underage'];
        const isHighRisk = HIGH_RISK_REASONS.includes(reason);
        const isCritical = CRITICAL_REASONS.includes(reason);

        const adminNotes = isCritical
          ? `⚠️ UNDERAGE RISK — IMMEDIATE_REVIEW_REQUIRED — DO NOT DISMISS WITHOUT STRUCTURED REVIEW. Reported by: ${user.email}`
          : isHighRisk && reason === 'solicitation'
            ? `⚠️ SOLICITATION REPORT — IMMEDIATE_REVIEW_REQUIRED. Possible escort/prostitution activity. Reported by: ${user.email}`
            : isHighRisk
              ? `⚠️ HIGH RISK (${reason}) — REQUIRES_IMMEDIATE_REVIEW. Reported by: ${user.email}`
              : null;

        const report = await base44.entities.Report.create({
          reporter_id: user.email,
          target_user_id,
          reason,
          details: details || '',
          target_content_type,
          target_content_id,
          status: isHighRisk ? 'investigating' : 'pending',
          ...(adminNotes ? { admin_notes: adminNotes } : {}),
        });

        // UNDERAGE / CRITICAL: immediately suspend target pending review, legal hold
        if (isCritical) {
          const targetProfiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: target_user_id });
          const targetProfile = targetProfiles[0];
          if (targetProfile?.id && !targetProfile.banned) {
            await base44.asServiceRole.entities.UserProfile.update(targetProfile.id, {
              suspended: true,
              suspension_reason: 'Account suspended pending mandatory safety review (underage risk report received). Please contact support.',
              legal_hold: true,
            }).catch(() => {});
          }

          // Log the auto-suspension
          await base44.asServiceRole.entities.AdminActionLog.create({
            admin_user_id: 'SYSTEM_UNDERAGE_ESCALATION',
            target_type: 'User',
            target_id: target_user_id,
            action: 'suspend_account',
            reason: 'Auto-suspended: underage risk report received',
            notes: `Report #${report.id} filed by ${user.email}. Account auto-suspended pending review. Legal hold applied.`,
            metadata_json: {
              report_id: report.id,
              reporter_id: user.email,
              reason,
              auto_action: 'suspended_legal_hold',
              requires_immediate_review: true,
              timestamp: new Date().toISOString(),
            },
          }).catch(() => {});
        }

        // HIGH RISK (non_consensual etc): mark as investigating immediately
        if (isHighRisk && !isCritical) {
          await base44.asServiceRole.entities.AdminActionLog.create({
            admin_user_id: 'SYSTEM_HIGH_RISK_ESCALATION',
            target_type: 'Report',
            target_id: report.id,
            action: 'content_moderation_flag',
            reason: `High-risk report auto-escalated: ${reason}`,
            notes: `Report #${report.id} filed by ${user.email} for reason: ${reason}. Details: ${(details || '').substring(0, 300)}`,
            metadata_json: {
              report_id: report.id,
              reporter_id: user.email,
              reason,
              requires_immediate_review: true,
              timestamp: new Date().toISOString(),
            },
          }).catch(() => {});
        }

        return Response.json({ success: true, data: report });
      }

      // ──────────────── PROFILE UPDATE ────────────────
      case 'update_profile': {
        const { profile_id, profile_data } = body;
        if (!profile_id || !profile_data) {
          return Response.json({ error: 'profile_id and profile_data required' }, { status: 400 });
        }

        // Ensure user can only update own profile
        const profiles = await base44.entities.UserProfile.filter({ id: profile_id, user_id: user.email });
        if (!profiles[0]) {
          return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });
        }

        // Strip any ban/admin fields (users cannot self-unban)
        const { banned, suspended, suspension_reason, legal_hold, is_admin, ...safeData } = profile_data;

        // ── MODERATION: scan profile bio and display_name ─────────────────────
        const profileText = [safeData.bio, safeData.display_name, safeData.real_name].filter(Boolean).join(' ');
        if (profileText) {
          const profileMod = await enforceModerationInline(base44, user.email, profileText, 'profile_update');
          if (profileMod && profileMod.severity === 'critical') {
            return Response.json({
              error: 'Your profile could not be saved. Content violates platform safety policies and your account has been placed under review.',
              code: 'account_suspended',
              blocked: true,
            }, { status: 403 });
          }
          if (profileMod && profileMod.severity === 'high') {
            return Response.json({
              error: 'Your profile could not be saved. One or more fields contain content that violates platform policies. Please review your bio and display name.',
              code: 'content_blocked',
              blocked: true,
            }, { status: 403 });
          }
        }
        // ─────────────────────────────────────────────────────────────────────

        const result = await base44.entities.UserProfile.update(profile_id, safeData);
        return Response.json({ success: true, data: result });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Protected actions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});