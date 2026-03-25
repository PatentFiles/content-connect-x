/**
 * LEGACY PUBLIC FILE AUDIT & FLAGGING — Admin Only
 *
 * Scans all sensitive file-related entities for records where
 * file URIs are public URLs (http/https) instead of private storage URIs.
 *
 * Actions:
 * - Identifies and logs all findings to AdminActionLog
 * - Marks TestingDocument records with legacy_public_file note
 * - Returns full remediation report
 *
 * Run once before launch, re-run after any file migration.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function isPublicUrl(val) {
  if (!val || typeof val !== 'string') return false;
  return val.startsWith('http://') || val.startsWith('https://');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const svc = base44.asServiceRole;
    const findings = [];
    const { dry_run = true } = await req.json().catch(() => ({}));

    // ─── SCAN: VerificationRecord ─────────────────────────────────────────────
    try {
      const records = await svc.entities.VerificationRecord.list();
      for (const rec of records) {
        const docs = rec.documents_submitted || [];
        for (let i = 0; i < docs.length; i++) {
          const doc = docs[i];
          if (isPublicUrl(doc.uri)) {
            findings.push({
              entity: 'VerificationRecord',
              id: rec.id,
              user_id: rec.user_id,
              field: `documents_submitted[${i}].uri`,
              value_preview: doc.uri.substring(0, 80),
              severity: 'CRITICAL',
              action: 'REQUIRES_MANUAL_MIGRATION',
            });
          }
        }
        if (isPublicUrl(rec.metadata?.document_url)) {
          findings.push({
            entity: 'VerificationRecord',
            id: rec.id,
            user_id: rec.user_id,
            field: 'metadata.document_url',
            severity: 'HIGH',
            action: 'REQUIRES_MANUAL_MIGRATION',
          });
        }
      }
    } catch (e) {
      findings.push({ entity: 'VerificationRecord', error: e.message });
    }

    // ─── SCAN: TestingDocument ────────────────────────────────────────────────
    try {
      const docs = await svc.entities.TestingDocument.list();
      for (const doc of docs) {
        const issues = [];
        if (isPublicUrl(doc.file_uri)) issues.push('file_uri');
        if (isPublicUrl(doc.file_url)) issues.push('file_url');

        if (issues.length > 0) {
          findings.push({
            entity: 'TestingDocument',
            id: doc.id,
            user_id: doc.user_id,
            file_name: doc.file_name,
            fields: issues,
            severity: 'CRITICAL',
            action: 'FLAGGED_FOR_MIGRATION',
          });

          // In non-dry-run mode, flag the record with a note
          if (!dry_run) {
            await svc.entities.TestingDocument.update(doc.id, {
              notes: (doc.notes || '') + ' [SYSTEM: legacy_public_file — requires private storage migration]',
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      findings.push({ entity: 'TestingDocument', error: e.message });
    }

    // ─── SCAN: TestingCredential ──────────────────────────────────────────────
    try {
      const creds = await svc.entities.TestingCredential.list();
      for (const cred of creds) {
        if (isPublicUrl(cred.docs_private_url)) {
          findings.push({
            entity: 'TestingCredential',
            id: cred.id,
            user_id: cred.user_id,
            field: 'docs_private_url',
            value_preview: cred.docs_private_url.substring(0, 80),
            severity: 'HIGH',
            action: 'FLAGGED_FOR_MIGRATION',
          });
        }
      }
    } catch (e) {
      findings.push({ entity: 'TestingCredential', error: e.message });
    }

    // ─── SCAN: ComplianceRecord (file fields) ─────────────────────────────────
    try {
      const records = await svc.entities.ComplianceRecord.list();
      for (const rec of records) {
        const fileFields = ['document_url', 'file_url', 'attachment_url'];
        for (const field of fileFields) {
          if (isPublicUrl(rec[field])) {
            findings.push({
              entity: 'ComplianceRecord',
              id: rec.id,
              user_id: rec.user_id,
              field,
              severity: 'HIGH',
              action: 'FLAGGED_FOR_MIGRATION',
            });
          }
        }
      }
    } catch (e) {
      // ComplianceRecord may not have file fields — skip silently
    }

    // ─── LOG FINDINGS ─────────────────────────────────────────────────────────
    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;
    const highCount = findings.filter(f => f.severity === 'HIGH').length;

    await svc.entities.AdminActionLog.create({
      admin_user_id: user.email,
      target_type: 'System',
      target_id: 'legacy_file_audit',
      action: 'legacy_file_audit',
      reason: `Legacy public file audit: ${findings.length} finding(s) — ${criticalCount} critical, ${highCount} high`,
      notes: JSON.stringify(findings).substring(0, 2000),
      metadata_json: {
        dry_run,
        total_findings: findings.length,
        critical: criticalCount,
        high: highCount,
        run_at: new Date().toISOString(),
        run_by: user.email,
      },
    }).catch(() => {});

    return Response.json({
      dry_run,
      total_findings: findings.length,
      critical: criticalCount,
      high: highCount,
      verdict: findings.length === 0
        ? 'CLEAN — No legacy public URLs found in sensitive file fields'
        : `ACTION REQUIRED — ${findings.length} sensitive file record(s) using public URLs`,
      findings,
      next_steps: findings.length > 0 ? [
        'Re-upload affected files using UploadPrivateFile integration',
        'Update the file_uri field with the returned private URI',
        'Set dry_run: false to flag records in the database',
        'Re-run this audit to confirm clean state',
      ] : ['No action required'],
    });

  } catch (error) {
    console.error('Legacy file audit error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});