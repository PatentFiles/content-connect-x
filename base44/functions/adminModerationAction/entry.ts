import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let action, targetUserId, currentUser;

  try {
    const base44 = createClientFromRequest(req);

    // adminClient: service role — bypasses ALL RLS for every DB call
    const adminClient = base44.asServiceRole;

    // 1. Authenticate caller (auth.me uses request token — correct, not service role)
    const user = await base44.auth.me();
    currentUser = user?.email;
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse input
    const body = await req.json();
    action = body.action;
    targetUserId = body.targetUserId;
    const { reason } = body;

    if (!action || !targetUserId) {
      return Response.json({ error: 'action and targetUserId are required' }, { status: 400 });
    }

    const validActions = ['make_admin', 'remove_admin', 'ban', 'unban'];
    if (!validActions.includes(action)) {
      return Response.json({ error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    // 3. Verify caller is admin — adminClient bypasses RLS
    const callerProfiles = await adminClient.entities.UserProfile.filter({ user_id: user.email });
    const callerProfile = callerProfiles[0];

    if (!callerProfile || callerProfile.role_type !== 'admin' || callerProfile.is_admin !== true) {
      return Response.json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 });
    }

    // 4. Fetch target profile — adminClient bypasses RLS
    const targetProfiles = await adminClient.entities.UserProfile.filter({ user_id: targetUserId });
    const targetProfile = targetProfiles[0];

    if (!targetProfile) {
      return Response.json({ error: `Target user not found: ${targetUserId}` }, { status: 404 });
    }

    // 5. Build update payload
    let updateData = {};

    if (action === 'make_admin') {
      updateData = { is_admin: true, role_type: 'admin' };
    } else if (action === 'remove_admin') {
      updateData = { is_admin: false, role_type: 'creator' };
    } else if (action === 'ban') {
      updateData = {
        banned: true,
        suspended: true,
        suspension_reason: reason || 'Violation of platform policies',
      };
    } else if (action === 'unban') {
      updateData = {
        banned: false,
        suspended: false,
        suspension_reason: null,
      };
    }

    // 6. Update UserProfile — adminClient bypasses RLS
    await adminClient.entities.UserProfile.update(targetProfile.id, updateData);

    // 7. Log the action — adminClient bypasses RLS
    await adminClient.entities.AdminActionLog.create({
      admin_user_id: user.email,
      target_type: 'User',
      target_id: targetUserId,
      action,
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
    console.error('ADMIN ACTION ERROR', {
      message: error?.message,
      stack: error?.stack,
      action,
      targetUserId,
      currentUser,
    });

    return Response.json({
      success: false,
      error: error?.message || 'Unknown error',
    });
  }
});