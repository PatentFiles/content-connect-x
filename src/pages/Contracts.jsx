import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
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
  ChevronRight
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import { CCLoadingScreen, CCSkeletonLoader } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';

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

  // Fetch signatures
  const { data: signatures = [] } = useQuery({
    queryKey: ['signatures', contracts],
    queryFn: async () => {
      const allSigs = await base44.entities.ContractSignature.list();
      return allSigs;
    },
    enabled: contracts.length > 0,
  });

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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Contracts</h1>
                <p className="text-xs text-[#6B7A94]">Your agreements and releases</p>
              </div>
            </div>
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
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
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
            description="Contracts are generated from completed Deal Rooms. Start a collaboration to create your first contract."
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
    </div>
  );
}