import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, collaboration_id, contract_id, target_user_id } = await req.json();

    if (!action) {
      return Response.json({ error: 'action required' }, { status: 400 });
    }

    // Log to appropriate entity
    if (collaboration_id) {
      await base44.asServiceRole.entities.CollaborationActivityLog.create({
        collaboration_id,
        activity_type: 'VERIFICATION_BLOCK',
        user_id: user.email,
        details: {
          action,
          blocked_at: new Date().toISOString(),
          reason: 'User verification required'
        }
      });
    }

    // Also log to admin action log for monitoring
    await base44.asServiceRole.entities.AdminActionLog.create({
      admin_id: 'SYSTEM',
      action_type: 'verification_enforcement',
      target_user_id: target_user_id || user.email,
      details: {
        action,
        collaboration_id,
        contract_id
      },
      reason: 'Action blocked due to missing or expired verification'
    });

    return Response.json({
      success: true,
      logged: true
    });

  } catch (error) {
    console.error('Verification block logging error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});