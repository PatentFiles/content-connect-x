import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Calendar, 
  MessageCircle, 
  Heart, 
  ShieldCheck, 
  Clock,
  Link as LinkIcon,
  AlertTriangle,
  Image,
  Lock,
  Share2,
  Flag,
  Ban,
  Briefcase,
  Activity,
  Shield,
  MapPinned,
  Globe
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';

const roleColors = {
  creator: 'accent',
  photographer: 'primary',
  videographer: 'primary',
  agent: 'warning',
  studio: 'success',
};

export default function ViewProfile() {
  const [activeTab, setActiveTab] = useState('about');
  const [showReportModal, setShowReportModal] = useState(false);
  const queryClient = useQueryClient();

  // Get profile ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const profileUserId = urlParams.get('id');

  // Check auth
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

  // Fetch profile
  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['viewProfile', profileUserId],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && isVerified && isSubscribed,
  });

  const profile = profiles[0];

  // Fetch profile verification
  const { data: profileVerification = [] } = useQuery({
    queryKey: ['profileVerification', profileUserId],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  const profileIsVerified = profileVerification[0]?.status === 'approved';

  // Fetch creator details
  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['viewCreatorDetails', profileUserId],
    queryFn: () => base44.entities.CreatorDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  const details = creatorDetails[0];

  // Fetch service details (photographer/videographer)
  const { data: serviceDetails = [] } = useQuery({
    queryKey: ['viewServiceDetails', profileUserId],
    queryFn: () => base44.entities.ServiceDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  const service = serviceDetails[0];

  // Fetch agent details
  const { data: agentDetails = [] } = useQuery({
    queryKey: ['viewAgentDetails', profileUserId],
    queryFn: () => base44.entities.AgentDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  const agent = agentDetails[0];

  // Fetch studio details
  const { data: studioDetails = [] } = useQuery({
    queryKey: ['viewStudioDetails', profileUserId],
    queryFn: () => base44.entities.StudioDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  const studio = studioDetails[0];

  // Fetch galleries
  const { data: galleries = [] } = useQuery({
    queryKey: ['viewGalleries', profileUserId],
    queryFn: () => base44.entities.Gallery.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  if (userLoading || profileLoading) {
    return <CCLoadingScreen message="Loading profile..." />;
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

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <CCEmpty
          icon={AlertTriangle}
          title="Profile not found"
          description="This profile may have been removed or doesn't exist."
        />
      </div>
    );
  }

  const tabs = [
    { value: 'about', label: 'About' },
    { value: 'gallery', label: 'Gallery' },
  ];

  const publicGallery = galleries.find(g => g.type === 'public');

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Cover & Avatar */}
      <div className="relative">
        <div className="h-48 md:h-64">
          <img 
            src={profile.cover_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69495df631e52046b1356040/730e18d7f_image.png"}
            alt="Cover" 
            className="w-full h-full object-cover" 
          />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative -mt-16 md:-mt-20 flex flex-col md:flex-row md:items-end gap-4">
            <CCAvatar
              src={profile.avatar_url}
              size="2xl"
              verified={profileIsVerified}
              className="ring-4 ring-[#0B0F14]"
            />
            <div className="flex-1 pb-2">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#E8EEF9] flex items-center gap-2">
                    {profile.display_name}
                    {profileIsVerified && <ShieldCheck className="w-5 h-5 text-[#4F8CFF]" />}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <CCBadge variant={roleColors[profile.role_type]} className="capitalize">
                      {profile.role_type}
                    </CCBadge>
                    {profile.age && (
                      <span className="text-sm text-[#9AA6BC]">{profile.age} years old</span>
                    )}
                    {profile.base_location?.city && (
                      <span className="text-sm text-[#9AA6BC] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {profile.base_location.city}, {profile.base_location.state || profile.base_location.country}
                      </span>
                    )}
                  </div>
                  {/* Website links for studio/agent */}
                  {(studio?.website || agent?.website) && (
                    <a 
                      href={studio?.website || agent?.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="flex items-center gap-2 text-[#4F8CFF] hover:underline mt-2 text-sm"
                    >
                      <Globe className="w-4 h-4" />
                      Visit Website
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <CCButton variant="outline" icon={Heart}>Save</CCButton>
                  <Link to={createPageUrl(`Messages?startWith=${profileUserId}`)}>
                    <CCButton variant="primary" icon={MessageCircle}>Message</CCButton>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <CCTabsList tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {/* About Tab */}
        <CCTabsContent value="about" activeTab={activeTab}>
          <div className="space-y-6">
            {/* Bio */}
            <CCCard padding="lg">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">About</h3>
              <p className="text-[#9AA6BC]">{profile.bio || 'No bio provided.'}</p>
            </CCCard>

            {/* Creator Details */}
            {profile.role_type === 'creator' && details && (
              <>
                {details.orientation_category && Array.isArray(details.orientation_category) && details.orientation_category.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Sexual Orientation</h3>
                    <div className="flex flex-wrap gap-2">
                      {details.orientation_category.map(o => (
                        <CCBadge key={o} variant="outline">{o}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {details.scene_pairings && details.scene_pairings.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Heart className="w-5 h-5 text-[#FF2DAA]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Scene Pairings</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {details.scene_pairings.map(sp => (
                        <CCBadge key={sp} variant="accent">{sp.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {details.compensation_preferences && details.compensation_preferences.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Briefcase className="w-5 h-5 text-[#4F8CFF]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Compensation Preferences</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {details.compensation_preferences.map(cp => (
                        <CCBadge key={cp} variant={cp === 'paid' ? 'success' : cp === 'trade' ? 'warning' : 'default'}>
                          {cp}
                        </CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {details.standard_acts && details.standard_acts.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-5 h-5 text-[#4F8CFF]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Standard Acts</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {details.standard_acts.map(sa => (
                        <CCBadge key={sa} variant="primary">{sa.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {details.fetish_acts && details.fetish_acts.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-5 h-5 text-[#FF2DAA]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Fetish Acts</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {details.fetish_acts.map(fa => (
                        <CCBadge key={fa} variant="accent">{fa.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {details.kink_edge_acts && details.kink_edge_acts.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-5 h-5 text-[#9333EA]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Kink / Edge Acts</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {details.kink_edge_acts.map(ke => (
                        <CCBadge key={ke} variant="default">{ke.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {details.performance_positioning && details.performance_positioning.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Performance Positioning</h3>
                    <div className="flex flex-wrap gap-2">
                      {details.performance_positioning.map(pp => (
                        <CCBadge key={pp} variant="primary">{pp}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {details.physical_details && Object.keys(details.physical_details).length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Physical Details</h3>
                    <div className="space-y-2">
                      {details.physical_details.breast_size && (
                        <p className="text-[#E8EEF9]">Breast Size: {details.physical_details.breast_size}</p>
                      )}
                      {details.physical_details.measurements && (
                        <p className="text-[#E8EEF9]">Measurements: {details.physical_details.measurements}</p>
                      )}
                      {details.physical_details.endowment_size && (
                        <p className="text-[#E8EEF9]">Endowment: {details.physical_details.endowment_size}"</p>
                      )}
                    </div>
                  </CCCard>
                )}

                {details.availability_type && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPinned className="w-5 h-5 text-[#4F8CFF]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Availability & Travel</h3>
                    </div>
                    <p className="text-[#E8EEF9] mb-2">
                      {details.availability_type.replace('_', ' ')}
                    </p>
                    {details.travel_regions && details.travel_regions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {details.travel_regions.map(tr => (
                          <CCBadge key={tr}>{tr}</CCBadge>
                        ))}
                      </div>
                    )}
                  </CCCard>
                )}
              </>
            )}

            {/* Agent Details */}
            {profile.role_type === 'agent' && agent && (
              <>
                {agent.content_types && agent.content_types.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Content Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {agent.content_types.map(ct => (
                        <CCBadge key={ct} variant="accent">{ct}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}
                {agent.agency_name && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Agency</h3>
                    <p className="text-[#E8EEF9]">{agent.agency_name}</p>
                  </CCCard>
                )}
              </>
            )}

            {/* Studio Details */}
            {profile.role_type === 'studio' && studio && (
              <>
                {studio.content_types && studio.content_types.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Content Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {studio.content_types.map(ct => (
                        <CCBadge key={ct} variant="success">{ct}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}
                {studio.locations && studio.locations.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Studio Locations</h3>
                    <div className="space-y-3">
                      {studio.locations.map((loc, i) => (
                        <div key={i} className="p-3 bg-[#121824] rounded-lg">
                          <p className="font-medium text-[#E8EEF9]">{loc.name || loc.city}</p>
                          <p className="text-sm text-[#6B7A94]">{loc.address}</p>
                        </div>
                      ))}
                    </div>
                  </CCCard>
                )}
              </>
            )}

            {/* Photographer/Videographer Details */}
            {(profile.role_type === 'photographer' || profile.role_type === 'videographer') && service && (
              <>
                {service.content_types && service.content_types.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Content Types</h3>
                    <div className="flex flex-wrap gap-2">
                      {service.content_types.map(ct => (
                        <CCBadge key={ct} variant="primary">{ct}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {service.acts_filmed && service.acts_filmed.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="w-5 h-5 text-[#4F8CFF]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Acts Filmed</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {service.acts_filmed.map(act => (
                        <CCBadge key={act} variant="primary">{act.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {service.availability_type && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPinned className="w-5 h-5 text-[#4F8CFF]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Availability</h3>
                    </div>
                    <p className="text-[#E8EEF9]">{service.availability_type.replace('_', ' ')}</p>
                  </CCCard>
                )}

                {service.rates && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Rates</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {service.rates.hourly && (
                        <div className="text-center p-4 bg-[#121824] rounded-xl">
                          <p className="text-2xl font-bold text-[#E8EEF9]">${service.rates.hourly}</p>
                          <p className="text-sm text-[#6B7A94]">per hour</p>
                        </div>
                      )}
                      {service.rates.half_day && (
                        <div className="text-center p-4 bg-[#121824] rounded-xl">
                          <p className="text-2xl font-bold text-[#E8EEF9]">${service.rates.half_day}</p>
                          <p className="text-sm text-[#6B7A94]">half day</p>
                        </div>
                      )}
                      {service.rates.full_day && (
                        <div className="text-center p-4 bg-[#121824] rounded-xl">
                          <p className="text-2xl font-bold text-[#E8EEF9]">${service.rates.full_day}</p>
                          <p className="text-sm text-[#6B7A94]">full day</p>
                        </div>
                      )}
                    </div>
                  </CCCard>
                )}

                {service.gear_list && service.gear_list.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Equipment</h3>
                    <div className="flex flex-wrap gap-2">
                      {service.gear_list.map((gear, i) => (
                        <CCBadge key={i} variant="outline">{gear}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}
              </>
            )}
          </div>
        </CCTabsContent>

        {/* Gallery Tab */}
        <CCTabsContent value="gallery" activeTab={activeTab}>
          <CCCard padding="lg">
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Public Gallery</h3>
            {publicGallery?.items?.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {publicGallery.items.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="aspect-square bg-[#121824] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#4F8CFF] transition-all"
                  >
                    <img 
                      src={item.url || item.thumbnail_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <CCEmpty
                icon={Image}
                title="No public images"
                description="This user hasn't added any public gallery images yet."
              />
            )}
          </CCCard>
        </CCTabsContent>

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-4">
          <CCButton 
            variant="ghost" 
            size="sm" 
            icon={Flag}
            onClick={() => setShowReportModal(true)}
            className="text-[#6B7A94]"
          >
            Report Profile
          </CCButton>
          <CCButton 
            variant="ghost" 
            size="sm" 
            icon={Ban}
            className="text-[#EF4444]"
          >
            Block
          </CCButton>
        </div>
      </div>

      {/* Report Modal */}
      <CCModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Report Profile"
      >
        <div className="space-y-4">
          <p className="text-[#9AA6BC]">
            Please select a reason for reporting this profile. Our team will review your report within 24 hours.
          </p>
          <div className="space-y-2">
            {['harassment', 'fake_profile', 'underage', 'non_consensual', 'spam', 'scam', 'other'].map(reason => (
              <button
                key={reason}
                className="w-full p-3 text-left bg-[#121824] hover:bg-[#151D2B] rounded-lg text-[#E8EEF9] capitalize transition-colors"
              >
                {reason.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </CCModal>
    </div>
  );
}