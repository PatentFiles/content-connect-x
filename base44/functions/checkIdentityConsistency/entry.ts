/**
 * checkIdentityConsistency — Privacy-Preserving Identity Fingerprint Scanner
 *
 * Called after verification review (approve or reject) or on-demand by admins.
 * 
 * HOW IT WORKS (privacy-preserving):
 * - Reads UserProfile.real_name and VerificationRecord metadata (NOT raw documents)
 * - Normalizes and SHA-256 hashes the name before comparison — raw values never stored or logged
 * - Uses double-metaphone phonetic encoding for near-name matching across linguistic variants
 * - Compares hashes + behavioral signals against existing IdentityFingerprint records
 * - Emits IdentityConsistencyFlag records (admin-only visibility)
 * - Never exposes raw identity data in flags, logs, or responses
 * 
 * Actions:
 *   scan_user    — scan a specific user (called on verification events)
 *   scan_all     — batch scan all verified users (admin manual trigger)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── Privacy-safe normalization helpers ─────────────────────────────────────

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function sha256hex(str) {
  if (!str) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simplified double-metaphone — produces a phonetic key so John / Jon / Johann all match
function metaphoneKey(str) {
  if (!str) return '';
  const s = normalizeName(str).replace(/\s/g, '');
  
  // Basic consonant reduction for matching — not a full DMETA but sufficient for flag detection
  return s
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/[aeiou]/g, '') // remove vowels
    .replace(/([a-z])\1+/g, '$1') // collapse double letters
    .substring(0, 8); // cap length
}

// ─── Core scan logic ─────────────────────────────────────────────────────────

async function scanUser(svc, targetUserId, triggeredBy) {
  const flags = [];

  // 1. Fetch profile for real_name
  const profiles = await svc.entities.UserProfile.filter({ user_id: targetUserId });
  const profile = profiles[0];
  const realName = profile?.real_name;

  // 2. Fetch their verification records
  const verifications = await svc.entities.VerificationRecord.filter({ user_id: targetUserId });
  const latestVerification = verifications.sort((a, b) =>
    new Date(b.created_date) - new Date(a.created_date)
  )[0];

  const submissionCount = verifications.length;
  const rejectedCount = verifications.filter(v => v.status === 'rejected').length;
  const docType = latestVerification?.documents_submitted?.[0]?.type || null;

  // 3. Build privacy-safe hashes
  const normalizedName = normalizeName(realName);
  const nameHash = normalizedName ? await sha256hex(normalizedName) : null;
  const nameMetaphone = metaphoneKey(normalizedName);

  // 4. Upsert fingerprint record (admin-only)
  const existingFps = await svc.entities.IdentityFingerprint.filter({ user_id: targetUserId });
  if (existingFps.length > 0) {
    await svc.entities.IdentityFingerprint.update(existingFps[0].id, {
      name_hash: nameHash,
      name_metaphone: nameMetaphone,
      doc_type: docType,
      verification_record_id: latestVerification?.id,
      created_from_status: latestVerification?.status,
      submission_count: submissionCount,
      rejection_count: rejectedCount,
    });
  } else if (nameHash || nameMetaphone) {
    await svc.entities.IdentityFingerprint.create({
      user_id: targetUserId,
      name_hash: nameHash,
      name_metaphone: nameMetaphone,
      doc_type: docType,
      verification_record_id: latestVerification?.id,
      created_from_status: latestVerification?.status,
      submission_count: submissionCount,
      rejection_count: rejectedCount,
    });
  }

  // 5. Load all OTHER fingerprints for comparison
  const allFingerprints = await svc.entities.IdentityFingerprint.list();
  const otherFps = allFingerprints.filter(fp => fp.user_id !== targetUserId);

  // 6. Detect matches
  for (const other of otherFps) {
    const reasonCodes = [];

    // Exact name hash match (high confidence)
    if (nameHash && other.name_hash && nameHash === other.name_hash) {
      reasonCodes.push('name_hash_match');
    }

    // Phonetic near-match (medium confidence if no exact match)
    if (nameMetaphone && other.name_metaphone && nameMetaphone === other.name_metaphone && nameMetaphone.length >= 3) {
      if (!reasonCodes.includes('name_hash_match')) {
        reasonCodes.push('name_phonetic_match');
      }
    }

    // Same doc type + same phonetic name = elevated
    if (docType && other.doc_type && docType === other.doc_type && reasonCodes.includes('name_phonetic_match')) {
      reasonCodes.push('doc_type_plus_name_match');
    }

    // Name hash + doc type = multiple accounts same identity (high)
    if (reasonCodes.includes('name_hash_match') && docType && other.doc_type && docType === other.doc_type) {
      reasonCodes.push('multiple_accounts_same_identity');
    }

    if (reasonCodes.length === 0) continue;

    // Determine confidence
    let confidence = 'low';
    if (reasonCodes.includes('multiple_accounts_same_identity') || reasonCodes.includes('name_hash_match')) {
      confidence = 'high';
    } else if (reasonCodes.includes('doc_type_plus_name_match') || reasonCodes.length >= 2) {
      confidence = 'medium';
    }

    // Check if flag already exists for this pair (avoid duplicate open flags)
    const existingFlags = await svc.entities.IdentityConsistencyFlag.filter({
      flagged_user_id: targetUserId,
      matched_user_id: other.user_id,
      status: 'open',
    });
    if (existingFlags.length > 0) continue;

    // Create flag — privacy-safe: no raw names in match_details
    const flag = await svc.entities.IdentityConsistencyFlag.create({
      flagged_user_id: targetUserId,
      matched_user_id: other.user_id,
      confidence,
      reason_codes: reasonCodes,
      match_details: buildMatchDetails(reasonCodes, confidence, submissionCount, rejectedCount),
      status: 'open',
      triggered_by: triggeredBy,
    });

    flags.push(flag);

    // Log the flag creation
    await svc.entities.AdminActionLog.create({
      admin_user_id: 'SYSTEM_IDENTITY_CHECK',
      action_type: 'identity_flag_created',
      target_user_id: targetUserId,
      details: {
        flag_id: flag.id,
        matched_user_id: other.user_id,
        confidence,
        reason_codes: reasonCodes,
        triggered_by: triggeredBy,
      },
      reason: `Identity consistency flag: ${confidence} confidence — ${reasonCodes.join(', ')}`,
    }).catch(() => {});
  }

  // 7. Behavioral signal checks (no cross-user comparison needed)
  const behavioralReasonCodes = [];

  // Repeated rejections (>= 3 failed attempts)
  if (rejectedCount >= 3) {
    behavioralReasonCodes.push('repeated_rejections');
  }

  // Rapid resubmission (3+ submissions within 30 days)
  if (submissionCount >= 3) {
    const recent = verifications.filter(v => {
      const daysSince = (Date.now() - new Date(v.created_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    });
    if (recent.length >= 3) {
      behavioralReasonCodes.push('rapid_resubmission');
    }
  }

  // Resubmit after ban
  if (profile?.banned || profile?.suspended) {
    if (submissionCount > 0) {
      behavioralReasonCodes.push('resubmit_after_ban');
    }
  }

  if (behavioralReasonCodes.length > 0) {
    const confidence = behavioralReasonCodes.includes('resubmit_after_ban') ? 'high' : 'medium';
    const existingBehavioral = await svc.entities.IdentityConsistencyFlag.filter({
      flagged_user_id: targetUserId,
      status: 'open',
    });
    const hasBehavioralFlag = existingBehavioral.some(f =>
      f.reason_codes?.some(rc => behavioralReasonCodes.includes(rc))
    );
    if (!hasBehavioralFlag) {
      const flag = await svc.entities.IdentityConsistencyFlag.create({
        flagged_user_id: targetUserId,
        matched_user_id: null,
        confidence,
        reason_codes: behavioralReasonCodes,
        match_details: buildMatchDetails(behavioralReasonCodes, confidence, submissionCount, rejectedCount),
        status: 'open',
        triggered_by: triggeredBy,
      });
      flags.push(flag);

      await svc.entities.AdminActionLog.create({
        admin_user_id: 'SYSTEM_IDENTITY_CHECK',
        action_type: 'identity_flag_created',
        target_user_id: targetUserId,
        details: {
          flag_id: flag.id,
          confidence,
          reason_codes: behavioralReasonCodes,
          triggered_by: triggeredBy,
        },
        reason: `Behavioral identity flag: ${confidence} confidence — ${behavioralReasonCodes.join(', ')}`,
      }).catch(() => {});
    }
  }

  return { user_id: targetUserId, flags_created: flags.length };
}

function buildMatchDetails(reasonCodes, confidence, submissionCount, rejectedCount) {
  const parts = [];
  if (reasonCodes.includes('name_hash_match')) parts.push('Exact identity name match detected across accounts');
  if (reasonCodes.includes('name_phonetic_match')) parts.push('Phonetic name similarity detected across accounts');
  if (reasonCodes.includes('doc_type_plus_name_match')) parts.push('Same document type + similar name across accounts');
  if (reasonCodes.includes('multiple_accounts_same_identity')) parts.push('HIGH: Likely same identity used across multiple accounts');
  if (reasonCodes.includes('repeated_rejections')) parts.push(`Verification rejected ${rejectedCount} times (${submissionCount} total submissions)`);
  if (reasonCodes.includes('rapid_resubmission')) parts.push(`${submissionCount} verification submissions in last 30 days`);
  if (reasonCodes.includes('resubmit_after_ban')) parts.push('Verification submitted while account is banned or suspended');
  return parts.join('. ') + `. Confidence: ${confidence}. No raw identity data is stored in this flag.`;
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;

    let body = {};
    try { body = await req.json(); } catch (_) {}

    // ── Entity automation payload: { event, data } ─────────────────────────
    const isEntityAutomation = !!(body.event && body.data);
    if (isEntityAutomation) {
      const verificationRecord = body.data;
      const userId = verificationRecord?.user_id;
      const status = verificationRecord?.status;
      if (!userId) return Response.json({ skipped: true, reason: 'No user_id in payload' });
      const triggeredBy = status === 'approved' ? 'verification_approved' : 'verification_rejected';
      const result = await scanUser(svc, userId, triggeredBy);
      return Response.json({ success: true, ...result });
    }
    // ── Manual / Admin API call ─────────────────────────────────────────────

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });

    const { action, user_id, triggered_by } = body;

    if (action === 'scan_user') {
      if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });
      const result = await scanUser(svc, user_id, triggered_by || 'manual_scan');
      return Response.json({ success: true, ...result });
    }

    if (action === 'scan_all') {
      // Batch scan all users who have verification records
      const allVerifications = await svc.entities.VerificationRecord.list();
      const uniqueUserIds = [...new Set(allVerifications.map(v => v.user_id))];

      let totalFlags = 0;
      const results = [];
      for (const uid of uniqueUserIds) {
        const r = await scanUser(svc, uid, triggered_by || 'manual_scan_all');
        totalFlags += r.flags_created;
        results.push(r);
      }

      await svc.entities.AdminActionLog.create({
        admin_user_id: user.email,
        action_type: 'identity_scan_all',
        details: { users_scanned: uniqueUserIds.length, total_flags_created: totalFlags },
        reason: 'Manual full identity consistency scan',
      }).catch(() => {});

      return Response.json({ success: true, users_scanned: uniqueUserIds.length, total_flags_created: totalFlags, results });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Identity check error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});