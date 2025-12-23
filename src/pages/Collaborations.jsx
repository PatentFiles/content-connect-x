import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  Briefcase, 
  Plus, 
  Filter, 
  Clock, 
  CheckCircle, 
  FileText,
  ChevronRight,
  Users,
  Calendar,
  DollarSign,
  Edit,
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCAvatarGroup } from '@/components/ui-custom/CCAvatars';
import { CCLoadingScreen, CCSkeletonLoader } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';
import CCModal from '@/components/ui-custom/CCModal';

const statusConfig = {
  draft: { label: 'Draft', variant: 'default', icon: FileText },
  negotiating: { label: 'Negotiating', variant: 'warning', icon: Clock },
  agreed: { label: 'Agreed', variant: 'primary', icon: CheckCircle },
  contract_sent: { label: 'Contract Sent', variant: 'primary', icon: FileText },
  signed: { label: 'Signed', variant: 'success', icon: CheckCircle },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'danger', icon: null },
};

export default function Collaborations() {
  const [filter, setFilter] = useState('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [collaborationToDelete, setCollaborationToDelete] = useState(null);
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

  // Fetch collaborations
  const { data: collaborations = [], isLoading: collaborationsLoading } = useQuery({
    queryKey: ['collaborations', user?.email],
    queryFn: async () => {
      const allRooms = await base44.entities.DealRoom.list('-created_date');
      return allRooms.filter(r => r.participant_ids?.includes(user?.email));
    },
    enabled: !!user && isVerified && isSubscribed,
  });

  // Fetch participant profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['collaborationProfiles', collaborations],
    queryFn: async () => {
      const allIds = [...new Set(collaborations.flatMap(r => r.participant_ids || []))];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => allIds.includes(p.user_id));
    },
    enabled: collaborations.length > 0,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DealRoom.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborations'] });
      toast.success('Collaboration deleted successfully');
      setDeleteModalOpen(false);
      setCollaborationToDelete(null);
    },
    onError: () => {
      toast.error('Failed to delete collaboration');
    },
  });

  const handleDeleteClick = (room, e) => {
    e.preventDefault();
    e.stopPropagation();
    setCollaborationToDelete(room);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (collaborationToDelete) {
      deleteMutation.mutate(collaborationToDelete.id);
    }
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

  const filteredRooms = filter === 'all' 
    ? collaborations 
    : collaborations.filter(r => r.status === filter);

  const getParticipantAvatars = (room) => {
    return room.participant_ids?.map(id => {
      const profile = profiles.find(p => p.user_id === id);
      return { src: profile?.avatar_url, alt: profile?.display_name };
    }) || [];
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center justify-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Collaborations</h1>
                <p className="text-xs text-[#6B7A94]">Manage your collaborations</p>
              </div>
            </div>
            <Link to={createPageUrl('CreateCollaboration')}>
              <CCButton variant="primary" icon={Plus}>
                New Collaboration
              </CCButton>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex gap-2 justify-center items-center overflow-x-auto pb-2 scrollbar-hide">
            {['all', 'draft', 'negotiating', 'agreed', 'signed', 'completed'].map((status) => (
              <CCButton
                key={status}
                variant={filter === status ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {status === 'all' ? 'All' : statusConfig[status]?.label}
              </CCButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {collaborationsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <CCCard key={i} padding="lg">
                <div className="animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <CCSkeletonLoader className="h-6 w-32" />
                    <CCSkeletonLoader className="h-6 w-20 rounded-full" />
                  </div>
                  <CCSkeletonLoader className="h-4 w-48" />
                  <div className="flex gap-4">
                    <CCSkeletonLoader className="h-4 w-24" />
                    <CCSkeletonLoader className="h-4 w-24" />
                  </div>
                </div>
              </CCCard>
            ))}
          </div>
        ) : filteredRooms.length === 0 ? (
          <CCEmpty
            icon={Briefcase}
            title="No collaborations yet"
            description="Create a collaboration to start working with other verified members."
            action={() => window.location.href = createPageUrl('CreateCollaboration')}
            actionLabel="Create Collaboration"
          />
        ) : (
          <div className="space-y-4">
            {filteredRooms.map((room) => {
              const status = statusConfig[room.status] || statusConfig.draft;
              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                    <CCCard hover padding="lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <CCAvatarGroup avatars={getParticipantAvatars(room)} max={3} />
                          <div className="flex-1">
                            <p className="text-[#E8EEF9] font-medium">
                              {room.collaboration_name || `${room.participant_ids?.length || 0} Participants`}
                            </p>
                            <p className="text-sm text-[#6B7A94] capitalize">
                              {room.scene_type || 'Scene'} • {room.compensation_type?.replace('_', ' ') || 'TBD'}
                            </p>
                          </div>
                        </div>
                        <CCBadge variant={status.variant} icon={status.icon}>
                          {status.label}
                        </CCBadge>
                      </div>

                      {/* Scenes */}
                      {room.scene_selected?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {room.scene_selected.map(scene => (
                            <CCBadge key={scene} variant="primary" size="sm">{scene}</CCBadge>
                          ))}
                        </div>
                      )}

                      {/* Acts */}
                      {room.acts_selected?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {room.acts_selected.map(act => (
                            <CCBadge key={act} variant="outline" size="sm">{act}</CCBadge>
                          ))}
                        </div>
                      )}

                      {/* Date/Time & Details */}
                      <div className="flex flex-wrap gap-3 text-sm text-[#9AA6BC] mb-2">
                        {room.schedule?.confirmed_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(room.schedule.confirmed_date).toLocaleDateString()}
                            {room.schedule?.start_time && ` at ${room.schedule.start_time}`}
                          </span>
                        )}
                        {room.compensation_details?.amount && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            ${room.compensation_details.amount}
                          </span>
                        )}
                      </div>

                      {/* Created date */}
                      <div className="text-xs text-[#6B7A94] mb-3">
                        Created {new Date(room.created_date).toLocaleDateString()} at {new Date(room.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-[#263248]">
                        <div className="flex gap-2">
                          <Link to={createPageUrl(`CreateCollaboration?id=${room.id}`)}>
                            <CCButton variant="ghost" size="sm" icon={Edit}>
                              Edit
                            </CCButton>
                          </Link>
                          <CCButton 
                            variant="ghost" 
                            size="sm" 
                            icon={Trash2}
                            onClick={(e) => handleDeleteClick(room, e)}
                            className="text-[#EF4444] hover:text-[#DC2626] hover:bg-[#EF4444]/10"
                          >
                            Delete
                          </CCButton>
                        </div>
                        <Link to={createPageUrl(`ViewCollaboration?id=${room.id}`)}>
                          <span className="text-sm text-[#4F8CFF] flex items-center gap-1">
                            View Details <ChevronRight className="w-4 h-4" />
                          </span>
                        </Link>
                      </div>
                    </CCCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <CCModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Collaboration"
        description="Are you sure you want to delete this collaboration? This action cannot be undone."
      >
        <div className="space-y-4">
          {collaborationToDelete && (
            <div className="bg-[#0B0F14] border border-[#263248] rounded-lg p-4">
              <p className="text-[#E8EEF9] font-medium">
                {collaborationToDelete.collaboration_name || `${collaborationToDelete.participant_ids?.length || 0} Participants`}
              </p>
              <p className="text-sm text-[#6B7A94] capitalize mt-1">
                {collaborationToDelete.scene_type || 'Scene'} • {collaborationToDelete.compensation_type?.replace('_', ' ') || 'TBD'}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="danger" 
              onClick={confirmDelete}
              loading={deleteMutation.isPending}
            >
              Delete
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}