import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { DollarSign, Briefcase, TrendingUp, Eye, Users, Download, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  projected: { label: 'Projected', variant: 'outline' },
  pending_settlement: { label: 'Pending', variant: 'warning' },
  settled: { label: 'Settled', variant: 'success' },
  disputed: { label: 'Disputed', variant: 'danger' },
};
const fmtMoney = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);

export default function StudioEarningsDashboard({ studioUserId }) {
  const [dateFilter, setDateFilter] = useState('all');

  // Fetch representations
  const { data: representations = [] } = useQuery({
    queryKey: ['studioRepresentations', studioUserId],
    queryFn: () => base44.entities.StudioRepresentation.filter({ 
      studio_id: studioUserId,
      active: true 
    }),
    enabled: !!studioUserId,
  });

  // Fetch observed collaborations
  const { data: observers = [] } = useQuery({
    queryKey: ['studioObservers', studioUserId],
    queryFn: () => base44.entities.StudioCollaborationObserver.filter({ studio_id: studioUserId }),
    enabled: !!studioUserId,
  });

  // Fetch collaborations
  const { data: collaborations = [] } = useQuery({
    queryKey: ['observedCollaborations'],
    queryFn: async () => {
      const collabIds = [...new Set(observers.map(o => o.collaboration_id))];
      if (!collabIds.length) return [];
      const allCollabs = await base44.entities.Collaboration.list();
      return allCollabs.filter(c => collabIds.includes(c.id));
    },
    enabled: observers.length > 0,
  });

  // Fetch creator profiles
  const { data: creatorProfiles = [] } = useQuery({
    queryKey: ['representedCreators'],
    queryFn: async () => {
      const creatorIds = [...new Set(representations.map(r => r.creator_user_id))];
      if (!creatorIds.length) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => creatorIds.includes(p.user_id));
    },
    enabled: representations.length > 0,
  });

  const totalRevenueShare = observers.reduce((sum, o) => sum + (o.revenue_share_percentage || 0), 0);
  const completedCollabs = collaborations.filter(c => c.status === 'completed');

  const exportEarningsReport = () => {
    try {
      const report = {
        studio_id: studioUserId,
        generated_at: new Date().toISOString(),
        representations: representations.map(r => ({
          creator: r.creator_user_id,
          type: r.representation_type,
          revenue_share: r.revenue_share_percentage
        })),
        collaborations: observers.map(o => {
          const collab = collaborations.find(c => c.id === o.collaboration_id);
          return {
            collaboration_id: o.collaboration_id,
            collaboration_name: collab?.collaboration_name,
            creator: o.creator_user_id,
            revenue_share_percentage: o.revenue_share_percentage,
            status: collab?.status
          };
        }),
        summary: {
          total_representations: representations.length,
          total_observed_collaborations: observers.length,
          completed_collaborations: completedCollabs.length
        }
      };

      const json = JSON.stringify(report, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-earnings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      toast.success('Earnings report exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Studio Earnings & Activity</h2>
          <p className="text-sm text-[#6B7A94]">Revenue participation and collaboration oversight</p>
        </div>
        <CCButton variant="outline" icon={Download} onClick={exportEarningsReport}>
          Export Report
        </CCButton>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CCCard padding="lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-[#4F8CFF]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#E8EEF9]">{representations.length}</p>
              <p className="text-xs text-[#6B7A94]">Representations</p>
            </div>
          </div>
        </CCCard>
        <CCCard padding="lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF2DAA]/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#E8EEF9]">{observers.length}</p>
              <p className="text-xs text-[#6B7A94]">Observed Collaborations</p>
            </div>
          </div>
        </CCCard>
        <CCCard padding="lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[#22C55E]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#E8EEF9]">{completedCollabs.length}</p>
              <p className="text-xs text-[#6B7A94]">Completed</p>
            </div>
          </div>
        </CCCard>
        <CCCard padding="lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#E8EEF9]">{totalRevenueShare.toFixed(0)}%</p>
              <p className="text-xs text-[#6B7A94]">Total Revenue</p>
            </div>
          </div>
        </CCCard>
      </div>

      {/* Represented Creators */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Represented Creators</h3>
        {representations.length === 0 ? (
          <p className="text-sm text-[#6B7A94] text-center py-4">No active representations</p>
        ) : (
          <div className="space-y-3">
            {representations.map(rep => {
              const profile = creatorProfiles.find(p => p.user_id === rep.creator_user_id);
              const creatorCollabs = observers.filter(o => o.creator_user_id === rep.creator_user_id);
              
              return (
                <div key={rep.id} className="bg-[#151D2B] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-sm font-medium text-[#E8EEF9]">
                          {profile?.display_name || rep.creator_user_id}
                        </p>
                        <CCBadge variant={
                          rep.representation_type === 'Exclusive' ? 'accent' :
                          rep.representation_type === 'Non-Exclusive' ? 'primary' :
                          'outline'
                        } size="sm">
                          {rep.representation_type}
                        </CCBadge>
                        <CCBadge variant="success" size="sm">{rep.revenue_share_percentage}%</CCBadge>
                      </div>
                      <p className="text-xs text-[#6B7A94]">
                        {creatorCollabs.length} collaborations observed
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CCCard>

      {/* Observed Collaborations */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Collaboration Activity</h3>
        {observers.length === 0 ? (
          <p className="text-sm text-[#6B7A94] text-center py-4">No collaboration activity yet</p>
        ) : (
          <div className="space-y-3">
            {observers.slice(0, 10).map(observer => {
              const collaboration = collaborations.find(c => c.id === observer.collaboration_id);
              const creatorProfile = creatorProfiles.find(p => p.user_id === observer.creator_user_id);
              
              return (
                <div key={observer.id} className="bg-[#151D2B] rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-[#E8EEF9]">
                          {collaboration?.collaboration_name || observer.collaboration_id}
                        </p>
                        <CCBadge variant="outline" size="sm">{collaboration?.status}</CCBadge>
                        {observer.added_automatically && (
                          <CCBadge variant="primary" size="sm">Auto</CCBadge>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7A94] mb-2">
                        Creator: {creatorProfile?.display_name || observer.creator_user_id}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[#6B7A94]">
                        <span>Revenue Share: {observer.revenue_share_percentage}%</span>
                        <span>•</span>
                        <span>Access: {observer.access_level}</span>
                      </div>
                    </div>
                    <Link to={createPageUrl(`CollaborationDetail?id=${observer.collaboration_id}`)}>
                      <CCButton variant="ghost" size="sm" icon={Eye}>
                        View
                      </CCButton>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CCCard>
    </div>
  );
}