import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let action, targetUserId, currentUser;

  try {
    const base44 = createClientFromRequest(req);
    const adminClient = base44.asServiceRole;

    // 1. Authenticate caller
    const user = await base44.auth.me();
    currentUser = user?.email;
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Parse input
    const body = await req.json();
    action = body.action;
    targetUserId = body.targetUserId;
    const { reason, suspensionDuration, suspensionEndAt, suspensionCategory, probationConfig } = body;

    if (!action || !targetUserId) {
      return Response.json({ error: 'action and targetUserId are required' }, { status: 400 });
    }

    const validActions = ['make_admin', 'remove_admin', 'ban', 'unban', 'suspend', 'unsuspend', 'convert_to_ban', 'set_probation'];
    if (!validActions.includes(action)) {
      return Response.json({ error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}` }, { status: 400 });
    }

    // 3. Verify caller is admin
    const callerProfiles = await adminClient.entities.UserProfile.filter({ user_id: user.email });
    const callerProfile = callerProfiles[0];
    if (!callerProfile || callerProfile.role_type !== 'admin' || callerProfile.is_admin !== true) {
      return Response.json({ error: 'Unauthorized: Admin privileges required' }, { status: 403 });
    }

    // 4. Fetch target profile
    const targetProfiles = await adminClient.entities.UserProfile.filter({ user_id: targetUserId });
    const targetProfile = targetProfiles[0];
    if (!targetProfile) {
      return Response.json({ error: `Target user not found: ${targetUserId}` }, { status: 404 });
    }

    // 5. Build update payload
    let updateData = {};
    const now = new Date().toISOString();

    if (action === 'make_admin') {
      updateData = { is_admin: true, role_type: 'admin' };

    } else if (action === 'remove_admin') {
      updateData = { is_admin: false, role_type: 'creator' };

    } else if (action === 'ban') {
      // Permanent ban — clears any suspension fields
      updateData = {
        banned: true,
        suspended: false,
        suspension_reason: reason || 'Permanent ban: violation of platform policies',
        suspension_category: suspensionCategory || 'policy_violation',
        suspension_start_at: now,
        suspension_end_at: null,
        on_probation: false,
      };

    } else if (action === 'unban') {
      updateData = {
        banned: false,
        suspended: false,
        suspension_reason: null,
        suspension_category: null,
        suspension_start_at: null,
        suspension_end_at: null,
        reinstated_at: now,
        reinstated_by_admin_id: user.email,
      };

    } else if (action === 'suspend') {
      // Timed or indefinite suspension
      let endAt = null;
      if (suspensionEndAt) {
        endAt = suspensionEndAt; // ISO string from client
      } else if (suspensionDuration) {
        const durationMap = {
          '7d': 7,
          '30d': 30,
          '6mo': 180,
          '1yr': 365,
        };
        const days = durationMap[suspensionDuration];
        if (days) {
          const end = new Date();
          end.setDate(end.getDate() + days);
          endAt = end.toISOString();
        }
      }
      updateData = {
        banned: false,
        suspended: true,
        suspension_reason: reason || 'Account suspended by administrator',
        suspension_category: suspensionCategory || 'policy_violation',
        suspension_start_at: now,
        suspension_end_at: endAt,
      };

    } else if (action === 'unsuspend') {
      updateData = {
        suspended: false,
        suspension_end_at: null,
        reinstated_at: now,
        reinstated_by_admin_id: user.email,
      };

    } else if (action === 'convert_to_ban') {
      // Convert existing suspension into permanent ban
      updateData = {
        banned: true,
        suspended: false,
        suspension_reason: reason || targetProfile.suspension_reason || 'Converted to permanent ban',
        suspension_category: suspensionCategory || targetProfile.suspension_category || 'policy_violation',
        suspension_start_at: now,
        suspension_end_at: null,
        on_probation: false,
      };

    } else if (action === 'set_probation') {
      updateData = {
        on_probation: true,
        probation_restrictions: probationConfig || {},
        banned: false,
        suspended: false,
        reinstated_at: now,
        reinstated_by_admin_id: user.email,
      };
    }

    // 6. Update UserProfile
    await adminClient.entities.UserProfile.update(targetProfile.id, updateData);

    // 7. Immutable audit log
    await adminClient.entities.AdminActionLog.create({
      admin_user_id: user.email,
      target_type: 'User',
      target_id: targetUserId,
      action,
      reason: reason || `Admin action: ${action}`,
      notes: `Performed by ${user.email} on ${targetUserId} at ${now}`,
      metadata_json: {
        action,
        performed_by: user.email,
        target_user_id: targetUserId,
        changes: updateData,
        suspension_end_at: updateData.suspension_end_at || null,
        suspension_category: updateData.suspension_category || null,
        timestamp: now,
      },
    });

    return Response.json({ success: true, action, targetUserId, changes: updateData });

  } catch (error) {
    console.error('ADMIN ACTION ERROR', { message: error?.message, stack: error?.stack, action, targetUserId, currentUser });
    return Response.json({ success: false, error: error?.message || 'Unknown error' });
  }
});