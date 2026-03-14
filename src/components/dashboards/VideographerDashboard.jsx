import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Video, 
  Briefcase, 
  MessageCircle, 
  Plus,
  Image,
  MapPin,
  DollarSign,
  Edit,
  Clock
} from 'lucide-react';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import CCEmpty from '../ui-custom/CCEmpty';

export default function VideographerDashboard({ user, profile, onboardingChecklist }) {
  const { data: portfolioItems = [] } = useQuery({
    queryKey: ['myPortfolio', user?.email],
    queryFn: () => base44.entities.ServicePortfolioItem.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['videographerBookings', user?.email],
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

  const service = serviceDetails[0];
  const activeBookings = collaborations.filter(d => ['agreed', 'contract_sent'].includes(d.status));
  const editingQueue = collaborations.filter(d => d.deliverables?.editing_included && d.status === 'signed');

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">
            Videographer Dashboard
          </h1>
          <p className="text-[#6B7A94]">Manage your reels, bookings, and editing queue</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Video className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{portfolioItems.length}</p>
                <p className="text-xs text-[#6B7A94]">Reel Items</p>
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
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Edit className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{editingQueue.length}</p>
                <p className="text-xs text-[#6B7A94]">Editing Queue</p>
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
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Portfolio */}
          <CCCard padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#E8EEF9]">Reels/Portfolio</h2>
              <Link to={createPageUrl('Portfolio')}>
                <CCButton variant="primary" size="sm" icon={Plus}>Add</CCButton>
              </Link>
            </div>
            {portfolioItems.length === 0 ? (
              <CCEmpty
                icon={Video}
                title="No portfolio items"
                description="Showcase your videography work"
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

          {/* Editing Queue */}
          <CCCard padding="lg">
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Editing Queue
            </h2>
            {editingQueue.length === 0 ? (
              <p className="text-sm text-[#6B7A94] text-center py-4">No editing projects</p>
            ) : (
              <div className="space-y-2">
                {editingQueue.map(room => (
                  <div key={room.id} className="p-3 bg-[#151D2B] rounded-lg">
                    <p className="text-sm text-[#E8EEF9]">{room.collaboration_name || 'Untitled'}</p>
                    <p className="text-xs text-[#6B7A94] flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {room.deliverables?.delivery_timeline_days || 7} days
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CCCard>
        </div>

        {/* Quick Actions */}
        <CCCard padding="lg" className="mt-6">
          <h2 className="text-lg font-semibold text-[#E8EEF9] mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link to={createPageUrl('Portfolio')}>
              <CCButton variant="primary" size="sm" fullWidth icon={Plus}>
                Add Reel
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
    </div>
  );
}