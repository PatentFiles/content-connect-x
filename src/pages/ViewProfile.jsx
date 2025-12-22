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
  Ban
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
    enabled: !!profileUserId && profile?.role_type === 'creator',
  });

  const details = creatorDetails[0];

  // Fetch service details
  const { data: serviceDetails = [] } = useQuery({
    queryKey: ['viewServiceDetails', profileUserId],
    queryFn: () => base44.entities.ServiceDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && (profile?.role_type === 'photographer' || profile?.role_type === 'videographer'),
  });

  const service = serviceDetails[0];

  // Fetch galleries
  const { data: galleries = [] } = useQuery({
    queryKey: ['viewGalleries', profileUserId],
    queryFn: () => base44.entities.Gallery.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  // Fetch testing credential
  const { data: testingCredential = [] } = useQuery({
    queryKey: ['viewTesting', profileUserId],
    queryFn: () => base44.entities.TestingCredential.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });

  const testing = testingCredential[0];

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
    ...(profile.role_type === 'photographer' || profile.role_type === 'videographer' ? [{ value: 'services', label: 'Services' }] : []),
  ];

  const publicGallery = galleries.find(g => g.type === 'public');

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Cover & Avatar */}
      <div className="relative">
        <div className="h-48 md:h-64 bg-gradient-to-br from-[#4F8CFF]/30 to-[#FF2DAA]/30">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />
          )}
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
                    {profile.base_location?.city && (
                      <span className="text-sm text-[#9AA6BC] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {profile.base_location.city}, {profile.base_location.country}
                      </span>
                    )}
                    {profile.response_time_hours && (
                      <span className="text-sm text-[#6B7A94] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ~{profile.response_time_hours}h reply
                      </span>
                    )}
                  </div>
                  {testing?.status_badge === 'valid' && testing?.share_settings?.show_badge_publicly && (
                    <CCBadge variant="success" className="mt-2" icon={ShieldCheck}>
                      Testing Valid until {new Date(testing.expires_at).toLocaleDateString()}
                    </CCBadge>
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
          <div className="grid md:grid-cols-2 gap-6">
            {/* Bio */}
            <CCCard padding="lg">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">About</h3>
              <p className="text-[#9AA6BC]">{profile.bio || 'No bio provided.'}</p>
            </CCCard>

            {/* Details for Creator */}
            {profile.role_type === 'creator' && details && (
              <CCCard padding="lg">
                <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Details</h3>
                <div className="space-y-3">
                  {details.gender_identity && (
                    <div>
                      <p className="text-sm text-[#6B7A94]">Identity</p>
                      <p className="text-[#E8EEF9] capitalize">{details.gender_identity.replace('_', ' ')}</p>
                    </div>
                  )}
                  {details.orientation_category && (
                    <div>
                      <p className="text-sm text-[#6B7A94]">Category</p>
                      <p className="text-[#E8EEF9] capitalize">{details.orientation_category.replace('_', ' ')}</p>
                    </div>
                  )}
                  {details.collab_types?.length > 0 && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-2">Open to</p>
                      <div className="flex gap-2">
                        {details.collab_types.map(type => (
                          <CCBadge 
                            key={type} 
                            variant={type === 'paid' ? 'success' : type === 'trade' ? 'warning' : 'default'}
                          >
                            {type}
                          </CCBadge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {/* Tags */}
            {details?.tags?.length > 0 && (
              <CCCard padding="lg">
                <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Categories & Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {details.tags.map(tag => (
                    <CCBadge key={tag} variant="outline">{tag}</CCBadge>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Travel */}
            {profile.travel_enabled && profile.travel_dates?.length > 0 && (
              <CCCard padding="lg">
                <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" /> Travel Plans
                </h3>
                <div className="space-y-2">
                  {profile.travel_dates.map((travel, i) => (
                    <div key={i} className="p-3 bg-[#121824] rounded-lg">
                      <p className="font-medium text-[#E8EEF9]">{travel.location}</p>
                      <p className="text-sm text-[#6B7A94]">
                        {new Date(travel.start_date).toLocaleDateString()} - {new Date(travel.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Social Links */}
            {details?.socials && Object.values(details.socials).some(v => v) && (
              <CCCard padding="lg">
                <h3 className="text-lg font-semibold text-[#E8EEF9] mb-3">Links</h3>
                <div className="space-y-2">
                  {details.socials.onlyfans && (
                    <a href={details.socials.onlyfans} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#4F8CFF] hover:underline">
                      <LinkIcon className="w-4 h-4" /> OnlyFans
                    </a>
                  )}
                  {details.socials.fansly && (
                    <a href={details.socials.fansly} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#4F8CFF] hover:underline">
                      <LinkIcon className="w-4 h-4" /> Fansly
                    </a>
                  )}
                  {details.socials.twitter && (
                    <a href={details.socials.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#4F8CFF] hover:underline">
                      <LinkIcon className="w-4 h-4" /> Twitter/X
                    </a>
                  )}
                  {details.socials.instagram && (
                    <a href={details.socials.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#4F8CFF] hover:underline">
                      <LinkIcon className="w-4 h-4" /> Instagram
                    </a>
                  )}
                </div>
              </CCCard>
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

        {/* Services Tab */}
        <CCTabsContent value="services" activeTab={activeTab}>
          {service ? (
            <div className="space-y-6">
              {/* Rates */}
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

              {/* Packages */}
              {service.packages?.length > 0 && (
                <CCCard padding="lg">
                  <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Packages</h3>
                  <div className="space-y-4">
                    {service.packages.map((pkg, i) => (
                      <div key={i} className="p-4 bg-[#121824] rounded-xl">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-[#E8EEF9]">{pkg.name}</h4>
                          <span className="text-lg font-bold text-[#4F8CFF]">${pkg.price}</span>
                        </div>
                        <p className="text-sm text-[#9AA6BC] mb-2">{pkg.description}</p>
                        <p className="text-xs text-[#6B7A94]">
                          Duration: {pkg.duration} • Deliverables: {pkg.deliverables}
                        </p>
                      </div>
                    ))}
                  </div>
                </CCCard>
              )}

              {/* Gear */}
              {service.gear_list?.length > 0 && (
                <CCCard padding="lg">
                  <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Equipment</h3>
                  <div className="flex flex-wrap gap-2">
                    {service.gear_list.map((gear, i) => (
                      <CCBadge key={i} variant="outline">{gear}</CCBadge>
                    ))}
                  </div>
                </CCCard>
              )}
            </div>
          ) : (
            <CCEmpty
              title="No service details"
              description="This user hasn't set up their service offerings yet."
            />
          )}
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