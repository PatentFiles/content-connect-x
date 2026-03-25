/**
 * SafetyAlertsQueue — Admin component for high-priority safety cases
 *
 * Surfaces underage, trafficking, coercion, and repeat-offender cases
 * at the top of the admin view with required structured resolution.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert, Ban, CheckCircle, Eye, Clock, Siren } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

// High-risk reason categories
const HIGH_RISK_REASONS = ['underage', 'non_consensual', 'solicitation'];
const HIGH_RISK_KEYWORDS_IN_NOTES = ['underage', 'trafficking', 'coercion', 'solicitation', 'IMMEDIATE_REVIEW', 'AUTO-MODERATION'];

function severityConfig(report) {
  const notes = (report.admin_notes || '') + (report.details || '');
  const isUnderage = report.reason === 'underage' || /underage|minor/i.test(notes);
  const isTrafficking = /trafficking|coercion|exploitation/i.test(notes);
  const isSolicitation = /solicitation|escort|payment.{0,10}sex/i.test(notes);
  const isAutoFlag = notes.includes('AUTO-MODERATION') || notes.includes('SYSTEM_AUTO');
  const isImmediate = notes.includes('IMMEDIATE_REVIEW');

  if (isUnderage) return { label: '⚠ UNDERAGE RISK', variant: 'danger', priority: 1, color: 'border-l-[#EF4444]', bgHint: 'bg-[#EF4444]/5' };
  if (isTrafficking) return { label: '⚠ TRAFFICKING / COERCION', variant: 'danger', priority: 2, color: 'border-l-[#EF4444]', bgHint: 'bg-[#EF4444]/5' };
  if (isSolicitation) return { label: '⚠ SOLICITATION', variant: 'warning', priority: 3, color: 'border-l-[#F59E0B]', bgHint: 'bg-[#F59E0B]/5' };
  if (isAutoFlag) return { label: 'AUTO-FLAGGED', variant: 'warning', priority: 4, color: 'border-l-[#F59E0B]', bgHint: 'bg-[#F59E0B]/5' };
  return { label: 'HIGH RISK', variant: 'danger', priority: 5, color: 'border-l-[#F59E0B]', bgHint: '' };
}

function isHighRisk(report) {
  const notes = (report.admin_notes || '') + (report.details || '');
  return (
    HIGH_RISK_REASONS.includes(report.reason) ||
    HIGH_RISK_KEYWORDS_IN_NOTES.some(kw => notes.includes(kw))
  );
}

export default function SafetyAlertsQueue({ currentAdmin }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionType, setResolutionType] = useState('');
  const queryClient = useQueryClient();

  const { data: allReports = [], isLoading } = useQuery({
    queryKey: ['safetyAlerts'],
    queryFn: () => base44.entities.Report.list('-created_date', 200),
    refetchInterval: 30000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['safetyProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const highRiskReports = allReports
    .filter(r => isHighRisk(r) && r.status !== 'resolved' && r.status !== 'dismissed')
    .sort((a, b) => {
      const pa = severityConfig(a).priority;
      const pb = severityConfig(b).priority;
      return pa !== pb ? pa - pb : new Date(b.created_date) - new Date(a.created_date);
    });

  const getProfile = (email) => profiles.find(p => p.user_id === email);

  const resolveMutation = useMutation({
    mutationFn: async ({ report, type, notes }) => {
      if (!notes || notes.trim().length < 20) {
        throw new Error('Resolution notes must be at least 20 characters for high-risk cases');
      }

      const now = new Date().toISOString();

      // Update report
      await base44.entities.Report.update(report.id, {
        status: type === 'ban' || type === 'suspend' ? 'resolved' : type === 'dismiss' ? 'dismissed' : 'resolved',
        admin_notes: `[STRUCTURED RESOLUTION — ${now}] Admin: ${currentAdmin?.email}. Action: ${type}. Notes: ${notes}`,
        resolved_at: now,
        resolved_by: currentAdmin?.email,
      });

      // Apply account action
      if (type === 'ban' || type === 'suspend') {
        const profile = profiles.find(p => p.user_id === report.target_user_id);
        if (profile?.id) {
          await base44.entities.UserProfile.update(profile.id, {
            ...(type === 'ban' ? { banned: true, suspended: false } : { suspended: true, banned: false }),
            suspension_reason: type === 'ban'
              ? `Account permanently banned following safety review: ${notes.substring(0, 200)}`
              : `Account suspended following safety review: ${notes.substring(0, 200)}`,
            legal_hold: true, // preserve evidence
          });
        }
      }

      // Log structured admin action
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin?.email,
        target_type: 'Report',
        target_id: report.id,
        action: type === 'ban' ? 'ban_account' : type === 'suspend' ? 'suspend_account' : type === 'dismiss' ? 'report_dismissed' : 'report_resolved',
        reason: `High-risk case resolution: ${type}`,
        notes: `Structured resolution of safety report #${report.id}. Admin: ${currentAdmin?.email}. Notes: ${notes}`,
        metadata_json: {
          report_reason: report.reason,
          resolution_type: type,
          resolution_notes: notes,
          reporter_id: report.reporter_id,
          target_id: report.target_user_id,
          timestamp: now,
          is_high_risk_case: true,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safetyAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['allReports'] });
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      toast.success('High-risk case resolved with structured notes');
      setSelectedReport(null);
      setResolutionNotes('');
      setResolutionType('');
    },
    onError: (err) => toast.error(err.message || 'Failed to resolve case'),
  });

  if (isLoading) {
    return <div className="text-[#9AA6BC] text-sm py-4">Loading safety alerts...</div>;
  }

  if (highRiskReports.length === 0) {
    return (
      <CCCard padding="lg" className="border-[#22C55E]/30">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-[#22C55E]" />
          <div>
            <p className="font-semibold text-[#22C55E]">No Active Safety Alerts</p>
            <p className="text-xs text-[#9AA6BC]">No high-risk underage, trafficking, solicitation, or coercion cases pending review.</p>
          </div>
        </div>
      </CCCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl">
        <Siren className="w-6 h-6 text-[#EF4444] flex-shrink-0" />
        <div>
          <p className="font-bold text-[#EF4444]">
            {highRiskReports.length} Active Safety Alert{highRiskReports.length !== 1 ? 's' : ''} — Immediate Review Required
          </p>
          <p className="text-xs text-[#9AA6BC]">
            Underage risk, trafficking, coercion, and solicitation cases cannot be silently dismissed. Structured resolution notes are required.
          </p>
        </div>
      </div>

      {/* Cases */}
      <div className="space-y-3">
        {highRiskReports.map(report => {
          const config = severityConfig(report);
          const target = getProfile(report.target_user_id);
          const isAutoFlag = report.reporter_id === 'SYSTEM_AUTO_MODERATION';

          return (
            <motion.div key={report.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <CCCard
                padding="md"
                clickable
                onClick={() => setSelectedReport(report)}
                className={`border-l-4 ${config.color} ${config.bgHint}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CCBadge variant={config.variant} icon={ShieldAlert}>{config.label}</CCBadge>
                      {isAutoFlag && <CCBadge variant="warning" icon={AlertTriangle} size="sm">Auto-Detected</CCBadge>}
                      {report.status === 'investigating' && <CCBadge variant="primary" icon={Eye} size="sm">Under Review</CCBadge>}
                      <span className="text-xs text-[#6B7A94]">{new Date(report.created_date).toLocaleString()}</span>
                    </div>
                    <div className="text-sm">
                      <p className="text-[#E8EEF9] line-clamp-2">{report.details}</p>
                    </div>
                    <div className="text-xs text-[#6B7A94]">
                      Target: <span className="text-[#E8EEF9]">{target?.display_name || report.target_user_id}</span>
                      {' · '}
                      Source: <span className="text-[#E8EEF9]">{isAutoFlag ? 'System Auto-Detection' : report.reporter_id}</span>
                    </div>
                  </div>
                  <CCButton variant="danger" size="sm" icon={Eye} onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}>
                    Review
                  </CCButton>
                </div>
              </CCCard>
            </motion.div>
          );
        })}
      </div>

      {/* Resolution Modal */}
      <CCModal
        isOpen={!!selectedReport}
        onClose={() => { setSelectedReport(null); setResolutionNotes(''); setResolutionType(''); }}
        title="High-Risk Case Resolution"
        size="lg"
      >
        {selectedReport && (() => {
          const config = severityConfig(selectedReport);
          const target = getProfile(selectedReport.target_user_id);
          return (
            <div className="space-y-5">
              {/* Warning banner */}
              <div className="flex items-start gap-3 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#EF4444] font-medium">
                  {config.label} — This case cannot be dismissed without structured moderator review notes (minimum 20 characters).
                </p>
              </div>

              {/* Report details */}
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[#6B7A94] mb-1">Target User</p>
                    <p className="text-[#E8EEF9]">{target?.display_name || selectedReport.target_user_id}</p>
                    <p className="text-xs text-[#6B7A94]">{selectedReport.target_user_id}</p>
                  </div>
                  <div>
                    <p className="text-[#6B7A94] mb-1">Reported Reason</p>
                    <p className="text-[#E8EEF9] capitalize">{selectedReport.reason?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[#6B7A94] mb-1">Report Details</p>
                  <p className="text-[#E8EEF9] bg-[#121824] rounded-lg p-3 text-xs font-mono leading-relaxed max-h-40 overflow-y-auto">
                    {selectedReport.details}
                  </p>
                </div>
                {selectedReport.admin_notes && (
                  <div>
                    <p className="text-[#6B7A94] mb-1">System / Previous Admin Notes</p>
                    <p className="text-[#E8EEF9] bg-[#121824] rounded-lg p-3 text-xs font-mono max-h-32 overflow-y-auto">
                      {selectedReport.admin_notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Selection */}
              {!resolutionType && (
                <div className="space-y-3 border-t border-[#263248] pt-4">
                  <p className="text-sm font-medium text-[#E8EEF9]">Required Action</p>
                  <div className="grid grid-cols-2 gap-3">
                    <CCButton variant="danger" icon={Ban} onClick={() => setResolutionType('ban')} fullWidth>
                      Permanent Ban
                    </CCButton>
                    <CCButton variant="warning" icon={Clock} onClick={() => setResolutionType('suspend')} fullWidth>
                      Suspend Account
                    </CCButton>
                    <CCButton variant="success" icon={CheckCircle} onClick={() => setResolutionType('resolve_no_action')} fullWidth>
                      Resolve (No Action)
                    </CCButton>
                    <CCButton variant="outline" icon={Eye} onClick={() => setResolutionType('dismiss')} fullWidth>
                      Dismiss (requires justification)
                    </CCButton>
                  </div>
                </div>
              )}

              {/* Resolution Notes — required */}
              {resolutionType && (
                <div className="space-y-4 border-t border-[#263248] pt-4">
                  <div>
                    <label className="block text-sm font-medium text-[#E8EEF9] mb-1">
                      Structured Resolution Notes <span className="text-[#EF4444]">*</span>
                    </label>
                    <p className="text-xs text-[#9AA6BC] mb-2">
                      Required for all high-risk cases. Minimum 20 characters. These notes are permanently logged.
                    </p>
                    <textarea
                      value={resolutionNotes}
                      onChange={e => setResolutionNotes(e.target.value)}
                      placeholder="Describe your findings and justification for this action..."
                      rows={4}
                      className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-3 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 resize-none"
                    />
                    <p className="text-xs text-[#6B7A94] mt-1">{resolutionNotes.length} / 20 min characters</p>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <CCButton variant="outline" onClick={() => { setResolutionType(''); setResolutionNotes(''); }}>
                      Back
                    </CCButton>
                    <CCButton
                      variant={resolutionType === 'ban' ? 'danger' : resolutionType === 'suspend' ? 'warning' : 'primary'}
                      loading={resolveMutation.isPending}
                      disabled={resolutionNotes.trim().length < 20}
                      onClick={() => resolveMutation.mutate({ report: selectedReport, type: resolutionType, notes: resolutionNotes })}
                    >
                      Confirm: {resolutionType.replace(/_/g, ' ')}
                    </CCButton>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </CCModal>
    </div>
  );
}