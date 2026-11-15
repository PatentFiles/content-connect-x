import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Plus } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCModal from '@/components/ui-custom/CCModal';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import { toast } from 'sonner';

const jurisdictions = [
  { code: 'US', name: 'United States', compliance: '2257/2257A' },
  { code: 'UK', name: 'United Kingdom', compliance: 'R18' },
  { code: 'EU', name: 'European Union', compliance: 'GDPR-aligned' },
  { code: 'CA', name: 'Canada', compliance: 'C-11' },
  { code: 'AU', name: 'Australia', compliance: 'Classification Act' },
  { code: 'OTHER', name: 'Other', compliance: 'Generic International' },
];

export default function JurisdictionManager({ currentAdmin }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({
    jurisdiction_code: '',
    rule_type: '',
    min_retention_days: 2555,
    strictness_level: 3,
  });
  const queryClient = useQueryClient();

  const { data: rules = [] } = useQuery({
    queryKey: ['jurisdictionRules'],
    queryFn: () => base44.entities.JurisdictionRule.list(),
  });

  const createRuleMutation = useMutation({
    mutationFn: (data) => {
      const jurisdiction = jurisdictions.find(j => j.code === data.jurisdiction_code);
      return base44.entities.JurisdictionRule.create({
        ...data,
        jurisdiction_name: jurisdiction?.name,
        requirements_json: {
          compliance_standard: jurisdiction?.compliance,
          retention_days: data.min_retention_days,
          strictness: data.strictness_level
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictionRules'] });
      toast.success('Jurisdiction rule created');
      setShowAddModal(false);
      setNewRule({
        jurisdiction_code: '',
        rule_type: '',
        min_retention_days: 2555,
        strictness_level: 3,
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.JurisdictionRule.update(id, { active: !active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jurisdictionRules'] });
      toast.success('Rule status updated');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Jurisdiction Management</h2>
          <p className="text-sm text-[#6B7A94]">Configure compliance rules by jurisdiction</p>
        </div>
        <CCButton variant="primary" icon={Plus} onClick={() => setShowAddModal(true)}>
          Add Rule
        </CCButton>
      </div>

      {/* Jurisdictions Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {jurisdictions.map(jurisdiction => {
          const jurisdictionRules = rules.filter(r => r.jurisdiction_code === jurisdiction.code);
          const activeRules = jurisdictionRules.filter(r => r.active);
          
          return (
            <CCCard key={jurisdiction.code} padding="lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#4F8CFF]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#E8EEF9]">{jurisdiction.name}</h3>
                    <p className="text-xs text-[#6B7A94]">{jurisdiction.compliance}</p>
                  </div>
                </div>
                <CCBadge variant={activeRules.length > 0 ? 'success' : 'default'} size="sm">
                  {activeRules.length} active rules
                </CCBadge>
              </div>
              {jurisdictionRules.length > 0 && (
                <div className="space-y-2 mt-3">
                  {jurisdictionRules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between bg-[#151D2B] rounded-lg px-3 py-2">
                      <div>
                        <p className="text-xs text-[#E8EEF9] capitalize">{rule.rule_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-[#6B7A94]">Level {rule.strictness_level}</p>
                      </div>
                      <CCButton
                        variant={rule.active ? 'success' : 'outline'}
                        size="sm"
                        onClick={() => toggleRuleMutation.mutate({ id: rule.id, active: rule.active })}
                      >
                        {rule.active ? 'Active' : 'Inactive'}
                      </CCButton>
                    </div>
                  ))}
                </div>
              )}
            </CCCard>
          );
        })}
      </div>

      {/* Add Rule Modal */}
      <CCModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Jurisdiction Rule"
        description="Configure compliance requirements for a jurisdiction"
      >
        <div className="space-y-4">
          <CCSelect
            label="Jurisdiction *"
            value={newRule.jurisdiction_code}
            onChange={(e) => setNewRule({ ...newRule, jurisdiction_code: e.target.value })}
            required
          >
            <option value="">Select jurisdiction</option>
            {jurisdictions.map(j => (
              <option key={j.code} value={j.code}>{j.name} ({j.compliance})</option>
            ))}
          </CCSelect>

          <CCSelect
            label="Rule Type *"
            value={newRule.rule_type}
            onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
            required
          >
            <option value="">Select rule type</option>
            <option value="verification">Verification</option>
            <option value="recordkeeping">Recordkeeping</option>
            <option value="consent">Consent</option>
            <option value="age_verification">Age Verification</option>
            <option value="data_retention">Data Retention</option>
          </CCSelect>

          <CCInput
            label="Retention Period (days)"
            type="number"
            value={newRule.min_retention_days}
            onChange={(e) => setNewRule({ ...newRule, min_retention_days: parseInt(e.target.value) })}
            hint="Minimum record retention required"
          />

          <CCSelect
            label="Strictness Level"
            value={newRule.strictness_level}
            onChange={(e) => setNewRule({ ...newRule, strictness_level: parseInt(e.target.value) })}
          >
            <option value="1">1 - Minimal</option>
            <option value="2">2 - Light</option>
            <option value="3">3 - Standard</option>
            <option value="4">4 - Strict</option>
            <option value="5">5 - Maximum</option>
          </CCSelect>

          <div className="flex gap-3 justify-end pt-4">
            <CCButton variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={() => createRuleMutation.mutate(newRule)}
              loading={createRuleMutation.isPending}
              disabled={!newRule.jurisdiction_code || !newRule.rule_type}
            >
              Create Rule
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}