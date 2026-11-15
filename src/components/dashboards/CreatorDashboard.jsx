import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertCircle,
  Handshake,
  Flag
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';
import AvailabilityManager from '../profile/AvailabilityManager';
import TravelDateManager from '../profile/TravelDateManager';
import BookingRequestsInbox from '../booking/BookingRequestsInbox';
import AgentInviteInbox from '@/components/representation/AgentInviteInbox';
import ProfileCompletionBar from '../profile/ProfileCompletionBar';
import CollaborationFeed from '@/components/discovery/CollaborationFeed';
import TopCreators from '@/components/discovery/TopCreators';
import TravelSync from '@/components/discovery/TravelSync';
import EarningsTracker from '@/components/earnings/EarningsTracker';
import ReputationBadge from '@/components/trust/ReputationBadge';
import CCModal from '../ui-custom/CCModal';

function ReputationScoreBarWithFlags({ score }) {
  const navigate = useNavigate();
  if (!score) return null;
  const pct = Math.round(score.score);
  const flags = score.factors?.moderation_flags || 0;
  const barColor = pct >= 80 ? '#4F8CFF' : pct >= 60 ? '#22C55E' : pct >= 40 ? '#34D399' : '#6B7A94';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <ReputationBadge score={score} size="md" showScore />
        <span className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>
          +{score.factors?.positive_points || 0} / -{score.factors?.negative_points || 0}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--cc-border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      {score.factors && (
        <div className="grid grid-cols-2 gap-1 text-xs mt-1" style={{ color: 'var(--cc-text-muted)' }}>
          {score.factors.completed_collabs !== undefined && (
            <span>✓ {score.factors.completed_collabs} completed</span>
          )}
          {score.factors.cancelled_collabs > 0 && (
            <span className="text-[#EF4444]">✗ {score.factors.cancelled_collabs} cancelled</span>
          )}
          {score.factors.verification_status === 'approved' && (
            <span>✓ Identity verified</span>
          )}
          {score.factors.testing_compliance === 'valid' && (
            <span>✓ Testing current</span>
          )}
          {flags > 0 && (
            <button
              onClick={() => navigate('/ModerationFlags')}
              className="text-[#F59E0B] hover:text-[#FCD34D] flex items-center gap-1 transition-colors text-left col-span-2"
            >
              <Flag className="w-3 h-3 flex-shrink-0" />
              ⚠ {flags} flag{flags > 1 ? 's' : ''} — tap to view
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CreatorDashboard({ user, profile, onboardingChecklist, onOpenWizard }) {
  const [newTask, setNewTask] = useState('');
  const [showAvailability, setShowAvailability] = useState(false);
  const [showTravelDate, setShowTravelDate] = useState(false);
  const [showEarnings, setShowEarnings] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch active collaborations (draft/negotiating/agreed)
  const { data: collaborations = [] } = useQuery({
    queryKey: ['myCollaborations', user?.email],
    queryFn: () => base44.entities.Collaboration.filter({ 
      participant_ids: { $in: [user.email] },
      status: { $in: ['draft', 'negotiating', 'agreed'] }
    }),
    enabled: !!user?.email,
  });

  // Fetch signed/awaiting completion collaborations
  const { data: awaitingCompletionCollabs = [] } = useQuery({
    queryKey: ['awaitingCompletion', user?.email],
    queryFn: () => base44.entities.Collaboration.filter({
      participant_ids: { $in: [user.email] },
      status: { $in: ['signed', 'active'] }
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

  // Fetch reputation score
  const { data: reputationScores = [] } = useQuery({
    queryKey: ['myReputationScore', user?.email],
    queryFn: () => base44.entities.ReputationScore.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const myReputationScore = reputationScores[0];

  // Fetch favorites
  const { data: favorites = [] } = useQuery({
    queryKey: ['myFavorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: user?.email }),
    enabled: !!user?.email,
  });

  // Validate favorites against active profiles, auto-clean deleted ones
  const allFavUserIds = [...new Set(favorites.flatMap(f => f.items?.map(i => i.user_id) || []))];
  const { data: allFavProfiles = [] } = useQuery({
    queryKey: ['favProfilesValidation', allFavUserIds.join(',')],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: allFavUserIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const activeIds = React.useMemo(() => new Set(
    allFavProfiles
      .filter(p => !p.banned && !p.account_deactivated && p.deletion_status !== 'anonymized' && p.deletion_status !== 'completed')
      .map(p => p.user_id)
  ), [allFavProfiles]);

  const activeFavCount = allFavUserIds.filter(id => activeIds.has(id)).length;

  // Auto-clean deleted/banned profiles from favorite lists
  const cleanedRef = React.useRef(false);
  React.useEffect(() => {
    if (!user?.email || !favorites.length || !allFavProfiles.length || cleanedRef.current) return;
    const deletedIds = allFavUserIds.filter(id => !activeIds.has(id));
    if (deletedIds.length === 0) return;
    cleanedRef.current = true;
    favorites.forEach(list => {
      if (list.items?.some(i => deletedIds.includes(i.user_id))) {
        base44.entities.Favorite.update(list.id, {
          items: list.items.filter(i => !deletedIds.includes(i.user_id))
        }).catch(() => {});
      }
    });
  }, [user?.email, favorites, allFavProfiles, activeIds]);

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
    <div className="min-h-screen pb-20 md:pb-8" style={{ backgroundColor: 'var(--cc-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--cc-text-primary)' }}>
            Welcome back, {profile?.display_name || 'Creator'}
          </h1>
          <p style={{ color: 'var(--cc-text-muted)' }}>Here's what's happening with your collaborations</p>
        </div>

        {/* Profile Completion */}
        <ProfileCompletionBar user={user} profile={profile} />

        {/* Onboarding Checklist */}
        {onboardingChecklist}

        {/* Agent Representation Invite Inbox */}
        <AgentInviteInbox userId={user?.email} profile={profile} />

        {/* Booking Requests Inbox */}
        <BookingRequestsInbox userId={user?.email} />

        {/* Quick Stats — 3 top row, 2 bottom row centered */}
        <div className="mb-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <CCCard padding="md">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--cc-blue) 20%, transparent)' }}>
                  <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--cc-blue)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>0</p>
                  <p className="text-[10px] sm:text-xs leading-tight" style={{ color: 'var(--cc-text-muted)' }}>New Messages</p>
                </div>
              </div>
            </CCCard>
            <CCCard padding="md">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--cc-pink) 20%, transparent)' }}>
                  <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--cc-pink)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{collaborations.length}</p>
                  <p className="text-[10px] sm:text-xs leading-tight" style={{ color: 'var(--cc-text-muted)' }}>Active Collabs</p>
                </div>
              </div>
            </CCCard>
            <CCCard padding="md">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-[#F59E0B]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{pendingContracts.length}</p>
                  <p className="text-[10px] sm:text-xs leading-tight" style={{ color: 'var(--cc-text-muted)' }}>Pending Sigs</p>
                </div>
              </div>
            </CCCard>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto w-full">
            <CCCard padding="md">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-[#22C55E]" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{completedCollabs}</p>
                  <p className="text-[10px] sm:text-xs leading-tight" style={{ color: 'var(--cc-text-muted)' }}>Completed</p>
                </div>
              </div>
            </CCCard>
            <CCCard padding="md">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{awaitingCompletionCollabs.length}</p>
                  <p className="text-[10px] sm:text-xs leading-tight" style={{ color: 'var(--cc-text-muted)' }}>Awaiting Completion</p>
                </div>
              </div>
            </CCCard>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column */}
          <div className="md:col-span-2 space-y-6">
            {/* Quick Actions */}
            <CCCard padding="lg">
              <h2 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--cc-text-primary)' }}>Quick Actions</h2>
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
                <Link to={createPageUrl('Discovery?role=agent')} className="col-span-2">
                  <CCButton variant="outline" size="sm" fullWidth icon={Handshake}>
                    Browse Agents
                  </CCButton>
                </Link>
                <Link to={createPageUrl('CreateCollaboration')} className="col-span-2">
                  <CCButton variant="primary" size="sm" fullWidth>
                    New Collaboration
                  </CCButton>
                </Link>
              </div>
            </CCCard>

            {/* Awaiting Completion */}
            {awaitingCompletionCollabs.length > 0 && (
              <CCCard padding="lg" className="border-l-4 border-l-[#F59E0B]">
                <div className="flex flex-col items-center mb-4">
                  <h2 className="text-lg font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--cc-text-primary)' }}>
                    <CheckCircle className="w-5 h-5 text-[#F59E0B]" />
                    Ready to Complete
                  </h2>
                  <p className="text-xs text-center" style={{ color: 'var(--cc-text-secondary)' }}>These collaborations are signed and ready for completion</p>
                </div>
                <div className="space-y-3">
                  {awaitingCompletionCollabs.slice(0, 3).map(room => (
                    <Link key={room.id} to={createPageUrl(`CollaborationDetail?id=${room.id}`)}>
                      <div className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ backgroundColor: 'var(--cc-surface-hover)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cc-border)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>
                            {room.collaboration_name || 'Untitled Collaboration'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{room.participant_ids?.length || 0} participants</p>
                        </div>
                        <CCBadge variant="warning" size="sm" icon={Clock}>
                          Signed
                        </CCBadge>
                      </div>
                    </Link>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Active Collaborations */}
            <CCCard padding="lg">
              <div className="flex flex-col items-center mb-4">
                <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--cc-text-primary)' }}>Negotiating</h2>
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
                    <Link key={room.id} to={createPageUrl(`CollaborationDetail?id=${room.id}`)}>
                      <div className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ backgroundColor: 'var(--cc-surface-hover)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cc-border)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'}>
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>
                            {room.collaboration_name || 'Untitled Collaboration'}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{room.participant_ids?.length || 0} participants</p>
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
          <div className="flex flex-col gap-6">
            {/* Tasks */}
            <CCCard padding="lg">
              <h2 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--cc-text-primary)' }}>My Tasks</h2>
              <div className="space-y-2 mb-4">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={task.status === 'DONE'}
                      onChange={() => toggleTaskMutation.mutate({ id: task.id, status: task.status })}
                      className="mt-0.5"
                    />
                    <p className="text-sm" style={{ color: task.status === 'DONE' ? 'var(--cc-text-muted)' : 'var(--cc-text-primary)', textDecoration: task.status === 'DONE' ? 'line-through' : 'none' }}>
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
                  className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ backgroundColor: 'var(--cc-bg)', border: '1px solid var(--cc-border)', color: 'var(--cc-text-primary)', '--tw-ring-color': 'var(--cc-blue)' }}
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
              <h2 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--cc-text-primary)' }}>Profile Health</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--cc-text-secondary)' }}>Profile Complete</span>
                  {profileComplete ? (
                    <CCBadge variant="success" size="sm" icon={CheckCircle}>Complete</CCBadge>
                  ) : (
                    <CCBadge variant="warning" size="sm" icon={AlertCircle}>Incomplete</CCBadge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--cc-text-secondary)' }}>Verification</span>
                  {isVerified ? (
                    <CCBadge variant="success" size="sm" icon={Shield}>Verified</CCBadge>
                  ) : (
                    <CCBadge variant="warning" size="sm">Pending</CCBadge>
                  )}
                </div>
                {!profileComplete && (
                  <div className="space-y-2">
                    <Link to={createPageUrl('Profile')}>
                      <CCButton variant="outline" size="sm" fullWidth>
                        Complete Profile
                      </CCButton>
                    </Link>
                  </div>
                )}
              </div>
            </CCCard>

            {/* Favorites — stretches to fill remaining height */}
            <CCCard padding="lg" className="flex-1 flex flex-col">
              <h2 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--cc-text-primary)' }}>Favorites</h2>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4" style={{ color: 'var(--cc-pink)' }} />
                <p className="text-2xl font-bold" style={{ color: 'var(--cc-text-primary)' }}>{activeFavCount}</p>
                <p className="text-sm" style={{ color: 'var(--cc-text-muted)' }}>saved</p>
              </div>
              <div className="mt-auto">
                <Link to={createPageUrl('Favorites')}>
                  <CCButton variant="outline" size="sm" fullWidth>
                    View All
                  </CCButton>
                </Link>
              </div>
            </CCCard>
          </div>
        </div>

        {/* Bottom row: Travel Sync + Contract Status side by side, Trust Standing + Earnings below */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <TravelSync userId={user?.email} myProfile={profile} />
          <CCCard padding="lg">
            <div className="flex flex-col items-center mb-4">
              <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--cc-text-primary)' }}>Contract Status</h2>
              <Link to={createPageUrl('Contracts')}>
                <CCButton variant="ghost" size="sm">View All</CCButton>
              </Link>
            </div>
            {contracts.length === 0 ? (
              <p className="text-xs text-center" style={{ color: 'var(--cc-text-muted)' }}>No contracts yet.</p>
            ) : (
              <div className="space-y-2">
                {pendingContracts.slice(0, 4).map(contract => (
                  <div key={contract.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--cc-surface-hover)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--cc-text-primary)' }}>{contract.title}</p>
                      <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Waiting for signature</p>
                    </div>
                    <CCBadge variant="warning" size="sm" icon={Clock}>Pending</CCBadge>
                  </div>
                ))}
              </div>
            )}
          </CCCard>
        </div>

        {/* Trust Standing + Earnings row */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {myReputationScore ? (
            <CCCard padding="lg">
              <h2 className="text-sm font-semibold mb-3 text-center" style={{ color: 'var(--cc-text-primary)' }}>Trust Standing</h2>
              <ReputationScoreBarWithFlags score={myReputationScore} />
            </CCCard>
          ) : <div />}
          <CCCard padding="lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--cc-text-primary)' }}>Earnings</h2>
              <CCButton variant="ghost" size="sm" onClick={() => setShowEarnings(true)}>View</CCButton>
            </div>
            <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>Track projected and confirmed collaboration earnings (private)</p>
          </CCCard>
        </div>

        {/* Activity Feed + Top Creators */}
        <div className="mt-6">
          <CollaborationFeed userId={user?.email} />
        </div>
        <div className="mt-6">
          <TopCreators userId={user?.email} title="Trusted Creators Near You" limit={5} />
        </div>
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

      <CCModal isOpen={showEarnings} onClose={() => setShowEarnings(false)} title="Earnings Tracker" size="lg">
        <EarningsTracker userId={user?.email} />
      </CCModal>


    </div>
  );
}