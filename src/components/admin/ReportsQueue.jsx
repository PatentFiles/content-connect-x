import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Eye, CheckCircle, X, MessageCircle, UserX, Ban, Clock, Flag, FileText, Image } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ReportsQueue({ currentAdmin }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const queryClient = useQueryClient();

  // Fetch all reports
  const { data: reports = [] } = useQuery({
    queryKey: ['allReports'],
    queryFn: () => base44.entities.Report.list('-created_date'),
  });

  // Fetch profiles for reporter and targets
  const { data: profiles = [] } = useQuery({
    queryKey: ['reportProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  // Update report status mutation
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, status, adminNotes }) => {
      await base44.entities.Report.update(reportId, {
        status,
        admin_notes: adminNotes,
        resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
        resolved_by: currentAdmin.email
      });

      // Log the action
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'Report',
        target_id: reportId,
        action: `report_${status}`,
        reason: `Report ${status}`,
        notes: adminNotes,
        metadata_json: { timestamp: new Date().toISOString() }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allReports'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('Report updated');
      setActionModalOpen(false);
      setSelectedReport(null);
      setActionNotes('');
    },
    onError: () => toast.error('Failed to update report')
  });

  // Suspend user shortcut
  const suspendUserMutation = useMutation({
    mutationFn: async ({ userId, reportId, reason }) => {
      const profile = profiles.find(p => p.user_id === userId);
      if (profile) {
        await base44.entities.UserProfile.update(profile.id, { 
          suspended: true,
          banned: false,
          suspension_reason: reason 
        });
      }

      // Update report as resolved
      await base44.entities.Report.update(reportId, {
        status: 'resolved',
        admin_notes: `User suspended: ${reason}`,
        resolved_at: new Date().toISOString(),
        resolved_by: currentAdmin.email
      });

      // Log both actions
      await base44.entities.AdminActionLog.create({
        admin_user_id: currentAdmin.email,
        target_type: 'User',
        target_id: userId,
        action: 'suspend_account',
        reason,
        notes: `Suspended via report #${reportId}`,
        metadata_json: { reportId, timestamp: new Date().toISOString() }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allReports'] });
      queryClient.invalidateQueries({ queryKey: ['allProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['recentAdminActions'] });
      toast.success('User suspended and report resolved');
      setActionModalOpen(false);
      setSelectedReport(null);
    },
    onError: () => toast.error('Failed to suspend user')
  });

  const getProfileByEmail = (email) => profiles.find(p => p.user_id === email);

  const statusConfig = {
    pending: { label: 'Open', variant: 'warning', icon: Clock },
    investigating: { label: 'In Review', variant: 'primary', icon: Eye },
    resolved: { label: 'Resolved', variant: 'success', icon: CheckCircle },
    dismissed: { label: 'Dismissed', variant: 'default', icon: X },
  };

  const reasonConfig = {
    harassment: { variant: 'danger', icon: AlertTriangle },
    fake_profile: { variant: 'warning', icon: UserX },
    underage: { variant: 'danger', icon: AlertTriangle },
    non_consensual: { variant: 'danger', icon: Flag },
    spam: { variant: 'outline', icon: MessageCircle },
    scam: { variant: 'danger', icon: AlertTriangle },
    other: { variant: 'outline', icon: Flag },
  };

  // High-risk reasons that should sort to top
  const HIGH_RISK = ['underage', 'non_consensual'];
  const isHighRiskReport = (r) => {
    const notes = (r.admin_notes || '') + (r.details || '');
    return HIGH_RISK.includes(r.reason) || /IMMEDIATE_REVIEW|AUTO-MODERATION|underage|trafficking|coercion/i.test(notes);
  };

  const filteredReports = (statusFilter === 'all'
    ? reports
    : reports.filter(r => r.status === statusFilter)
  ).sort((a, b) => {
    const aHigh = isHighRiskReport(a) ? 0 : 1;
    const bHigh = isHighRiskReport(b) ? 0 : 1;
    if (aHigh !== bHigh) return aHigh - bHigh;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Reports Queue</h2>
        <p className="text-sm text-[#6B7A94]">Review and moderate user reports</p>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'pending', 'investigating', 'resolved', 'dismissed'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              statusFilter === status
                ? 'bg-[#4F8CFF] text-white'
                : 'bg-[#151D2B] text-[#9AA6BC] hover:bg-[#1A2438]'
            }`}
          >
            {status === 'all' ? 'All' : statusConfig[status]?.label} 
            ({status === 'all' ? reports.length : reports.filter(r => r.status === status).length})
          </button>
        ))}
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <CCCard padding="xl">
          <div className="text-center py-8">
            <Flag className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">No reports to review</p>
          </div>
        </CCCard>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => {
            const reporter = getProfileByEmail(report.reporter_id);
            const target = getProfileByEmail(report.target_user_id);
            const statusInfo = statusConfig[report.status] || statusConfig.pending;
            const reasonInfo = reasonConfig[report.reason] || reasonConfig.other;
            const StatusIcon = statusInfo.icon;
            const ReasonIcon = reasonInfo.icon;

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <CCCard 
                  padding="lg" 
                  hover 
                  clickable
                  onClick={() => setSelectedReport(report)}
                  className={report.status === 'pending' ? 'border-l-4 border-l-[#F59E0B]' : ''}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <CCBadge variant={statusInfo.variant} icon={StatusIcon}>
                          {statusInfo.label}
                        </CCBadge>
                        <CCBadge variant={reasonInfo.variant} icon={ReasonIcon}>
                          {report.reason.replace(/_/g, ' ')}
                        </CCBadge>
                        <span className="text-xs text-[#6B7A94]">
                          {new Date(report.created_date).toLocaleString()}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="text-sm">
                        <p className="text-[#E8EEF9] mb-2">{report.details}</p>
                        <div className="flex items-center gap-4 text-[#6B7A94]">
                          <span>Reporter: {reporter?.display_name || report.reporter_id}</span>
                          <span>•</span>
                          <span>Target: {target?.display_name || report.target_user_id}</span>
                        </div>
                      </div>

                      {report.admin_notes && (
                        <div className="text-xs text-[#6B7A94] bg-[#121824] rounded-lg p-2">
                          <strong>Admin Notes:</strong> {report.admin_notes}
                        </div>
                      )}
                    </div>

                    <CCButton
                      variant="outline"
                      size="sm"
                      icon={Eye}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReport(report);
                      }}
                    >
                      Review
                    </CCButton>
                  </div>
                </CCCard>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Report Detail Modal */}
      <CCModal
        isOpen={!!selectedReport}
        onClose={() => {
          setSelectedReport(null);
          setActionType('');
          setActionNotes('');
        }}
        title="Report Details"
        size="lg"
      >
        {selectedReport && (
          <div className="space-y-6">
            {/* Report Info */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <CCBadge variant={statusConfig[selectedReport.status]?.variant}>
                  {statusConfig[selectedReport.status]?.label}
                </CCBadge>
                <CCBadge variant={reasonConfig[selectedReport.reason]?.variant}>
                  {selectedReport.reason.replace(/_/g, ' ')}
                </CCBadge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[#6B7A94] mb-1">Reporter</p>
                  <p className="text-[#E8EEF9]">
                    {getProfileByEmail(selectedReport.reporter_id)?.display_name || selectedReport.reporter_id}
                  </p>
                </div>
                <div>
                  <p className="text-[#6B7A94] mb-1">Target User</p>
                  <p className="text-[#E8EEF9]">
                    {getProfileByEmail(selectedReport.target_user_id)?.display_name || selectedReport.target_user_id}
                  </p>
                </div>
                <div>
                  <p className="text-[#6B7A94] mb-1">Content Type</p>
                  <p className="text-[#E8EEF9] capitalize">{selectedReport.target_content_type || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[#6B7A94] mb-1">Submitted</p>
                  <p className="text-[#E8EEF9]">{new Date(selectedReport.created_date).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-[#6B7A94] mb-2">Report Details</p>
                <p className="text-[#E8EEF9] bg-[#121824] rounded-lg p-3">
                  {selectedReport.details}
                </p>
              </div>

              {selectedReport.admin_notes && (
                <div>
                  <p className="text-[#6B7A94] mb-2">Previous Admin Notes</p>
                  <p className="text-[#E8EEF9] bg-[#121824] rounded-lg p-3">
                    {selectedReport.admin_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Action Selection */}
            {!actionType && selectedReport.status !== 'resolved' && selectedReport.status !== 'dismissed' && (
              <div className="space-y-3 border-t border-[#263248] pt-4">
                <p className="text-sm font-medium text-[#E8EEF9]">Select Action</p>
                <div className="grid grid-cols-2 gap-3">
                  <CCButton
                    variant="primary"
                    icon={Eye}
                    onClick={() => setActionType('investigating')}
                    fullWidth
                  >
                    Mark Under Review
                  </CCButton>
                  <CCButton
                    variant="success"
                    icon={CheckCircle}
                    onClick={() => setActionType('resolved')}
                    fullWidth
                  >
                    Resolve
                  </CCButton>
                  <CCButton
                    variant="outline"
                    icon={X}
                    onClick={() => setActionType('dismissed')}
                    fullWidth
                  >
                    Dismiss
                  </CCButton>
                  <CCButton
                    variant="danger"
                    icon={UserX}
                    onClick={() => setActionType('suspend')}
                    fullWidth
                  >
                    Suspend User
                  </CCButton>
                </div>
              </div>
            )}

            {/* Action Confirmation */}
            {actionType && (
              <div className="space-y-4 border-t border-[#263248] pt-4">
                <CCInput
                  label="Action Notes"
                  placeholder="Add notes about this action..."
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  required
                />
                <div className="flex gap-3 justify-end">
                  <CCButton
                    variant="outline"
                    onClick={() => {
                      setActionType('');
                      setActionNotes('');
                    }}
                  >
                    Cancel
                  </CCButton>
                  <CCButton
                    variant={actionType === 'suspend' ? 'danger' : 'primary'}
                    onClick={() => {
                      if (!actionNotes.trim()) {
                        toast.error('Please add notes');
                        return;
                      }

                      if (actionType === 'suspend') {
                        suspendUserMutation.mutate({
                          userId: selectedReport.target_user_id,
                          reportId: selectedReport.id,
                          reason: actionNotes
                        });
                      } else {
                        updateReportMutation.mutate({
                          reportId: selectedReport.id,
                          status: actionType,
                          adminNotes: actionNotes
                        });
                      }
                    }}
                    loading={updateReportMutation.isPending || suspendUserMutation.isPending}
                  >
                    Confirm {actionType === 'suspend' ? 'Suspension' : 'Action'}
                  </CCButton>
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="flex gap-2 border-t border-[#263248] pt-4">
              <CCButton
                variant="ghost"
                size="sm"
                icon={Eye}
                onClick={() => window.open(`/ViewProfile?id=${selectedReport.target_user_id}`, '_blank')}
              >
                View Target Profile
              </CCButton>
              <CCButton
                variant="ghost"
                size="sm"
                icon={Eye}
                onClick={() => window.open(`/ViewProfile?id=${selectedReport.reporter_id}`, '_blank')}
              >
                View Reporter Profile
              </CCButton>
            </div>
          </div>
        )}
      </CCModal>
    </div>
  );
}