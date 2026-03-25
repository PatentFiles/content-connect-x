import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useMobilePageSetup from '@/hooks/useMobilePageSetup';
import { toast } from 'sonner';
import SaveToFavoritesModal from '@/components/profiles/SaveToFavoritesModal';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
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
  Building,
  Image,
  Lock,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import SocialLinksDisplay from '@/components/socials/SocialLinksDisplay';
import AccessGate from '@/components/auth/AccessGate';
import { useVerificationCheck } from '@/components/auth/useVerificationCheck';
import VerificationRequired from '@/components/auth/VerificationRequired';
import FriendRequestButton from '@/components/friends/FriendRequestButton';
import CCErrorModal from '@/components/ui-custom/CCErrorModal';
import BookingRequestModal from '@/components/booking/BookingRequestModal';
import StudioBookingModal from '@/components/booking/StudioBookingModal';
import AgentRepresentationRequestModal from '@/components/representation/AgentRepresentationRequestModal';
import GalleryLightbox from '@/components/profile/GalleryLightbox';
import { PROFILE_THEMES } from '@/components/profile/ProfileThemeSelector';
import ReputationBadge from '@/components/trust/ReputationBadge';
import CollaborationHistory from '@/components/profile/CollaborationHistory';
import TrustBadges from '@/components/profile/TrustBadges';
import PreCollaborationCheck from '@/components/trust/PreCollaborationCheck';
import CCModal from '@/components/ui-custom/CCModal';

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

  // Register mobile header back button
  useMobilePageSetup({ title: 'Profile', onBack: () => window.history.back() });
  
  const { checking: verificationChecking, blocked: verificationBlocked } = useVerificationCheck('view_profile');

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

  const isAdmin = myProfiles[0]?.is_admin || user?.role === 'admin';
  const isVerified = isAdmin || verification?.[0]?.status === 'approved';
  const isSubscribed = isAdmin || subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch current viewer's own profile for display name
  const { data: myProfiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const myProfile = myProfiles[0];

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

  // Fetch reputation score for profile
  const { data: profileReputationArr = [] } = useQuery({
    queryKey: ['profileReputation', profileUserId],
    queryFn: () => base44.entities.ReputationScore.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && !!profile,
  });
  const profileReputation = profileReputationArr[0];

  // Fetch testing credential for trust badges
  const { data: profileTestingArr = [] } = useQuery({
    queryKey: ['profileTesting', profileUserId],
    queryFn: () => base44.entities.TestingCredential.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && !!profile,
  });
  const profileTestingCred = profileTestingArr[0];

  // Fetch galleries
  const { data: galleries = [] } = useQuery({
    queryKey: ['galleries', profileUserId],
    queryFn: () => base44.entities.Gallery.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && !!profile,
  });

  // Fetch private gallery permission for current user
  const { data: galleryPermissions = [] } = useQuery({
    queryKey: ['galleryPermissions', profileUserId, user?.email],
    queryFn: () => base44.entities.GalleryPermission.filter({ owner_id: profileUserId, granted_to_user_id: user?.email, status: 'granted' }),
    enabled: !!profileUserId && !!user?.email,
  });
  const hasPrivateAccess = galleryPermissions.length > 0;

  // Fetch social links
  const { data: socialLinks = [] } = useQuery({
    queryKey: ['socialLinks', profileUserId],
    queryFn: () => base44.entities.SocialLink.filter({ user_id: profileUserId }),
    enabled: !!profileUserId && !!profile,
  });

  // Fetch availability entries
  const { data: availabilityEntries = [] } = useQuery({
    queryKey: ['availabilityEntries', profileUserId],
    queryFn: async () => {
      const entries = await base44.entities.ScheduleEntry.filter({ 
        user_id: profileUserId,
        entry_type: 'AVAILABILITY'
      });
      return entries.filter(e => e.status === 'AVAILABLE');
    },
    enabled: !!profileUserId && !!profile,
  });

  // Fetch travel entries
  const { data: travelEntries = [] } = useQuery({
    queryKey: ['travelEntries', profileUserId],
    queryFn: () => base44.entities.ScheduleEntry.filter({ 
      user_id: profileUserId,
      entry_type: 'TRAVEL'
    }),
    enabled: !!profileUserId && !!profile,
  });

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState({ title: '', message: '' });
  const [activeTab, setActiveTab] = useState('profile');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxGalleryType, setLightboxGalleryType] = useState('public');
  const [accessRequested, setAccessRequested] = useState(false);
  const [showPreCheck, setShowPreCheck] = useState(false);
  const [showAgentRepModal, setShowAgentRepModal] = useState(false);

  // Fetch target user's privacy settings
  const { data: targetSettingsArr = [] } = useQuery({
    queryKey: ['targetSettings', profileUserId],
    queryFn: () => base44.entities.UserSettings.filter({ user_id: profileUserId }),
    enabled: !!profileUserId,
  });
  const targetSettings = targetSettingsArr[0];
  const commentPolicy = targetSettings?.privacy?.gallery_comment_policy || 'everyone';
  const showGalleryCount = targetSettings?.privacy?.show_gallery_count ?? true;

  // Track profile view once per session per profile
  useEffect(() => {
    if (!user?.email || !profileUserId || profileUserId === user.email) return;
    const key = `pv_${user.email}_${profileUserId}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    base44.entities.ProfileView.create({
      profile_owner_id: profileUserId,
      viewer_user_id: user.email,
      viewed_date: new Date().toISOString().split('T')[0],
      view_type: 'profile',
    }).catch(() => {});
  }, [user?.email, profileUserId]);
  
  // Fetch favorites to check if profile is saved
  const { data: favorites = [] } = useQuery({
    queryKey: ['myFavorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ owner_id: user?.email }),
    enabled: !!user?.email,
  });

  const isSaved = favorites.some(f => f.items?.some(item => item.user_id === profileUserId));
  const queryClient = useQueryClient();

  // Fetch friend count and friendship status
  const { data: friendCount } = useQuery({
    queryKey: ['friendCount', profileUserId],
    queryFn: async () => {
      const friendships = await base44.entities.Friendship.filter({
        status: 'ACCEPTED',
        $or: [
          { requester_user_id: profileUserId },
          { addressee_user_id: profileUserId }
        ]
      });
      return friendships.length;
    },
    enabled: !!profileUserId,
  });

  // Check friend settings visibility
  const { data: friendSettings } = useQuery({
    queryKey: ['friendSettings', profileUserId],
    queryFn: async () => {
      const settings = await base44.entities.FriendSettings.filter({ user_id: profileUserId });
      return settings[0] || { friend_count_visibility: 'PUBLIC' };
    },
    enabled: !!profileUserId,
  });

  const canSeeFriendCount = () => {
    if (!friendSettings) return false;
    if (friendSettings.friend_count_visibility === 'PUBLIC') return true;
    if (friendSettings.friend_count_visibility === 'VERIFIED_ONLY' && isVerified) return true;
    if (friendSettings.friend_count_visibility === 'PRIVATE' && user?.email === profileUserId) return true;
    return false;
  };

  // Unsave from favorites mutation
  const unsaveFromFavoritesMutation = useMutation({
    mutationFn: async (userId) => {
      const listsWithProfile = favorites.filter(f => f.items?.some(item => item.user_id === userId));
      await Promise.all(
        listsWithProfile.map(list => {
          const updatedItems = list.items.filter(item => item.user_id !== userId);
          return base44.entities.Favorite.update(list.id, { items: updatedItems });
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      toast.success('Removed from favorites');
    },
  });

  const handleSaveClick = () => {
    if (isSaved) {
      // Unsave directly
      unsaveFromFavoritesMutation.mutate(profileUserId);
    } else {
      if (favorites.length === 0) {
        // No lists exist, create default
        base44.entities.Favorite.create({
          owner_id: user.email,
          name: 'My Favorites',
          items: [{ user_id: profileUserId, added_at: new Date().toISOString() }],
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['myFavorites'] });
          toast.success('Saved to favorites');
        });
      } else {
        setShowSaveModal(true);
      }
    }
  };

  // Fetch representation info (for creators only)
  const { data: agentRepresentations = [] } = useQuery({
    queryKey: ['agentRepresentation', profileUserId],
    queryFn: () => base44.entities.AgentRepresentation.filter({ 
      creator_user_id: profileUserId,
      status: 'ACTIVE'
    }),
    enabled: !!profileUserId && profile?.role_type === 'creator',
  });

  const { data: studioRepresentations = [] } = useQuery({
    queryKey: ['studioRepresentation', profileUserId],
    queryFn: () => base44.entities.StudioRepresentation.filter({ 
      creator_user_id: profileUserId,
      active: true
    }),
    enabled: !!profileUserId && profile?.role_type === 'creator',
  });

  // Fetch agent/studio profiles for representation
  const agentIds = agentRepresentations.map(r => r.agent_user_id);
  const studioIds = studioRepresentations.map(r => r.studio_id);
  
  const { data: representativeProfiles = [] } = useQuery({
    queryKey: ['representativeProfiles', [...agentIds, ...studioIds]],
    queryFn: async () => {
      const allIds = [...agentIds, ...studioIds];
      if (allIds.length === 0) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => allIds.includes(p.user_id));
    },
    enabled: (agentIds.length + studioIds.length) > 0,
  });

  if (userLoading || profileLoading || verificationChecking) {
    return <CCLoadingScreen message="Loading profile..." />;
  }

  if (!user) {
    return <AccessGate type="both" />;
  }

  if (verificationBlocked) {
    return <VerificationRequired action="view profiles" />;
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

  const tabs = [
    { value: 'profile', label: 'Profile', icon: Users },
    { value: 'galleries', label: 'Galleries', icon: Image },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Cover Image */}
      <div className="relative h-64 md:h-80">
        {profile.cover_url ? (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: PROFILE_THEMES[profile.profile_theme || 'default']?.bg }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F14] via-transparent to-transparent" />
        
        {/* Back Button */}
        <button
          onClick={() => window.history.back()}
          className="absolute left-4 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/40 backdrop-blur-sm border border-white/20 text-white text-sm font-medium min-h-[44px] min-w-[44px] transition-opacity active:opacity-70"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      {/* Profile Content */}
      <div className="max-w-5xl mx-auto px-4 -mt-24 relative z-10">
        {/* Avatar & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-[#0B0F14] bg-[#151D2B] mb-4">
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
          
          <div className="flex items-center justify-center gap-2 mb-3">
            <CCBadge variant={roleColors[profile.role_type]} icon={RoleIcon}>
              {roleLabels[profile.role_type]}
            </CCBadge>
            {profile.travel_enabled && (
              <CCBadge variant="outline" icon={Plane} size="sm">
                Available for Travel
              </CCBadge>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-sm text-[#9AA6BC] mb-4">
            {profile.age && <span>{profile.age} years old</span>}
            {profile.base_location?.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {profile.base_location.city}
                {profile.base_location.state && `, ${profile.base_location.state}`}
              </span>
            )}
          </div>

          {/* Trust Badges + Reputation */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <TrustBadges profile={profile} verification={profileVerifications[0]} testingCred={profileTestingCred} size="sm" />
            {profileReputation && <ReputationBadge score={profileReputation} size="sm" />}
          </div>

          {/* Connection Stats */}
          {canSeeFriendCount() && friendCount !== undefined && (
            <div className="flex items-center justify-center gap-2 mb-4 text-[#9AA6BC]">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{friendCount} connections</span>
            </div>
          )}

          <div className="flex gap-3 w-full max-w-md flex-wrap">
            <button
              onClick={handleSaveClick}
              disabled={unsaveFromFavoritesMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[#263248] bg-transparent hover:bg-[#151D2B] transition-all duration-200 disabled:opacity-50"
            >
              <Heart 
                className={`w-4 h-4 ${isSaved ? 'fill-[#EF4444] text-[#EF4444]' : 'text-[#E8EEF9]'}`}
              />
              <span className="text-[#E8EEF9]">
                {isSaved ? 'Saved' : 'Save'}
              </span>
            </button>
            {user?.email !== profileUserId && (
              <CCButton
                variant="outline"
                icon={Calendar}
                className="flex-1"
                onClick={() => setShowPreCheck(true)}
              >
                Book
              </CCButton>
            )}
            <CCButton 
              variant="primary" 
              icon={MessageCircle}
              className="flex-1"
              onClick={async () => {
                try {
                  const { data } = await base44.functions.invoke('startConversation', {
                    recipient_id: profileUserId
                  });
                  window.location.href = createPageUrl(`Messages?conversation=${data.conversation.id}`);
                } catch (error) {
                  setErrorMessage({
                    title: 'Failed to Start Conversation',
                    message: 'Unable to start a conversation at this time. Please try again later.'
                  });
                  setShowErrorModal(true);
                }
              }}
            >
              Message
            </CCButton>
          </div>

          {/* Friend Request Button */}
          {user?.email !== profileUserId && (
            <div className="w-full max-w-md mt-3">
              <FriendRequestButton targetUserId={profileUserId} size="md" variant="outline" />
            </div>
          )}
        </div>

        {/* Save to Favorites Modal */}
        <SaveToFavoritesModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          profileUserId={profileUserId}
          userEmail={user?.email}
        />

        {/* Error Modal */}
        <CCErrorModal
          isOpen={showErrorModal}
          onClose={() => setShowErrorModal(false)}
          title={errorMessage.title}
          message={errorMessage.message}
        />

        {/* Pre-Collaboration Check Modal */}
        <CCModal
          isOpen={showPreCheck}
          onClose={() => setShowPreCheck(false)}
          title=""
          size="md"
          showClose
        >
          <PreCollaborationCheck
            targetUserId={profileUserId}
            currentUserId={user?.email}
            onProceed={() => { setShowPreCheck(false); setShowBookingModal(true); }}
            onCancel={() => setShowPreCheck(false)}
            showProceed={user?.email !== profileUserId}
          />
        </CCModal>

        {/* Booking Modal — studio uses StudioBookingModal, others use generic */}
        {profile?.role_type === 'studio' ? (
          <StudioBookingModal
            isOpen={showBookingModal}
            onClose={() => setShowBookingModal(false)}
            recipientUserId={profileUserId}
            recipientName={profile?.display_name}
            requesterUserId={user?.email}
            studioDetails={studio}
          />
        ) : (
          <BookingRequestModal
            isOpen={showBookingModal}
            onClose={() => setShowBookingModal(false)}
            recipientUserId={profileUserId}
            recipientName={profile?.display_name}
            requesterUserId={user?.email}
          />
        )}

        {/* Tabs */}
        <CCTabsList tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {/* Galleries Tab */}
        <CCTabsContent value="galleries" activeTab={activeTab}>
          {/* Public Gallery */}
          {(() => {
            const publicGallery = galleries.find(g => g.type === 'public');
            return publicGallery?.items?.length > 0 ? (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-1 text-center">Public Gallery</h2>
                {showGalleryCount && (
                  <p className="text-xs text-[#6B7A94] text-center mb-4">{publicGallery.items.length} photo{publicGallery.items.length !== 1 ? 's' : ''}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {publicGallery.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="aspect-square rounded-lg overflow-hidden bg-[#151D2B] cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => {
                        if (user?.email && profileUserId !== user.email) {
                          const key = `gv_${user.email}_${profileUserId}_${idx}_${new Date().toDateString()}`;
                          if (!sessionStorage.getItem(key)) {
                            sessionStorage.setItem(key, '1');
                            base44.entities.ProfileView.create({
                              profile_owner_id: profileUserId,
                              viewer_user_id: user.email,
                              viewed_date: new Date().toISOString().split('T')[0],
                              view_type: 'gallery',
                            }).catch(() => {});
                          }
                        }
                        setLightboxGalleryType('public');
                        setLightboxIndex(idx);
                      }}
                    >
                      {item.type === 'video' ? (
                        <video src={item.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={item.url} alt={item.caption || 'Gallery item'} className="w-full h-full object-cover" />
                      )}
                    </div>
                  ))}
                </div>
              </CCCard>
            ) : (
              <CCCard padding="lg" className="mb-6">
                <CCEmpty icon={Image} title="No public gallery items" description="This user hasn't added any public gallery items yet." />
              </CCCard>
            );
          })()}

          {/* Private Gallery */}
          {(() => {
            const privateGallery = galleries.find(g => g.type === 'private');
            if (!privateGallery && !hasPrivateAccess) return null;
            return (
              <CCCard padding="lg" className="mb-6">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-[#9AA6BC]" />
                  <h2 className="text-xl font-semibold text-[#E8EEF9]">Private Gallery</h2>
                </div>
                {hasPrivateAccess && privateGallery?.items?.length > 0 ? (
                  <>
                    {showGalleryCount && (
                      <p className="text-xs text-[#6B7A94] text-center mb-4">{privateGallery.items.length} photo{privateGallery.items.length !== 1 ? 's' : ''}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {privateGallery.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="aspect-square rounded-lg overflow-hidden bg-[#151D2B] cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            setLightboxGalleryType('private');
                            setLightboxIndex(idx);
                          }}
                        >
                          {item.type === 'video' ? (
                            <video src={item.url} className="w-full h-full object-cover" />
                          ) : (
                            <img src={item.url} alt={item.caption || 'Gallery item'} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-[#263248] flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-[#6B7A94]" />
                    </div>
                    <p className="text-[#9AA6BC] text-sm mb-4">This gallery is private. Request access to view its contents.</p>
                    {accessRequested ? (
                      <div className="flex items-center justify-center gap-2 text-[#22C55E] text-sm font-medium">
                        <CheckCircle className="w-4 h-4" />
                        Access request sent!
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          base44.entities.Notification.create({
                            user_id: profileUserId,
                            type: 'messages',
                            actor_user_id: user?.email,
                            title: 'Private Gallery Access Request',
                            body: `${myProfile?.display_name || user?.full_name || user?.email} is requesting access to your private gallery.`,
                          }).catch(() => {});
                          setAccessRequested(true);
                        }}
                        className="px-4 py-2 bg-[#4F8CFF] hover:bg-[#3A7AEE] text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Request Access
                      </button>
                    )}
                  </div>
                )}
              </CCCard>
            );
          })()}

          {/* Lightbox */}
          {lightboxIndex !== null && (() => {
            const activeGallery = galleries.find(g => g.type === lightboxGalleryType);
            return activeGallery?.items?.length > 0 ? (
              <GalleryLightbox
                images={activeGallery.items}
                initialIndex={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                galleryId={activeGallery?.id}
                profileOwnerId={profileUserId}
                currentUser={user}
                commentPolicy={commentPolicy}
              />
            ) : null;
          })()}
        </CCTabsContent>

        {/* Profile Tab */}
        <CCTabsContent value="profile" activeTab={activeTab}>

        {/* Representation Section */}
        {profile.role_type === 'creator' && (agentRepresentations.length > 0 || studioRepresentations.length > 0) && (
          <CCCard padding="lg" className="mb-6">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2 justify-center">
              <Briefcase className="w-5 h-5" />
              Representation
            </h2>
            <div className="space-y-3">
              {agentRepresentations.map(rep => {
                const agent = representativeProfiles.find(p => p.user_id === rep.agent_user_id);
                return agent ? (
                  <div key={rep.id} className="flex items-center gap-3 p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                    <div className="w-10 h-10 rounded-full bg-[#FF2DAA]/20 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#6B7A94]">Represented by Agent</p>
                      <Link to={createPageUrl(`ViewProfile?id=${agent.user_id}`)} className="text-[#E8EEF9] font-medium hover:text-[#4F8CFF]">
                        {agent.display_name}
                      </Link>
                    </div>
                  </div>
                ) : null;
              })}
              {studioRepresentations.map(rep => {
                const studio = representativeProfiles.find(p => p.user_id === rep.studio_id);
                const isExclusive = rep.representation_type === 'Exclusive';
                return studio ? (
                  <div key={rep.id} className="flex items-center gap-3 p-3 bg-[#0B0F14] rounded-lg border border-[#263248]">
                    <div className="w-10 h-10 rounded-full bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                      <Building className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm text-[#6B7A94]">Represented by Studio</p>
                        {isExclusive && (
                          <CCBadge variant="warning" size="sm">
                            Exclusive
                          </CCBadge>
                        )}
                      </div>
                      <Link to={createPageUrl(`ViewProfile?id=${studio.user_id}`)} className="text-[#E8EEF9] font-medium hover:text-[#4F8CFF]">
                        {studio.display_name}
                      </Link>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </CCCard>
        )}

        {/* Collaboration History */}
        {user?.email !== profileUserId && (
          <div className="mb-6">
            <CollaborationHistory
              targetUserId={profileUserId}
              isOwner={false}
              visibilitySetting="summary"
            />
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <CCCard padding="lg" className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-3 text-center">About</h2>
            <div
              className="text-[#9AA6BC] leading-relaxed prose prose-invert prose-sm max-w-none text-center [&_a]:text-[#4F8CFF]"
              dangerouslySetInnerHTML={{ __html: profile.bio }}
            />
          </CCCard>
        )}

        {/* Creator Details */}
        {profile.role_type === 'creator' && creator && (
          <>
            {/* Basic Info */}
            {(creator.gender_identity || creator.orientation_category || creator.ethnicity) && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Basic Information</h2>
                <div className="space-y-4 text-center">
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
                      <p className="text-sm text-[#E8EEF9]">
                        {creator.orientation_category.map(o => o.replace('_', ' ')).join(', ')}
                      </p>
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
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Content Preferences</h2>
                {creator.scene_pairings?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-[#6B7A94] mb-2">Scene Pairings</p>
                    <p className="text-sm text-[#E8EEF9]">
                     {creator.scene_pairings.map(scene => scene.replace(/_/g, ' ')).join(', ')}
                    </p>
                  </div>
                )}
                {creator.compensation_preferences?.length > 0 && (
                  <div>
                    <p className="text-sm text-[#6B7A94] mb-2">Compensation Types</p>
                    <p className="text-sm text-[#E8EEF9]">
                     {creator.compensation_preferences.map(comp => 
                       comp.charAt(0).toUpperCase() + comp.slice(1)
                     ).join(', ')}
                    </p>
                  </div>
                )}
              </CCCard>
            )}

            {/* Acts */}
            {(creator.standard_acts?.length > 0 || creator.fetish_acts?.length > 0 || creator.kink_edge_acts?.length > 0) && (
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Performance Acts</h2>
                {creator.standard_acts?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-[#6B7A94] mb-2">Standard Acts</p>
                    <p className="text-sm text-[#E8EEF9]">
                     {creator.standard_acts.map(act => 
                       act.replace('prints_stills', 'prints/stills').replace('solo_with_toys', 'solo with toys').replace(/_/g, ' ')
                     ).join(', ')}
                    </p>
                  </div>
                )}
                {creator.fetish_acts?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm text-[#6B7A94] mb-2">Fetish Acts</p>
                    <p className="text-sm text-[#E8EEF9]">
                     {creator.fetish_acts.map(act => act.replace(/_/g, ' ')).join(', ')}
                    </p>
                  </div>
                )}
                {creator.kink_edge_acts?.length > 0 && (
                  <div>
                    <p className="text-sm text-[#6B7A94] mb-2">Kink/Edge Acts</p>
                    <p className="text-sm text-[#E8EEF9]">
                     {creator.kink_edge_acts.map(act => 
                       act.replace('dominant_submissive', 'dominant/submissive').replace(/_/g, ' ')
                     ).join(', ')}
                    </p>
                  </div>
                )}
              </CCCard>
            )}

            {/* Physical Details */}
            {creator.physical_details && Object.keys(creator.physical_details).length > 0 && (
              <CCCard padding="lg" className="mb-6">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Physical Details</h2>
                <div className="grid grid-cols-1 gap-4 text-center">
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
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2 justify-center">
                  <DollarSign className="w-5 h-5" />
                  Rates
                </h2>
                <p className="text-[#9AA6BC] whitespace-pre-wrap text-center">{creator.rates_text}</p>
              </CCCard>
            )}
          </>
        )}

        {/* Agent Details */}
        {profile.role_type === 'agent' && agent && (
          <>
            {agent.agency_name && (
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-3 text-center">Agency Information</h2>
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
                         <span key={type} className="text-sm text-[#E8EEF9]">
                           {type.charAt(0).toUpperCase() + type.slice(1)}
                         </span>
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
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Services</h2>
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
                         <span key={type} className="text-sm text-[#E8EEF9]">
                           {type.charAt(0).toUpperCase() + type.slice(1)}
                         </span>
                       ))}
                      </div>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {service.rates && (
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Rates</h2>
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
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Packages</h2>
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
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Studio Information</h2>
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
                         <span key={type} className="text-sm text-[#E8EEF9]">
                           {type.charAt(0).toUpperCase() + type.slice(1)}
                         </span>
                       ))}
                      </div>
                    </div>
                  )}
                </div>
              </CCCard>
            )}

            {studio.locations?.length > 0 && (
              <CCCard padding="lg" className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Locations</h2>
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
          <CCCard padding="lg" className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2 justify-center">
              <Plane className="w-5 h-5" />
              Travel Availability
            </h2>
            <div className="flex flex-wrap gap-2">
             {profile.travel_regions.map(region => (
               <span key={region} className="text-sm text-[#E8EEF9]">
                 {region}
               </span>
             ))}
            </div>
          </CCCard>
        )}

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <CCCard padding="lg" className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4 text-center">Connect</h2>
            <SocialLinksDisplay links={socialLinks} />
          </CCCard>
        )}

        {/* Availability & Travel */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <CCCard padding="lg">
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">
              {profile.role_type === 'studio' ? 'Studio Availability' : 'Availability'}
            </h3>
            {availabilityEntries.length > 0 ? (
              profile.role_type === 'studio' ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availabilityEntries.slice(0, 6).map(entry => (
                    <div key={entry.id} className="p-2 bg-[#0B0F14] rounded-lg border border-[#263248]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-[#E8EEF9]">
                          {format(new Date(entry.start_date), 'MMM d')}
                          {entry.end_date !== entry.start_date && ` – ${format(new Date(entry.end_date), 'MMM d')}`}
                        </div>
                        <CCBadge variant="success" size="sm">Open</CCBadge>
                      </div>
                      {(entry.start_time || entry.end_time) && (
                        <p className="text-xs text-[#6B7A94] mt-0.5">
                          {entry.start_time}{entry.end_time && ` – ${entry.end_time}`}
                        </p>
                      )}
                      {entry.room_label && (
                        <p className="text-xs text-[#4F8CFF] mt-0.5">{entry.room_label}</p>
                      )}
                    </div>
                  ))}
                  {availabilityEntries.length > 6 && (
                    <p className="text-xs text-[#6B7A94] text-center">+{availabilityEntries.length - 6} more windows</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center">
                  {availabilityEntries.slice(0, 8).map(entry => (
                    <CCBadge key={entry.id} variant="outline">
                      {format(new Date(entry.start_date), 'MMM d')}
                    </CCBadge>
                  ))}
                  {availabilityEntries.length > 8 && (
                    <CCBadge variant="outline">+{availabilityEntries.length - 8} more</CCBadge>
                  )}
                </div>
              )
            ) : (
              <p className="text-sm text-[#6B7A94] text-center">No availability dates posted</p>
            )}
          </CCCard>

          <CCCard padding="lg">
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Travel Schedule</h3>
            {travelEntries.length > 0 ? (
              <div className="space-y-2">
                {travelEntries.slice(0, 3).map(entry => (
                  <div key={entry.id} className="p-2 rounded bg-[#0B0F14] text-center">
                    <div className="text-sm font-medium text-[#E8EEF9]">{entry.location_city || entry.title}</div>
                    <div className="text-xs text-[#9AA6BC]">
                      {format(new Date(entry.start_date), 'MMM d')} - {format(new Date(entry.end_date), 'MMM d')}
                    </div>
                    {entry.start_time && <div className="text-xs text-[#6B7A94]">Arrives: {entry.start_time}</div>}
                  </div>
                ))}
                {travelEntries.length > 3 && (
                  <p className="text-xs text-[#6B7A94] text-center">+{travelEntries.length - 3} more destinations</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#6B7A94] text-center">No travel dates posted</p>
            )}
          </CCCard>
        </div>

        </CCTabsContent>
        </div>
    </div>
  );
}