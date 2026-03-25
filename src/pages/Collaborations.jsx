import React, { useState, useMemo } from 'react';
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
  Trash2,
  Search,
  SlidersHorizontal,
  ArrowUpDown
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
import { logCollaborationActivity } from '@/components/collaboration/activityLogHelpers';
import PullToRefresh from '@/components/ui-custom/PullToRefresh';
import BottomSheetSelect from '@/components/ui-custom/BottomSheetSelect';

const statusConfig = {
  draft: { label: 'Draft', variant: 'default', icon: FileText },
  pending_approval: { label: 'Pending Approval', variant: 'warning', icon: Clock },
  active: { label: 'Active', variant: 'primary', icon: CheckCircle },
  negotiating: { label: 'Negotiating', variant: 'warning', icon: Clock },
  agreed: { label: 'Agreed', variant: 'primary', icon: CheckCircle },
  contract_pending: { label: 'Contract Pending', variant: 'warning', icon: FileText },
  contract_sent: { label: 'Contract Sent', variant: 'primary', icon: FileText },
  signed: { label: 'Signed', variant: 'success', icon: CheckCircle },
  completed: { label: 'Completed', variant: 'success', icon: CheckCircle },
  cancelled: { label: 'Cancelled', variant: 'danger', icon: null },
  disputed: { label: 'Disputed', variant: 'danger', icon: null },
};

export default function Collaborations() {
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_date');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
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

  // Fetch collaborations - only for current user
  const { data: collaborations = [], isLoading: collaborationsLoading } = useQuery({
    queryKey: ['collaborations', user?.email],
    queryFn: async () => {
      const allCollaborations = await base44.entities.Collaboration.list('-created_date', 100);
      return allCollaborations.filter(r => r.participant_ids?.includes(user?.email));
    },
    enabled: !!user && isVerified && isSubscribed,
    staleTime: 30000,
  });

  // Fetch only needed participant profiles - lazy load
  const participantIds = useMemo(
    () => [...new Set(collaborations.flatMap(r => r.participant_ids || []))],
    [collaborations]
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ['collaborationProfiles', participantIds],
    queryFn: async () => {
      if (!participantIds.length) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => participantIds.includes(p.user_id));
    },
    enabled: participantIds.length > 0,
    staleTime: 60000,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await logCollaborationActivity({
        collaborationId: id,
        actorUserId: user?.email,
        activityType: 'CANCELLED',
        description: `Collaboration deleted by ${user?.email}`,
      });
      return base44.entities.Collaboration.delete(id);
    },
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

  // Filter and sort collaborations
  let filteredRooms = collaborations;

  // Status filter
  if (filter !== 'all') {
    filteredRooms = filteredRooms.filter(r => r.status === filter);
  }

  // Keyword search - enhanced with tags, participant names, and notes
  if (searchKeyword) {
    const keyword = searchKeyword.toLowerCase();
    filteredRooms = filteredRooms.filter(r => {
      // Search in basic fields
      const basicMatch = 
        r.collaboration_name?.toLowerCase().includes(keyword) ||
        r.scene_type?.toLowerCase().includes(keyword) ||
        r.acts_selected?.some(act => act.toLowerCase().includes(keyword)) ||
        r.scene_selected?.some(scene => scene.toLowerCase().includes(keyword)) ||
        r.tags?.some(tag => tag.toLowerCase().includes(keyword)) ||
        r.internal_notes?.toLowerCase().includes(keyword);
      
      // Search in participant names
      const participantProfiles = r.participant_ids?.map(id => 
        profiles.find(p => p.user_id === id)
      ).filter(Boolean);
      const participantMatch = participantProfiles?.some(p => 
        p.display_name?.toLowerCase().includes(keyword) ||
        p.real_name?.toLowerCase().includes(keyword)
      );
      
      return basicMatch || participantMatch;
    });
  }

  // Date range filter
  if (dateRange.start) {
    filteredRooms = filteredRooms.filter(r => 
      new Date(r.created_date) >= new Date(dateRange.start)
    );
  }
  if (dateRange.end) {
    filteredRooms = filteredRooms.filter(r => 
      new Date(r.created_date) <= new Date(dateRange.end)
    );
  }

  // Role filter
  if (roleFilter !== 'all') {
    filteredRooms = filteredRooms.filter(r => {
      const participantProfiles = r.participant_ids?.map(id => 
        profiles.find(p => p.user_id === id)
      ).filter(Boolean);
      return participantProfiles?.some(p => p.role_type === roleFilter);
    });
  }

  // Sort
  filteredRooms = [...filteredRooms].sort((a, b) => {
    switch (sortBy) {
      case 'created_date':
        return new Date(b.created_date) - new Date(a.created_date);
      case 'updated_date':
        return new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date);
      case 'status':
        return (a.status || '').localeCompare(b.status || '');
      case 'name':
        return (a.collaboration_name || '').localeCompare(b.collaboration_name || '');
      default:
        return 0;
    }
  });

  const getParticipantAvatars = (room) => {
    return room.participant_ids?.map(id => {
      const profile = profiles.find(p => p.user_id === id);
      return { src: profile?.avatar_url, alt: profile?.display_name };
    }) || [];
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]" style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="text-center md:text-left flex-1">
              <h1 className="text-xl font-semibold text-[#E8EEF9]">Collaborations</h1>
              <p className="text-xs text-[#6B7A94]">Manage your collaborations</p>
            </div>
            <Link to={createPageUrl('CreateCollaboration')} className="md:ml-auto">
              <CCButton variant="primary" fullWidth className="md:w-auto">
                New Collaboration
              </CCButton>
            </Link>
          </div>

          {/* Quick Status Filters */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['all', 'draft', 'pending_approval', 'active', 'contract_pending', 'signed', 'completed', 'disputed'].map((status) => (
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

          {/* Search and Advanced Filters */}
          <div className="mt-3 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
                <input
                  type="text"
                  placeholder="Search collaborations..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
              </div>
              <CCButton
                variant={showAdvancedFilters ? 'primary' : 'outline'}
                size="sm"
                icon={SlidersHorizontal}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                Filters
              </CCButton>
              <BottomSheetSelect
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'created_date', label: 'Latest' },
                  { value: 'updated_date', label: 'Last Activity' },
                  { value: 'status', label: 'Status' },
                  { value: 'name', label: 'Name' },
                ]}
                placeholder="Sort"
                className="min-w-[110px]"
              />
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#121824] border border-[#263248] rounded-lg p-4 space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#6B7A94] mb-1">Created By Role</label>
                    <BottomSheetSelect
                      value={roleFilter}
                      onChange={setRoleFilter}
                      options={[
                        { value: 'all', label: 'All Roles' },
                        { value: 'creator', label: 'Creator' },
                        { value: 'agent', label: 'Agent' },
                        { value: 'studio', label: 'Studio' },
                        { value: 'photographer', label: 'Photographer' },
                        { value: 'videographer', label: 'Videographer' },
                      ]}
                      label="Created By Role"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B7A94] mb-1">Created From</label>
                    <input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full bg-[#0B0F14] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B7A94] mb-1">Created To</label>
                    <input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full bg-[#0B0F14] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <CCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchKeyword('');
                      setDateRange({ start: '', end: '' });
                      setRoleFilter('all');
                    }}
                  >
                    Clear Filters
                  </CCButton>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <PullToRefresh
        className="max-w-6xl mx-auto"
        scrollable={false}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['collaborations', user?.email] })}
      >
      <div className="px-4 py-6">
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
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[#E8EEF9] font-medium">
                                {room.collaboration_name || `${room.participant_ids?.length || 0} Participants`}
                              </p>
                              {room.created_by_role === 'agent' && (
                                <CCBadge variant="accent" size="sm">Created by Agent</CCBadge>
                              )}
                            </div>
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
                        <Link to={createPageUrl(`CollaborationDetail?id=${room.id}`)}>
                          <CCButton variant="primary" size="sm">
                            View Details
                          </CCButton>
                        </Link>
                      </div>
                    </CCCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      </PullToRefresh>

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