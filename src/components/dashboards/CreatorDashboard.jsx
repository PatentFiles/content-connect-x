import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Plus, 
  Briefcase, 
  FileText, 
  CheckCircle, 
  Clock,
  MapPin,
  Shield,
  Heart,
  MessageCircle,
  Calendar,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';
import AvailabilityManager from '../profile/AvailabilityManager';
import TravelDateManager from '../profile/TravelDateManager';

export default function CreatorDashboard({ user, profile, onboardingChecklist, onOpenWizard }) {
  const [newTask, setNewTask] = useState('');
  const [showAvailability, setShowAvailability] = useState(false);
  const [showTravelDate, setShowTravelDate] = useState(false);
  const queryClient = useQueryClient();

  // Fetch active collaborations
  const { data: collaborations = [] } = useQuery({
    queryKey: ['myCollaborations', user?.email],
    queryFn: () => base44.entities.Collaboration.filter({ 
      participant_ids: { $in: [user.email] },
      status: { $in: ['draft', 'negotiating', 'agreed'] }
    }),
    enabled: !!user?.email,
  });

  // Fetch contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ['myContracts', user?.email],
    queryFn: () => base44.entities.Contract.list(),
    enabled: !!user?.email,
  });

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['myTasks', user?.email],
    queryFn: () => base44.entities.QuickTask.filter({ user_id: user?.email, status: 'OPEN' }),
    enabled: !!user?.email,
  });

  // Fetch verification
  const { data: verifications = [] } = useQuery({
    queryKey: ['myVerification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ['myFavorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: user?.email }),
    enabled: !!user?.email,
  });

  const createTaskMutation = useMutation({
    mutationFn: (title) => base44.entities.QuickTask.create({
      user_id: user.email,
      title,
      status: 'OPEN'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myTasks']);
      setNewTask('');
    },
  });

  const toggleTaskMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.QuickTask.update(id, { 
      status: status === 'OPEN' ? 'DONE' : 'OPEN' 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['myTasks']);
    },
  });

  const isVerified = verifications[0]?.status === 'approved';
  const pendingContracts = contracts.filter(c => 
    c.signatories?.some(s => s.user_id === user?.email && !s.signed)
  );
  const completedCollabs = collaborations.filter(d => d.status === 'completed').length;
  const profileComplete = profile?.profile_complete && profile?.bio && profile?.avatar_url;

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">
            Welcome back, {profile?.display_name || 'Creator'}
          </h1>
          <p className="text-[#6B7A94]">Here's what's happening with your collaborations</p>
        </div>

        {/* Onboarding Checklist */}
        {onboardingChecklist}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">0</p>
                <p className="text-xs text-[#6B7A94]">New Messages</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2DAA]/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{collaborations.length}</p>
                <p className="text-xs text-[#6B7A94]">Active Collaborations</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{pendingContracts.length}</p>
                <p className="text-xs text-[#6B7A94]">Pending Signatures</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{completedCollabs}</p>
                <p className="text-xs text-[#6B7A94]">Completed</p>
              </div>
            </div>
          </CCCard>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Quick Actions */}
            <CCCard padding="lg">
              <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <CCButton 
                  variant="outline" 
                  size="sm" 
                  fullWidth 
                  icon={MapPin}
                  onClick={() => setShowAvailability(true)}
                >
                  Update Availability
                </CCButton>
                <CCButton 
                  variant="outline" 
                  size="sm" 
                  fullWidth 
                  icon={Calendar}
                  onClick={() => setShowTravelDate(true)}
                >
                  Post Travel Dates
                </CCButton>
                <Link to={createPageUrl('CreateCollaboration')} className="col-span-2">
                  <CCButton variant="primary" size="sm" fullWidth>
                    New Collaboration
                  </CCButton>
                </Link>
              </div>
            </CCCard>

            {/* Active Collaborations */}
            <CCCard padding="lg">
              <div className="flex flex-col items-center mb-4">
                <h2 className="text-lg font-semibold text-[#E8EEF9] mb-2">Active Collaborations</h2>
                <Link to={createPageUrl('Collaborations')}>
                  <CCButton variant="ghost" size="sm">View All</CCButton>
                </Link>
              </div>
              {collaborations.length === 0 ? (
                <CCEmpty
                  icon={Briefcase}
                  title="No active collaborations"
                  description="Start by creating a new collaboration"
                  action={() => window.location.href = createPageUrl('CreateCollaboration')}
                  actionLabel="Create Collaboration"
                />
              ) : (
                <div className="space-y-3">
                  {collaborations.slice(0, 5).map(room => (
                    <Link key={room.id} to={createPageUrl(`ViewCollaboration?id=${room.id}`)}>
                      <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg hover:bg-[#1A2438] transition-colors">
                        <div>
                          <p className="text-sm font-medium text-[#E8EEF9]">
                            {room.collaboration_name || 'Untitled Collaboration'}
                          </p>
                          <p className="text-xs text-[#6B7A94]">{room.participant_ids?.length || 0} participants</p>
                        </div>
                        <CCBadge variant={
                          room.status === 'agreed' ? 'success' :
                          room.status === 'negotiating' ? 'warning' :
                          'default'
                        } size="sm">
                          {room.status}
                        </CCBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CCCard>

          </div>

          {/* Right Column */}
          <div className="space-y-6 flex flex-col">
            {/* Tasks */}
            <CCCard padding="lg">
              <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">My Tasks</h2>
              <div className="space-y-2 mb-4">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={task.status === 'DONE'}
                      onChange={() => toggleTaskMutation.mutate({ id: task.id, status: task.status })}
                      className="mt-0.5"
                    />
                    <p className={`text-sm ${task.status === 'DONE' ? 'line-through text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>
                      {task.title}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add new task..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && newTask && createTaskMutation.mutate(newTask)}
                  className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
                <CCButton 
                  variant="primary" 
                  size="sm" 
                  icon={Plus}
                  onClick={() => newTask && createTaskMutation.mutate(newTask)}
                  loading={createTaskMutation.isPending}
                />
              </div>
            </CCCard>

            {/* Profile Health */}
            <CCCard padding="lg">
              <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Profile Health</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9AA6BC]">Profile Complete</span>
                  {profileComplete ? (
                    <CCBadge variant="success" size="sm" icon={CheckCircle}>Complete</CCBadge>
                  ) : (
                    <CCBadge variant="warning" size="sm" icon={AlertCircle}>Incomplete</CCBadge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#9AA6BC]">Verification</span>
                  {isVerified ? (
                    <CCBadge variant="success" size="sm" icon={Shield}>Verified</CCBadge>
                  ) : (
                    <CCBadge variant="warning" size="sm">Pending</CCBadge>
                  )}
                </div>
                {!profileComplete && (
                  <Link to={createPageUrl('Profile')}>
                    <CCButton variant="outline" size="sm" fullWidth>
                      Complete Profile
                    </CCButton>
                  </Link>
                )}
              </div>
            </CCCard>

            {/* Favorites */}
            <CCCard padding="lg" className="flex-1">
              <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Favorites</h2>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-[#FF2DAA]" />
                <p className="text-2xl font-bold text-[#E8EEF9]">{favorites.length}</p>
                <p className="text-sm text-[#6B7A94]">saved</p>
              </div>
              <Link to={createPageUrl('Favorites')}>
                <CCButton variant="outline" size="sm" fullWidth>
                  View All
                </CCButton>
              </Link>
            </CCCard>
          </div>
        </div>

        {/* Contracts Status */}
        {contracts.length > 0 && (
          <CCCard padding="lg" className="mt-6">
            <div className="flex flex-col items-center mb-4">
              <h2 className="text-lg font-semibold text-[#E8EEF9] mb-2">Contract Status</h2>
              <Link to={createPageUrl('Contracts')}>
                <CCButton variant="ghost" size="sm">View All</CCButton>
              </Link>
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              {pendingContracts.slice(0, 4).map(contract => (
                <div key={contract.id} className="flex flex-col justify-between p-3 bg-[#151D2B] rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-[#E8EEF9] mb-1">{contract.title}</p>
                    <p className="text-xs text-[#6B7A94]">Waiting for signature</p>
                  </div>
                  <CCBadge variant="warning" size="sm" icon={Clock} className="mt-2 self-start">
                    Pending
                  </CCBadge>
                </div>
              ))}
            </div>
          </CCCard>
        )}
      </div>

      {/* Modals */}
      {showAvailability && (
        <AvailabilityManager
          profile={profile}
          onClose={() => setShowAvailability(false)}
        />
      )}
      {showTravelDate && (
        <TravelDateManager
          profile={profile}
          onClose={() => setShowTravelDate(false)}
        />
      )}
    </div>
  );
}