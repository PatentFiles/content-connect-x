/**
 * PROTECTED ACTIONS ENDPOINT
 * 
 * All sensitive user-initiated mutations route through here.
 * Banned/suspended users are blocked BEFORE any data operation.
 * 
 * Actions supported (via ?action= query param):
 * - send_message
 * - block_user  
 * - unblock_user
 * - save_favorite
 * - remove_favorite
 * - create_collaboration
 * - start_conversation
 * - submit_report
 * - update_profile
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Inline ban check - cannot import from other files due to deployment isolation
async function checkBanStatus(base44, userEmail, actionName) {
  const profiles = await base44.asServiceRole.entities.UserProfile.filter({
    user_id: userEmail
  });
  const profile = profiles[0];

  if (profile?.banned === true) {
    await logBlockedAction(base44, userEmail, actionName, 'banned');
    return {
      blocked: true,
      response: Response.json(
        { error: 'Your account has been permanently banned.', code: 'banned', blocked: true },
        { status: 403 }
      )
    };
  }

  if (profile?.suspended === true) {
    await logBlockedAction(base44, userEmail, actionName, 'suspended');
    return {
      blocked: true,
      response: Response.json(
        { error: `Your account is temporarily suspended. ${profile.suspension_reason || ''}`, code: 'suspended', blocked: true },
        { status: 403 }
      )
    };
  }

  return { blocked: false, profile };
}

async function logBlockedAction(base44, userId, actionName, blockReason) {
  try {
    await base44.asServiceRole.entities.AdminActionLog.create({
      admin_id: 'SYSTEM_BAN_ENFORCEMENT',
      action_type: 'blocked_action_attempt',
      target_user_id: userId,
      details: {
        action_attempted: actionName,
        block_reason: blockReason,
        timestamp: new Date().toISOString()
      },
      reason: `Blocked ${blockReason} user from: ${actionName}`
    });
  } catch (e) {
    console.error('Failed to log blocked action:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check ban status before ANY action
    const banResult = await checkBanStatus(base44, user.email, action || 'unknown');
    if (banResult.blocked) {
      return banResult.response;
    }

    const body = await req.json();

    switch (action) {

      // ──────────────── MESSAGES ────────────────
      case 'send_message': {
        const { conversation_id, body: messageBody, attachments } = body;
        if (!conversation_id || !messageBody) {
          return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const message = await base44.entities.Message.create({
          conversation_id,
          sender_id: user.email,
          body: messageBody,
          attachments: attachments || [],
          read_by: []
        });

        // Update conversation
        await base44.entities.Conversation.update(conversation_id, {
          last_message_at: new Date().toISOString(),
          last_message_preview: messageBody.substring(0, 50)
        });

        return Response.json({ success: true, data: message });
      }

      // ──────────────── CONVERSATIONS ────────────────
      case 'start_conversation': {
        const { recipient_id } = body;
        if (!recipient_id) {
          return Response.json({ error: 'recipient_id required' }, { status: 400 });
        }

        const existingConvs = await base44.entities.Conversation.list();
        const existing = existingConvs.find(c =>
          c.participant_ids?.includes(user.email) &&
          c.participant_ids?.includes(recipient_id) &&
          c.type === 'discovery'
        );

        if (existing) {
          return Response.json({ success: true, data: existing, isNew: false });
        }

        const conversation = await base44.entities.Conversation.create({
          type: 'discovery',
          participant_ids: [user.email, recipient_id],
          status: 'active',
          unread_counts: {}
        });

        return Response.json({ success: true, data: conversation, isNew: true });
      }

      // ──────────────── BLOCK USER ────────────────
      case 'block_user': {
        const { blocked_id } = body;
        if (!blocked_id) {
          return Response.json({ error: 'blocked_id required' }, { status: 400 });
        }

        const result = await base44.entities.BlockedUser.create({
          blocker_id: user.email,
          blocked_id,
          reason: body.reason || ''
        });

        return Response.json({ success: true, data: result });
      }

      // ──────────────── FAVORITES ────────────────
      case 'update_favorite': {
        // update (add/remove item) on a favorites list
        const { list_id, items } = body;
        if (!list_id || !items) {
          return Response.json({ error: 'list_id and items required' }, { status: 400 });
        }

        const result = await base44.entities.Favorite.update(list_id, { items });
        return Response.json({ success: true, data: result });
      }

      case 'create_favorite_list': {
        const { name, items } = body;
        const result = await base44.entities.Favorite.create({
          owner_id: user.email,
          name: name || 'My Favorites',
          items: items || []
        });
        return Response.json({ success: true, data: result });
      }

      // ──────────────── COLLABORATIONS ────────────────
      case 'create_collaboration': {
        const collabData = body;

        const participant_ids = [
          user.email,
          ...((collabData.participant_ids || []).filter(id => id !== user.email))
        ];

        const collaboration = await base44.entities.Collaboration.create({
          ...collabData,
          participant_ids,
          status: 'draft'
        });

        return Response.json({ success: true, data: collaboration });
      }

      case 'update_collaboration': {
        const { collab_id, ...updateData } = body;
        if (!collab_id) {
          return Response.json({ error: 'collab_id required' }, { status: 400 });
        }

        // Verify the user is a participant
        const collabs = await base44.entities.Collaboration.filter({ id: collab_id });
        const collab = collabs[0];
        if (!collab) {
          return Response.json({ error: 'Collaboration not found' }, { status: 404 });
        }
        if (!collab.participant_ids?.includes(user.email)) {
          return Response.json({ error: 'Not a participant' }, { status: 403 });
        }

        const result = await base44.entities.Collaboration.update(collab_id, updateData);
        return Response.json({ success: true, data: result });
      }

      // ──────────────── REPORTS ────────────────
      case 'submit_report': {
        const { target_user_id, reason, details, target_content_type, target_content_id } = body;
        if (!target_user_id || !reason) {
          return Response.json({ error: 'target_user_id and reason required' }, { status: 400 });
        }

        const report = await base44.entities.Report.create({
          reporter_id: user.email,
          target_user_id,
          reason,
          details: details || '',
          target_content_type,
          target_content_id,
          status: 'pending'
        });

        return Response.json({ success: true, data: report });
      }

      // ──────────────── PROFILE UPDATE ────────────────
      case 'update_profile': {
        const { profile_id, profile_data } = body;
        if (!profile_id || !profile_data) {
          return Response.json({ error: 'profile_id and profile_data required' }, { status: 400 });
        }

        // Ensure user can only update own profile
        const profiles = await base44.entities.UserProfile.filter({ id: profile_id, user_id: user.email });
        if (!profiles[0]) {
          return Response.json({ error: 'Profile not found or access denied' }, { status: 403 });
        }

        // Strip any ban/admin fields (users cannot self-unban)
        const { banned, suspended, suspension_reason, legal_hold, is_admin, ...safeData } = profile_data;

        const result = await base44.entities.UserProfile.update(profile_id, safeData);
        return Response.json({ success: true, data: result });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Protected actions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});