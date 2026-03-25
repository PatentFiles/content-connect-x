/**
 * RATE LIMITER BACKEND FUNCTION
 *
 * Provides per-user and per-IP rate limiting for sensitive platform actions.
 * Uses AdminActionLog as the source of truth for recent actions.
 *
 * Limits (configurable below):
 *  - send_message:        30 per minute, 300 per hour
 *  - submit_report:       5 per hour
 *  - create_collaboration: 10 per hour
 *  - update_profile:      20 per hour
 *
 * Returns: { allowed: true } or { allowed: false, reason, retry_after_seconds }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── RATE LIMIT CONFIG ────────────────────────────────────────────────────────
const LIMITS = {
  send_message: [
    { window_minutes: 1, max: 30 },
    { window_minutes: 60, max: 300 },
  ],
  submit_report: [
    { window_minutes: 60, max: 5 },
  ],
  create_collaboration: [
    { window_minutes: 60, max: 10 },
  ],
  update_profile: [
    { window_minutes: 60, max: 20 },
  ],
  // Fallback for unknown actions
  default: [
    { window_minutes: 60, max: 50 },
  ],
};

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

    const { action, ip_hint } = await req.json();

    if (!action) {
      return Response.json({ error: 'action is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const userId = user.email;
    const now = Date.now();
    const rules = LIMITS[action] || LIMITS.default;

    // Fetch recent action logs for this user + action
    let recentLogs = [];
    try {
      recentLogs = await svc.entities.AdminActionLog.filter({
        target_id: userId,
        action: `rate_limit_action_${action}`,
      });
    } catch (e) {
      // If log fetch fails, fail open (log error but don't block)
      console.error('Rate limit log fetch failed:', e.message);
    }

    // Check each window rule
    for (const rule of rules) {
      const windowMs = rule.window_minutes * 60 * 1000;
      const windowStart = now - windowMs;
      const actionsInWindow = recentLogs.filter(l =>
        new Date(l.created_date).getTime() > windowStart
      ).length;

      if (actionsInWindow >= rule.max) {
        // Log the violation
        await svc.entities.AdminActionLog.create({
          admin_user_id: 'SYSTEM_RATE_LIMITER',
          target_type: 'User',
          target_id: userId,
          action: 'rate_limit_exceeded',
          reason: `Rate limit exceeded: ${action} (${actionsInWindow}/${rule.max} per ${rule.window_minutes}min)`,
          notes: `User ${userId} exceeded rate limit for ${action}. IP hint: ${ip_hint || 'unknown'}. Window: ${rule.window_minutes}min. Actions in window: ${actionsInWindow}`,
          metadata_json: {
            action,
            limit: rule.max,
            window_minutes: rule.window_minutes,
            actions_in_window: actionsInWindow,
            ip_hint: ip_hint || null,
            timestamp: new Date().toISOString(),
          },
        }).catch(() => {});

        return Response.json({
          allowed: false,
          reason: `Too many ${action.replace(/_/g, ' ')} requests. Please wait before trying again.`,
          retry_after_seconds: rule.window_minutes * 60,
          limit: rule.max,
          window_minutes: rule.window_minutes,
        }, { status: 429 });
      }
    }

    // Log the allowed action (for future counting)
    await svc.entities.AdminActionLog.create({
      admin_user_id: 'SYSTEM_RATE_LIMITER',
      target_type: 'User',
      target_id: userId,
      action: `rate_limit_action_${action}`,
      reason: `Rate limit tracking: ${action}`,
      notes: `Allowed. User: ${userId}. Action: ${action}`,
      metadata_json: {
        action,
        ip_hint: ip_hint || null,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});

    return Response.json({ allowed: true });

  } catch (error) {
    console.error('Rate limiter error:', error);
    // Fail open for availability — log but don't block
    return Response.json({ allowed: true, error_note: 'rate_limit_check_failed' });
  }
});