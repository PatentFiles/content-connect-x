import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Film, 
  Briefcase, 
  MessageCircle, 
  Plus,
  MapPin,
  DollarSign,
  Edit,
  Clock,
  CheckCircle
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';
import CCModal from '../ui-custom/CCModal';
import BookingRequestsInbox from '../booking/BookingRequestsInbox';
import EarningsTracker from '../earnings/EarningsTracker';
import { ReputationScoreBar } from '../trust/ReputationBadge';

export default function VideoEditorDashboard({ user, profile, onboardingChecklist }) {
  const [showEarnings, setShowEarnings] = useState(false);

  const { data: portfolioItems = [] } = useQuery({
    queryKey: ['myPortfolio', user?.email],
    queryFn: () => base44.entities.ServicePortfolioItem.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['videoEditorBookings', user?.email],
    queryFn: () => base44.entities.Collaboration.filter({ 
      participant_ids: { $in: [user.email] }
    }),
    enabled: !!user?.email,
  });

  const { data: serviceDetails = [] } = useQuery({
    queryKey: ['myServiceDetails', user?.email],
    queryFn: () => base44.entities.ServiceDetails.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: myReputationScore } = useQuery({
    queryKey: ['myReputationScore', user?.email],
    queryFn: async () => {
      const scores = await base44.entities.ReputationScore.filter({ user_id: user?.email });
      return scores[0] || null;
    },
    enabled: !!user?.email,
  });

  const service = serviceDetails[0];
  const activeBookings = collaborations.filter(d => ['agreed', 'contract_pending'].includes(d.status));
  const editingQueue = collaborations.filter(d => d.deliverables?.editing_included && d.status === 'signed');
  
  const awaitingCompletion = collaborations.filter(d => ['signed', 'active'].includes(d.status));

  return (
    <div className="min-h-screen pb-20 md:pb-8" style={{ backgroundColor: 'var(--cc-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold cc-text-fix-primary mb-1">
            Video Editor Dashboard
          </h1>
          <p className="cc-text-fix-muted">Manage your portfolio, bookings, and editing queue</p>
        </div>

        {onboardingChecklist}

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Film className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold cc-text-fix-primary">{portfolioItems.length}</p>
                <p className="text-xs cc-text-fix-muted">Portfolio Items</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2DAA]/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
              </div>
              <div>
                <p className="text-2xl font-bold cc-text-fix-primary">{activeBookings.length}</p>
                <p className="text-xs cc-text-fix-muted">Active Bookings</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Edit className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold cc-text-fix-primary">{editingQueue.length}</p>
                <p className="text-xs cc-text-fix-muted">Editing Queue</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold cc-text-fix-primary">0</p>
                <p className="text-xs cc-text-fix-muted">Unread</p>
              </div>
            </div>
          </CCCard>
        </div>

        {/* Booking Requests Inbox */}
        <CCCard padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold cc-text-fix-primary mb-4">Incoming Booking Requests</h2>
          <BookingRequestsInbox userId={user?.email} />
        </CCCard>

        {/* Awaiting Completion */}
        {awaitingCompletion.length > 0 && (
          <CCCard padding="lg" className="mb-6 border-l-4 border-l-[#F59E0B]">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-[#F59E0B]" />
              <h2 className="text-lg font-semibold cc-text-fix-primary">Ready to Complete ({awaitingCompletion.length})</h2>
            </div>
            <p className="text-xs cc-text-fix-secondary mb-3">These projects are signed and ready for completion. Mark them complete to generate earnings.</p>
            <div className="space-y-2">
              {awaitingCompletion.map(collab => (
                <Link key={collab.id} to={createPageUrl(`CollaborationDetail?id=${collab.id}`)}>
                  <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg hover:bg-[#1A2438] transition-colors">
                    <div>
                      <p className="text-sm font-medium cc-text-fix-primary">{collab.collaboration_name || 'Untitled'}</p>
                      <p className="text-xs cc-text-fix-muted">{collab.participant_ids?.length || 0} participants</p>
                    </div>
                    <CCBadge variant="warning" size="sm" icon={Clock}>Signed</CCBadge>
                  </div>
                </Link>
              ))}
            </div>
          </CCCard>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Portfolio */}
          <CCCard padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold cc-text-fix-primary">Portfolio</h2>
              <Link to={createPageUrl('Portfolio')}>
                <CCButton variant="primary" size="sm" icon={Plus}>Add</CCButton>
              </Link>
            </div>
            {portfolioItems.length === 0 ? (
              <CCEmpty
                icon={Film}
                title="No portfolio items"
                description="Showcase your editing work"
                action={() => window.location.href = createPageUrl('Portfolio')}
                actionLabel="Add Item"
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {portfolioItems.slice(0, 6).map(item => (
                  <div key={item.id} className="aspect-square rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--cc-surface-hover)' }}>
                    <img src={item.thumbnail_url || item.media_url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </CCCard>

          {/* Editing Queue */}
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold cc-text-fix-primary mb-4 flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Editing Queue
            </h2>
            {editingQueue.length === 0 ? (
              <p className="text-sm cc-text-fix-muted text-center py-4">No editing projects</p>
            ) : (
              <div className="space-y-2">
                {editingQueue.map(room => (
                  <div key={room.id} className="p-3 bg-[#151D2B] rounded-lg">
                    <p className="text-sm cc-text-fix-primary">{room.collaboration_name || 'Untitled'}</p>
                    <p className="text-xs cc-text-fix-muted flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {room.deliverables?.delivery_timeline_days || 7} days
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CCCard>
        </div>

        {/* Reputation / Trust Standing */}
        {myReputationScore && (
          <CCCard padding="lg" className="mt-6">
            <h2 className="text-sm font-semibold cc-text-fix-primary mb-3">Trust Standing</h2>
            <ReputationScoreBar score={myReputationScore} />
          </CCCard>
        )}

        {/* Earnings */}
        <CCCard padding="lg" className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold cc-text-fix-primary">Earnings</h2>
            <CCButton variant="ghost" size="sm" onClick={() => setShowEarnings(true)}>View</CCButton>
          </div>
          <p className="text-xs cc-text-fix-muted">Track projected and confirmed collaboration earnings (private)</p>
        </CCCard>

        {/* Quick Actions */}
        <CCCard padding="lg" className="mt-6">
          <h2 className="text-lg font-semibold cc-text-fix-primary mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link to={createPageUrl('Portfolio')}>
              <CCButton variant="primary" size="sm" fullWidth icon={Plus}>
                Add Item
              </CCButton>
            </Link>
            <Link to={createPageUrl('Profile')}>
              <CCButton variant="outline" size="sm" fullWidth icon={DollarSign}>
                Update Rates
              </CCButton>
            </Link>
            <Link to={createPageUrl('Profile')}>
              <CCButton variant="outline" size="sm" fullWidth icon={MapPin}>
                Update Availability
              </CCButton>
            </Link>
          </div>
        </CCCard>
      </div>

      <CCModal isOpen={showEarnings} onClose={() => setShowEarnings(false)} title="Earnings Tracker" size="lg">
        <EarningsTracker userId={user?.email} />
      </CCModal>
    </div>
  );
}