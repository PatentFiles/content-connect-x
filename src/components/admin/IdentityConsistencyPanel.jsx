/**
 * IdentityConsistencyPanel — Admin-only review UI for identity consistency flags.
 * 
 * Shows: open flags grouped by confidence, reason codes, matched users,
 * and allows admin to clear false positives or escalate.
 * 
 * Privacy: displays only reason codes + match_details. Never shows raw identity values.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Fingerprint,
  AlertTriangle,
  CheckCircle,
  Shield,
  Play,
  RefreshCw,
  Eye,
  Lock,
  ChevronDown,
  ChevronUp,
  Clock,
  Ban,
  BookOpen,
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCEmpty from '@/components/ui-custom/CCEmpty';

const CONFIDENCE_CONFIG = {
  high:   { variant: 'danger',  label: 'High', icon: AlertTriangle },
  medium: { variant: 'warning', label: 'Medium', icon: Shield },
  low:    { variant: 'default', label: 'Low', icon: Eye },
};

const REASON_LABELS = {
  name_hash_match:                'Exact identity name match across accounts',
  name_phonetic_match:            'Phonetic name similarity across accounts',
  dob_hash_match:                 'Date of birth match across accounts',
  doc_type_plus_name_match:       'Same document type + similar name across accounts',
  repeated_rejections:            'Repeated verification rejections',
  resubmit_after_ban:             'Verification submitted while banned/suspended',
  rapid_resubmission:             'Rapid resubmission pattern',
  multiple_accounts_same_identity:'Likely same identity across multiple accounts',
};

const STATUS_CONFIG = {
  open:       { variant: 'warning', label: 'Open' },
  reviewed:   { variant: 'primary', label: 'Reviewed' },
  escalated:  { variant: 'danger',  label: 'Escalated' },
  cleared:    { variant: 'success', label: 'Cleared' },
  actioned:   { variant: 'accent',  label: 'Actioned' },
};

function FlagCard({ flag, profiles, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const conf = CONFIDENCE_CONFIG[flag.confidence] || CONFIDENCE_CONFIG.low;
  const ConfIcon = conf.icon;
  const statusConf = STATUS_CONFIG[flag.status] || STATUS_CONFIG.open;

  const flaggedProfile = profiles.find(p => p.user_id === flag.flagged_user_id);
  const matchedProfile = flag.matched_user_id ? profiles.find(p => p.user_id === flag.matched_user_id) : null;

  return (
    <CCCard padding="md" className={`border-l-4 ${
      flag.confidence === 'high' ? 'border-l-[#EF4444]' :
      flag.confidence === 'medium' ? 'border-l-[#F59E0B]' : 'border-l-[#263248]'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            flag.confidence === 'high' ? 'bg-[#EF4444]/20' :
            flag.confidence === 'medium' ? 'bg-[#F59E0B]/20' : 'bg-[#263248]'
          }`}>
            <ConfIcon className={`w-4 h-4 ${
              flag.confidence === 'high' ? 'text-[#EF4444]' :
              flag.confidence === 'medium' ? 'text-[#F59E0B]' : 'text-[#9AA6BC]'
            }`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <CCBadge variant={conf.variant} size="sm">{conf.label} Confidence</CCBadge>
              <CCBadge variant={statusConf.variant} size="sm">{statusConf.label}</CCBadge>
            </div>
            <p className="text-sm text-[#E8EEF9] font-medium">
              {flaggedProfile?.display_name || flag.flagged_user_id}
            </p>
            {matchedProfile && (
              <p className="text-xs text-[#9AA6BC]">
                Overlaps with: <span className="text-[#F59E0B]">{matchedProfile.display_name || flag.matched_user_id}</span>
              </p>
            )}
            {!matchedProfile && flag.matched_user_id && (
              <p className="text-xs text-[#9AA6BC]">Matched user: {flag.matched_user_id}</p>
            )}
            <p className="text-xs text-[#6B7A94] mt-0.5">
              {format(new Date(flag.created_date), 'MMM d, yyyy HH:mm')} · via {flag.triggered_by?.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[#6B7A94] hover:text-[#E8EEF9] p-1 flex-shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#263248] space-y-4">
          {/* Reason codes */}
          <div>
            <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide mb-2">Detection Signals</p>
            <div className="flex flex-wrap gap-2">
              {(flag.reason_codes || []).map(code => (
                <span key={code} className="px-2 py-1 text-xs bg-[#1A2438] border border-[#263248] rounded-full text-[#9AA6BC]">
                  {REASON_LABELS[code] || code}
                </span>
              ))}
            </div>
          </div>

          {/* Match details */}
          {flag.match_details && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Lock className="w-3 h-3 text-[#6B7A94]" />
                <p className="text-xs font-semibold text-[#9AA6BC] uppercase tracking-wide">Admin Summary (privacy-safe — no raw identity data)</p>
              </div>
              <p className="text-sm text-[#9AA6BC] leading-relaxed bg-[#0D1520] rounded-lg p-3">
                {flag.match_details}
              </p>
            </div>
          )}

          {/* Admin notes input if open */}
          {flag.status === 'open' && (
            <div>
              <label className="block text-xs font-medium text-[#E8EEF9] mb-1.5">Review Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[60px]"
                placeholder="Document your review decision..."
              />
            </div>
          )}

          {/* Actions */}
          {flag.status === 'open' && (
            <div className="flex flex-wrap gap-2">
              <CCButton
                variant="success"
                size="sm"
                icon={CheckCircle}
                onClick={() => onAction(flag.id, 'cleared_false_positive', notes)}
              >
                Clear (False Positive)
              </CCButton>
              <CCButton
                variant="warning"
                size="sm"
                icon={BookOpen}
                onClick={() => onAction(flag.id, 'enhanced_review', notes)}
              >
                Enhanced Review
              </CCButton>
              <CCButton
                variant="danger"
                size="sm"
                icon={Ban}
                onClick={() => onAction(flag.id, 'suspended', notes)}
              >
                Suspend User
              </CCButton>
              <CCButton
                variant="outline"
                size="sm"
                icon={Lock}
                onClick={() => onAction(flag.id, 'legal_hold_added', notes)}
              >
                Add Legal Hold
              </CCButton>
            </div>
          )}

          {/* Reviewed info */}
          {flag.reviewed_by && (
            <div className="text-xs text-[#6B7A94]">
              Reviewed by {flag.reviewed_by} · Action: {flag.action_taken?.replace(/_/g, ' ')}
              {flag.reviewed_at && ` · ${format(new Date(flag.reviewed_at), 'MMM d, yyyy')}`}
            </div>
          )}
          {flag.admin_notes && (
            <p className="text-xs text-[#9AA6BC] italic">"{flag.admin_notes}"</p>
          )}
        </div>
      )}
    </CCCard>
  );
}

export default function IdentityConsistencyPanel() {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [filterStatus, setFilterStatus] = useState('open');
  const [filterConfidence, setFilterConfidence] = useState('all');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['identityFlags'],
    queryFn: () => base44.entities.IdentityConsistencyFlag.list('-created_date', 200),
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['allProfilesForIdCheck'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const { data: fingerprints = [] } = useQuery({
    queryKey: ['identityFingerprints'],
    queryFn: () => base44.entities.IdentityFingerprint.list(),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ flagId, actionTaken, notes }) => {
      const now = new Date().toISOString();

      const flag = flags.find(f => f.id === flagId);

      // Map action to status
      const newStatus = actionTaken === 'cleared_false_positive' ? 'cleared'
        : actionTaken === 'enhanced_review' ? 'escalated'
        : 'actioned';

      await base44.entities.IdentityConsistencyFlag.update(flagId, {
        status: newStatus,
        action_taken: actionTaken,
        admin_notes: notes || '',
        reviewed_by: user?.email,
        reviewed_at: now,
      });

      // Apply real enforcement actions if needed
      if (actionTaken === 'suspended' && flag?.flagged_user_id) {
        const profiles = await base44.entities.UserProfile.list();
        const targetProfile = profiles.find(p => p.user_id === flag.flagged_user_id);
        if (targetProfile) {
          await base44.entities.UserProfile.update(targetProfile.id, {
            suspended: true,
            suspension_reason: 'Identity consistency flag: admin review determination',
          });
        }
      }

      if (actionTaken === 'legal_hold_added' && flag?.flagged_user_id) {
        const profiles = await base44.entities.UserProfile.list();
        const targetProfile = profiles.find(p => p.user_id === flag.flagged_user_id);
        if (targetProfile) {
          await base44.entities.UserProfile.update(targetProfile.id, { legal_hold: true });
        }
      }

      // Audit log
      await base44.entities.AdminActionLog.create({
        admin_user_id: user?.email,
        action_type: 'identity_flag_reviewed',
        target_user_id: flag?.flagged_user_id,
        details: { flag_id: flagId, action_taken: actionTaken, notes },
        reason: `Identity consistency flag reviewed: ${actionTaken}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identityFlags'] });
      toast.success('Flag updated and action recorded');
    },
    onError: (e) => toast.error(e.message || 'Action failed'),
  });

  const runScanAll = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await base44.functions.invoke('checkIdentityConsistency', {
        action: 'scan_all',
        triggered_by: 'manual_scan_all',
      });
      setScanResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['identityFlags'] });
      queryClient.invalidateQueries({ queryKey: ['identityFingerprints'] });
      toast.success(`Scan complete: ${res.data?.total_flags_created || 0} new flag(s) created`);
    } catch (e) {
      toast.error('Scan failed: ' + e.message);
    } finally {
      setScanning(false);
    }
  };

  const filteredFlags = flags.filter(f => {
    if (filterStatus !== 'all' && f.status !== filterStatus) return false;
    if (filterConfidence !== 'all' && f.confidence !== filterConfidence) return false;
    return true;
  });

  const openCount = flags.filter(f => f.status === 'open').length;
  const highCount = flags.filter(f => f.confidence === 'high' && f.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Fingerprint className="w-6 h-6 text-[#4F8CFF]" />
            <h2 className="text-2xl font-bold text-[#E8EEF9]">Identity Consistency Check</h2>
          </div>
          <p className="text-sm text-[#6B7A94]">
            Privacy-preserving identity fingerprint detection. No raw identity data is stored or displayed.
          </p>
        </div>
        <CCButton
          variant="primary"
          icon={scanning ? RefreshCw : Play}
          onClick={runScanAll}
          loading={scanning}
        >
          Run Full Scan
        </CCButton>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CCCard padding="md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#EF4444]/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#E8EEF9]">{highCount}</p>
              <p className="text-xs text-[#6B7A94]">High Confidence</p>
            </div>
          </div>
        </CCCard>
        <CCCard padding="md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#E8EEF9]">{openCount}</p>
              <p className="text-xs text-[#6B7A94]">Open Flags</p>
            </div>
          </div>
        </CCCard>
        <CCCard padding="md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
              <Fingerprint className="w-4 h-4 text-[#4F8CFF]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#E8EEF9]">{fingerprints.length}</p>
              <p className="text-xs text-[#6B7A94]">Fingerprints</p>
            </div>
          </div>
        </CCCard>
        <CCCard padding="md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#E8EEF9]">{flags.filter(f => f.status === 'cleared').length}</p>
              <p className="text-xs text-[#6B7A94]">Cleared</p>
            </div>
          </div>
        </CCCard>
      </div>

      {/* Scan result */}
      {scanResult && (
        <CCCard padding="md" className={`border ${scanResult.error ? 'border-[#EF4444]/30 bg-[#EF4444]/5' : 'border-[#22C55E]/30 bg-[#22C55E]/5'}`}>
          {scanResult.error ? (
            <p className="text-sm text-[#EF4444]">Scan error: {scanResult.error}</p>
          ) : (
            <p className="text-sm text-[#22C55E]">
              Scanned {scanResult.users_scanned} users · {scanResult.total_flags_created} new flag(s) created
            </p>
          )}
        </CCCard>
      )}

      {/* Privacy notice */}
      <div className="flex items-start gap-2 p-3 bg-[#151D2B] border border-[#263248] rounded-lg">
        <Lock className="w-4 h-4 text-[#4F8CFF] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[#9AA6BC] leading-relaxed">
          <strong className="text-[#E8EEF9]">Privacy note:</strong> All identity matching uses SHA-256 hashes and phonetic keys — raw names, documents, and personal data are never stored in flags or displayed here. Flags contain only reason codes and admin-readable summaries.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {['open', 'cleared', 'escalated', 'actioned', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filterStatus === s
                  ? 'bg-[#4F8CFF] text-white'
                  : 'bg-[#151D2B] border border-[#263248] text-[#9AA6BC] hover:text-[#E8EEF9]'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap ml-auto">
          {['all', 'high', 'medium', 'low'].map(c => (
            <button
              key={c}
              onClick={() => setFilterConfidence(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filterConfidence === c
                  ? 'bg-[#263248] text-[#E8EEF9]'
                  : 'bg-[#0D1520] border border-[#263248] text-[#6B7A94] hover:text-[#9AA6BC]'
              }`}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Flag list */}
      {isLoading ? (
        <div className="text-center py-8 text-[#9AA6BC]">Loading flags...</div>
      ) : filteredFlags.length === 0 ? (
        <CCEmpty
          icon={Fingerprint}
          title={filterStatus === 'open' ? 'No open identity flags' : 'No flags match filters'}
          description={filterStatus === 'open' ? 'Run a scan to detect potential identity inconsistencies across accounts.' : 'Try adjusting the filters.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredFlags.map(flag => (
            <FlagCard
              key={flag.id}
              flag={flag}
              profiles={allProfiles}
              onAction={(flagId, actionTaken, notes) =>
                actionMutation.mutate({ flagId, actionTaken, notes })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}