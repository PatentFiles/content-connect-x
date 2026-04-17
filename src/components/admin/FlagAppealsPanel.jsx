import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { CCSkeletonLoader } from '@/components/ui-custom/CCLoading';
import { createNotification } from '@/components/notifications/notificationHelpers';
import { toast } from 'sonner';

export default function FlagAppealsPanel() {
  const [expanded, setExpanded] = useState(null);
  const [responseText, setResponseText] = useState({});
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: appeals = [], isLoading } = useQuery({
    queryKey: ['allFlagAppeals'],
    queryFn: () => base44.entities.FlagAppeal.list('-created_date', 100),
  });

  // Fetch profiles for display names
  const appellantIds = [...new Set(appeals.map(a => a.user_id))];
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['appealProfiles', appellantIds.join(',')],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: appellantIds.length > 0,
  });
  const profileMap = Object.fromEntries(allProfiles.map(p => [p.user_id, p]));

  const resolveMutation = useMutation({
    mutationFn: async ({ appealId, appealUserId, status, response }) => {
      await base44.entities.FlagAppeal.update(appealId, {
        status,
        admin_response: response,
        reviewed_by: user?.email,
        reviewed_at: new Date().toISOString(),
      });

      const isCleared = status === 'cleared';
      await createNotification({
        userId: appealUserId,
        type: 'system_announcements',
        actorUserId: user?.email,
        title: isCleared ? 'Flag Appeal Approved ✓' : 'Flag Appeal Decision',
        body: response,
        relatedEntityType: 'FlagAppeal',
        relatedEntityId: appealId,
        actionUrl: '/ModerationFlags',
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['allFlagAppeals'] });
      setExpanded(null);
      setResponseText(prev => ({ ...prev, [vars.appealId]: '' }));
      toast.success('Appeal resolved and user notified.');
    },
  });

  const pending = appeals.filter(a => a.status === 'pending');
  const resolved = appeals.filter(a => a.status !== 'pending');

  const STATUS_CONFIG = {
    pending:  { label: 'Pending',      variant: 'warning' },
    reviewed: { label: 'Reviewed',     variant: 'primary' },
    upheld:   { label: 'Flag Upheld',  variant: 'danger'  },
    cleared:  { label: 'Flag Cleared', variant: 'success' },
  };

  const AppealCard = ({ appeal }) => {
    const profile = profileMap[appeal.user_id];
    const isOpen = expanded === appeal.id;
    const response = responseText[appeal.id] || '';

    return (
      <CCCard padding="md" className="mb-3">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(isOpen ? null : appeal.id)}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
              <Flag className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#E8EEF9]">
                {profile?.display_name || appeal.user_id} — Flag #{appeal.flag_index}
              </p>
              <p className="text-xs text-[#6B7A94]">{new Date(appeal.created_date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CCBadge variant={STATUS_CONFIG[appeal.status]?.variant || 'default'} size="sm">
              {STATUS_CONFIG[appeal.status]?.label}
            </CCBadge>
            {isOpen ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
          </div>
        </div>

        {isOpen && (
          <div className="mt-4 space-y-4 border-t border-[#263248] pt-4">
            <div className="bg-[#121824] rounded-lg p-3">
              <p className="text-xs font-semibold text-[#9AA6BC] mb-1">User's Appeal</p>
              <p className="text-sm text-[#E8EEF9]">{appeal.appeal_message}</p>
            </div>

            {appeal.admin_response ? (
              <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-[#9AA6BC] mb-1">Your Response</p>
                <p className="text-sm text-[#E8EEF9]">{appeal.admin_response}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={response}
                  onChange={e => setResponseText(prev => ({ ...prev, [appeal.id]: e.target.value }))}
                  placeholder="Write a detailed response explaining your decision. This will be sent directly to the user."
                  rows={4}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 resize-none"
                />
                <div className="flex gap-2">
                  <CCButton
                    variant="success"
                    size="sm"
                    icon={CheckCircle}
                    disabled={!response.trim()}
                    loading={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ appealId: appeal.id, appealUserId: appeal.user_id, status: 'cleared', response })}
                  >
                    Clear Flag
                  </CCButton>
                  <CCButton
                    variant="danger"
                    size="sm"
                    icon={AlertCircle}
                    disabled={!response.trim()}
                    loading={resolveMutation.isPending}
                    onClick={() => resolveMutation.mutate({ appealId: appeal.id, appealUserId: appeal.user_id, status: 'upheld', response })}
                  >
                    Uphold Flag
                  </CCButton>
                </div>
              </div>
            )}
          </div>
        )}
      </CCCard>
    );
  };

  if (isLoading) return <div className="space-y-3"><CCSkeletonLoader className="h-16 w-full" /><CCSkeletonLoader className="h-16 w-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#F59E0B]" />
          Pending Appeals ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <CCEmpty icon={CheckCircle} title="No pending appeals" description="All flag appeals have been reviewed." />
        ) : (
          pending.map(appeal => <AppealCard key={appeal.id} appeal={appeal} />)
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#9AA6BC] mb-3">Resolved ({resolved.length})</h3>
          {resolved.map(appeal => <AppealCard key={appeal.id} appeal={appeal} />)}
        </div>
      )}
    </div>
  );
}