import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Camera, 
  Briefcase, 
  MessageCircle, 
  Plus,
  Image,
  MapPin,
  DollarSign,
  CheckCircle,
  Clock
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';
import CCModal from '../ui-custom/CCModal';
import BookingRequestsInbox from '../booking/BookingRequestsInbox';
import EarningsTracker from '../earnings/EarningsTracker';
import { ReputationScoreBar } from '../trust/ReputationBadge';

export default function PhotographerDashboard({ user, profile, onboardingChecklist }) {
  const [showEarnings, setShowEarnings] = useState(false);

  const { data: portfolioItems = [] } = useQuery({
    queryKey: ['myPortfolio', user?.email],
    queryFn: () => base44.entities.ServicePortfolioItem.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['photographerBookings', user?.email],
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
  // Use correct status: 'contract_pending' not 'contract_sent'
  const activeBookings = collaborations.filter(d => ['agreed', 'contract_pending'].includes(d.status));
  
  // Collaborations awaiting completion (signed but not finished)
  const awaitingCompletion = collaborations.filter(d => ['signed', 'active'].includes(d.status));

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">
            Photographer Dashboard
          </h1>
          <p className="text-[#6B7A94]">Manage your portfolio and bookings</p>
        </div>

        {onboardingChecklist}

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Image className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{portfolioItems.length}</p>
                <p className="text-xs text-[#6B7A94]">Portfolio Items</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF2DAA]/20 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{activeBookings.length}</p>
                <p className="text-xs text-[#6B7A94]">Active Bookings</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">0</p>
                <p className="text-xs text-[#6B7A94]">Unread</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Camera className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{collaborations.filter(d => d.status === 'negotiating').length}</p>
                <p className="text-xs text-[#6B7A94]">Requests</p>
              </div>
            </div>
          </CCCard>
        </div>

        {/* Booking Requests Inbox */}
        <CCCard padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Incoming Booking Requests</h2>
          <BookingRequestsInbox userId={user?.email} />
        </CCCard>

        {/* Awaiting Completion */}
        {awaitingCompletion.length > 0 && (
          <CCCard padding="lg" className="mb-6 border-l-4 border-l-[#F59E0B]">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-[#F59E0B]" />
              <h2 className="text-lg font-semibold text-[#E8EEF9]">Ready to Complete ({awaitingCompletion.length})</h2>
            </div>
            <p className="text-xs text-[#9AA6BC] mb-3">These shoots are signed and ready for completion. Mark them complete to generate earnings.</p>
            <div className="space-y-2">
              {awaitingCompletion.map(collab => (
                <Link key={collab.id} to={createPageUrl(`CollaborationDetail?id=${collab.id}`)}>
                  <div className="flex items-center justify-between p-3 bg-[#151D2B] rounded-lg hover:bg-[#1A2438] transition-colors">
                    <div>
                      <p className="text-sm font-medium text-[#E8EEF9]">{collab.collaboration_name || 'Untitled'}</p>
                      <p className="text-xs text-[#6B7A94]">{collab.participant_ids?.length || 0} participants</p>
                    </div>
                    <CCBadge variant="warning" size="sm" icon={Clock}>Signed</CCBadge>
                  </div>
                </Link>
              ))}
            </div>
          </CCCard>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Portfolio Status */}
          <CCCard padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#E8EEF9]">Portfolio</h2>
              <Link to={createPageUrl('Portfolio')}>
                <CCButton variant="primary" size="sm" icon={Plus}>Add Item</CCButton>
              </Link>
            </div>
            {portfolioItems.length === 0 ? (
              <CCEmpty
                icon={Camera}
                title="No portfolio items"
                description="Showcase your work"
                action={() => window.location.href = createPageUrl('Portfolio')}
                actionLabel="Add Item"
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {portfolioItems.slice(0, 6).map(item => (
                  <div key={item.id} className="aspect-square bg-[#151D2B] rounded-lg overflow-hidden">
                    <img src={item.thumbnail_url || item.media_url} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </CCCard>

          {/* Work Preferences */}
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Work Preferences</h2>
            <div className="space-y-3">
              {service?.content_types && service.content_types.length > 0 && (
                <div>
                  <p className="text-sm text-[#6B7A94] mb-2">Creator Types Served</p>
                  <div className="flex flex-wrap gap-2">
                    {service.content_types.map(type => (
                      <CCBadge key={type} variant="primary" size="sm">
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </CCBadge>
                    ))}
                  </div>
                </div>
              )}
              {service?.availability_type && (
                <div>
                  <p className="text-sm text-[#6B7A94] mb-1">Availability</p>
                  <p className="text-[#E8EEF9] capitalize">{service.availability_type.replace('_', ' ')}</p>
                </div>
              )}
              <Link to={createPageUrl('Profile')}>
                <CCButton variant="outline" size="sm" fullWidth icon={MapPin}>
                  Update Availability
                </CCButton>
              </Link>
            </div>
          </CCCard>
        </div>

        {/* Reputation / Trust Standing */}
        {myReputationScore && (
          <CCCard padding="lg" className="mt-6">
            <h2 className="text-sm font-semibold text-[#E8EEF9] mb-3">Trust Standing</h2>
            <ReputationScoreBar score={myReputationScore} />
          </CCCard>
        )}

        {/* Earnings */}
        <CCCard padding="lg" className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#E8EEF9]">Earnings</h2>
            <CCButton variant="ghost" size="sm" onClick={() => setShowEarnings(true)}>View</CCButton>
          </div>
          <p className="text-xs text-[#6B7A94]">Track projected and confirmed collaboration earnings (private)</p>
        </CCCard>

        {/* Quick Actions */}
        <CCCard padding="lg" className="mt-6">
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link to={createPageUrl('Portfolio')}>
              <CCButton variant="primary" size="sm" fullWidth icon={Plus}>
                Add Portfolio Item
              </CCButton>
            </Link>
            <Link to={createPageUrl('Profile')}>
              <CCButton variant="outline" size="sm" fullWidth icon={DollarSign}>
                Update Rates
              </CCButton>
            </Link>
            <Link to={createPageUrl('Messages')}>
              <CCButton variant="outline" size="sm" fullWidth icon={MessageCircle}>
                Messages
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