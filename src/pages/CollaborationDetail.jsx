import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useMobilePageSetup from '@/hooks/useMobilePageSetup';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Users, Calendar, FileText, CheckSquare, MessageSquare, AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCTabs } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import TaskManager from '@/components/collaboration/TaskManager';
import DocumentRepository from '@/components/collaboration/DocumentRepository';
import CollaborationCalendar from '@/components/collaboration/CollaborationCalendar';
import ActivityFeed from '@/components/collaboration/ActivityFeed';
import CollaborationMessaging from '@/components/collaboration/CollaborationMessaging';
import DisputeManager from '@/components/collaboration/DisputeManager';
import ConfirmationManager from '@/components/collaboration/ConfirmationManager';
import RolePermissions from '@/components/collaboration/RolePermissions';
import ExportManager from '@/components/collaboration/ExportManager';
import RiskScoringDisplay from '@/components/admin/RiskScoringEngine';
import InsuranceManager from '@/components/admin/InsuranceManager';
import ConsentRevocationManager from '@/components/collaboration/ConsentRevocationManager';
import AIRiskPrediction from '@/components/admin/AIRiskPrediction';
import TemplateContractGenerator from '@/components/contracts/TemplateContractGenerator';
import TestingStatusBanner from '@/components/collaboration/TestingStatusBanner';
import ConsentRevocationBanner from '@/components/collaboration/ConsentRevocationBanner';
import TestingPolicyManager from '@/components/collaboration/TestingPolicyManager';
import { useRepObserverCheck, logRepObserverAccess } from '@/components/collaboration/RepObserverAccessControl';
import CollaborationPacketExporter from '@/components/collaboration/CollaborationPacketExporter';
import SafetyCheckInWidget from '@/components/safety/SafetyCheckInWidget';
import CompletionBanner from '@/components/collaboration/CompletionBanner';
import CompletionManager from '@/components/collaboration/CompletionManager';

export default function CollaborationDetail() {
  const [searchParams] = useSearchParams();
  const collaborationId = searchParams.get('id');
  const [activeTab, setActiveTab] = useState('tasks');

  useMobilePageSetup({ title: 'Collaboration', onBack: () => window.history.back() });

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: collaborations = [], isLoading: collaborationLoading } = useQuery({
    queryKey: ['collaboration', collaborationId],
    queryFn: () => base44.entities.Collaboration.filter({ id: collaborationId }),
    enabled: !!collaborationId,
  });

  const collaboration = collaborations[0];

  const { data: profiles = [] } = useQuery({
    queryKey: ['participantProfiles', collaboration?.participant_ids],
    queryFn: async () => {
      if (!collaboration?.participant_ids?.length) return [];
      return await Promise.all(
        collaboration.participant_ids.map(id => 
          base44.entities.UserProfile.filter({ user_id: id }).then(p => p[0])
        )
      );
    },
    enabled: !!collaboration?.participant_ids,
  });

  const { data: participantRoles = [] } = useQuery({
    queryKey: ['participantRoles', collaborationId],
    queryFn: () => base44.entities.CollaborationParticipantRole.filter({
      collaboration_id: collaborationId
    }),
    enabled: !!collaborationId,
  });

  const participantRole = participantRoles.find(r => r.user_id === user?.email);
  const userRole = participantRole?.role || 'Viewer';

  const { data: packetItems = [] } = useQuery({
    queryKey: ['collaborationPacketItems', collaborationId],
    queryFn: () => base44.entities.CollaborationPacketItem.filter({
      collaboration_id: collaborationId
    }),
    enabled: !!collaborationId,
  });

  // RepObserver access control
  const { isRepObserver, canMessage, canEdit } = useRepObserverCheck(
    collaboration?.id,
    user?.email
  );

  // Log RepObserver access
  useEffect(() => {
    if (isRepObserver && collaboration?.id) {
      logRepObserverAccess(
        collaboration.id,
        user?.email,
        'VIEW_COLLABORATION',
        { page: 'CollaborationDetail' }
      );
    }
  }, [isRepObserver, collaboration?.id, user?.email]);

  const { data: profile = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const isAdmin = profile[0]?.is_admin || profile[0]?.role_type === 'admin' || user?.role === 'admin';

  if (userLoading || collaborationLoading) {
    return <CCLoadingScreen message="Loading collaboration..." />;
  }

  if (!collaboration) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <CCCard padding="xl" className="text-center">
          <p className="text-[#9AA6BC]">Collaboration not found</p>
          <Link to={createPageUrl('Collaborations')}>
            <CCButton variant="primary" className="mt-4">
              Back to Collaborations
            </CCButton>
          </Link>
        </CCCard>
      </div>
    );
  }

  const statusConfig = {
    draft: { label: 'Draft', variant: 'default' },
    pending_approval: { label: 'Pending Approval', variant: 'warning' },
    active: { label: 'Active', variant: 'primary' },
    negotiating: { label: 'Negotiating', variant: 'warning' },
    agreed: { label: 'Agreed', variant: 'success' },
    contract_pending: { label: 'Contract Pending', variant: 'warning' },
    contract_sent: { label: 'Contract Sent', variant: 'accent' },
    signed: { label: 'Signed', variant: 'success' },
    completed: { label: 'Completed', variant: 'primary' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
    disputed: { label: 'Disputed', variant: 'danger' },
  };

  const status = statusConfig[collaboration.status] || statusConfig.draft;

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link to={createPageUrl('Collaborations')}>
            <CCButton variant="ghost" size="sm" icon={ArrowLeft} className="mb-3">
              Back
            </CCButton>
          </Link>
          
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-[#E8EEF9]">
                  {collaboration.collaboration_name || 'Collaboration'}
                </h1>
                <CCBadge variant="outline" icon={Shield}>{userRole}</CCBadge>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <CCBadge variant={status.variant}>{status.label}</CCBadge>
                {collaboration.created_by_role === 'agent' && (
                  <CCBadge variant="accent">Created by Agent</CCBadge>
                )}
                <div className="flex items-center gap-1 text-sm text-[#9AA6BC]">
                  <Users className="w-4 h-4" />
                  <span>{collaboration.participant_ids?.length || 0} participants</span>
                </div>
              </div>
            </div>
            
            <Link to={`${createPageUrl('CreateCollaboration')}?edit=${collaboration.id}`}>
              <CCButton variant="outline">Edit Details</CCButton>
            </Link>
          </div>

          {/* Participants */}
          {profiles.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {profiles.map(profile => (
                <div key={profile?.user_id} className="flex items-center gap-2 bg-[#151D2B] border border-[#263248] rounded-lg px-3 py-1.5">
                  {profile?.avatar_url && (
                    <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  )}
                  <span className="text-sm text-[#E8EEF9]">{profile?.display_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
           <div className="lg:col-span-2 space-y-6">
            <ConsentRevocationBanner collaborationId={collaboration.id} />
            <TestingStatusBanner collaboration={collaboration} currentUserId={user?.email} />
            <CompletionBanner collaboration={collaboration} userEmail={user?.email} />
            <CCCard padding="none">
              <CCTabs activeTab={activeTab} onTabChange={setActiveTab}>
                <div className="border-b border-[#263248] px-4">
                  <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    <button
                      onClick={() => setActiveTab('tasks')}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'tasks'
                          ? 'border-[#4F8CFF] text-[#E8EEF9]'
                          : 'border-transparent text-[#9AA6BC] hover:text-[#E8EEF9]'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4" />
                      Tasks
                    </button>
                    <button
                      onClick={() => setActiveTab('documents')}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'documents'
                          ? 'border-[#4F8CFF] text-[#E8EEF9]'
                          : 'border-transparent text-[#9AA6BC] hover:text-[#E8EEF9]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      Documents
                    </button>
                    <button
                      onClick={() => setActiveTab('calendar')}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'calendar'
                          ? 'border-[#4F8CFF] text-[#E8EEF9]'
                          : 'border-transparent text-[#9AA6BC] hover:text-[#E8EEF9]'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      Calendar
                    </button>
                    <button
                      onClick={() => setActiveTab('messages')}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'messages'
                          ? 'border-[#4F8CFF] text-[#E8EEF9]'
                          : 'border-transparent text-[#9AA6BC] hover:text-[#E8EEF9]'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      Messages
                    </button>
                    <button
                      onClick={() => setActiveTab('roles')}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'roles'
                          ? 'border-[#4F8CFF] text-[#E8EEF9]'
                          : 'border-transparent text-[#9AA6BC] hover:text-[#E8EEF9]'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                      Roles
                    </button>
                    <button
                      onClick={() => setActiveTab('contracts')}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                        activeTab === 'contracts'
                          ? 'border-[#4F8CFF] text-[#E8EEF9]'
                          : 'border-transparent text-[#9AA6BC] hover:text-[#E8EEF9]'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      Contracts
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === 'tasks' && (
                    canEdit ? (
                      <TaskManager collaborationId={collaboration.id} participants={collaboration.participant_ids} />
                    ) : (
                      <CCCard padding="lg">
                        <div className="text-center py-8">
                          <AlertTriangle className="w-12 h-12 text-[#F59E0B] mx-auto mb-3" />
                          <p className="text-[#9AA6BC]">RepObservers have read-only access</p>
                        </div>
                      </CCCard>
                    )
                  )}
                  {activeTab === 'documents' && (
                    <DocumentRepository collaborationId={collaboration.id} readOnly={isRepObserver} />
                  )}
                  {activeTab === 'calendar' && (
                    <CollaborationCalendar collaborationId={collaboration.id} participants={collaboration.participant_ids} readOnly={isRepObserver} />
                  )}
                  {activeTab === 'messages' && (
                    canMessage ? (
                      <CollaborationMessaging 
                        collaborationId={collaboration.id} 
                        currentUser={user}
                        userRole={userRole}
                      />
                    ) : (
                      <CCCard padding="lg">
                        <div className="text-center py-8">
                          <AlertTriangle className="w-12 h-12 text-[#F59E0B] mx-auto mb-3" />
                          <p className="text-[#9AA6BC]">
                            RepObservers cannot send messages unless granted permission by Admin
                          </p>
                        </div>
                      </CCCard>
                    )
                  )}
                  {activeTab === 'roles' && (
                    <RolePermissions 
                      collaborationId={collaboration.id}
                      currentUser={user}
                      currentUserRole={userRole}
                    />
                  )}
                  {activeTab === 'contracts' && (
                    <div className="space-y-4">
                      <TemplateContractGenerator 
                        collaborationId={collaboration.id}
                        onContractCreated={(contract) => {
                          toast.success('Contract created and backed up to Google Drive');
                        }}
                      />
                    </div>
                  )}
                </div>
              </CCTabs>
            </CCCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Safety Check-In — shown when collab is signed/active for participants */}
            {['signed', 'active', 'agreed'].includes(collaboration.status) &&
              collaboration.participant_ids?.includes(user?.email) && !isRepObserver && (
              <SafetyCheckInWidget
                collaborationId={collaboration.id}
                userId={user?.email}
              />
            )}
            <TestingPolicyManager 
              collaborationId={collaboration.id} 
              userRole={userRole}
              readOnly={isRepObserver}
            />
            
            <CCCard padding="lg">
              <ActivityFeed collaborationId={collaboration.id} />
            </CCCard>

            {(userRole === 'Admin' || userRole === 'Member') && (
              <>
                <CompletionManager
                  collaboration={collaboration}
                  currentUser={user}
                  userRole={userRole}
                />

                <CCCard padding="lg">
                  <ConfirmationManager 
                    collaborationId={collaboration.id}
                    currentUser={user}
                    userRole={userRole}
                    collaborationStatus={collaboration.status}
                  />
                </CCCard>

                <ConsentRevocationManager 
                  collaborationId={collaboration.id}
                  currentUser={user}
                  userRole={userRole}
                />

                <CCCard padding="lg">
                  <DisputeManager 
                    collaborationId={collaboration.id}
                    currentUser={user}
                    userRole={userRole}
                  />
                </CCCard>
              </>
            )}

            {userRole === 'Admin' && (
              <>
                <CollaborationPacketExporter 
                  collaboration={collaboration}
                  packetItems={packetItems}
                />
                <CCCard padding="lg">
                  <ExportManager 
                    collaborationId={collaboration.id}
                    collaborationName={collaboration.collaboration_name}
                  />
                </CCCard>
                {isAdmin && (
                  <>
                    <RiskScoringDisplay collaborationId={collaboration.id} />
                    <AIRiskPrediction collaborationId={collaboration.id} currentUser={user} />
                    <InsuranceManager collaborationId={collaboration.id} currentUser={user} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}