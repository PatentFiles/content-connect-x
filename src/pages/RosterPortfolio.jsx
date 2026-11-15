import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import { 
  Users, 
  Clock,
  UserPlus,
  Camera
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';
export default function RosterPortfolio() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [creatorEmail, setCreatorEmail] = useState('');
  const [relationshipType, setRelationshipType] = useState('WORKED_WITH');
  const [notes, setNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles[0];

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['studioRoster', user?.email],
    queryFn: () => base44.entities.StudioRoster.filter({ studio_user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: creatorProfiles = [] } = useQuery({
    queryKey: ['rosterCreators'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: roster.length > 0,
  });

  const addCreatorMutation = useMutation({
    mutationFn: ({ email, type, notes }) => base44.entities.StudioRoster.create({
      studio_user_id: user.email,
      creator_user_id: email,
      relationship_type: type,
      status: 'PENDING',
      notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['studioRoster']);
      setShowAddModal(false);
      setCreatorEmail('');
      setNotes('');
    },
  });

  const removeCreatorMutation = useMutation({
    mutationFn: (id) => base44.entities.StudioRoster.update(id, { status: 'ENDED' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['studioRoster']);
    },
  });

  if (userLoading || rosterLoading) {
    return <CCLoadingScreen message="Loading roster..." />;
  }

  const getCreatorProfile = (userId) => creatorProfiles.find(p => p.user_id === userId);
  const activeRoster = roster.filter(r => r.status === 'ACTIVE' && r.relationship_type === 'ROSTER');
  const workedWith = roster.filter(r => r.status === 'ACTIVE' && r.relationship_type === 'WORKED_WITH');
  const pendingApprovals = roster.filter(r => r.status === 'PENDING');

  return (
    <FeatureRouteGuard flag="representations" requiresSubscription={true}>
    <MobileRefreshPage onRefresh={() => queryClient.invalidateQueries({ queryKey: ['studioRoster', user?.email] })}>
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">Roster & Portfolio</h1>
            <p className="text-[#6B7A94]">Manage your creator relationships</p>
          </div>
          <CCButton variant="primary" icon={UserPlus} onClick={() => setShowAddModal(true)}>
            Add Creator
          </CCButton>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{activeRoster.length}</p>
                <p className="text-xs text-[#6B7A94]">Roster</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{workedWith.length}</p>
                <p className="text-xs text-[#6B7A94]">Worked With</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{pendingApprovals.length}</p>
                <p className="text-xs text-[#6B7A94]">Pending</p>
              </div>
            </div>
          </CCCard>
        </div>

        {/* Active Roster */}
        <CCCard padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Active Roster</h2>
          {activeRoster.length === 0 ? (
            <CCEmpty
              icon={Users}
              title="No roster members"
              description="Add creators to your roster"
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {activeRoster.map(r => {
                const creatorProfile = getCreatorProfile(r.creator_user_id);
                return (
                  <div key={r.id} className="flex items-center justify-between p-4 bg-[#151D2B] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#263248] flex items-center justify-center">
                        {creatorProfile?.avatar_url ? (
                          <img src={creatorProfile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <span className="text-lg text-[#6B7A94]">{r.creator_user_id.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[#E8EEF9]">{creatorProfile?.display_name || r.creator_user_id}</p>
                        <p className="text-xs text-[#6B7A94] capitalize">{r.relationship_type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <CCButton 
                      variant="outline" 
                      size="sm"
                      onClick={() => removeCreatorMutation.mutate(r.id)}
                    >
                      Remove
                    </CCButton>
                  </div>
                );
              })}
            </div>
          )}
        </CCCard>

        {/* Worked With */}
        <CCCard padding="lg">
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Worked With</h2>
          {workedWith.length === 0 ? (
            <p className="text-sm text-[#6B7A94] text-center py-4">No collaborations yet</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {workedWith.map(r => {
                const creatorProfile = getCreatorProfile(r.creator_user_id);
                return (
                  <div key={r.id} className="text-center p-3 bg-[#151D2B] rounded-lg">
                    <div className="w-16 h-16 mx-auto rounded-full bg-[#263248] flex items-center justify-center mb-2">
                      {creatorProfile?.avatar_url ? (
                        <img src={creatorProfile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-xl text-[#6B7A94]">{r.creator_user_id.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <p className="text-sm text-[#E8EEF9] truncate">{creatorProfile?.display_name || r.creator_user_id}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CCCard>
      </div>

      {/* Add Creator Modal */}
      <CCModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Creator"
      >
        <div className="space-y-4">
          <CCInput
            label="Creator Email"
            type="email"
            placeholder="creator@example.com"
            value={creatorEmail}
            onChange={(e) => setCreatorEmail(e.target.value)}
          />
          <CCSelect
            label="Relationship Type"
            options={[
              { value: 'WORKED_WITH', label: 'Worked With' },
              { value: 'ROSTER', label: 'Roster' },
              { value: 'EXCLUSIVE', label: 'Exclusive' },
            ]}
            value={relationshipType}
            onChange={(e) => setRelationshipType(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px]"
              placeholder="Optional notes about this relationship..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary"
              onClick={() => addCreatorMutation.mutate({ 
                email: creatorEmail, 
                type: relationshipType, 
                notes 
              })}
              loading={addCreatorMutation.isPending}
              disabled={!creatorEmail}
            >
              Add Creator
            </CCButton>
          </div>
        </div>
      </CCModal>
      </div>
    </MobileRefreshPage>
    </FeatureRouteGuard>
  );
}