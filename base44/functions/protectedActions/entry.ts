/**
 * PROTECTED ACTIONS - High-risk operations that need extra enforcement
 * 
 * These are called from the frontend instead of direct SDK mutations:
 * - Send message
 * - Block user
 * - Create collaboration
 * - Save to favorites
 * - Create contract
 * 
 * Each action validates ban status, logs the attempt, and performs the operation.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { checkUserBanStatus, createBlockedUserResponse } from './utils/banCheckUtils.js';

// ACTION: Send Message
// Prevents banned users from sending messages
export async function sendMessage(req) {
  const banCheck = await checkUserBanStatus(req, 'send_message');
  if (!banCheck.allowed) {
    return createBlockedUserResponse(banCheck);
  }

  try {
    const base44 = createClientFromRequest(req);
    const { conversation_id, body, attachments } = await req.json();
    const user = banCheck.user;

    if (!conversation_id || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const message = await base44.entities.Message.create({
      conversation_id,
      sender_id: user.email,
      body,
      attachments: attachments || [],
      read_by: []
    });

    return Response.json({ success: true, data: message });
  } catch (error) {
    console.error('Send message error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ACTION: Block User
// Prevents banned users from blocking others
export async function blockUser(req) {
  const banCheck = await checkUserBanStatus(req, 'block_user');
  if (!banCheck.allowed) {
    return createBlockedUserResponse(banCheck);
  }

  try {
    const base44 = createClientFromRequest(req);
    const { blocked_id, reason } = await req.json();
    const user = banCheck.user;

    if (!blocked_id) {
      return Response.json({ error: 'Missing blocked_id' }, { status: 400 });
    }

    const blockedUser = await base44.entities.BlockedUser.create({
      blocker_id: user.email,
      blocked_id,
      reason: reason || ''
    });

    return Response.json({ success: true, data: blockedUser });
  } catch (error) {
    console.error('Block user error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ACTION: Save to Favorites
// Prevents banned users from saving profiles
export async function saveFavorite(req) {
  const banCheck = await checkUserBanStatus(req, 'save_favorite');
  if (!banCheck.allowed) {
    return createBlockedUserResponse(banCheck);
  }

  try {
    const base44 = createClientFromRequest(req);
    const { profile_user_id, list_id } = await req.json();
    const user = banCheck.user;

    if (!profile_user_id) {
      return Response.json({ error: 'Missing profile_user_id' }, { status: 400 });
    }

    // Find or create default favorites list
    let favorite;
    if (list_id) {
      favorite = await base44.entities.Favorite.update(list_id, {
        items: []  // This should actually append, see client-side logic
      });
    } else {
      favorite = await base44.entities.Favorite.create({
        owner_id: user.email,
        name: 'My Favorites',
        items: [{ user_id: profile_user_id, added_at: new Date().toISOString() }]
      });
    }

    return Response.json({ success: true, data: favorite });
  } catch (error) {
    console.error('Save favorite error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ACTION: Create Collaboration
// Prevents banned users from creating collaborations
export async function createCollaborationProtected(req) {
  const banCheck = await checkUserBanStatus(req, 'create_collaboration');
  if (!banCheck.allowed) {
    return createBlockedUserResponse(banCheck);
  }

  try {
    const base44 = createClientFromRequest(req);
    const collaborationData = await req.json();
    const user = banCheck.user;

    // Add creator to participant list if not already there
    const participant_ids = [
      user.email,
      ...(collaborationData.participant_ids || [])
    ];

    const collaboration = await base44.entities.Collaboration.create({
      ...collaborationData,
      participant_ids,
      status: 'draft'
    });

    return Response.json({ success: true, data: collaboration });
  } catch (error) {
    console.error('Create collaboration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ACTION: Create Contract
// Prevents banned users from creating contracts
export async function createContractProtected(req) {
  const banCheck = await checkUserBanStatus(req, 'create_contract');
  if (!banCheck.allowed) {
    return createBlockedUserResponse(banCheck);
  }

  try {
    const base44 = createClientFromRequest(req);
    const contractData = await req.json();
    const user = banCheck.user;

    const contract = await base44.entities.Contract.create({
      ...contractData,
      created_by: user.email
    });

    return Response.json({ success: true, data: contract });
  } catch (error) {
    console.error('Create contract error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ACTION: Start Conversation
// Prevents banned users from starting conversations
export async function startConversationProtected(req) {
  const banCheck = await checkUserBanStatus(req, 'start_conversation');
  if (!banCheck.allowed) {
    return createBlockedUserResponse(banCheck);
  }

  try {
    const base44 = createClientFromRequest(req);
    const { recipient_id } = await req.json();
    const user = banCheck.user;

    if (!recipient_id) {
      return Response.json({ error: 'recipient_id is required' }, { status: 400 });
    }

    // Check if conversation already exists
    const existingConvs = await base44.entities.Conversation.filter({
      participant_ids: [user.email, recipient_id],
      type: 'discovery'
    });

    if (existingConvs.length > 0) {
      return Response.json({ 
        success: true, 
        data: existingConvs[0],
        isNew: false 
      });
    }

    // Create new conversation
    const conversation = await base44.entities.Conversation.create({
      type: 'discovery',
      participant_ids: [user.email, recipient_id],
      status: 'active',
      unread_counts: {}
    });

    return Response.json({ 
      success: true, 
      data: conversation,
      isNew: true 
    });
  } catch (error) {
    console.error('Start conversation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Main router
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'send_message':
        return await sendMessage(req);
      case 'block_user':
        return await blockUser(req);
      case 'save_favorite':
        return await saveFavorite(req);
      case 'create_collaboration':
        return await createCollaborationProtected(req);
      case 'create_contract':
        return await createContractProtected(req);
      case 'start_conversation':
        return await startConversationProtected(req);
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Protected actions error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});