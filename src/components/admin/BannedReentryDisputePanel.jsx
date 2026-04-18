/**
 * BannedReentryDisputePanel — Admin review panel for banned identity re-entry disputes.
 * Extends the existing identity consistency / verification architecture.
 * Surfaces prior ban context, identity match signals, and moderation history.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  UserX, CheckCircle, XCircle, AlertTriangle, MessageSquare,
  ShieldAlert, Clock, ChevronDown, ChevronUp, Info
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import CCModal from '@/components/ui-custom/CCModal';

const STATUS_CONFIG = {
  pending:              { variant: 'warning',  label: 'Pending Review' },
  under_review:         { variant: 'primary',  label: 'Under Review' },
  approved:             { variant: 'success',  label: 'Approved' },
  approved_probation:   { variant: 'accent',   label: 'Approved w/ Probation' },
  denied:               { variant: 'danger',   label: 'Denied' },
  more_info_requested:  { variant: 'default',  label: 'More Info Requested' },
};

function DisputeCard({ dispute, profiles, flags, actionLogs, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState('');
  const [moreInfoText, setMoreInfoText] = useState('');
  const [probationConfig, setProbationConfig] = useState({
    restricted_messaging: true,
    elevated_moderation: true,
    no_hosting: false,
    no_accelerated_payouts: false,
  });

  const submitterProfile = profiles.find(p => p.user_id === dispute.submitter_user_id);
  const priorProfile = profiles.find(p => p.user_id === dispute.prior_banned_user_id);
  const relatedFlag = flags.find(f => f.id === dispute.identity_flag_id);
  const statusConf = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.pending;

  // Prior moderation actions against the banned account
  const priorActions = actionLogs.filter(
    l => l.target_id === dispute.prior_banned_user_id || l.target_user_id === dispute.prior_banned_user_id
  );

  return (
    <CCCard padding="md" className="border-l-4 border-l-[#EF4444]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#EF4444]/20 flex items-center justify-center flex-shrink-0">
            <UserX className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <CCBadge variant={statusConf.variant} size="sm">{statusConf.label}</CCBadge>
            </div>
            <p className="text-sm font-medium text-[#E8EEF9]">
              {submitterProfile?.display_name || dispute.submitter_user_id}
            </p>
            {priorProfile && (
              <p className="text-xs text-[#9AA6BC]">
                Prior banned account: <span className="text-[#EF4444]">{priorProfile.display_name || dispute.prior_banned_user_id}</span>
              </p>
            )}
            <p className="text-xs text-[#6B7A94] mt-0.5">
              Submitted {format(new Date(dispute.created_date), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-[#6B7A94] hover:text-[#E8EEF9] p-1 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#263248] space-y-5">
          {/* Dispute statement */}
          <div>
            <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">User's Statement</p>
            <p className="text-sm text-[#E8EEF9] bg-[#0D1520] rounded-lg p-3 leading-relaxed">
              {dispute.dispute_statement}
            </p>
          </div>

          {/* Supplemental statement */}
          {dispute.supplemental_statement && (
            <div>
              <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Follow-up Statement</p>
              <p className="text-sm text-[#E8EEF9] bg-[#0D1520] rounded-lg p-3 leading-relaxed">
                {dispute.supplemental_statement}
              </p>
            </div>
          )}

          {/* Prior ban context */}
          {priorProfile && (
            <div>
              <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Prior Ban Context</p>
              <div className="bg-[#1A0A0A] border border-[#EF4444]/30 rounded-lg p-3 space-y-1.5 text-sm">
                <p><span className="text-[#9AA6BC]">Ban reason: </span><span className="text-[#E8EEF9]">{priorProfile.suspension_reason || 'Not recorded'}</span></p>
                <p><span className="text-[#9AA6BC]">Category: </span><span className="text-[#E8EEF9] capitalize">{priorProfile.suspension_category?.replace(/_/g, ' ') || 'Unknown'}</span></p>
                {priorProfile.suspension_start_at && (
                  <p><span className="text-[#9AA6BC]">Banned: </span><span className="text-[#E8EEF9]">{format(new Date(priorProfile.suspension_start_at), 'MMM d, yyyy')}</span></p>
                )}
              </div>
            </div>
          )}

          {/* Identity match context */}
          {relatedFlag && (
            <div>
              <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Identity Match Signals</p>
              <div className="bg-[#0D1520] border border-[#263248] rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {(relatedFlag.reason_codes || []).map(code => (
                    <span key={code} className="px-2 py-0.5 text-xs bg-[#1A2438] border border-[#263248] rounded-full text-[#9AA6BC]">
                      {code.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
                {relatedFlag.match_details && (
                  <p className="text-xs text-[#9AA6BC] italic">{relatedFlag.match_details}</p>
                )}
                <CCBadge variant={relatedFlag.confidence === 'high' ? 'danger' : relatedFlag.confidence === 'medium' ? 'warning' : 'default'} size="sm">
                  {relatedFlag.confidence} confidence match
                </CCBadge>
              </div>
            </div>
          )}

          {/* Prior moderation history */}
          {priorActions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Prior Moderation History ({priorActions.length} actions)</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {priorActions.slice(0, 10).map(log => (
                  <div key={log.id} className="flex items-center justify-between text-xs p-2 bg-[#0D1520] rounded border border-[#263248]">
                    <span className="text-[#E8EEF9] font-medium capitalize">{log.action?.replace(/_/g, ' ')}</span>
                    <span className="text-[#6B7A94]">{log.created_date ? format(new Date(log.created_date), 'MMM d, yyyy') : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* More info request text */}
          {dispute.more_info_request && (
            <div className="p-3 bg-[#151D2B] border border-[#4F8CFF]/30 rounded-lg text-sm">
              <p className="text-xs font-semibold text-[#4F8CFF] mb-1">Information Requested from User</p>
              <p className="text-[#E8EEF9]">{dispute.more_info_request}</p>
            </div>
          )}

          {/* Admin decision area */}
          {['pending', 'under_review', 'more_info_requested'].includes(dispute.status) && (
            <div className="space-y-3 pt-2 border-t border-[#263248]">
              <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide">Admin Decision</p>
              <textarea
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[70px]"
                placeholder="Document your decision..."
              />

              {/* Probation config (shown if admin selects probation) */}
              <div className="p-3 bg-[#0D1520] border border-[#263248] rounded-lg space-y-2">
                <p className="text-xs text-[#9AA6BC] mb-1">Probation config (if approving with probation):</p>
                {[
                  { key: 'restricted_messaging', label: 'Restricted Messaging' },
                  { key: 'no_hosting', label: 'No Hosting' },
                  { key: 'no_accelerated_payouts', label: 'No Accelerated Payouts' },
                  { key: 'elevated_moderation', label: 'Elevated Moderation' },
                ].map(r => (
                  <label key={r.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={probationConfig[r.key] || false}
                      onChange={(e) => setProbationConfig(prev => ({ ...prev, [r.key]: e.target.checked }))}
                      className="w-3 h-3"
                    />
                    <span className="text-xs text-[#E8EEF9]">{r.label}</span>
                  </label>
                ))}
              </div>

              {dispute.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <CCButton variant="primary" size="sm" icon={Info} onClick={() => onAction(dispute.id, 'under_review', decision, null)}>
                    Mark Under Review
                  </CCButton>
                  <CCButton
                    variant="outline"
                    size="sm"
                    icon={MessageSquare}
                    onClick={() => onAction(dispute.id, 'more_info_requested', decision, null, moreInfoText)}
                  >
                    Request More Info
                  </CCButton>
                </div>
              )}

              {['pending', 'under_review', 'more_info_requested'].includes(dispute.status) && (
                <div className="flex flex-wrap gap-2">
                  <CCButton variant="success" size="sm" icon={CheckCircle} onClick={() => onAction(dispute.id, 'approved', decision, null)}>
                    Approve Reinstatement
                  </CCButton>
                  <CCButton variant="accent" size="sm" icon={AlertTriangle} onClick={() => onAction(dispute.id, 'approved_probation', decision, probationConfig)}>
                    Approve w/ Probation
                  </CCButton>
                  <CCButton variant="danger" size="sm" icon={XCircle} onClick={() => onAction(dispute.id, 'denied', decision, null)}>
                    Deny Permanently
                  </CCButton>
                </div>
              )}

              {dispute.status === 'pending' && (
                <div>
                  <label className="block text-xs text-[#9AA6BC] mb-1">More Info Request Text</label>
                  <textarea
                    value={moreInfoText}
                    onChange={(e) => setMoreInfoText(e.target.value)}
                    className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none min-h-[50px]"
                    placeholder="What information do you need from the user?"
                  />
                </div>
              )}
            </div>
          )}

          {/* Decision already made */}
          {!['pending', 'under_review', 'more_info_requested'].includes(dispute.status) && dispute.admin_decision && (
            <div className="p-3 bg-[#151D2B] border border-[#263248] rounded-lg text-sm">
              <p className="text-xs text-[#9AA6BC] mb-1">Admin Decision by {dispute.admin_reviewer_id}</p>
              <p className="text-[#E8EEF9]">{dispute.admin_decision}</p>
              {dispute.reviewed_at && (
                <p className="text-xs text-[#6B7A94] mt-1">{format(new Date(dispute.reviewed_at), 'MMM d, yyyy HH:mm')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </CCCard>
  );
}

export default function BannedReentryDisputePanel() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('pending');

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['bannedReentryDisputes'],
    queryFn: () => base44.entities.BannedReentryDispute.list('-created_date', 200),
  });
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['allProfilesForDisputes'],
    queryFn: () => base44.entities.UserProfile.list(),
  });
  const { data: flags = [] } = useQuery({
    queryKey: ['identityFlagsForDisputes'],
    queryFn: () => base44.entities.IdentityConsistencyFlag.list('-created_date', 500),
  });
  const { data: actionLogs = [] } = useQuery({
    queryKey: ['adminActionLogsForDisputes'],
    queryFn: () => base44.entities.AdminActionLog.list('-created_date', 500),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ disputeId, status, adminDecision, probationConfig, moreInfoRequest }) => {
      const now = new Date().toISOString();
      const dispute = disputes.find(d => d.id === disputeId);

      await base44.entities.BannedReentryDispute.update(disputeId, {
        status,
        admin_decision: adminDecision || '',
        admin_reviewer_id: user?.email,
        reviewed_at: now,
        ...(moreInfoRequest ? { more_info_request: moreInfoRequest } : {}),
        ...(probationConfig ? { probation_config: probationConfig } : {}),
      });

      // If approved or approved_probation, reinstate the account
      if ((status === 'approved' || status === 'approved_probation') && dispute?.submitter_user_id) {
        const targetProfiles = await base44.entities.UserProfile.filter({ user_id: dispute.submitter_user_id });
        const targetProfile = targetProfiles[0];
        if (targetProfile) {
          if (status === 'approved_probation' && probationConfig) {
            await base44.entities.UserProfile.update(targetProfile.id, {
              banned: false,
              suspended: false,
              on_probation: true,
              probation_restrictions: probationConfig,
              reinstated_at: now,
              reinstated_by_admin_id: user?.email,
            });
          } else {
            await base44.entities.UserProfile.update(targetProfile.id, {
              banned: false,
              suspended: false,
              on_probation: false,
              reinstated_at: now,
              reinstated_by_admin_id: user?.email,
            });
          }
        }
      }

      // Immutable audit log
      await base44.entities.AdminActionLog.create({
        admin_user_id: user?.email,
        target_type: 'User',
        target_id: dispute?.submitter_user_id,
        action: `banned_reentry_dispute_${status}`,
        reason: adminDecision || `Reentry dispute: ${status}`,
        metadata_json: { disputeId, status, probationConfig, timestamp: now },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bannedReentryDisputes'] });
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      toast.success('Dispute updated');
    },
    onError: (e) => toast.error(e.message || 'Action failed'),
  });

  const filteredDisputes = disputes.filter(d => filterStatus === 'all' || d.status === filterStatus);
  const pendingCount = disputes.filter(d => d.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-6 h-6 text-[#EF4444]" />
            <h2 className="text-2xl font-bold text-[#E8EEF9]">Banned Re-entry Disputes</h2>
          </div>
          <p className="text-sm text-[#6B7A94]">
            Review reinstatement requests from users whose identity matches a previously banned account.
          </p>
        </div>
        {pendingCount > 0 && (
          <CCBadge variant="danger" size="lg">{pendingCount} Pending</CCBadge>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {['pending', 'under_review', 'more_info_requested', 'approved', 'approved_probation', 'denied', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterStatus === s
                ? 'bg-[#4F8CFF] text-white'
                : 'bg-[#151D2B] border border-[#263248] text-[#9AA6BC] hover:text-[#E8EEF9]'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s}
            {s === 'pending' && pendingCount > 0 && ` (${pendingCount})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[#9AA6BC]">Loading disputes...</div>
      ) : filteredDisputes.length === 0 ? (
        <CCEmpty
          icon={ShieldAlert}
          title={filterStatus === 'pending' ? 'No pending disputes' : 'No disputes match filters'}
          description="Banned re-entry disputes will appear here when flagged by the identity consistency system."
        />
      ) : (
        <div className="space-y-3">
          {filteredDisputes.map(dispute => (
            <DisputeCard
              key={dispute.id}
              dispute={dispute}
              profiles={allProfiles}
              flags={flags}
              actionLogs={actionLogs}
              onAction={(id, status, decision, probConfig, moreInfo) =>
                actionMutation.mutate({ disputeId: id, status, adminDecision: decision, probationConfig: probConfig, moreInfoRequest: moreInfo })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}