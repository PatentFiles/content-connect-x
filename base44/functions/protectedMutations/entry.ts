/**
 * PROTECTED MUTATION LAYER
 * 
 * All sensitive user-initiated mutations go through here.
 * This ensures banned/suspended users cannot bypass enforcement.
 * 
 * This function validates the user, checks ban status, logs actions,
 * and delegates to the appropriate entity operation.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { checkUserBanStatus, createBlockedUserResponse } from './utils/banCheckUtils.js';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { operation, entity_name, data, id, query } = await req.json();

    if (!operation || !entity_name) {
      return Response.json({ error: 'Missing operation or entity_name' }, { status: 400 });
    }

    // Check ban status first
    const banCheck = await checkUserBanStatus(req, `${operation}_${entity_name}`);
    if (!banCheck.allowed) {
      return createBlockedUserResponse(banCheck);
    }

    const base44 = createClientFromRequest(req);
    const user = banCheck.user;

    // Perform the operation
    let result;

    switch (operation) {
      case 'create':
        // Add user context to created data
        result = await base44.entities[entity_name].create({
          ...data,
          ...getContextualFields(entity_name, user.email, operation)
        });
        break;

      case 'update':
        if (!id) throw new Error('ID required for update');
        result = await base44.entities[entity_name].update(id, data);
        break;

      case 'delete':
        if (!id) throw new Error('ID required for delete');
        result = await base44.entities[entity_name].delete(id);
        break;

      case 'filter':
        // Filter with user context
        result = await base44.entities[entity_name].filter({
          ...query,
          ...getContextualFilters(entity_name, user.email)
        });
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('Protected mutation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Add user context fields based on entity type
 */
function getContextualFields(entityName, userEmail, operation) {
  if (operation !== 'create') return {};

  const contextFields = {
    'Message': { sender_id: userEmail },
    'Conversation': { participant_ids: [userEmail] },
    'BlockedUser': { blocker_id: userEmail },
    'Favorite': { owner_id: userEmail },
    'Report': { reporter_id: userEmail },
    'Notification': { user_id: userEmail }
  };

  return contextFields[entityName] || {};
}

/**
 * Add user context filters based on entity type
 */
function getContextualFilters(entityName, userEmail) {
  const contextFilters = {
    'Message': { sender_id: userEmail },
    'BlockedUser': { blocker_id: userEmail },
    'Favorite': { owner_id: userEmail },
    'Report': { reporter_id: userEmail }
  };

  return contextFilters[entityName] || {};
}