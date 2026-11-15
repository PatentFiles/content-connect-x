import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// A member may submit documents free of charge but may never approve their own age.
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_id: user.email });
    if (profiles.some(p => p.banned || p.suspended)) return Response.json({ error: 'Account unavailable' }, { status: 403 });
    const { id_file_uri, selfie_file_uri } = await req.json();
    if (![id_file_uri, selfie_file_uri].every(v => typeof v === 'string' && v.startsWith('private://'))) {
      return Response.json({ error: 'Two private document references are required' }, { status: 400 });
    }
    const existing = await base44.asServiceRole.entities.VerificationRecord.filter({ user_id: user.email });
    if (existing.some(v => v.status === 'approved')) return Response.json({ error: 'Already verified' }, { status: 409 });
    if (existing.some(v => v.status === 'pending')) return Response.json({ error: 'Verification is under review' }, { status: 409 });
    const data = {
      user_id: user.email, provider: 'manual', status: 'pending',
      documents_submitted: [
        { type: 'id', uri: id_file_uri, submitted_at: new Date().toISOString() },
        { type: 'selfie', uri: selfie_file_uri, submitted_at: new Date().toISOString() },
      ],
    };
    const record = await base44.asServiceRole.entities.VerificationRecord.create(data);
    return Response.json({ id: record.id, status: 'pending' }, { status: 201 });
  } catch (error) {
    console.error('submitAgeVerification failed', error);
    return Response.json({ error: 'Could not submit verification' }, { status: 500 });
  }
});
