/**
 * getSecureDocumentUrl
 * Generates a short-lived signed URL for a private verification/testing document.
 * Admin-only. Logs every access to AdminActionLog for audit trail.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { file_uri, document_type, belongs_to_user_id, record_id, entity_name } = await req.json();

    if (!file_uri) {
      return Response.json({ error: 'file_uri is required' }, { status: 400 });
    }

    // Generate a short-lived signed URL (5 minutes = 300 seconds)
    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri,
      expires_in: 300,
    });

    // Log access for audit trail
    await base44.asServiceRole.entities.AdminActionLog.create({
      admin_user_id: user.email,
      target_type: entity_name || 'SensitiveDocument',
      target_id: record_id || belongs_to_user_id || 'unknown',
      action: 'sensitive_file_view',
      reason: `Admin viewed sensitive document: ${document_type || 'unknown'}`,
      notes: `File type: ${document_type}. Belongs to user: ${belongs_to_user_id}. Accessed by: ${user.email} at ${new Date().toISOString()}. Signed URL expires in 5 minutes.`,
      metadata_json: {
        document_type,
        belongs_to_user_id,
        accessed_by: user.email,
        accessed_at: new Date().toISOString(),
        entity_name,
        record_id,
      },
    }).catch(() => {}); // Non-blocking — don't fail the request if logging fails

    return Response.json({ signed_url });

  } catch (error) {
    console.error('getSecureDocumentUrl error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});