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
  const isRequired = !!(testingReq && testingReq.is_required);

  // Fetch collaboration testing policy
  const { data: policies = [] } = useQuery({
    queryKey: ['testingPolicy', collaboration.id],
    queryFn: () => base44.entities.CollaborationTestingPolicy.filter({ 
      collaboration_id: collaboration.id 
    }),
  });

  const policy = policies[0];

  // Fetch all testing credentials — only needed when testing is required
  const { data: allCredentials = [] } = useQuery({
    queryKey: ['testingCredentials'],
    queryFn: () => base44.entities.TestingCredential.filter({}),
    enabled: isRequired,
  });

  // Fetch creator details for policy enforcement
  const { data: allCreatorDetails = [] } = useQuery({
    queryKey: ['allCreatorDetails'],
    queryFn: () => base44.entities.CreatorDetails.list(),
    enabled: isRequired && !!policy,
  });

  // Check satisfaction for each participant (safe even when testingReq is undefined)
  const participantIds = collaboration.participant_ids || [];
  const satisfactionResults = isRequired ? participantIds.map(participantId => {
    const participantCredentials = allCredentials.filter(c => c.user_id === participantId);
    const creatorDetails = allCreatorDetails.find(d => d.user_id === participantId);
    
    let satisfied = false;
    let policyViolations = [];

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

    // Apply policy enforcement
    if (policy && satisfied && creatorDetails?.health_testing) {
      const testing = creatorDetails.health_testing;

      if (policy.require_verified_testing && testing.testing_provider_type === 'self_reported' && !policy.allow_self_reported) {
        satisfied = false;
        policyViolations.push('Self-reported testing not allowed');
      }

      if (policy.require_full_panel_within_days) {
        const recencyMap = {
          'within_14_days': 14,
          'within_30_days': 30,
          'within_60_days': 60,
          'older_than_60_days': 999,
          'unknown': 999,
        };
        const testDays = recencyMap[testing.testing_recency] || 999;
        if (testDays > policy.require_full_panel_within_days) {
          satisfied = false;
          policyViolations.push(`Testing older than ${policy.require_full_panel_within_days} days`);
        }
      }

      if (policy.require_hiv_negative_only && testing.hiv_status !== 'hiv_negative') {
        satisfied = false;
        policyViolations.push('HIV negative status required');
      } else if (!policy.require_hiv_negative_only && !policy.allow_hiv_undetectable && testing.hiv_status === 'hiv_positive_undetectable') {
        satisfied = false;
        policyViolations.push('HIV undetectable (U=U) not allowed by policy');
      }

      if (testing.sti_panel_status === 'expired' || testing.sti_panel_status === 'not_tested') {
        satisfied = false;
        policyViolations.push('Valid STI panel required');
      }
    }

    return { participantId, satisfied, policyViolations };
  }) : [];

  const allSatisfied = isRequired && satisfactionResults.length > 0 && satisfactionResults.every(r => r.satisfied);
  const currentUserSatisfied = satisfactionResults.find(r => r.participantId === currentUserId)?.satisfied;

  // Mark as satisfied when all complete — always declared, guarded inside
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

  // Auto-mark when satisfied — always declared, guarded inside
  useEffect(() => {
    if (!isRequired || !testingReq) return;
    if (allSatisfied && !testingReq.satisfied_at && testingReq.status !== 'FAILED') {
      markSatisfiedMutation.mutate();
    }
  }, [isRequired, allSatisfied, testingReq?.satisfied_at, testingReq?.status]);

  // Don't render if testing not required
  if (!isRequired) return null;

  // Prefer stored satisfied state
  const isMarkedSatisfied = !!testingReq.satisfied_at;
  const effectivelySatisfied = isMarkedSatisfied || allSatisfied;

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
    subtitle = deadline 
      ? `Testing required by ${format(deadline, 'PPp')}`
      : 'Waiting on required participants';
  }

  const Icon = icon;

  const visibilityLabels = {
    'PUBLIC': 'Public',
    'PRIVATE': 'Private',
    'COLLABORATION_ROOM_ONLY': 'Collaboration Room Only',
    'VERIFIED_COLLABORATORS': 'Verified Collaborators'
  };

  const hasViolations = satisfactionResults.some(r => r.policyViolations?.length > 0);
  const violationDetails = satisfactionResults.filter(r => r.policyViolations?.length > 0);

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
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-3 text-xs text-[#9AA6BC]">
                    {deadline && (
                      <div>Deadline: <span className="text-[#E8EEF9]">{format(deadline, 'PPp')}</span></div>
                    )}
                    <div>Visibility: <span className="text-[#E8EEF9]">{visibilityLabels[testingReq.visibility_level]}</span></div>
                  </div>
                  {hasViolations && (
                    <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-2 space-y-1">
                      <p className="text-xs font-medium text-[#EF4444]">Policy Violations Detected:</p>
                      {violationDetails.map((v, idx) => (
                        <div key={idx} className="text-xs text-[#9AA6BC]">
                          • {v.policyViolations.join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {showUploadAction && (
              <CCButton
                variant="primary"
                size="sm"
                onClick={() => {
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