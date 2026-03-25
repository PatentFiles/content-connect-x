import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { FileText, Plus, Send, CheckCircle2, Clock, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import AIContractBuilder from '@/components/contracts/AIContractBuilder';
import TemplateContractGenerator from '@/components/contracts/TemplateContractGenerator';

export default function ContractManager({ collaborationId, profiles, user }) {
  const [showNewContract, setShowNewContract] = useState(false);
  const [newContract, setNewContract] = useState({ title: '', template_type: 'custom' });
  const queryClient = useQueryClient();

  const { data: contracts = [] } = useQuery({
    queryKey: ['collaborationContracts', collaborationId],
    queryFn: () => base44.entities.Contract.filter({ collaboration_id: collaborationId }),
    enabled: !!collaborationId,
  });

  const createContractMutation = useMutation({
    mutationFn: (data) => base44.entities.Contract.create({
      ...data,
      collaboration_id: collaborationId,
      created_by: user.email,
      signatories: profiles.map(p => ({
        user_id: p.user_id,
        name: p.display_name,
        signed: false,
      })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationContracts']);
      setShowNewContract(false);
      setNewContract({ title: '', template_type: 'custom' });
      toast.success('Contract created');
    },
  });

  const updateContractMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Contract.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationContracts']);
    },
  });

  const signContract = (contract) => {
    const updatedSignatories = contract.signatories.map(s => 
      s.user_id === user.email 
        ? { ...s, signed: true, signed_at: new Date().toISOString() }
        : s
    );
    const allSigned = updatedSignatories.every(s => s.signed);
    
    updateContractMutation.mutate({
      id: contract.id,
      data: {
        signatories: updatedSignatories,
        status: allSigned ? 'completed' : contract.status,
      },
    });
    toast.success('Contract signed');
  };

  const sendContract = (contract) => {
    updateContractMutation.mutate({
      id: contract.id,
      data: {
        status: 'sent',
        sent_date: new Date().toISOString(),
      },
    });
    toast.success('Contract sent for signatures');
  };

  const statusColors = {
    draft: 'default',
    sent: 'primary',
    signed: 'warning',
    completed: 'success',
    cancelled: 'danger',
  };

  return (
    <div className="space-y-4">
      <CCButton
        variant="primary"
        icon={Plus}
        onClick={() => setShowNewContract(!showNewContract)}
      >
        New Contract
      </CCButton>

      {showNewContract && (
        <CCCard className="p-4">
          <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Create Contract</h3>
          <div className="space-y-3">
            <CCInput
              label="Contract Title"
              placeholder="e.g., Content Creation Agreement"
              value={newContract.title}
              onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
            />
            <div>
              <label className="text-sm text-[#9AA6BC] mb-1 block">Template Type</label>
              <select
                value={newContract.template_type}
                onChange={(e) => setNewContract({ ...newContract, template_type: e.target.value })}
                className="w-full bg-[#151D2B] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9]"
              >
                <option value="custom">Custom</option>
                <option value="creator_to_creator">Creator to Creator</option>
                <option value="studio_contract">Studio Contract</option>
                <option value="photographer_contract">Photographer Contract</option>
              </select>
            </div>
            <div className="flex gap-2">
              <CCButton 
                variant="primary" 
                onClick={() => createContractMutation.mutate(newContract)}
                disabled={!newContract.title}
              >
                Create
              </CCButton>
              <CCButton variant="outline" onClick={() => setShowNewContract(false)}>
                Cancel
              </CCButton>
            </div>
          </div>
        </CCCard>
      )}

      <div className="space-y-3">
        {contracts.length === 0 ? (
          <CCEmpty icon={FileText} title="No contracts yet" description="Create a contract to get started" />
        ) : (
          contracts.map((contract) => {
            const userSignatory = contract.signatories?.find(s => s.user_id === user.email);
            const signedCount = contract.signatories?.filter(s => s.signed).length || 0;
            const totalSignatories = contract.signatories?.length || 0;

            return (
              <CCCard key={contract.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-[#E8EEF9]">{contract.title}</h4>
                      <CCBadge variant={statusColors[contract.status]}>
                        {contract.status}
                      </CCBadge>
                    </div>
                    <p className="text-xs text-[#6B7A94] capitalize">
                      {contract.template_type.replace('_', ' ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {contract.status === 'draft' && contract.created_by === user.email && (
                      <CCButton
                        variant="primary"
                        size="sm"
                        icon={Send}
                        onClick={() => sendContract(contract)}
                      >
                        Send
                      </CCButton>
                    )}
                    {contract.status === 'sent' && userSignatory && !userSignatory.signed && (
                      <CCButton
                        variant="success"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => signContract(contract)}
                      >
                        Sign
                      </CCButton>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7A94]">Signatures</span>
                    <span className="text-[#E8EEF9]">{signedCount}/{totalSignatories}</span>
                  </div>
                  <div className="space-y-1">
                    {contract.signatories?.map((sig, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-[#9AA6BC]">{sig.name}</span>
                        {sig.signed ? (
                          <div className="flex items-center gap-1 text-[#22C55E]">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Signed {format(new Date(sig.signed_at), 'MMM d')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[#6B7A94]">
                            <Clock className="w-3 h-3" />
                            <span>Pending</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CCCard>
            );
          })
        )}
      </div>
    </div>
  );
}