/**
 * PLATFORM CONTENT MODERATION ENGINE
 *
 * Anti-solicitation, underage-risk, and high-risk safety enforcement.
 * Called server-side before any user-generated content is saved/sent.
 *
 * Enforcement logic:
 *  - BLOCK: severe solicitation, underage references, trafficking, coercion
 *  - HOLD: moderate risk — content flagged, saved as pending, admin alerted
 *  - WARN: low risk — logged, user warned, content allowed
 *
 * Severity escalation:
 *  - First offense: WARN / HOLD depending on severity
 *  - Repeated offense (3+ flags): auto-suspend
 *  - HIGH-RISK (underage / trafficking / coercion): immediate suspend + admin escalation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── DETECTION DICTIONARIES ──────────────────────────────────────────────────

// Underage indicators — any match = CRITICAL, immediate suspend
const UNDERAGE_PATTERNS = [
  /\b(minor|minors|underage|under.?age|u18|under 18|u-18|teen|teenager|jailbait|preteen|pre-teen|lolita|child|children|kid|kids|boy|girl)\b/i,
  /\b(young|youthful|barely.?legal|18\+.?looks.?younger|looks.?young)\b/i,
  /\byoung.{0,10}(girl|boy|man|woman|lady|performer)\b/i,
];

// Trafficking / coercion / exploitation — CRITICAL
const TRAFFICKING_PATTERNS = [
  /\b(trafficking|traffick|traffick(ing|ed|er)|forced|force them|make her|make him|compel|coerce|coercion|exploit|exploitation|lure|recruit them|control them)\b/i,
  /\b(debt bondage|bonded labor|slave|enslaved|pimp|pimping|manage girls|manage talent for sex)\b/i,
  /\b(take their passport|confiscate|immigration threat|visa threat|deport threat)\b/i,
];

// Direct sex-for-payment solicitation — HIGH
const SOLICITATION_PATTERNS = [
  /\b(pay for sex|payment for sex|cash for sex|money for sex|rate for sex|escort|escorting|call girl|hooker|prostitut(e|ion)|john|trick|turning tricks|street work|full service|FS|GFE|girlfriend experience)\b/i,
  /\b(happy ending|extras|full service|in-call|incall|out-call|outcall|donation|roses|rosebuds|p4p|pay.{0,5}play)\b/i,
  /\b(hourly rate.{0,15}(meet|meetup|visit|come over|see you|sex|fuck|hook up))\b/i,
];

// Payment + meetup + sexual combination signals — HIGH
const PAYMENT_TERMS = /\b(pay|payment|cash|venmo|paypal|cashapp|zelle|crypto|bitcoin|gift card|deposit|fee|rate|price|charge|compensation|tips|tip me|send money|wire|transfer)\b/i;
const MEETUP_TERMS = /\b(meet(up)?|come over|my place|your place|hotel|motel|visit|in person|get together|hook up|link up|let's connect|private session|private meet|one-on-one)\b/i;
const SEXUAL_TERMS = /\b(sex|sexual|fuck|intercourse|blowjob|handjob|oral|anal|penetrat|naked|nude|strip|explicit|nsfw|adult service|adult meet|pleasure|satisfy|happy)\b/i;

// Threats / coercion language — HIGH
const THREAT_PATTERNS = [
  /\b(threaten|threat|blackmail|extort|expose you|release your|post your|leak your|revenge porn|doxxing|dox you|hurt you|harm you|find you|come for you|will regret)\b/i,
];

// Fraud / impersonation safety risk — HIGH
const FRAUD_PATTERNS = [
  /\b(fake (id|identity|profile|credentials)|impersonat|pretend to be|not really|using someone else's|stolen identity)\b/i,
];

// ─── ANALYSIS FUNCTION ───────────────────────────────────────────────────────

function analyzeText(text) {
  if (!text || typeof text !== 'string') return { severity: 'none', reasons: [], flags: [] };

  const t = text.toLowerCase();
  const flags = [];
  let severity = 'none';

  // CRITICAL checks
  for (const pattern of UNDERAGE_PATTERNS) {
    if (pattern.test(text)) {
      flags.push({ type: 'underage_risk', pattern: pattern.source.substring(0, 60) });
      severity = 'critical';
    }
  }

  for (const pattern of TRAFFICKING_PATTERNS) {
    if (pattern.test(text)) {
      flags.push({ type: 'trafficking_coercion', pattern: pattern.source.substring(0, 60) });
      severity = 'critical';
    }
  }

  for (const pattern of THREAT_PATTERNS) {
    if (pattern.test(text)) {
      flags.push({ type: 'threat_coercion', pattern: pattern.source.substring(0, 60) });
      if (severity !== 'critical') severity = 'high';
    }
  }

  // HIGH checks
  for (const pattern of SOLICITATION_PATTERNS) {
    if (pattern.test(text)) {
      flags.push({ type: 'direct_solicitation', pattern: pattern.source.substring(0, 60) });
      if (severity !== 'critical') severity = 'high';
    }
  }

  for (const pattern of FRAUD_PATTERNS) {
    if (pattern.test(text)) {
      flags.push({ type: 'fraud_impersonation', pattern: pattern.source.substring(0, 60) });
      if (severity !== 'critical') severity = 'high';
    }
  }

  // COMBINATION check: payment + meetup + sexual = HIGH
  const hasPayment = PAYMENT_TERMS.test(text);
  const hasMeetup = MEETUP_TERMS.test(text);
  const hasSexual = SEXUAL_TERMS.test(text);

  if (hasPayment && hasMeetup && hasSexual) {
    flags.push({ type: 'combination_solicitation', signals: ['payment', 'meetup', 'sexual'] });
    if (severity === 'none') severity = 'high';
  } else if (hasPayment && hasSexual && !hasMeetup) {
    // Payment + sexual without meetup = WARN
    flags.push({ type: 'payment_sexual_signal', signals: ['payment', 'sexual'] });
    if (severity === 'none') severity = 'warn';
  } else if (hasMeetup && hasSexual) {
    // Meetup + sexual without payment = WARN
    flags.push({ type: 'meetup_sexual_signal', signals: ['meetup', 'sexual'] });
    if (severity === 'none') severity = 'warn';
  }

  return { severity, flags, reasons: flags.map(f => f.type) };
}

// ─── ENFORCEMENT ACTIONS ─────────────────────────────────────────────────────

async function countRecentViolations(svc, userId) {
  try {
    const logs = await svc.entities.AdminActionLog.filter({ target_id: userId });
    const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
    return logs.filter(l =>
      l.action === 'content_moderation_flag' &&
      new Date(l.created_date).getTime() > recentCutoff
    ).length;
  } catch {
    return 0;
  }
}

async function autoSuspend(svc, userId, reason, flagType) {
  const profiles = await svc.entities.UserProfile.filter({ user_id: userId });
  const profile = profiles[0];
  if (profile?.id) {
    await svc.entities.UserProfile.update(profile.id, {
      suspended: true,
      suspension_reason: `Automated safety enforcement: ${reason}. Your account is under review.`,
      legal_hold: flagType === 'underage_risk' || flagType === 'trafficking_coercion',
    });
  }
}

async function createModerationCase(svc, userId, context, analysisResult, contentSnippet) {
  const { severity, flags, reasons } = analysisResult;
  const isUnderage = reasons.includes('underage_risk');
  const isTrafficking = reasons.includes('trafficking_coercion');
  const isSolicitation = reasons.includes('direct_solicitation') || reasons.includes('combination_solicitation');
  // Use specific 'solicitation' reason in Report when applicable
  const reportReason = isUnderage ? 'underage' : isTrafficking ? 'non_consensual' : isSolicitation ? 'solicitation' : 'other';

  // Create report record — auto-escalated (must use service role — reporter is SYSTEM)
  const report = await svc.entities.Report.create({
    reporter_id: 'SYSTEM_AUTO_MODERATION',
    target_user_id: userId,
    reason: reportReason,
    details: `[AUTO-MODERATION] Severity: ${severity.toUpperCase()}. Flags: ${flags.map(f => f.type).join(', ')}. Context: ${context}. Content snippet: ${contentSnippet.substring(0, 200)}`,
    status: severity === 'critical' ? 'investigating' : 'pending',
    target_content_type: 'message',
    admin_notes: `AUTO-GENERATED. Priority: ${severity === 'critical' ? 'IMMEDIATE_REVIEW_REQUIRED' : 'HIGH'}. ${isUnderage ? '⚠️ UNDERAGE RISK — DO NOT DISMISS WITHOUT STRUCTURED REVIEW' : ''} ${isTrafficking ? '⚠️ TRAFFICKING/COERCION RISK' : ''}`,
  }).catch(() => null);

  // Log to admin action log
  await svc.entities.AdminActionLog.create({
    admin_user_id: 'SYSTEM_CONTENT_MODERATION',
    target_type: 'User',
    target_id: userId,
    action: 'content_moderation_flag',
    reason: `Content moderation: ${severity} — ${reasons.join(', ')}`,
    notes: `Context: ${context}. Flags: ${JSON.stringify(flags)}. Snippet: ${contentSnippet.substring(0, 300)}`,
    metadata_json: {
      severity,
      flags,
      context,
      auto_action: severity === 'critical' ? 'suspended' : severity === 'high' ? 'held' : 'warned',
      report_id: report?.id,
      timestamp: new Date().toISOString(),
      requires_immediate_review: isUnderage || isTrafficking,
    }
  }).catch(() => {});

  return { report };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, context = 'unknown', allow_warn = true } = await req.json();

    if (!text) {
      return Response.json({ allowed: true, severity: 'none', flags: [] });
    }

    const analysisResult = analyzeText(text);
    const { severity, flags, reasons } = analysisResult;

    // No flags — pass through
    if (severity === 'none') {
      return Response.json({ allowed: true, severity: 'none', flags: [] });
    }

    const svc = base44.asServiceRole;
    const userId = user.email;
    const contentSnippet = text.substring(0, 500);

    // Count past violations for escalation decisions
    const pastViolations = await countRecentViolations(svc, userId);

    // ── CRITICAL: underage, trafficking, coercion → immediate suspend + block ──
    if (severity === 'critical') {
      await autoSuspend(svc, userId, reasons[0], reasons[0]);
      await createModerationCase(svc, userId, context, analysisResult, contentSnippet);

      console.warn(`[CRITICAL] User ${userId} auto-suspended for ${reasons.join(', ')} in context: ${context}`);

      return Response.json({
        allowed: false,
        severity: 'critical',
        flags,
        action: 'blocked_and_suspended',
        message: 'This content violates our platform safety policies and your account has been placed under review. If you believe this is an error, please contact support.',
      });
    }

    // ── HIGH: direct solicitation, threats, fraud ──────────────────────────────
    if (severity === 'high') {
      await createModerationCase(svc, userId, context, analysisResult, contentSnippet);

      // Escalate to suspension if repeated violations
      if (pastViolations >= 2) {
        await autoSuspend(svc, userId, `Repeated high-risk content violations (${pastViolations + 1} incidents)`, reasons[0]);

        console.warn(`[HIGH - REPEAT OFFENDER] User ${userId} auto-suspended after ${pastViolations + 1} violations`);

        return Response.json({
          allowed: false,
          severity: 'high',
          flags,
          action: 'blocked_and_suspended',
          message: 'Your account has been suspended due to repeated violations of our platform safety policies. Please contact support.',
        });
      }

      console.warn(`[HIGH] Content blocked for user ${userId} in context: ${context}. Past violations: ${pastViolations}`);

      return Response.json({
        allowed: false,
        severity: 'high',
        flags,
        action: 'blocked',
        message: 'This message could not be sent because it appears to contain content that violates our platform policies. This platform is for professional creator collaboration only.',
      });
    }

    // ── WARN: low-risk signal ──────────────────────────────────────────────────
    if (severity === 'warn') {
      await createModerationCase(svc, userId, context, analysisResult, contentSnippet);

      // Escalate if repeated
      if (pastViolations >= 4) {
        await autoSuspend(svc, userId, `Repeated content warnings (${pastViolations + 1} incidents)`, reasons[0]);
        return Response.json({
          allowed: false,
          severity: 'warn',
          flags,
          action: 'blocked_and_suspended',
          message: 'Your account has been suspended for repeated policy violations.',
        });
      }

      if (allow_warn) {
        // Warn but allow (logged)
        return Response.json({
          allowed: true,
          severity: 'warn',
          flags,
          action: 'warned',
          message: 'Please keep all communications focused on professional content collaboration. This platform does not support solicitation or personal services.',
        });
      } else {
        // Caller asked to block warns too
        return Response.json({
          allowed: false,
          severity: 'warn',
          flags,
          action: 'blocked',
          message: 'This content has been blocked. Please keep all communications professional.',
        });
      }
    }

    return Response.json({ allowed: true, severity: 'none', flags: [] });

  } catch (error) {
    console.error('Content moderation error:', error);

    // ALERT on moderation failure — never silently fail
    try {
      const base44Emergency = createClientFromRequest(req);
      await base44Emergency.asServiceRole.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_MODERATION_HEALTH',
        target_type: 'System',
        target_id: 'moderateContent',
        action: 'system_health_alert',
        reason: 'MODERATION ENGINE FAILURE — content moderation check failed',
        notes: `Error: ${error.message}. Content moderation was non-blocking (fail-open). Manual review may be required for recent content.`,
        metadata_json: {
          error: error.message,
          timestamp: new Date().toISOString(),
          severity: 'HIGH',
          alert_type: 'moderation_check_failed',
        },
      }).catch(() => {});

      // Also create a system alert report for admin dashboard visibility
      await base44Emergency.asServiceRole.entities.Report.create({
        reporter_id: 'SYSTEM_MODERATION_HEALTH',
        target_user_id: 'SYSTEM',
        reason: 'other',
        details: `[SYSTEM HEALTH ALERT] Moderation engine failure at ${new Date().toISOString()}. Error: ${error.message}. Content was allowed through without moderation check. Manual review recommended.`,
        status: 'investigating',
        admin_notes: '⚠️ SYSTEM HEALTH — MODERATION ENGINE FAILURE — CHECK INFRASTRUCTURE',
      }).catch(() => {});
    } catch (_) { /* best-effort alert */ }

    // Fail open for availability — but now we've alerted
    return Response.json({ allowed: true, severity: 'none', flags: [], error_note: 'moderation_check_failed' });
  }
});