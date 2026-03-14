import { base44 } from '@/api/base44Client';

/**
 * Write an immutable entry to CollaborationActivityLog.
 * Call this on every collaboration state change.
 */
export async function logCollaborationActivity({
  collaborationId,
  actorUserId,
  activityType,
  description,
  metadata = {},
}) {
  await base44.entities.CollaborationActivityLog.create({
    collaboration_id: collaborationId,
    actor_user_id: actorUserId,
    activity_type: activityType,
    description,
    metadata,
  }).catch(() => {}); // Never block the primary operation
}

/**
 * Write an immutable entry to AdminActionLog.
 * Call this on every admin write operation.
 */
export async function logAdminAction({
  adminUserId,
  actionType,
  targetEntityType,
  targetEntityId,
  beforeState = null,
  afterState = null,
  reason = '',
}) {
  await base44.entities.AdminActionLog.create({
    admin_user_id: adminUserId,
    action_type: actionType,
    target_entity_type: targetEntityType,
    target_entity_id: targetEntityId,
    before_state: beforeState,
    after_state: afterState,
    reason,
  }).catch(() => {});
}