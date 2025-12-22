import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Filter, 
  Download, 
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  ChevronRight,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import { CCLoadingScreen, CCSkeletonLoader } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';
import CCModal from '@/components/ui-custom/CCModal';
import CCSelect from '@/components/ui-custom/CCSelect';

const statusConfig = {
  draft: { label: 'Draft', variant: 'default', icon: FileText },
  sent: { label: 'Sent', variant: 'warning', icon: Clock },
  partially_signed: { label: 'Awaiting Signatures', variant: 'warning', icon: AlertCircle },
  signed: { label: 'Signed', variant: 'success', icon: CheckCircle },
  expired: { label: 'Expired', variant: 'danger', icon: AlertCircle },
  voided: { label: 'Voided', variant: 'danger', icon: AlertCircle },
};

const templateLabels = {
  creator_to_creator: 'Creator to Creator',
  studio_release: 'Studio Release',
  photo_service: 'Photo Service',
  video_service: 'Video Service',
  agent_managed: 'Agent Managed',
};

export default function Contracts() {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCollaboration, setSelectedCollaboration] = useState('');
  const [contractTitle, setContractTitle] = useState('');
  const [templateType, setTemplateType] = useState('custom');
  const queryClient = useQueryClient();

  // Check auth and access
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: verification } = useQuery({
    queryKey: ['verification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: subscription } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const isVerified = verification?.[0]?.status === 'approved';
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch contracts
  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['contracts', user?.email],
    queryFn: async () => {
      // In a real app, filter by user participation
      return base44.entities.Contract.list('-created_date');
    },
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch collaborations for contract creation
  const { data: collaborations = [] } = useQuery({
    queryKey: ['collaborations', user?.email],
    queryFn: async () => {
      const allRooms = await base44.entities.DealRoom.list('-created_date');
      return allRooms.filter(r => r.participant_ids?.includes(user?.email));
    },
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch signatures
  const { data: signatures = [] } = useQuery({
    queryKey: ['signatures', contracts],
    queryFn: async () => {
      const allSigs = await base44.entities.ContractSignature.list();
      return allSigs;
    },
    enabled: contracts.length > 0,
  });

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: async (data) => {
      const collaboration = collaborations.find(c => c.id === data.collaboration_id);
      return base44.entities.Contract.create({
        deal_room_id: data.collaboration_id,
        title: data.title,
        template_type: data.template_type,
        content: {
          collaboration_details: {
            name: collaboration?.collaboration_name,
            scene_type: collaboration?.scene_type,
            scenes: collaboration?.scene_selected,
            acts: collaboration?.acts_selected,
            compensation: collaboration?.compensation_details,
            schedule: collaboration?.schedule,
            location: collaboration?.location,
            deliverables: collaboration?.deliverables,
            usage_rights: collaboration?.usage_rights,
          }
        },
        status: 'draft',
        created_by: user.email,
        signatories: collaboration?.participant_ids?.map(email => ({
          user_id: email,
          name: email,
          signed: false
        })) || []
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Contract created successfully');
      setCreateModalOpen(false);
      setSelectedCollaboration('');
      setContractTitle('');
      setTemplateType('custom');
      window.location.href = createPageUrl(`ViewContract?id=${result.id}`);
    },
    onError: () => {
      toast.error('Failed to create contract');
    },
  });

  const handleCreateContract = () => {
    if (!selectedCollaboration || !contractTitle) {
      toast.error('Please select a collaboration and enter a contract title');
      return;
    }
    createContractMutation.mutate({
      collaboration_id: selectedCollaboration,
      title: contractTitle,
      template_type: templateType,
    });
  };

  if (userLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <AccessGate type="both" />;
  }

  if (!isVerified) {
    return <AccessGate type="verification" />;
  }

  if (!isSubscribed) {
    return <AccessGate type="subscription" />;
  }

  const filteredContracts = contracts.filter(c => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.content?.title?.toLowerCase().includes(q) ||
             templateLabels[c.template_type]?.toLowerCase().includes(q);
    }
    return true;
  });

  const getSignatureStatus = (contract) => {
    const contractSigs = signatures.filter(s => s.contract_id === contract.id);
    const totalParties = contract.content?.parties?.length || 2;
    return { signed: contractSigs.length, total: totalParties };
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Contracts</h1>
                <p className="text-xs text-[#6B7A94]">Manage collaboration agreements</p>
              </div>
            </div>
            <CCButton variant="primary" icon={Plus} onClick={() => setCreateModalOpen(true)}>
              New Contract
            </CCButton>
          </div>

          {/* Search */}
          <CCInput
            placeholder="Search contracts..."
            icon={Search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-4"
          />

          {/* Filters */}
          <div className="flex gap-2 justify-center overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {['all', 'draft', 'sent', 'signed', 'expired'].map((status) => (
              <CCButton
                key={status}
                variant={filter === status ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </CCButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {contractsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <CCCard key={i} padding="lg">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <CCSkeletonLoader className="h-6 w-48" />
                    <CCSkeletonLoader className="h-6 w-20 rounded-full" />
                  </div>
                  <CCSkeletonLoader className="h-4 w-32" />
                </div>
              </CCCard>
            ))}
          </div>
        ) : filteredContracts.length === 0 ? (
          <CCEmpty
            icon={FileText}
            title="No contracts yet"
            description="Create contracts for your collaborations to formalize agreements."
            action={() => setCreateModalOpen(true)}
            actionLabel="Create Contract"
          />
        ) : (
          <div className="space-y-4">
            {filteredContracts.map((contract) => {
              const status = statusConfig[contract.status] || statusConfig.draft;
              const sigStatus = getSignatureStatus(contract);
              
              return (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Link to={createPageUrl(`ViewContract?id=${contract.id}`)}>
                    <CCCard hover clickable padding="lg">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-medium text-[#E8EEF9]">
                            {contract.content?.title || templateLabels[contract.template_type]}
                          </h3>
                          <p className="text-sm text-[#6B7A94]">
                            {templateLabels[contract.template_type]} • Version {contract.version}
                          </p>
                        </div>
                        <CCBadge variant={status.variant} icon={status.icon}>
                          {status.label}
                        </CCBadge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="text-[#9AA6BC]">
                          Created: {new Date(contract.created_date).toLocaleDateString()}
                        </span>
                        {contract.signed_at && (
                          <span className="text-[#22C55E]">
                            Signed: {new Date(contract.signed_at).toLocaleDateString()}
                          </span>
                        )}
                        {contract.expires_at && (
                          <span className="text-[#F59E0B]">
                            Expires: {new Date(contract.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Signature Progress */}
                      <div className="mt-4 pt-3 border-t border-[#263248]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[#9AA6BC]">Signatures:</span>
                            <div className="flex items-center gap-1">
                              {Array(sigStatus.total).fill(0).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full ${
                                    i < sigStatus.signed ? 'bg-[#22C55E]' : 'bg-[#263248]'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-[#9AA6BC]">
                              {sigStatus.signed}/{sigStatus.total}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {contract.pdf_url && (
                              <CCButton
                                variant="ghost"
                                size="sm"
                                icon={Download}
                                onClick={(e) => {
                                  e.preventDefault();
                                  window.open(contract.pdf_url, '_blank');
                                }}
                              >
                                PDF
                              </CCButton>
                            )}
                            <span className="text-sm text-[#4F8CFF] flex items-center gap-1">
                              View <ChevronRight className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </CCCard>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Contract Modal */}
      <CCModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Contract"
        description="Create a new contract from one of your collaborations"
      >
        <div className="space-y-4">
          <CCInput
            label="Contract Title"
            placeholder="e.g., Content Creation Agreement"
            value={contractTitle}
            onChange={(e) => setContractTitle(e.target.value)}
            required
          />
          
          <CCSelect
            label="Select Collaboration"
            value={selectedCollaboration}
            onChange={(e) => setSelectedCollaboration(e.target.value)}
            required
          >
            <option value="">Choose a collaboration...</option>
            {collaborations.map(collab => (
              <option key={collab.id} value={collab.id}>
                {collab.collaboration_name || `${collab.scene_type || 'Collaboration'} - ${new Date(collab.created_date).toLocaleDateString()}`}
              </option>
            ))}
          </CCSelect>

          <CCSelect
            label="Contract Template"
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
          >
            <option value="custom">Custom Agreement</option>
            <option value="creator_to_creator">Creator to Creator</option>
            <option value="studio_contract">Studio Contract</option>
            <option value="photographer_contract">Photographer Contract</option>
          </CCSelect>

          {selectedCollaboration && (
            <div className="bg-[#0B0F14] border border-[#263248] rounded-lg p-4">
              <p className="text-xs text-[#6B7A94] mb-2">Contract will include:</p>
              <ul className="text-sm text-[#E8EEF9] space-y-1">
                {(() => {
                  const collab = collaborations.find(c => c.id === selectedCollaboration);
                  return (
                    <>
                      <li>• Scene: {collab?.scene_type || 'N/A'}</li>
                      <li>• Compensation: {collab?.compensation_type?.replace('_', ' ') || 'N/A'}</li>
                      <li>• Participants: {collab?.participant_ids?.length || 0}</li>
                      <li>• Location: {collab?.location?.city || 'TBD'}</li>
                    </>
                  );
                })()}
              </ul>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <CCButton variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary" 
              onClick={handleCreateContract}
              loading={createContractMutation.isPending}
              disabled={!selectedCollaboration || !contractTitle}
            >
              Create Contract
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}