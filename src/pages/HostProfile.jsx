import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Star, Camera, Save } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';

export default function HostProfile() {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['myProperties', user?.email],
    queryFn: () => base44.entities.Property.filter({ owner_user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles[0];

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.UserProfile.update(profile.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      toast.success('Profile updated');
      setEditMode(false);
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await updateMutation.mutateAsync({ avatar_url: file_url });
  };

  if (userLoading || profileLoading) return <CCLoadingScreen message="Loading profile..." />;

  const activeProperties = properties.filter(p => p.status === 'active');
  const avgRating = properties.filter(p => p.average_rating).length > 0
    ? (properties.reduce((s, p) => s + (p.average_rating || 0), 0) / properties.filter(p => p.average_rating).length).toFixed(1)
    : null;
  const totalReviews = properties.reduce((s, p) => s + (p.total_reviews || 0), 0);

  return (
    <FeatureRouteGuard flag="hosting_marketplace">
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#E8EEF9]">Host Profile</h1>
          {!editMode ? (
            <CCButton variant="outline" size="sm" onClick={() => { setFormData({ display_name: profile?.display_name || '', bio: profile?.bio || '' }); setEditMode(true); }}>
              Edit Profile
            </CCButton>
          ) : (
            <div className="flex gap-2">
              <CCButton variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancel</CCButton>
              <CCButton variant="primary" size="sm" icon={Save} loading={updateMutation.isPending}
                onClick={() => updateMutation.mutate(formData)}>
                Save
              </CCButton>
            </div>
          )}
        </div>

        {/* Avatar + Identity */}
        <CCCard padding="lg">
          <div className="flex items-start gap-5">
            <div className="relative flex-shrink-0">
              <CCAvatar src={profile?.avatar_url} alt={profile?.display_name} size="xl" />
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#4F8CFF] flex items-center justify-center cursor-pointer hover:bg-[#3A7AEE] transition-colors">
                <Camera className="w-3.5 h-3.5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
            <div className="flex-1 min-w-0">
              {editMode ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[#6B7A94] mb-1">Display / Business Name</label>
                    <input
                      type="text"
                      value={formData.display_name || ''}
                      onChange={e => setFormData(f => ({ ...f, display_name: e.target.value }))}
                      className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-[#E8EEF9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                      placeholder="Your name or business name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B7A94] mb-1">Host Bio / Description</label>
                    <textarea
                      value={formData.bio || ''}
                      onChange={e => setFormData(f => ({ ...f, bio: e.target.value }))}
                      rows={4}
                      className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-[#E8EEF9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 resize-none"
                      placeholder="Tell guests about your space and hosting style..."
                    />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xl font-semibold text-[#E8EEF9]">{profile?.display_name || 'Set your name'}</p>
                  <CCBadge variant="primary" size="sm" className="mt-1">Host</CCBadge>
                  {profile?.bio ? (
                    <p className="text-sm text-[#9AA6BC] mt-3 leading-relaxed">{profile.bio}</p>
                  ) : (
                    <p className="text-sm text-[#6B7A94] mt-3 italic">No bio yet — click Edit Profile to add one.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </CCCard>

        {/* Host Stats */}
        <div className="grid grid-cols-3 gap-4">
          <CCCard padding="md">
            <div className="flex flex-col items-center text-center">
              <Building2 className="w-5 h-5 text-[#4F8CFF] mb-1" />
              <p className="text-2xl font-bold text-[#E8EEF9]">{properties.length}</p>
              <p className="text-xs text-[#6B7A94]">Total Properties</p>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex flex-col items-center text-center">
              <Building2 className="w-5 h-5 text-[#22C55E] mb-1" />
              <p className="text-2xl font-bold text-[#E8EEF9]">{activeProperties.length}</p>
              <p className="text-xs text-[#6B7A94]">Active Listings</p>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex flex-col items-center text-center">
              <Star className="w-5 h-5 text-[#F59E0B] mb-1" />
              <p className="text-2xl font-bold text-[#E8EEF9]">{avgRating || '—'}</p>
              <p className="text-xs text-[#6B7A94]">{totalReviews > 0 ? `${totalReviews} review${totalReviews !== 1 ? 's' : ''}` : 'No reviews yet'}</p>
            </div>
          </CCCard>
        </div>

        {/* Properties Summary */}
        {properties.length > 0 && (
          <CCCard padding="lg">
            <h3 className="text-base font-semibold text-[#E8EEF9] mb-3">Your Properties</h3>
            <div className="space-y-2">
              {properties.map(prop => {
                const cover = prop.media?.find(m => m.is_cover) || prop.media?.[0];
                return (
                  <div key={prop.id} className="flex items-center gap-3 p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#263248] flex-shrink-0">
                      {cover ? (
                        <img src={cover.url} alt={prop.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-[#6B7A94]" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#E8EEF9] truncate">{prop.title}</p>
                      <p className="text-xs text-[#9AA6BC]">{prop.city}{prop.state ? `, ${prop.state}` : ''}</p>
                    </div>
                    <CCBadge
                      variant={prop.status === 'active' ? 'success' : prop.status === 'draft' ? 'outline' : 'warning'}
                      size="sm"
                    >
                      {prop.status}
                    </CCBadge>
                  </div>
                );
              })}
            </div>
          </CCCard>
        )}
      </div>
    </div>
    </FeatureRouteGuard>
  );
}