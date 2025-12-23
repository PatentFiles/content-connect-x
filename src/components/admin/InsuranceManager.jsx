import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, CheckCircle, AlertTriangle, Upload } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function InsuranceManager({ collaborationId, currentUser }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newInsurance, setNewInsurance] = useState({
    insurance_type: '',
    provider: '',
    policy_reference: '',
    coverage_start: '',
    coverage_end: '',
    coverage_scope: [],
    document_url: '',
  });
  const queryClient = useQueryClient();

  const { data: insurances = [] } = useQuery({
    queryKey: ['collaborationInsurance', collaborationId],
    queryFn: () => base44.entities.CollaborationInsurance.filter({ collaboration_id: collaborationId }),
    enabled: !!collaborationId,
  });

  const createInsuranceMutation = useMutation({
    mutationFn: (data) => base44.entities.CollaborationInsurance.create({
      ...data,
      collaboration_id: collaborationId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborationInsurance'] });
      toast.success('Insurance record added');
      setShowAddModal(false);
      setNewInsurance({
        insurance_type: '',
        provider: '',
        policy_reference: '',
        coverage_start: '',
        coverage_end: '',
        coverage_scope: [],
        document_url: '',
      });
    },
  });

  const verifyInsuranceMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.CollaborationInsurance.update(id, {
      verified: true,
      verified_by_admin_id: currentUser?.email,
      verified_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborationInsurance'] });
      toast.success('Insurance verified');
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewInsurance({ ...newInsurance, document_url: file_url });
      toast.success('Document uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleCoverageScope = (scope) => {
    const current = newInsurance.coverage_scope;
    const updated = current.includes(scope)
      ? current.filter(s => s !== scope)
      : [...current, scope];
    setNewInsurance({ ...newInsurance, coverage_scope: updated });
  };

  return (
    <CCCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#4F8CFF]" />
          <h3 className="text-lg font-semibold text-[#E8EEF9]">Insurance & Coverage</h3>
        </div>
        <CCButton variant="primary" size="sm" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Insurance
        </CCButton>
      </div>

      {insurances.length === 0 ? (
        <div className="text-center py-6">
          <Shield className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-sm text-[#9AA6BC]">No insurance records</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insurances.map(insurance => (
            <div key={insurance.id} className="bg-[#151D2B] rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#E8EEF9] capitalize">
                      {insurance.insurance_type.replace(/_/g, ' ')}
                    </p>
                    {insurance.verified ? (
                      <CCBadge variant="success" size="sm" icon={CheckCircle}>Verified</CCBadge>
                    ) : (
                      <CCBadge variant="warning" size="sm" icon={AlertTriangle}>Pending</CCBadge>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7A94]">{insurance.provider}</p>
                </div>
                {!insurance.verified && (
                  <CCButton
                    variant="success"
                    size="sm"
                    onClick={() => verifyInsuranceMutation.mutate({ id: insurance.id })}
                    loading={verifyInsuranceMutation.isPending}
                  >
                    Verify
                  </CCButton>
                )}
              </div>
              <div className="text-xs text-[#6B7A94] space-y-1">
                <p>Coverage: {format(new Date(insurance.coverage_start), 'MMM d, yyyy')} - {format(new Date(insurance.coverage_end), 'MMM d, yyyy')}</p>
                {insurance.coverage_scope?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {insurance.coverage_scope.map(scope => (
                      <CCBadge key={scope} variant="outline" size="sm">
                        {scope.replace(/_/g, ' ')}
                      </CCBadge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Insurance Modal */}
      <CCModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Insurance Coverage"
        size="md"
      >
        <div className="space-y-4">
          <CCSelect
            label="Insurance Type *"
            value={newInsurance.insurance_type}
            onChange={(e) => setNewInsurance({ ...newInsurance, insurance_type: e.target.value })}
            required
          >
            <option value="">Select type</option>
            <option value="performer_personal">Performer Personal</option>
            <option value="studio_production">Studio Production</option>
            <option value="agent_liability">Agent Liability</option>
            <option value="general_liability">General Liability</option>
          </CCSelect>

          <CCInput
            label="Provider *"
            placeholder="Insurance company name"
            value={newInsurance.provider}
            onChange={(e) => setNewInsurance({ ...newInsurance, provider: e.target.value })}
            required
          />

          <CCInput
            label="Policy Reference"
            placeholder="Policy number (private)"
            value={newInsurance.policy_reference}
            onChange={(e) => setNewInsurance({ ...newInsurance, policy_reference: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <CCInput
              label="Coverage Start *"
              type="date"
              value={newInsurance.coverage_start}
              onChange={(e) => setNewInsurance({ ...newInsurance, coverage_start: e.target.value })}
              required
            />
            <CCInput
              label="Coverage End *"
              type="date"
              value={newInsurance.coverage_end}
              onChange={(e) => setNewInsurance({ ...newInsurance, coverage_end: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Coverage Scope</label>
            <div className="flex flex-wrap gap-2">
              {['general_liability', 'production', 'travel', 'medical', 'equipment'].map(scope => (
                <CCButton
                  key={scope}
                  variant={newInsurance.coverage_scope.includes(scope) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => toggleCoverageScope(scope)}
                >
                  {scope.replace(/_/g, ' ')}
                </CCButton>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Upload Certificate (Optional)</label>
            <label className="flex items-center justify-center gap-2 p-4 bg-[#151D2B] border-2 border-dashed border-[#263248] rounded-lg cursor-pointer hover:border-[#4F8CFF] transition-colors">
              <Upload className="w-4 h-4 text-[#6B7A94]" />
              <span className="text-sm text-[#9AA6BC]">
                {uploading ? 'Uploading...' : newInsurance.document_url ? 'Certificate uploaded' : 'Upload insurance certificate'}
              </span>
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png"
              />
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <CCButton variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={() => createInsuranceMutation.mutate(newInsurance)}
              loading={createInsuranceMutation.isPending}
              disabled={!newInsurance.insurance_type || !newInsurance.provider || !newInsurance.coverage_start || !newInsurance.coverage_end}
            >
              Add Insurance
            </CCButton>
          </div>
        </div>
      </CCModal>
    </CCCard>
  );
}