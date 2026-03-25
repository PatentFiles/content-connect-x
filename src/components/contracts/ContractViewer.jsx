import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
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
import PrintContract from './PrintContract';
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

  const [signedName, setSignedName] = useState('');

  const signContractMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('signContract', {
        action: 'sign',
        contract_id: id,
        signed_name: signedName || user?.full_name || user?.email,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contractSignatures', id] });
      queryClient.invalidateQueries({ queryKey: ['contractAuditLogs', id] });
      toast.success(data.all_signed ? 'Contract fully signed by all parties!' : 'Signature recorded successfully');
      setShowSignModal(false);
    },
    onError: (e) => {
      toast.error(e.message || 'Failed to sign contract');
    },
  });

  const sendForSignaturesMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('signContract', {
        action: 'send_for_signatures',
        contract_id: id,
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contractAuditLogs', id] });
      toast.success('Contract sent for signatures — all participants notified');
    },
    onError: (e) => {
      toast.error(e.message || 'Failed to send contract');
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

  const userHasSigned = signatures.some(s => s.signer_id === user?.email);
  const isSignatory = contract.signatories?.some(s => s.user_id === user?.email);
  const alreadySigned = contract.signatories?.find(s => s.user_id === user?.email)?.signed === true;
  const canSign = !isContractLocked && !isRepObserver && ['sent', 'partially_signed'].includes(contract.status) && isSignatory && !alreadySigned;
  const canSend = !isContractLocked && contract.status === 'generated' && contract.created_by === user?.email;
  
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
              <PrintContract contract={contract} signatures={signatures} />
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
              {canSend && (
                <CCButton
                  variant="accent"
                  icon={Send}
                  onClick={() => sendForSignaturesMutation.mutate()}
                  loading={sendForSignaturesMutation.isPending}
                >
                  Send for Signatures
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
              {isSignatory && alreadySigned && (
                <CCBadge variant="success" icon={CheckCircle}>You have signed</CCBadge>
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
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-1">Signatures</h3>
              <p className="text-xs text-[#6B7A94] mb-4">
                {contract.signatories?.filter(s => s.signed).length || 0} of {contract.signatories?.length || 0} signed
              </p>
              {contract.signatories?.length > 0 ? (
                <div className="space-y-2">
                  {contract.signatories.map((sig, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-[#1A2438] last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sig.signed ? 'bg-[#22C55E]' : 'bg-[#6B7A94]'}`} />
                        <span className={`truncate ${sig.user_id === user?.email ? 'text-[#4F8CFF]' : 'text-[#9AA6BC]'}`}>
                          {sig.name}{sig.user_id === user?.email ? ' (you)' : ''}
                        </span>
                      </div>
                      {sig.signed ? (
                        <div className="flex items-center gap-1 text-[#22C55E] flex-shrink-0">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span className="text-xs">{sig.signed_at ? format(new Date(sig.signed_at), 'MMM d') : 'Signed'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[#6B7A94] flex-shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs">Pending</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#6B7A94] italic">
                  {contract.status === 'generated'
                    ? 'Contract not yet sent for signatures.'
                    : 'No signatories assigned.'}
                </p>
              )}
              {!isSignatory && contract.signatories?.length > 0 && (
                <p className="text-xs text-[#6B7A94] mt-3 italic">You are not a required signatory.</p>
              )}
            </CCCard>
          </div>
        </div>
      </div>

      {/* Sign Modal */}
      <CCModal
        isOpen={showSignModal}
        onClose={() => { setShowSignModal(false); setSignedName(''); }}
        title="Sign Contract"
        description="By signing, you confirm you have read and agree to all terms"
      >
        <div className="space-y-4">
          <div className="bg-[#0B0F14] border border-[#263248] rounded-lg p-4 text-sm text-[#9AA6BC] leading-relaxed">
            <p className="font-medium text-[#E8EEF9] mb-1">"{contract.title}"</p>
            <p>Your typed name below serves as your legally binding electronic signature.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
              Type your full name to sign
            </label>
            <input
              type="text"
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF]"
              placeholder={user?.full_name || user?.email}
              value={signedName}
              onChange={e => setSignedName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-[#6B7A94] mt-1">
              Date: {format(new Date(), 'PPP')} · Signer: {user?.email}
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <CCButton variant="outline" onClick={() => { setShowSignModal(false); setSignedName(''); }}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary"
              icon={CheckCircle}
              onClick={() => signContractMutation.mutate()}
              loading={signContractMutation.isPending}
              disabled={!signedName.trim()}
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