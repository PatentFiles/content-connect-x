import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook to check if current user is RepObserver
 * Returns: { isRepObserver, canMessage, canEdit, canView }
 */
export function useRepObserverCheck(collaborationId, currentUserId) {
  const { data: participantRoles = [] } = useQuery({
    queryKey: ['participantRoles', collaborationId],
    queryFn: () => base44.entities.CollaborationParticipantRole.filter({
      collaboration_id: collaborationId,
      user_id: currentUserId
    }),
    enabled: !!collaborationId && !!currentUserId,
  });

  const role = participantRoles[0];
  const isRepObserver = role?.role === 'RepObserver';

  return {
    isRepObserver,
    canMessage: !isRepObserver || (role?.permissions?.can_message === true),
    canEdit: !isRepObserver, // RepObserver can never edit
    canView: true, // All roles can view
    role: role?.role
  };
}

/**
 * Log RepObserver access for audit
 */
export async function logRepObserverAccess(collaborationId, userId, action, details = {}) {
  try {
    await base44.entities.CollaborationActivityLog.create({
      collaboration_id: collaborationId,
      activity_type: 'REP_OBSERVER_ACCESS',
      user_id: userId,
      details: {
        action,
        ...details,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to log RepObserver access:', error);
  }
}