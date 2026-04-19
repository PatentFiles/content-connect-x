import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Flag, Shield, CheckCircle, Clock, AlertCircle, ChevronLeft, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import { createNotification } from '@/components/notifications/notificationHelpers';
import { toast } from 'sonner';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';

const STATUS_CONFIG = {
  pending:  { label: 'Under Review', variant: 'warning', icon: Clock },
  reviewed: { label: 'Reviewed',     variant: 'primary', icon: CheckCircle },
  upheld:   { label: 'Flag Upheld',  variant: 'danger',  icon: AlertCircle },
  cleared:  { label: 'Flag Cleared', variant: 'success', icon: CheckCircle },
};

export default function ModerationFlags() {
  const [appealMessage, setAppealMessage] = useState('');
  const [appealingIndex, setAppealingIndex] = useState(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: reputationScores = [] } = useQuery({
    queryKey: ['myReputationScore', user?.email],
    queryFn: () => base44.entities.ReputationScore.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: appeals = [], isLoading: appealsLoading } = useQuery({
    queryKey: ['myFlagAppeals', user?.email],
    queryFn: () => base44.entities.FlagAppeal.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const score = reputationScores[0];
  const flagCount = score?.factors?.moderation_flags || 0;

  // Find all admin users to notify
  const { data: adminProfiles = [] } = useQuery({
    queryKey: ['adminProfiles'],
    queryFn: () => base44.entities.UserProfile.filter({ is_admin: true }),
    enabled: !!user?.email,
  });

  const submitAppealMutation = useMutation({
    mutationFn: async ({ flagIndex, message }) => {
      const appeal = await base44.entities.FlagAppeal.create({
        user_id: user.email,
        flag_index: flagIndex,
        appeal_message: message,
        status: 'pending',
      });

      // Notify all admins
      await Promise.all(adminProfiles.map(admin =>
        createNotification({
          userId: admin.user_id,
          type: 'system_announcements',
          actorUserId: user.email,
          title: 'Flag Appeal Submitted',
          body: `A user has submitted an appeal for moderation flag #${flagIndex}. Please review in the Admin Dashboard.`,
          relatedEntityType: 'FlagAppeal',
          relatedEntityId: appeal.id,
          actionUrl: '/AdminDashboard?tab=flag_appeals',
        })
      ));

      return appeal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myFlagAppeals', user?.email] });
      setAppealingIndex(null);
      setAppealMessage('');
      toast.success('Appeal submitted. Admins have been notified.');
    },
  });

  if (userLoading || appealsLoading) return <CCLoadingScreen message="Loading..." />;

  const flags = Array.from({ length: flagCount }, (_, i) => i + 1);
  const appealsByIndex = Object.fromEntries(appeals.map(a => [a.flag_index, a]));

  return (
    <FeatureRouteGuard flag="moderation_flags" requiresSubscription={false}>
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link to={createPageUrl('Dashboard')}>
            <CCButton variant="ghost" size="sm" icon={ChevronLeft}>Back</CCButton>
          </Link>
          <div className="text-center mt-2">
            <h1 className="text-xl font-semibold text-[#E8EEF9]">Moderation Flags</h1>
            <p className="text-xs text-[#6B7A94] mt-0.5">View and appeal flags on your account</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex gap-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 mb-6">
          <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E8EEF9] mb-1">About Moderation Flags</p>
            <p className="text-xs text-[#9AA6BC]">
              Flags are issued by the platform moderation team based on reports or policy violations.
              Each flag affects your trust standing score. You can submit one appeal per flag —
              an admin will review it and respond with a detailed decision.
            </p>
          </div>
        </div>

        {flagCount === 0 ? (
          <CCCard padding="lg" className="text-center">
            <Shield className="w-10 h-10 text-[#22C55E] mx-auto mb-3" />
            <p className="text-[#E8EEF9] font-medium">No active flags</p>
            <p className="text-sm text-[#6B7A94] mt-1">Your account is in good standing.</p>
          </CCCard>
        ) : (
          <div className="space-y-4">
            {flags.map((flagNum) => {
              const appeal = appealsByIndex[flagNum];
              const isAppealing = appealingIndex === flagNum;
              const statusCfg = appeal ? STATUS_CONFIG[appeal.status] : null;
              const StatusIcon = statusCfg?.icon;

              return (
                <motion.div key={flagNum} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <CCCard padding="lg">
                    <div className="text-center mb-3">
                      <div className="w-8 h-8 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mx-auto mb-2">
                        <Flag className="w-4 h-4 text-[#F59E0B]" />
                      </div>
                      <p className="text-sm font-semibold text-[#E8EEF9]">Moderation Flag #{flagNum}</p>
                      <p className="text-xs text-[#6B7A94]">Issued by platform moderation team · Details are private</p>
                      {statusCfg && (
                        <div className="flex justify-center mt-2">
                          <CCBadge variant={statusCfg.variant} size="sm">
                            {StatusIcon && <StatusIcon className="w-3 h-3 mr-1 inline" />}
                            {statusCfg.label}
                          </CCBadge>
                        </div>
                      )}
                    </div>

                    {/* Appeal result */}
                    {appeal?.admin_response && (
                      <div className={`rounded-lg p-3 mb-3 border ${appeal.status === 'cleared' ? 'bg-[#22C55E]/10 border-[#22C55E]/30' : 'bg-[#EF4444]/10 border-[#EF4444]/30'}`}>
                        <p className="text-xs font-semibold text-[#E8EEF9] mb-1">Admin Response</p>
                        <p className="text-sm text-[#9AA6BC]">{appeal.admin_response}</p>
                      </div>
                    )}

                    {/* User's appeal message (if submitted) */}
                    {appeal && !appeal.admin_response && (
                      <div className="bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-lg p-3 mb-3">
                        <p className="text-xs font-semibold text-[#E8EEF9] mb-1">Your Appeal</p>
                        <p className="text-sm text-[#9AA6BC]">{appeal.appeal_message}</p>
                        <p className="text-xs text-[#6B7A94] mt-1">Submitted · Awaiting admin review</p>
                      </div>
                    )}

                    {/* Appeal form */}
                    {!appeal && (
                      <>
                        {isAppealing ? (
                          <div className="space-y-3">
                            <textarea
                              value={appealMessage}
                              onChange={e => setAppealMessage(e.target.value)}
                              placeholder="Explain why you believe this flag should be removed. Be clear and specific."
                              rows={4}
                              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <CCButton variant="outline" size="sm" onClick={() => { setAppealingIndex(null); setAppealMessage(''); }}>
                                Cancel
                              </CCButton>
                              <CCButton
                                variant="primary"
                                size="sm"
                                icon={Send}
                                disabled={!appealMessage.trim()}
                                loading={submitAppealMutation.isPending}
                                onClick={() => submitAppealMutation.mutate({ flagIndex: flagNum, message: appealMessage })}
                              >
                                Submit Appeal
                              </CCButton>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center">
                            <CCButton variant="outline" size="sm" onClick={() => setAppealingIndex(flagNum)}>
                              Appeal This Flag
                            </CCButton>
                          </div>
                        )}
                      </>
                    )}
                  </CCCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      </div>
    </FeatureRouteGuard>
  );
}