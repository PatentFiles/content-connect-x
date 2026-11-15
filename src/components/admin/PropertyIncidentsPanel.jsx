/**
 * PropertyIncidentsPanel
 *
 * Admin panel for reviewing PropertyIncident records.
 * Follows the same pattern as ReportsQueue / SafetyAlertsQueue.
 * Supports status updates, resolution setting, and optional PropertyRiskPanel
 * for admin geo-risk + enforcement actions inline.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { format } from 'date-fns';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import PropertyRiskPanel from '@/components/hosting/PropertyRiskPanel';
import { toast } from 'sonner';

const STATUS_VARIANTS = {
  open: 'warning',
  under_review: 'primary',
  resolved: 'success',
  dismissed: 'default',
  escalated: 'danger',
};

const TYPE_LABELS = {
  damage: 'Damage',
  unauthorized_use: 'Unauthorized Use',
  safety_issue: 'Safety Issue',
  illegal_activity: 'Illegal Activity',
  cleanup_failure: 'Cleanup Failure',
  equipment_issue: 'Equipment Issue',
  host_no_show: 'Host No-Show',
  host_cancelled: 'Host Cancelled',
  failed_access: 'Failed Access',
  other: 'Other',
};

const RESOLUTIONS = [
  { value: 'no_action', label: 'No Action' },
  { value: 'warning_issued', label: 'Warning Issued' },
  { value: 'deposit_withheld', label: 'Deposit Withheld' },
  { value: 'payout_adjusted', label: 'Payout Adjusted' },
  { value: 'suspended', label: 'Host Suspended' },
  { value: 'banned', label: 'Host Banned' },
  { value: 'referred_to_insurance', label: 'Referred to Insurance' },
];

function IncidentRow({ incident, currentAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const [showRiskPanel, setShowRiskPanel] = useState(false);
  const [adminNotes, setAdminNotes] = useState(incident.admin_notes || '');
  const [resolution, setResolution] = useState(incident.resolution || '');
  const [depositAmount, setDepositAmount] = useState(incident.deposit_withheld_amount || '');
  const queryClient = useQueryClient();

  const { data: property } = useQuery({
    queryKey: ['incidentProperty', incident.property_id],
    queryFn: () => incident.property_id
      ? base44.entities.Property.filter({ id: incident.property_id }).then(r => r[0] || null)
      : Promise.resolve(null),
    enabled: expanded && !!incident.property_id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ status, resolution: res, admin_notes, deposit_withheld_amount }) =>
      base44.entities.PropertyIncident.update(incident.id, {
        status,
        resolution: res || undefined,
        admin_notes: admin_notes || undefined,
        deposit_withheld_amount: deposit_withheld_amount ? parseFloat(deposit_withheld_amount) : undefined,
        admin_reviewer_id: currentAdmin?.email,
        reviewed_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['propertyIncidents']);
      toast.success('Incident updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const isEnforcement = ['host_no_show', 'host_cancelled', 'failed_access'].includes(incident.incident_type);

  return (
    <CCCard padding="md" className={isEnforcement ? 'border-[#F59E0B]/40' : ''}>
      <button
        className="w-full flex items-start justify-between gap-3 text-left"
        onClick={() => setExpanded(s => !s)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <CCBadge variant={STATUS_VARIANTS[incident.status] || 'default'} size="sm">
              {incident.status?.replace(/_/g, ' ')}
            </CCBadge>
            <CCBadge variant={isEnforcement ? 'warning' : 'danger'} size="sm">
              {TYPE_LABELS[incident.incident_type] || incident.incident_type}
            </CCBadge>
            <CCBadge variant="outline" size="sm">{incident.reporter_role}</CCBadge>
          </div>
          <p className="text-sm font-medium text-[#E8EEF9] truncate">{incident.title || 'Untitled'}</p>
          <p className="text-xs text-[#6B7A94] mt-0.5">
            Session: {incident.session_id?.slice(0, 8)}...
            {incident.created_date && ` · ${format(new Date(incident.created_date), 'MMM d, yyyy')}`}
            {incident.estimated_damage_amount ? ` · Est. damage: $${incident.estimated_damage_amount}` : ''}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94] flex-shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94] flex-shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[#263248] space-y-4">
          <p className="text-sm text-[#9AA6BC]">{incident.description}</p>

          {/* Evidence */}
          {incident.evidence_urls?.length > 0 && (
            <div>
              <p className="text-xs text-[#6B7A94] mb-1">Evidence ({incident.evidence_urls.length} file{incident.evidence_urls.length > 1 ? 's' : ''})</p>
              <div className="flex flex-wrap gap-2">
                {incident.evidence_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="w-16 h-16 rounded overflow-hidden bg-[#0B0F14] border border-[#263248] block"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Admin actions */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Status</label>
              <select
                defaultValue={incident.status}
                onChange={e => updateMutation.mutate({ status: e.target.value, resolution, admin_notes: adminNotes, deposit_withheld_amount: depositAmount })}
                className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] w-full focus:outline-none"
              >
                <option value="open">Open</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] w-full focus:outline-none"
              >
                <option value="">— Select resolution —</option>
                {RESOLUTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {resolution === 'deposit_withheld' && (
              <div>
                <label className="block text-xs text-[#9AA6BC] mb-1">Deposit Withheld Amount (USD)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="0"
                  className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] w-full focus:outline-none"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-[#9AA6BC] mb-1">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={2}
                className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] w-full focus:outline-none resize-none"
                placeholder="Internal notes..."
              />
            </div>
            <div className="flex gap-2">
              <CCButton
                variant="primary"
                size="sm"
                loading={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ status: incident.status, resolution, admin_notes: adminNotes, deposit_withheld_amount: depositAmount })}
              >
                Save Changes
              </CCButton>
              {incident.property_id && (
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={Shield}
                  onClick={() => setShowRiskPanel(s => !s)}
                >
                  {showRiskPanel ? 'Hide' : 'Risk Profile'}
                </CCButton>
              )}
            </div>
          </div>

          {/* Inline PropertyRiskPanel */}
          {showRiskPanel && property && (
            <div className="border-t border-[#263248] pt-4">
              <p className="text-xs font-medium text-[#9AA6BC] mb-3 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Property Risk Profile — {property.title}
              </p>
              <PropertyRiskPanel
                property={property}
                onUpdated={() => setShowRiskPanel(false)}
              />
            </div>
          )}
        </div>
      )}
    </CCCard>
  );
}

export default function PropertyIncidentsPanel({ currentAdmin }) {
  const [statusFilter, setStatusFilter] = useState('open');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['propertyIncidents', statusFilter],
    queryFn: () => statusFilter
      ? base44.entities.PropertyIncident.filter({ status: statusFilter }, '-created_date', 100)
      : base44.entities.PropertyIncident.list('-created_date', 100),
  });

  const filtered = typeFilter ? incidents.filter(i => i.incident_type === typeFilter) : incidents;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#E8EEF9] mb-1 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
          Property Incidents
        </h2>
        <p className="text-sm text-[#9AA6BC]">
          Damage, no-shows, safety issues, and access failures filed by hosts and guests.
          Use the Risk Profile panel to set geo risk, insurance verification, and enforcement state.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="under_review">Under Review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none"
        >
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-[#6B7A94]">Loading incidents...</div>
      ) : filtered.length === 0 ? (
        <CCEmpty
          icon={AlertTriangle}
          title="No incidents found"
          description="No property incidents match the current filter."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(incident => (
            <IncidentRow key={incident.id} incident={incident} currentAdmin={currentAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}