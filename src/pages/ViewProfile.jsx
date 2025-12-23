import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Calendar, 
  DollarSign, 
  Heart, 
  MessageCircle, 
  ShieldCheck,
  Plane,
  ArrowLeft,
  Users,
  Camera,
  Video,
  Briefcase,
  Building
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import SocialLinksDisplay from '@/components/socials/SocialLinksDisplay';
import AccessGate from '@/components/auth/AccessGate';

const roleColors = {
  creator: 'primary',
  photographer: 'warning',
  videographer: 'danger',
  agent: 'accent',
  studio: 'success',
};

const roleLabels = {
  creator: 'Creator',
  photographer: 'Photographer',
  videographer: 'Videographer',
  agent: 'Agent',
  studio: 'Studio',
};

const roleIcons = {
  creator: Users,
  photographer: Camera,
  videographer: Video,
  agent: Briefcase,
  studio: Building,
};

export default function ViewProfile() {
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
    enabled: !!profileUserId && !!user && isVerified && isSubscribed,
  });

  const profile = profiles[0];

  // Fetch verification for profile
  const { data: profileVerifications = [] } = useQuery({
    queryKey: ['profileVerification', profileUserId],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && !!profile,
  });

  const isProfileVerified = profileVerifications[0]?.status === 'approved';

  // Fetch role-specific details
  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['creatorDetails', profileUserId],
    queryFn: () => base44.entities.CreatorDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && profile?.role_type === 'creator',
  });

  const { data: agentDetails = [] } = useQuery({
    queryKey: ['agentDetails', profileUserId],
    queryFn: () => base44.entities.AgentDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && profile?.role_type === 'agent',
  });

  const { data: serviceDetails = [] } = useQuery({
    queryKey: ['serviceDetails', profileUserId],
    queryFn: () => base44.entities.ServiceDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && (profile?.role_type === 'photographer' || profile?.role_type === 'videographer'),
  });

  const { data: studioDetails = [] } = useQuery({
    queryKey: ['studioDetails', profileUserId],
    queryFn: () => base44.entities.StudioDetails.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && profile?.role_type === 'studio',
  });

  // Fetch galleries
  const { data: galleries = [] } = useQuery({
    queryKey: ['galleries', profileUserId],
    queryFn: () => base44.entities.Gallery.filter({ user_id: profileUserId, type: 'public' }),
    enabled: !!profileUserId && !!profile,
  });

  // Fetch social links
  const { data: socialLinks = [] } = useQuery({
    queryKey: ['socialLinks', profileUserId],
    queryFn: () => base44.entities.SocialLink.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && !!profile,
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
          title="Profile not found"
          description="This profile doesn't exist or has been removed."
          action={() => window.history.back()}
          actionLabel="Go Back"
        />
      </div>
    );
  }

  const creator = creatorDetails[0];
  const agent = agentDetails[0];
  const service = serviceDetails[0];
  const studio = studioDetails[0];
  const RoleIcon = roleIcons[profile.role_type] || Users;

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Cover Image */}
      <div className="relative h-64 md:h-80 bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20">
        {profile.cover_url ? (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#4F8CFF]/30 to-[#FF2DAA]/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-transparent to-transparent" />
        
        {/* Back Button */}
        <Link to={createPageUrl('Discovery')}>
          <CCButton
            variant="outline"
            icon={ArrowLeft}
            className="absolute top-4 left-4 backdrop-blur-sm"
          >
            Back
          </CCButton>
        </Link>
      </div>

      {/* Profile Content */}
      <div className="max-w-5xl mx-auto px-4 -mt-24 relative z-10">
        {/* Avatar & Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <div className="flex-shrink-0">
            <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-[#0B0F14] bg-[#151D2B]">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-5xl text-[#6B7A94]">
                    {profile.display_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-[#E8EEF9]">
                    {profile.display_name}
                  </h1>
                  {isProfileVerified && (
                    <div className="w-8 h-8 rounded-full bg-[#4F8CFF] flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <CCBadge variant={roleColors[profile.role_type]} icon={RoleIcon}>
                    {roleLabels[profile.role_type]}
                  </CCBadge>
                  {profile.travel_enabled && (
                    <CCBadge variant="outline" icon={Plane} size="sm">
                      Available for Travel
                    </CCBadge>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-[#9AA6BC]">
                  {profile.age && <span>{profile.age} years old</span>}
                  {profile.base_location?.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {profile.base_location.city}
                      {profile.base_location.state && `, ${profile.base_location.state}`}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <CCButton variant="outline" icon={Heart}>
                  Save
                </CCButton>
                <CCButton variant="primary" icon={MessageCircle}>
                  Message
                </CCButton>
              </div>
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <CCCard padding="lg" className="mb-6">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-3">About</h2>
            <p className="text-[#9AA6BC] leading-relaxed whitespace-pre-wrap">
              {profile.bio}
            </p>
          </CCCard>
        )}

        {/* Creator Details */}
        {profile.role_type === 'creator' && creator && (
          <>
            {/* Basic Info */}
            {(creator.gender_identity || creator.orientation_category || creator.ethnicity) && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {creator.gender_identity && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Gender Identity</p>
                      <p className="text-[#E8EEF9] capitalize">
                        {creator.gender_identity.replace('_', ' ')}
                      </p>
                    </div>
                  )}
                  {creator.orientation_category && creator.orientation_category.length > 0 && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Orientation</p>
                      <div className="flex flex-wrap gap-2">
                        {creator.orientation_category.map(o => (
                          <CCBadge key={o} variant="primary" size="sm">
                            {o.replace('_', ' ')}
                          </CCBadge>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.ethnicity && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Ethnicity</p>
                      <p className="text-[#E8EEF9]">{profile.ethnicity}</p>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {/* Scene Pairings & Content */}
            {(creator.scene_pairings?.length > 0 || creator.compensation_preferences?.length > 0) && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Content Preferences</h2>
                {creator.scene_pairings?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-[#6B7A94] mb-2">Scene Pairings</p>
                    <div className="flex flex-wrap gap-2">
                      {creator.scene_pairings.map(scene => (
                        <CCBadge key={scene} variant="primary" size="sm">
                          {scene.replace(/_/g, ' ')}
                        </CCBadge>
                      ))}
                    </div>
                  </div>
                )}
                {creator.compensation_preferences?.length > 0 && (
                  <div>
                    <p className="text-sm text-[#6B7A94] mb-2">Compensation Types</p>
                    <div className="flex flex-wrap gap-2">
                      {creator.compensation_preferences.map(comp => (
                        <CCBadge key={comp} variant="accent" size="sm" icon={DollarSign}>
                          {comp.charAt(0).toUpperCase() + comp.slice(1)}
                        </CCBadge>
                      ))}
                    </div>
                  </div>
                )}
              </CCCard>
            )}

            {/* Acts */}
            {(creator.standard_acts?.length > 0 || creator.fetish_acts?.length > 0 || creator.kink_edge_acts?.length > 0) && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Performance Acts</h2>
                {creator.standard_acts?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-[#6B7A94] mb-2">Standard Acts</p>
                    <div className="flex flex-wrap gap-2">
                      {creator.standard_acts.map(act => (
                        <CCBadge key={act} variant="primary" size="sm">
                          {act}
                        </CCBadge>
                      ))}
                    </div>
                  </div>
                )}
                {creator.fetish_acts?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-[#6B7A94] mb-2">Fetish Acts</p>
                    <div className="flex flex-wrap gap-2">
                      {creator.fetish_acts.map(act => (
                        <CCBadge key={act} variant="warning" size="sm">
                          {act}
                        </CCBadge>
                      ))}
                    </div>
                  </div>
                )}
                {creator.kink_edge_acts?.length > 0 && (
                  <div>
                    <p className="text-sm text-[#6B7A94] mb-2">Kink/Edge Acts</p>
                    <div className="flex flex-wrap gap-2">
                      {creator.kink_edge_acts.map(act => (
                        <CCBadge key={act} variant="danger" size="sm">
                          {act}
                        </CCBadge>
                      ))}
                    </div>
                  </div>
                )}
              </CCCard>
            )}

            {/* Physical Details */}
            {creator.physical_details && Object.keys(creator.physical_details).length > 0 && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Physical Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {creator.physical_details.breast_size && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Breast Size</p>
                      <p className="text-[#E8EEF9]">{creator.physical_details.breast_size}</p>
                    </div>
                  )}
                  {creator.physical_details.measurements && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Measurements</p>
                      <p className="text-[#E8EEF9]">{creator.physical_details.measurements}</p>
                    </div>
                  )}
                  {creator.physical_details.endowment_size && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Endowment Size</p>
                      <p className="text-[#E8EEF9]">{creator.physical_details.endowment_size}"</p>
                    </div>
                  )}
                  {creator.physical_details.circumcision_status && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Circumcision Status</p>
                      <p className="text-[#E8EEF9] capitalize">{creator.physical_details.circumcision_status}</p>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {/* Rates */}
            {creator.rates_text && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Rates
                </h2>
                <p className="text-[#9AA6BC] whitespace-pre-wrap">{creator.rates_text}</p>
              </CCCard>
            )}
          </>
        )}

        {/* Agent Details */}
        {profile.role_type === 'agent' && agent && (
          <>
            {agent.agency_name && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-3">Agency Information</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-[#6B7A94] mb-1">Agency Name</p>
                    <p className="text-[#E8EEF9] text-lg">{agent.agency_name}</p>
                  </div>
                  {agent.website && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Website</p>
                      <a href={agent.website} target="_blank" rel="noopener noreferrer" className="text-[#4F8CFF] hover:underline">
                        {agent.website}
                      </a>
                    </div>
                  )}
                  {agent.content_types?.length > 0 && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-2">Content Types</p>
                      <div className="flex flex-wrap gap-2">
                        {agent.content_types.map(type => (
                          <CCBadge key={type} variant="primary" size="sm">
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </CCBadge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CCCard>
            )}
          </>
        )}

        {/* Service Provider Details */}
        {(profile.role_type === 'photographer' || profile.role_type === 'videographer') && service && (
          <>
            {(service.service_type || service.content_types?.length > 0) && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Services</h2>
                <div className="space-y-3">
                  {service.service_type && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Service Type</p>
                      <p className="text-[#E8EEF9] capitalize">{service.service_type.replace('_', ' ')}</p>
                    </div>
                  )}
                  {service.content_types?.length > 0 && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-2">Content Types</p>
                      <div className="flex flex-wrap gap-2">
                        {service.content_types.map(type => (
                          <CCBadge key={type} variant="primary" size="sm">
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </CCBadge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {service.rates && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Rates</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {service.rates.hourly && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Hourly</p>
                      <p className="text-[#E8EEF9] text-lg">${service.rates.hourly}</p>
                    </div>
                  )}
                  {service.rates.half_day && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Half Day</p>
                      <p className="text-[#E8EEF9] text-lg">${service.rates.half_day}</p>
                    </div>
                  )}
                  {service.rates.full_day && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Full Day</p>
                      <p className="text-[#E8EEF9] text-lg">${service.rates.full_day}</p>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {service.packages?.length > 0 && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Packages</h2>
                <div className="space-y-4">
                  {service.packages.map((pkg, idx) => (
                    <div key={idx} className="p-4 bg-[#0B0F14] rounded-lg border border-[#263248]">
                      <h3 className="font-semibold text-[#E8EEF9] mb-2">{pkg.name}</h3>
                      {pkg.description && <p className="text-sm text-[#9AA6BC] mb-2">{pkg.description}</p>}
                      {pkg.price && <p className="text-[#4F8CFF] font-semibold">${pkg.price}</p>}
                    </div>
                  ))}
                </div>
              </CCCard>
            )}
          </>
        )}

        {/* Studio Details */}
        {profile.role_type === 'studio' && studio && (
          <>
            {studio.studio_name && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Studio Information</h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-[#6B7A94] mb-1">Studio Name</p>
                    <p className="text-[#E8EEF9] text-lg">{studio.studio_name}</p>
                  </div>
                  {studio.website && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-1">Website</p>
                      <a href={studio.website} target="_blank" rel="noopener noreferrer" className="text-[#4F8CFF] hover:underline">
                        {studio.website}
                      </a>
                    </div>
                  )}
                  {studio.content_types?.length > 0 && (
                    <div>
                      <p className="text-sm text-[#6B7A94] mb-2">Content Types</p>
                      <div className="flex flex-wrap gap-2">
                        {studio.content_types.map(type => (
                          <CCBadge key={type} variant="primary" size="sm">
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </CCBadge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {studio.locations?.length > 0 && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Locations</h2>
                <div className="space-y-4">
                  {studio.locations.map((loc, idx) => (
                    <div key={idx} className="p-4 bg-[#0B0F14] rounded-lg border border-[#263248]">
                      <h3 className="font-semibold text-[#E8EEF9] mb-2">{loc.name}</h3>
                      <p className="text-sm text-[#9AA6BC]">
                        {loc.city && loc.country && `${loc.city}, ${loc.country}`}
                      </p>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}
          </>
        )}

        {/* Travel Info */}
        {profile.travel_enabled && profile.travel_regions?.length > 0 && (
          <CCCard padding="lg" className="mb-6">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
              <Plane className="w-5 h-5" />
              Travel Availability
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.travel_regions.map(region => (
                <CCBadge key={region} variant="primary" size="sm">
                  {region}
                </CCBadge>
              ))}
            </div>
          </CCCard>
        )}

        {/* Public Gallery */}
        {galleries[0]?.items?.length > 0 && (
          <CCCard padding="lg" className="mb-6">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Gallery</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleries[0].items.map((item, idx) => (
                <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-[#151D2B]">
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt={item.caption || 'Gallery item'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      controls
                    />
                  )}
                </div>
              ))}
            </div>
          </CCCard>
        )}

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <CCCard padding="lg" className="mb-6">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">Connect</h2>
            <SocialLinksDisplay links={socialLinks} />
          </CCCard>
        )}
      </div>
    </div>
  );
}