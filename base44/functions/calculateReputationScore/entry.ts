/**
 * REPUTATION SCORE CALCULATOR
 *
 * System-derived, non-gamable trust score (0–100).
 * No user ratings, no reviews — only system events.
 *
 * Score Bands:
 *   0–19   → new
 *   20–39  → established
 *   40–59  → reliable
 *   60–79  → highly_reliable
 *   80–100 → trusted
 *
 * Can be called:
 *  - On demand: { user_id: "email@..." }
 *  - Batch (admin): { recalculate_all: true }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Score band thresholds
function getLabel(score) {
  if (score >= 80) return 'trusted';
  if (score >= 60) return 'highly_reliable';
  if (score >= 40) return 'reliable';
  if (score >= 20) return 'established';
  return 'new';
}

async function computeScoreForUser(svc, userId) {
  const now = new Date();
  let positive = 0;
  let negative = 0;
  const factors = {};

  // ── 1. COLLABORATION OUTCOMES ───────────────────────────────────────────────
  const collabs = await svc.entities.Collaboration.filter({ participant_ids: { $in: [userId] } }).catch(() => []);
  const completed = collabs.filter(c => c.status === 'completed').length;
  const cancelled = collabs.filter(c => c.status === 'cancelled').length;
  const disputed = collabs.filter(c => c.status === 'disputed').length;
  const total = collabs.length;

  factors.completed_collabs = completed;
  factors.cancelled_collabs = cancelled;
  factors.disputed_collabs = disputed;

  // Completed collaborations: up to +30 pts
  positive += Math.min(completed * 5, 30);

  // Cancellations: -4 pts each, up to -20
  negative += Math.min(cancelled * 4, 20);

  // Disputes filed against user: -6 pts each, up to -24
  negative += Math.min(disputed * 6, 24);

  // Contract completion rate: up to +10 pts
  if (total > 0) {
    const completionRate = completed / total;
    factors.contract_completion_rate = Math.round(completionRate * 100);
    positive += Math.round(completionRate * 10);
  } else {
    factors.contract_completion_rate = 0;
  }

  // ── 2. DISPUTE OUTCOMES ──────────────────────────────────────────────────────
  const disputes = await svc.entities.CollaborationDispute.filter({ filed_by: userId }).catch(() => []);
  const wonDisputes = disputes.filter(d => d.status === 'resolved' && d.outcome_notes?.toLowerCase().includes('favor')).length;
  factors.dispute_outcomes_favorable = wonDisputes;
  positive += Math.min(wonDisputes * 3, 9);

  // ── 3. CONSENT REVOCATIONS ───────────────────────────────────────────────────
  const revocations = await svc.entities.ConsentRevocation.filter({ revoking_user_id: userId }).catch(() => []);
  factors.consent_revocations = revocations.length;
  negative += Math.min(revocations.length * 3, 9); // revocations against user are serious

  // ── 4. VERIFICATION STATUS ───────────────────────────────────────────────────
  const verifications = await svc.entities.VerificationRecord.filter({ user_id: userId }).catch(() => []);
  const latestVerif = verifications[0];
  const verStatus = latestVerif?.status || 'none';
  factors.verification_status = verStatus;
  if (verStatus === 'approved') positive += 10;
  else if (verStatus === 'expired') negative += 5;
  else if (verStatus === 'rejected') negative += 8;

  // ── 5. TESTING COMPLIANCE ───────────────────────────────────────────────────
  const creds = await svc.entities.TestingCredential.filter({ user_id: userId }).catch(() => []);
  const validCred = creds.find(c => c.status_badge === 'valid' && (!c.expires_at || new Date(c.expires_at) > now));
  const expiredCred = creds.find(c => c.status_badge === 'expired' || (c.expires_at && new Date(c.expires_at) <= now));
  factors.testing_compliance = validCred ? 'valid' : expiredCred ? 'expired' : 'none';
  if (validCred) positive += 8;
  else if (expiredCred) negative += 3;

  // ── 6. MODERATION FLAGS ──────────────────────────────────────────────────────
  const adminLogs = await svc.entities.AdminActionLog.filter({ target_id: userId }).catch(() => []);
  const moderationFlags = adminLogs.filter(l =>
    ['suspend_account', 'ban_account', 'content_moderation_flag', 'rate_limit_exceeded']
      .includes(l.action)
  ).length;
  factors.moderation_flags = moderationFlags;
  negative += Math.min(moderationFlags * 5, 25);

  // Active suspension or ban = hard cap
  const profiles = await svc.entities.UserProfile.filter({ user_id: userId }).catch(() => []);
  const profile = profiles[0];
  if (profile?.banned) return { score: 0, label: 'new', factors, computed_at: now.toISOString(), version: 1 };
  if (profile?.suspended) negative += 20;

  // ── 7. PROFILE COMPLETENESS ──────────────────────────────────────────────────
  let completeness = 0;
  if (profile) {
    const fields = [profile.display_name, profile.bio, profile.avatar_url, profile.role_type, profile.base_location?.city, profile.age];
    completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }
  factors.profile_completeness = completeness;
  positive += Math.round(completeness / 10); // up to +10

  // ── 8. RESPONSE TIME ─────────────────────────────────────────────────────────
  const responseHours = profile?.response_time_hours;
  factors.response_time_hours = responseHours || null;
  if (responseHours && responseHours <= 4) positive += 5;
  else if (responseHours && responseHours <= 24) positive += 2;

  // ── 9. ACCOUNT AGE ───────────────────────────────────────────────────────────
  const users = await svc.entities.User.filter({ email: userId }).catch(() => []);
  const user = users[0];
  const ageMs = user?.created_date ? now - new Date(user.created_date) : 0;
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  factors.account_age_days = ageDays;
  if (ageDays >= 365) positive += 5;
  else if (ageDays >= 90) positive += 3;
  else if (ageDays >= 30) positive += 1;

  // ── FINAL SCORE ───────────────────────────────────────────────────────────────
  factors.positive_points = positive;
  factors.negative_points = negative;

  const rawScore = Math.max(0, Math.min(100, positive - negative));
  const label = getLabel(rawScore);

  return {
    score: rawScore,
    label,
    factors,
    computed_at: now.toISOString(),
    version: 1,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const svc = base44.asServiceRole;

    // Admin batch recalculation
    if (body.recalculate_all) {
      if (user?.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
      }
      const allProfiles = await svc.entities.UserProfile.list();
      const results = [];
      for (const profile of allProfiles.slice(0, 100)) { // process up to 100 at a time
        const computed = await computeScoreForUser(svc, profile.user_id);
        // Upsert: find existing or create
        const existing = await svc.entities.ReputationScore.filter({ user_id: profile.user_id }).catch(() => []);
        if (existing[0]) {
          await svc.entities.ReputationScore.update(existing[0].id, { ...computed, user_id: profile.user_id });
        } else {
          await svc.entities.ReputationScore.create({ user_id: profile.user_id, ...computed });
        }
        results.push({ user_id: profile.user_id, score: computed.score, label: computed.label });
      }
      return Response.json({ success: true, count: results.length, results });
    }

    // Single user calculation
    const targetUserId = body.user_id || user.email;

    // Non-admins can only compute their own score
    if (targetUserId !== user.email && user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const computed = await computeScoreForUser(svc, targetUserId);

    // Upsert score
    const existing = await svc.entities.ReputationScore.filter({ user_id: targetUserId }).catch(() => []);
    let scoreRecord;
    if (existing[0]) {
      scoreRecord = await svc.entities.ReputationScore.update(existing[0].id, { ...computed, user_id: targetUserId });
    } else {
      scoreRecord = await svc.entities.ReputationScore.create({ user_id: targetUserId, ...computed });
    }

    return Response.json({ success: true, data: scoreRecord });
  } catch (error) {
    console.error('calculateReputationScore error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});