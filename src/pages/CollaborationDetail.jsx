import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Users, Calendar, FileText, CheckSquare, Activity } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCTabs from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import TaskManager from '@/components/collaboration/TaskManager';
import DocumentRepository from '@/components/collaboration/DocumentRepository';
import CollaborationCalendar from '@/components/collaboration/CollaborationCalendar';
import ActivityFeed from '@/components/collaboration/ActivityFeed';

export default function CollaborationDetail() {
  const [searchParams] = useSearchParams();
  const dealRoomId = searchParams.get('id');
  const [activeTab, setActiveTab] = useState('tasks');

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: dealRooms = [], isLoading: dealRoomLoading } = useQuery({
    queryKey: ['dealRoom', dealRoomId],
    queryFn: () => base44.entities.DealRoom.filter({ id: dealRoomId }),
    enabled: !!dealRoomId,
  });

  const dealRoom = dealRooms[0];

  const { data: profiles = [] } = useQuery({
    queryKey: ['participantProfiles', dealRoom?.participant_ids],
    queryFn: async () => {
      if (!dealRoom?.participant_ids?.length) return [];
      return await Promise.all(
        dealRoom.participant_ids.map(id => 
          base44.entities.UserProfile.filter({ user_id: id }).then(p => p[0])
        )
      );
    },
    enabled: !!dealRoom?.participant_ids,
  });

  if (userLoading || dealRoomLoading) {
    return <CCLoadingScreen message="Loading collaboration..." />;
  }

  if (!dealRoom) {
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
    negotiating: { label: 'Negotiating', variant: 'warning' },
    agreed: { label: 'Agreed', variant: 'success' },
    contract_sent: { label: 'Contract Sent', variant: 'accent' },
    signed: { label: 'Signed', variant: 'success' },
    completed: { label: 'Completed', variant: 'primary' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
  };

  const status = statusConfig[dealRoom.status] || statusConfig.draft;

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
              <h1 className="text-2xl font-bold text-[#E8EEF9] mb-2">
                {dealRoom.collaboration_name || 'Collaboration'}
              </h1>
              <div className="flex items-center gap-3">
                <CCBadge variant={status.variant}>{status.label}</CCBadge>
                <div className="flex items-center gap-1 text-sm text-[#9AA6BC]">
                  <Users className="w-4 h-4" />
                  <span>{dealRoom.participant_ids?.length || 0} participants</span>
                </div>
              </div>
            </div>
            
            <Link to={`${createPageUrl('CreateCollaboration')}?edit=${dealRoom.id}`}>
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
                  </div>
                </div>

                <div className="p-6">
                  {activeTab === 'tasks' && (
                    <TaskManager dealRoomId={dealRoom.id} participants={dealRoom.participant_ids} />
                  )}
                  {activeTab === 'documents' && (
                    <DocumentRepository dealRoomId={dealRoom.id} />
                  )}
                  {activeTab === 'calendar' && (
                    <CollaborationCalendar dealRoomId={dealRoom.id} participants={dealRoom.participant_ids} />
                  )}
                </div>
              </CCTabs>
            </CCCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <CCCard padding="lg">
              <ActivityFeed dealRoomId={dealRoom.id} />
            </CCCard>
          </div>
        </div>
      </div>
    </div>
  );
}