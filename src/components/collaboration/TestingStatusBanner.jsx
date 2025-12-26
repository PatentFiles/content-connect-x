import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import CCButton from '@/components/ui-custom/CCButton';
import { format } from 'date-fns';

export default function TestingStatusBanner({ collaboration, currentUserId }) {
  const queryClient = useQueryClient();

  // Fetch testing requirement
  const { data: testingReqs = [] } = useQuery({
    queryKey: ['testingRequirement', collaboration.id],
    queryFn: () => base44.entities.TestingRequirement.filter({ 
      collaboration_id: collaboration.id 
    }),
  });

  const testingReq = testingReqs[0];

  // Don't show if testing not required
  if (!testingReq || !testingReq.is_required) {
    return null;
  }

  // Fetch all testing credentials
  const { data: allCredentials = [] } = useQuery({
    queryKey: ['testingCredentials'],
    queryFn: () => base44.entities.TestingCredential.filter({}),
  });

  // Check satisfaction for each participant
  const participantIds = collaboration.participant_ids || [];
  const satisfactionResults = participantIds.map(participantId => {
    const participantCredentials = allCredentials.filter(c => c.user_id === participantId);
    
    let satisfied = false;

    if (testingReq.require_new_upload) {
      const collabSpecific = participantCredentials.find(c => 
        c.submitted_for_collaboration_id === collaboration.id &&
        c.status_badge === 'valid'
      );
      if (collabSpecific) satisfied = true;
    } else if (testingReq.require_valid_credential) {
      const validCredential = participantCredentials.find(c => {
        if (c.status_badge !== 'valid') return false;
        if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
        return true;
      });
      if (validCredential) satisfied = true;
    }

    return { participantId, satisfied };
  });

  const allSatisfied = satisfactionResults.every(r => r.satisfied);
  const currentUserSatisfied = satisfactionResults.find(r => r.participantId === currentUserId)?.satisfied;

  // Mark as satisfied when all complete
  const markSatisfiedMutation = useMutation({
    mutationFn: async () => {
      await base44.functions.invoke('markTestingRequirementSatisfied', {
        collaboration_id: collaboration.id,
        testing_requirement_id: testingReq.id,
        satisfied_by: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['testingRequirement']);
      queryClient.invalidateQueries(['collaborationActivity']);
    }
  });

  // Auto-mark when satisfied
  useEffect(() => {
    if (allSatisfied && !testingReq.satisfied_at && testingReq.status !== 'FAILED') {
      markSatisfiedMutation.mutate();
    }
  }, [allSatisfied, testingReq.satisfied_at, testingReq.status]);

  // Prefer stored satisfied state
  const isMarkedSatisfied = !!testingReq.satisfied_at;
  const effectivelySatisfied = isMarkedSatisfied || allSatisfied;

  // Determine banner state
  const now = new Date();
  const deadline = testingReq.deadline_at ? new Date(testingReq.deadline_at) : null;
  const hoursUntilDeadline = deadline ? (deadline - now) / (1000 * 60 * 60) : null;

  let bannerState = 'pending';
  let icon = Clock;
  let bgColor = 'bg-yellow-500/10';
  let borderColor = 'border-yellow-500/30';
  let iconColor = 'text-yellow-500';
  let title = 'Testing Required';
  let subtitle = '';
  let showUploadAction = !currentUserSatisfied && testingReq.status !== 'FAILED';

  if (testingReq.status === 'FAILED') {
    bannerState = 'failed';
    icon = XCircle;
    bgColor = 'bg-red-500/10';
    borderColor = 'border-red-500/30';
    iconColor = 'text-red-500';
    title = 'Testing Deadline Missed';
    subtitle = 'Required testing was not completed. Collaboration has been cancelled.';
    showUploadAction = false;
  } else if (effectivelySatisfied) {
    bannerState = 'complete';
    icon = CheckCircle2;
    bgColor = 'bg-green-500/10';
    borderColor = 'border-green-500/30';
    iconColor = 'text-green-500';
    title = 'Testing Complete';
    subtitle = isMarkedSatisfied 
      ? `Satisfied on ${format(new Date(testingReq.satisfied_at), 'PPp')}`
      : 'All required testing has been submitted and verified.';
    showUploadAction = false;
  } else if (hoursUntilDeadline !== null && hoursUntilDeadline < 24) {
    bannerState = 'at_risk';
    icon = AlertTriangle;
    bgColor = 'bg-orange-500/10';
    borderColor = 'border-orange-500/30';
    iconColor = 'text-orange-500';
    title = 'Testing Deadline Approaching';
    subtitle = `One or more participants have not completed required testing. ${Math.max(0, Math.floor(hoursUntilDeadline))} hours remaining.`;
  } else {
    bannerState = 'pending';
    icon = Clock;
    bgColor = 'bg-yellow-500/10';
    borderColor = 'border-yellow-500/30';
    iconColor = 'text-yellow-500';
    title = 'Testing Required';
    subtitle = deadline 
      ? `Testing required by ${format(deadline, 'PPp')}`
      : 'Waiting on required participants';
  }

  const Icon = icon;

  const visibilityLabels = {
    'PRIVATE': 'Private',
    'COLLABORATION_ROOM_ONLY': 'Collaboration Room Only',
    'VERIFIED_COLLABORATORS': 'Verified Collaborators'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 mb-6',
        bgColor,
        borderColor
      )}
    >
      <div className="flex items-start gap-4">
        <div className={cn('p-2 rounded-lg bg-[#0B0F14]/50', iconColor)}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="font-semibold text-[#E8EEF9] mb-1">{title}</h4>
              <p className="text-sm text-[#9AA6BC]">{subtitle}</p>
              
              {bannerState === 'pending' && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#9AA6BC]">
                  {deadline && (
                    <div>Deadline: <span className="text-[#E8EEF9]">{format(deadline, 'PPp')}</span></div>
                  )}
                  <div>Visibility: <span className="text-[#E8EEF9]">{visibilityLabels[testingReq.visibility_level]}</span></div>
                </div>
              )}
            </div>

            {showUploadAction && (
              <CCButton
                variant="primary"
                size="sm"
                onClick={() => {
                  // Navigate to settings or testing upload
                  window.location.href = '/pages/Settings?tab=testing';
                }}
              >
                Upload Testing Now
              </CCButton>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}