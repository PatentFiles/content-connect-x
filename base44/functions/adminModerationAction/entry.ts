import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // 1. Authenticate caller
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify caller is an admin via service role (bypasses RLS)
    const svc = base44.asServiceRole;
    const callerProfiles = await svc.entities.UserProfile.filter({ user_id: user.email });
    const callerProfile = callerProfiles[0];

    if (!callerProfile || callerProfile.role_type !== 'admin' || callerProfile.is_admin !== true) {
      return Response.json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 });
    }

    // 3. Parse input
    const { action, targetUserId, reason } = await req.json();

    if (!action || !targetUserId) {
      return Response.json({ error: 'action and targetUserId are required' }, { status: 400 });
    }

    const validActions = ['make_admin', 'remove_admin', 'ban', 'unban'];
    if (!validActions.includes(action)) {
      return Response.json({ error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    // 4. Fetch target profile via service role (bypasses RLS)
    const targetProfiles = await svc.entities.UserProfile.filter({ user_id: targetUserId });
    const targetProfile = targetProfiles[0];

    if (!targetProfile) {
      return Response.json({ error: `Target user not found: ${targetUserId}` }, { status: 404 });
    }

    // 5. Execute action with elevated (service role) access
    let updateData = {};
    let logAction = action;

    switch (action) {
      case 'make_admin':
        updateData = { is_admin: true, role_type: 'admin' };
        break;

      case 'remove_admin':
        updateData = { is_admin: false, role_type: 'creator' };
        break;

      case 'ban':
        updateData = {
          banned: true,
          suspended: true,
          suspension_reason: reason || 'Violation of platform policies',
        };
        break;

      case 'unban':
        updateData = {
          banned: false,
          suspended: false,
          suspension_reason: null,
        };
        break;
    }

    // Perform the update via service role — bypasses all RLS
    await svc.entities.UserProfile.update(targetProfile.id, updateData);

    // 6. Log the admin action
    await svc.entities.AdminActionLog.create({
      admin_user_id: user.email,
      target_type: 'User',
      target_id: targetUserId,
      action: logAction,
      reason: reason || `Admin action: ${action}`,
      notes: `Performed by ${user.email} on ${targetUserId} at ${new Date().toISOString()}`,
      metadata_json: {
        action,
        performed_by: user.email,
        target_user_id: targetUserId,
        changes: updateData,
        timestamp: new Date().toISOString(),
      },
    });

    return Response.json({
      success: true,
      action,
      targetUserId,
      changes: updateData,
    });

  } catch (error) {
    console.error('adminModerationAction error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});