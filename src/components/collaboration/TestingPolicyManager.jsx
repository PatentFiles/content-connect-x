import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Shield, AlertTriangle, Info } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';

export default function TestingPolicyManager({ collaborationId, userRole, readOnly = false }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: policies = [] } = useQuery({
    queryKey: ['testingPolicy', collaborationId],
    queryFn: () => base44.entities.CollaborationTestingPolicy.filter({ collaboration_id: collaborationId }),
    enabled: !!collaborationId,
  });

  const policy = policies[0] || {
    require_verified_testing: true,
    require_full_panel_within_days: null,
    require_hiv_negative_only: false,
    allow_hiv_undetectable: true,
    allow_self_reported: false,
    require_testing_before_contract: true,
    require_testing_before_schedule_lock: false,
  };

  const [editedPolicy, setEditedPolicy] = useState(policy);

  const saveMutation = useMutation({
    mutationFn: async (policyData) => {
      if (policies.length > 0) {
        return base44.entities.CollaborationTestingPolicy.update(policies[0].id, policyData);
      } else {
        return base44.entities.CollaborationTestingPolicy.create({
          collaboration_id: collaborationId,
          ...policyData,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['testingPolicy']);
      queryClient.invalidateQueries(['collaborationActivity']);
      toast.success('Testing policy updated');
      setEditing(false);
    },
    onError: () => {
      toast.error('Failed to update testing policy');
    },
  });

  const isAdmin = userRole === 'Admin';

  return (
    <CCCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#4F8CFF]" />
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Testing Policy</h3>
        </div>
        {isAdmin && !readOnly && (
          <CCButton
            variant={editing ? 'outline' : 'primary'}
            size="sm"
            onClick={() => {
              if (editing) {
                setEditedPolicy(policy);
              }
              setEditing(!editing);
            }}
          >
            {editing ? 'Cancel' : 'Edit'}
          </CCButton>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={editedPolicy.require_verified_testing}
              onChange={(e) => setEditedPolicy({ ...editedPolicy, require_verified_testing: e.target.checked })}
              className="mt-1"
            />
            <div>
              <span className="text-sm font-medium text-[#E8EEF9]">Require Verified Testing Only</span>
              <p className="text-xs text-[#6B7A94] mt-0.5">Only admin-verified testing credentials accepted</p>
            </div>
          </label>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
              Require Full Panel Within
            </label>
            <select
              value={editedPolicy.require_full_panel_within_days || ''}
              onChange={(e) => setEditedPolicy({ 
                ...editedPolicy, 
                require_full_panel_within_days: e.target.value ? parseInt(e.target.value) : null 
              })}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-[#E8EEF9]"
            >
              <option value="">No requirement</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
            </select>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={editedPolicy.require_hiv_negative_only}
              onChange={(e) => setEditedPolicy({ ...editedPolicy, require_hiv_negative_only: e.target.checked })}
              className="mt-1"
            />
            <div>
              <span className="text-sm font-medium text-[#E8EEF9]">Require HIV Negative Only</span>
              <p className="text-xs text-[#6B7A94] mt-0.5">Require negative HIV status</p>
            </div>
          </label>

          <label className="flex items-start gap-3 opacity-50" style={{ pointerEvents: editedPolicy.require_hiv_negative_only ? 'none' : 'auto' }}>
            <input
              type="checkbox"
              checked={editedPolicy.allow_hiv_undetectable}
              onChange={(e) => setEditedPolicy({ ...editedPolicy, allow_hiv_undetectable: e.target.checked })}
              disabled={editedPolicy.require_hiv_negative_only}
              className="mt-1"
            />
            <div>
              <span className="text-sm font-medium text-[#E8EEF9]">Allow HIV Undetectable (U=U)</span>
              <p className="text-xs text-[#6B7A94] mt-0.5">Accept HIV Positive – Undetectable status</p>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={editedPolicy.allow_self_reported}
              onChange={(e) => setEditedPolicy({ ...editedPolicy, allow_self_reported: e.target.checked })}
              className="mt-1"
            />
            <div>
              <span className="text-sm font-medium text-[#E8EEF9]">Allow Self-Reported Testing</span>
              <p className="text-xs text-[#6B7A94] mt-0.5">Accept self-reported test results</p>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={editedPolicy.require_testing_before_contract}
              onChange={(e) => setEditedPolicy({ ...editedPolicy, require_testing_before_contract: e.target.checked })}
              className="mt-1"
            />
            <div>
              <span className="text-sm font-medium text-[#E8EEF9]">Require Testing Before Contract</span>
              <p className="text-xs text-[#6B7A94] mt-0.5">Block contract creation until testing satisfied</p>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={editedPolicy.require_testing_before_schedule_lock}
              onChange={(e) => setEditedPolicy({ ...editedPolicy, require_testing_before_schedule_lock: e.target.checked })}
              className="mt-1"
            />
            <div>
              <span className="text-sm font-medium text-[#E8EEF9]">Require Testing Before Schedule Lock</span>
              <p className="text-xs text-[#6B7A94] mt-0.5">Block locking schedule dates until testing satisfied</p>
            </div>
          </label>

          <CCButton
            variant="primary"
            fullWidth
            onClick={() => saveMutation.mutate(editedPolicy)}
            loading={saveMutation.isPending}
          >
            Save Policy
          </CCButton>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9AA6BC]">Verified Testing Only</span>
            <CCBadge variant={policy.require_verified_testing ? 'success' : 'outline'}>
              {policy.require_verified_testing ? 'Required' : 'Optional'}
            </CCBadge>
          </div>

          {policy.require_full_panel_within_days && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#9AA6BC]">Panel Recency</span>
              <CCBadge variant="warning">Within {policy.require_full_panel_within_days} days</CCBadge>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9AA6BC]">HIV Requirement</span>
            <CCBadge variant={policy.require_hiv_negative_only ? 'danger' : 'success'}>
              {policy.require_hiv_negative_only ? 'Negative Only' : policy.allow_hiv_undetectable ? 'Negative or U=U' : 'Negative'}
            </CCBadge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9AA6BC]">Self-Reported</span>
            <CCBadge variant={policy.allow_self_reported ? 'success' : 'outline'}>
              {policy.allow_self_reported ? 'Allowed' : 'Not Allowed'}
            </CCBadge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9AA6BC]">Contract Gate</span>
            <CCBadge variant={policy.require_testing_before_contract ? 'primary' : 'outline'}>
              {policy.require_testing_before_contract ? 'Enabled' : 'Disabled'}
            </CCBadge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[#9AA6BC]">Schedule Lock Gate</span>
            <CCBadge variant={policy.require_testing_before_schedule_lock ? 'primary' : 'outline'}>
              {policy.require_testing_before_schedule_lock ? 'Enabled' : 'Disabled'}
            </CCBadge>
          </div>

          {!isAdmin && (
            <div className="bg-[#263248]/30 rounded-lg p-3 flex items-start gap-2 mt-4">
              <Info className="w-4 h-4 text-[#6B7A94] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#9AA6BC]">
                Only Collaboration Admins can edit testing policy
              </p>
            </div>
          )}
        </div>
      )}
    </CCCard>
  );
}