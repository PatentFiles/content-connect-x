import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import React from 'react';
import { 
  ArrowLeft, Download, Send, CheckCircle, Clock, Eye, 
  History, FileText, AlertTriangle, Edit, Users, Calendar,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCModal from '@/components/ui-custom/CCModal';
import { useVerificationCheck } from '@/components/auth/useVerificationCheck';
import VerificationRequired from '@/components/auth/VerificationRequired';
import ContractVersionHistory from './ContractVersionHistory';
import ContractAuditLog from './ContractAuditLog';
import ConsentRevocationBanner from '@/components/collaboration/ConsentRevocationBanner';
import { logRepObserverAccess } from '@/components/collaboration/RepObserverAccessControl';

export default function ContractViewer({ contractId }) {
  const [searchParams] = useSearchParams();
  const id = contractId || searchParams.get('id');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const queryClient = useQueryClient();
  
  const { checking: verificationChecking, blocked: verificationBlocked } = useVerificationCheck('sign_contract');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contract', id],
    queryFn: () => base44.entities.Contract.filter({ id }),
    enabled: !!id,
  });

  const contract = contracts[0];

  const { data: versions = [] } = useQuery({
    queryKey: ['contractVersions', id],
    queryFn: () => base44.entities.ContractVersion.filter({ contract_id: id }),
    enabled: !!id,
  });

  const { data: signatures = [] } = useQuery({
    queryKey: ['contractSignatures', id],
    queryFn: () => base44.entities.ContractSignature.filter({ contract_id: id }),
    enabled: !!id,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['contractAuditLogs', id],
    queryFn: () => base44.entities.ContractAuditLog.filter({ contract_id: id }),
    enabled: !!id,
  });

  const currentVersion = versions.find(v => v.id === contract?.current_version_id) || versions[versions.length - 1];

  const signContractMutation = useMutation({
    mutationFn: async () => {
      // Create signature
      await base44.entities.ContractSignature.create({
        contract_id: id,
        user_id: user.email,
        signature_text: user.full_name || user.email,
        signed_at: new Date().toISOString(),
      });

      // Update contract signatories
      const updatedSignatories = contract.signatories?.map(s => 
        s.user_id === user.email 
          ? { ...s, signed: true, signed_at: new Date().toISOString() }
          : s
      ) || [];

      const allSigned = updatedSignatories.every(s => s.signed);
      
      // Update contract status
      const newStatus = allSigned ? 'signed' : 'partially_signed';
      await base44.entities.Contract.update(id, {
        signatories: updatedSignatories,
        status: newStatus,
        ...(allSigned && { signed_at: new Date().toISOString() }),
      });

      // Create audit log
      await base44.entities.ContractAuditLog.create({
        contract_id: id,
        collaboration_id: contract.collaboration_id,
        action: allSigned ? 'contract_signed' : 'signature_added',
        actor_email: user.email,
        metadata_json: { signatory: user.email },
      });

      return { allSigned };
    },
    onSuccess: ({ allSigned }) => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contractSignatures', id] });
      queryClient.invalidateQueries({ queryKey: ['contractAuditLogs', id] });
      toast.success(allSigned ? 'Contract fully signed!' : 'Signature added successfully');
      setShowSignModal(false);
    },
    onError: () => {
      toast.error('Failed to sign contract');
    },
  });

  const downloadPDFMutation = useMutation({
    mutationFn: async () => {
      // Log download
      await base44.entities.ContractAuditLog.create({
        contract_id: id,
        collaboration_id: contract.collaboration_id,
        action: 'pdf_downloaded',
        actor_email: user.email,
      });
      return contract.pdf_url;
    },
    onSuccess: (url) => {
      window.open(url, '_blank');
      queryClient.invalidateQueries({ queryKey: ['contractAuditLogs', id] });
    },
  });

  if (isLoading || verificationChecking) {
    return <CCLoadingScreen message="Loading contract..." />;
  }

  if (verificationBlocked) {
    return <VerificationRequired action="sign contracts" />;
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <CCCard padding="xl" className="text-center">
          <p className="text-[#9AA6BC]">Contract not found</p>
          <Link to={createPageUrl('Contracts')}>
            <CCButton variant="primary" className="mt-4">
              Back to Contracts
            </CCButton>
          </Link>
        </CCCard>
      </div>
    );
  }

  // Check for active consent revocation
  const { data: revocations = [] } = useQuery({
    queryKey: ['consentRevocations', contract.collaboration_id],
    queryFn: () => base44.entities.ConsentRevocation.filter({ 
      collaboration_id: contract.collaboration_id,
      status: 'active'
    }),
    enabled: !!contract.collaboration_id,
  });

  const hasActiveRevocation = revocations.length > 0;
  const isContractLocked = hasActiveRevocation || contract.status === 'disputed';

  // Check if user is RepObserver
  const { data: participantRoles = [] } = useQuery({
    queryKey: ['participantRoles', contract.collaboration_id],
    queryFn: () => base44.entities.CollaborationParticipantRole.filter({
      collaboration_id: contract.collaboration_id,
      user_id: user?.email
    }),
    enabled: !!contract?.collaboration_id && !!user?.email,
  });

  const userRole = participantRoles[0];
  const isRepObserver = userRole?.role === 'RepObserver';

  // Log RepObserver access
  React.useEffect(() => {
    if (isRepObserver && contract?.id) {
      logRepObserverAccess(
        contract.collaboration_id,
        user?.email,
        'VIEW_CONTRACT',
        { contract_id: contract.id }
      );
    }
  }, [isRepObserver, contract?.id, user?.email]);

  const userHasSigned = signatures.some(s => s.user_id === user?.email);
  const canSign = !isContractLocked && !isRepObserver && contract.status === 'sent' && contract.signatories?.some(s => s.user_id === user?.email && !s.signed);
  
  const statusConfig = {
    draft: { variant: 'default', icon: FileText },
    generated: { variant: 'primary', icon: FileText },
    sent: { variant: 'warning', icon: Clock },
    partially_signed: { variant: 'warning', icon: Clock },
    signed: { variant: 'success', icon: CheckCircle },
    completed: { variant: 'success', icon: CheckCircle },
    disputed: { variant: 'danger', icon: AlertTriangle },
    expired: { variant: 'danger', icon: AlertTriangle },
    voided: { variant: 'danger', icon: AlertTriangle },
  };

  const status = statusConfig[contract.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link to={createPageUrl('Contracts')}>
            <CCButton variant="ghost" size="sm" icon={ArrowLeft} className="mb-3">
              Back to Contracts
            </CCButton>
          </Link>
          
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-[#E8EEF9] mb-2">{contract.title}</h1>
              <div className="flex items-center gap-3 flex-wrap">
                <CCBadge variant={status.variant} icon={status.icon}>
                  {contract.status.replace('_', ' ')}
                </CCBadge>
                <span className="text-sm text-[#9AA6BC]">Version {contract.version}</span>
                <span className="text-sm text-[#9AA6BC]">
                  {signatures.length}/{contract.signatories?.length || 0} signed
                </span>
              </div>
            </div>
            
            <div className="flex gap-2 flex-wrap">
              {contract.pdf_url && (
                <CCButton 
                  variant="outline" 
                  icon={Download}
                  onClick={() => downloadPDFMutation.mutate()}
                  loading={downloadPDFMutation.isPending}
                >
                  Download PDF
                </CCButton>
              )}
              {canSign && (
                <CCButton 
                  variant="primary" 
                  icon={CheckCircle}
                  onClick={() => setShowSignModal(true)}
                >
                  Sign Contract
                </CCButton>
              )}
              <CCButton variant="outline" icon={History} onClick={() => setShowVersionHistory(true)}>
                History
              </CCButton>
              <CCButton variant="outline" icon={Shield} onClick={() => setShowAuditLog(true)}>
                Audit Log
              </CCButton>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <ConsentRevocationBanner collaborationId={contract.collaboration_id} />
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <CCCard padding="lg">
              <div className="prose prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: currentVersion?.body_html || '<p>No content available</p>' }} />
              </div>
            </CCCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contract Info */}
            <CCCard padding="lg">
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-4">Contract Details</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[#6B7A94]">Created</p>
                  <p className="text-[#E8EEF9]">{format(new Date(contract.created_date), 'MMM d, yyyy')}</p>
                </div>
                {contract.effective_date && (
                  <div>
                    <p className="text-[#6B7A94]">Effective Date</p>
                    <p className="text-[#E8EEF9]">{format(new Date(contract.effective_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {contract.signed_at && (
                  <div>
                    <p className="text-[#6B7A94]">Signed</p>
                    <p className="text-[#22C55E]">{format(new Date(contract.signed_at), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {contract.expires_at && (
                  <div>
                    <p className="text-[#6B7A94]">Expires</p>
                    <p className="text-[#F59E0B]">{format(new Date(contract.expires_at), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>
            </CCCard>

            {/* Parties */}
            {contract.parties?.length > 0 && (
              <CCCard padding="lg">
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Parties
                </h3>
                <div className="space-y-3">
                  {contract.parties.map((party, idx) => (
                    <div key={idx} className="text-sm">
                      <p className="text-[#E8EEF9] font-medium">
                        {party.stage_name || party.legal_name || party.company_name || party.email}
                      </p>
                      <p className="text-[#6B7A94] text-xs capitalize">{party.role_type}</p>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Signatures */}
            <CCCard padding="lg">
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-4">Signatures</h3>
              <div className="space-y-2">
                {contract.signatories?.map((sig, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-[#9AA6BC]">{sig.name}</span>
                    {sig.signed ? (
                      <div className="flex items-center gap-1 text-[#22C55E]">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-xs">{format(new Date(sig.signed_at), 'MMM d')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[#6B7A94]">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">Pending</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CCCard>
          </div>
        </div>
      </div>

      {/* Sign Modal */}
      <CCModal
        isOpen={showSignModal}
        onClose={() => setShowSignModal(false)}
        title="Sign Contract"
        description="By signing, you agree to all terms and conditions"
      >
        <div className="space-y-4">
          <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4">
            <p className="text-sm text-[#E8EEF9] mb-2">I hereby sign this contract:</p>
            <p className="text-lg font-semibold text-[#4F8CFF]">{user?.full_name || user?.email}</p>
            <p className="text-xs text-[#6B7A94] mt-2">
              Date: {format(new Date(), 'PPP')}
            </p>
          </div>
          
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setShowSignModal(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary" 
              onClick={() => signContractMutation.mutate()}
              loading={signContractMutation.isPending}
            >
              Confirm Signature
            </CCButton>
          </div>
        </div>
      </CCModal>

      {/* Version History Modal */}
      <CCModal
        isOpen={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        title="Version History"
        size="lg"
      >
        <ContractVersionHistory versions={versions} contractId={id} />
      </CCModal>

      {/* Audit Log Modal */}
      <CCModal
        isOpen={showAuditLog}
        onClose={() => setShowAuditLog(false)}
        title="Audit Log"
        size="lg"
      >
        <ContractAuditLog logs={auditLogs} />
      </CCModal>
    </div>
  );
}