import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { 
  User, 
  MapPin, 
  Camera, 
  Edit2, 
  Save, 
  Plus,
  Image,
  Lock,
  Heart,
  Briefcase,
  Activity,
  Shield,
  MapPinned,
  Trash2,
  CheckCircle
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import LocationSelector from '@/components/location/LocationSelector';
import BioGenerator from '@/components/profile/BioGenerator';
import { filterScenePairings } from '@/components/profiles/ScenePairingFilter';
import GalleryLightbox from '@/components/profile/GalleryLightbox';
import GalleryGrid from '@/components/profile/GalleryGrid';
import ProfileThemeSelector, { PROFILE_THEMES } from '@/components/profile/ProfileThemeSelector';
import ProfileAnalytics from '@/components/profile/ProfileAnalytics';
import ReactQuill from 'react-quill';

// Component to show availability and travel from ScheduleEntry
function AvailabilityTravelSection({ user, profile }) {
  const { data: availabilityEntries = [] } = useQuery({
    queryKey: ['availabilityEntries', user?.email],
    queryFn: async () => {
      const entries = await base44.entities.ScheduleEntry.filter({ 
        user_id: user?.email,
        entry_type: 'AVAILABILITY'
      });
      return entries.filter(e => e.status === 'AVAILABLE');
    },
    enabled: !!user?.email,
  });

  const { data: travelEntries = [] } = useQuery({
    queryKey: ['travelEntries', user?.email, 'all'],
    queryFn: () => base44.entities.ScheduleEntry.filter({ 
      user_id: user?.email,
      entry_type: 'TRAVEL'
    }),
    enabled: !!user?.email,
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Availability Dates */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Availability</h3>
        {availabilityEntries.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 justify-center mb-3">
              {availabilityEntries.slice(0, 8).map(entry => (
                <CCBadge key={entry.id} variant="outline">
                  {format(new Date(entry.start_date), 'MMM d')}
                </CCBadge>
              ))}
              {availabilityEntries.length > 8 && (
                <CCBadge variant="outline">
                  +{availabilityEntries.length - 8} more
                </CCBadge>
              )}
            </div>
            <Link 
              to={createPageUrl('AvailabilitySchedule')}
              className="text-sm text-[#4F8CFF] hover:text-[#3A7AEE] text-center block"
            >
              See more →
            </Link>
          </>
        ) : (
          <p className="text-sm text-[#6B7A94] text-center">No availability dates set</p>
        )}
      </CCCard>

      {/* Travel Dates */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Travel Schedule</h3>
        {travelEntries.length > 0 ? (
          <>
            <div className="space-y-2 mb-3">
              {travelEntries.slice(0, 3).map((entry) => (
                <div key={entry.id} className="p-2 rounded bg-[#0B0F14] text-center">
                  <div className="text-sm font-medium text-[#E8EEF9]">{entry.location_city || entry.title}</div>
                  <div className="text-xs text-[#9AA6BC]">
                    {format(new Date(entry.start_date), 'MMM d')} - {format(new Date(entry.end_date), 'MMM d')}
                  </div>
                  {entry.start_time && (
                    <div className="text-xs text-[#6B7A94]">Arrives: {entry.start_time}</div>
                  )}
                </div>
              ))}
              {travelEntries.length > 3 && (
                <p className="text-xs text-[#6B7A94] text-center">
                  +{travelEntries.length - 3} more destinations
                </p>
              )}
            </div>
            <Link 
              to={createPageUrl('TravelSchedule')}
              className="text-sm text-[#4F8CFF] hover:text-[#3A7AEE] text-center block"
            >
              See more →
            </Link>
          </>
        ) : (
          <p className="text-sm text-[#6B7A94] text-center">No travel dates posted</p>
        )}
      </CCCard>
    </div>
  );
}

const genderOptions = [
  { value: 'woman', label: 'Female' },
  { value: 'man', label: 'Male' },
  { value: 'trans_woman', label: 'Trans Female' },
  { value: 'trans_man', label: 'Trans Male' },
  { value: 'non_binary', label: 'Non-Binary' },
];

const orientationOptions = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bi', label: 'Bisexual' },
  { value: 'pan', label: 'Pansexual' },
  { value: 'fluid', label: 'Fluid' },
];

const compensationPreferences = [
  { value: 'paid', label: 'Paid' },
  { value: 'trade', label: 'Trade' },
  { value: 'free', label: 'Free' },
];

const performancePositioning = [
  { value: 'Top', showFor: 'all' },
  { value: 'Bottom', showFor: 'all' },
  { value: 'Versatile', showFor: ['gay', 'bi'] },
  { value: 'Switch', showFor: 'all' },
  { value: 'Dominant', showFor: 'all' },
  { value: 'Submissive', showFor: 'all' },
  { value: 'Other', showFor: 'all' },
];

export default function Profile() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [deleteSuccessModal, setDeleteSuccessModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { galleryType, index }
  const [lightbox, setLightbox] = useState(null); // { galleryType, index }
  const [customValues, setCustomValues] = useState({
    scene_pairings: '',
    standard_acts: '',
    fetish_acts: '',
    kink_edge_acts: '',
    performance_positioning: ''
  });
  const queryClient = useQueryClient();

  // Fetch user
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Fetch profile
  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const profile = profiles[0];

  // Fetch creator details
  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['myCreatorDetails', user?.email],
    queryFn: () => base44.entities.CreatorDetails.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const details = creatorDetails[0];

  // Fetch catalog items
  const { data: catalogItems = [] } = useQuery({
    queryKey: ['catalogItems'],
    queryFn: () => base44.entities.ContentCatalogItem.filter({ status: 'active' }),
  });

  const scenePairings = catalogItems
    .filter(item => item.category === 'scene_pairing')
    .map(item => item.value);

  const standardActs = catalogItems
    .filter(item => item.category === 'standard_act')
    .map(item => item.value);

  const fetishActs = catalogItems
    .filter(item => item.category === 'fetish_act')
    .map(item => item.value);

  const kinkEdgeActs = catalogItems
    .filter(item => item.category === 'kink_edge_act')
    .map(item => item.value);

  // Fetch verification
  const { data: verification = [] } = useQuery({
    queryKey: ['myVerification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const isVerified = verification[0]?.status === 'approved';

  // Fetch galleries
  const { data: galleries = [] } = useQuery({
    queryKey: ['myGalleries', user?.email],
    queryFn: () => base44.entities.Gallery.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      if (profile) {
        return base44.entities.UserProfile.update(profile.id, data);
      } else {
        return base44.entities.UserProfile.create({ ...data, user_id: user.email });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myProfile']);
      setIsEditing(false);
    },
  });

  // Update creator details mutation
  const updateDetailsMutation = useMutation({
    mutationFn: async (data) => {
      if (details) {
        return base44.entities.CreatorDetails.update(details.id, data);
      } else {
        return base44.entities.CreatorDetails.create({ ...data, user_id: user.email });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['myCreatorDetails']);
    },
  });

  const handleSave = () => {
    const profileData = {
      real_name: editData.real_name || profile?.real_name,
      display_name: editData.display_name || profile?.display_name,
      age: editData.age || profile?.age,
      ethnicity: editData.ethnicity || profile?.ethnicity,
      bio: editData.bio || profile?.bio,
      role_type: editData.role_type || profile?.role_type,
      base_location: editData.base_location || profile?.base_location,
      travel_enabled: editData.travel_enabled ?? profile?.travel_enabled,
      profile_theme: editData.profile_theme || profile?.profile_theme || 'default',
      profile_complete: true,
    };
    updateProfileMutation.mutate(profileData);

    const creatorData = {
      gender_identity: editData.gender_identity || details?.gender_identity,
      orientation_category: editData.orientation_category || details?.orientation_category,
      scene_pairings: editData.scene_pairings || details?.scene_pairings,
      scene_pairings_other: editData.scene_pairings_other || details?.scene_pairings_other,
      compensation_preferences: editData.compensation_preferences || details?.compensation_preferences,
      standard_acts: editData.standard_acts || details?.standard_acts,
      standard_acts_other: editData.standard_acts_other || details?.standard_acts_other,
      fetish_acts: editData.fetish_acts || details?.fetish_acts,
      fetish_acts_other: editData.fetish_acts_other || details?.fetish_acts_other,
      kink_edge_acts: editData.kink_edge_acts || details?.kink_edge_acts,
      kink_edge_acts_other: editData.kink_edge_acts_other || details?.kink_edge_acts_other,
      performance_positioning: editData.performance_positioning || details?.performance_positioning,
      physical_details: editData.physical_details || details?.physical_details,
      availability_type: editData.availability_type || details?.availability_type,
      travel_regions: editData.travel_regions || details?.travel_regions,
      health_testing: editData.health_testing || details?.health_testing,
      looking_for_genders: editData.looking_for_genders || details?.looking_for_genders,
      rates_text: editData.rates_text || details?.rates_text,
    };
    updateDetailsMutation.mutate(creatorData);
  };

  const toggleArrayValue = (field, value) => {
    const current = editData[field] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setEditData({...editData, [field]: updated});
  };

  const handleAddCustomValue = async (category, field) => {
    const value = customValues[field]?.trim();
    if (!value) return;

    // Add to user's current selections
    const current = editData[field] || [];
    if (!current.includes(value)) {
      setEditData({...editData, [field]: [...current, value]});
    }

    // Submit for admin approval
    try {
      await base44.entities.CustomValueSubmission.create({
        submitted_by: user.email,
        category,
        custom_value: value,
        status: 'pending'
      });
    } catch (error) {
      console.error('Failed to submit custom value:', error);
    }

    // Clear input
    setCustomValues({...customValues, [field]: ''});
  };

  if (userLoading || profileLoading) {
    return <CCLoadingScreen message="Loading profile..." />;
  }

  // Fetch user settings for comment policy
  const { data: userSettingsArr = [] } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: () => base44.entities.UserSettings.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const userSettings = userSettingsArr[0];
  const commentPolicy = userSettings?.privacy?.gallery_comment_policy || 'everyone';

  const tabs = [
    { value: 'profile', label: 'Profile', icon: User },
    { value: 'galleries', label: 'Galleries', icon: Image },
    { value: 'analytics', label: 'Analytics', icon: Activity },
  ];

  const showFemaleFields = editData.gender_identity === 'woman' || editData.gender_identity === 'trans_woman';
  const showMaleFields = editData.gender_identity === 'man' || editData.gender_identity === 'trans_man';
  const showPositioning = (pos) => {
    if (pos.showFor === 'all') return true;
    const orientations = editData.orientation_category || [];
    return pos.showFor.some(o => orientations.includes(o));
  };

  // Filter scene pairings based on orientation and gender
  const orientations = editData.orientation_category || [];
  const genderIdentity = editData.gender_identity || details?.gender_identity;
  const filteredScenePairings = filterScenePairings(
    genderIdentity,
    scenePairings.map(sp => ({ value: sp }))
  ).map(pairing => pairing.value || pairing);

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Cover & Avatar */}
      <div className="relative">
        <div className="h-48 md:h-64 relative overflow-hidden group">
          {profile?.cover_url ? (
            <img 
              src={profile.cover_url}
              alt="Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{ background: PROFILE_THEMES[profile?.profile_theme || 'default']?.bg }}
            />
          )}
          <button 
            onClick={() => document.getElementById('cover-upload').click()}
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <div className="text-center text-white">
              <Camera className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-medium">Change Cover</p>
              <p className="text-xs text-gray-300 mt-1">Recommended: 1500x400px (Web) / 800x300px (Mobile)</p>
            </div>
          </button>
          <input
            id="cover-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                updateProfileMutation.mutate({ cover_url: file_url });
              }
            }}
          />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative -mt-16 md:-mt-20">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <CCAvatar
                  src={profile?.avatar_url}
                  size="2xl"
                />
                <button 
                  onClick={() => document.getElementById('avatar-upload').click()}
                  className="absolute bottom-0 right-0 p-2 bg-[#4F8CFF] rounded-full text-white hover:bg-[#3A7AEE] transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      updateProfileMutation.mutate({ avatar_url: file_url });
                    }
                  }}
                />
              </div>
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold text-[#E8EEF9]">
                  {profile?.display_name || 'Set up your profile'}
                </h1>
                <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                  {profile?.role_type && (
                    <CCBadge variant="outline">
                      {profile.role_type}
                    </CCBadge>
                  )}
                  {isVerified && (
                    <CCBadge variant="success" icon={Shield}>Verified</CCBadge>
                  )}
                </div>
                <CCButton
                  variant="primary"
                  icon={isEditing ? Save : Edit2}
                  onClick={isEditing ? handleSave : () => {
                    setEditData({
                      real_name: profile?.real_name,
                      display_name: profile?.display_name,
                      age: profile?.age,
                      ethnicity: profile?.ethnicity,
                      bio: profile?.bio,
                      role_type: profile?.role_type,
                      base_location: profile?.base_location,
                      travel_enabled: profile?.travel_enabled,
                      profile_theme: profile?.profile_theme || 'default',
                      gender_identity: details?.gender_identity,
                      orientation_category: details?.orientation_category || [],
                      scene_pairings: details?.scene_pairings || [],
                      scene_pairings_other: details?.scene_pairings_other,
                      compensation_preferences: details?.compensation_preferences || [],
                      standard_acts: details?.standard_acts || [],
                      standard_acts_other: details?.standard_acts_other,
                      fetish_acts: details?.fetish_acts || [],
                      fetish_acts_other: details?.fetish_acts_other,
                      kink_edge_acts: details?.kink_edge_acts || [],
                      kink_edge_acts_other: details?.kink_edge_acts_other,
                      performance_positioning: details?.performance_positioning || [],
                      physical_details: details?.physical_details || {},
                      availability_type: details?.availability_type,
                      travel_regions: details?.travel_regions || [],
                      health_testing: details?.health_testing || {},
                      looking_for_genders: details?.looking_for_genders || [],
                      rates_text: details?.rates_text || '',
                    });
                    setIsEditing(true);
                  }}
                  loading={updateProfileMutation.isPending}
                  className="mt-3"
                >
                  {isEditing ? 'Save' : 'Edit'}
                </CCButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <CCTabsList tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        <CCTabsContent value="profile" activeTab={activeTab}>
          <div className="space-y-6">
            {/* Basic Info */}
            <CCCard padding="lg">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Basic Information</h3>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Real Name</label>
                      <input
                        type="text"
                        value={editData.real_name || ''}
                        onChange={(e) => setEditData({...editData, real_name: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        placeholder="Your legal name (only visible to admins)"
                      />
                      <p className="text-xs text-[#6B7A94] mt-1">This will only be visible to platform administrators</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Display Name</label>
                      <input
                        type="text"
                        value={editData.display_name || ''}
                        onChange={(e) => setEditData({...editData, display_name: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Age</label>
                        <input
                          type="number"
                          value={editData.age || ''}
                          onChange={(e) => setEditData({...editData, age: parseInt(e.target.value) || 0})}
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="Age"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Ethnicity/Race</label>
                        <input
                          type="text"
                          value={editData.ethnicity || ''}
                          onChange={(e) => setEditData({...editData, ethnicity: e.target.value})}
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="e.g., Caucasian, Latino, etc."
                        />
                      </div>
                    </div>
                    <CCSelect
                      label="Role"
                      options={[
                        { value: 'creator', label: 'Creator' },
                        { value: 'agent', label: 'Agent' },
                        { value: 'studio', label: 'Studio' },
                        { value: 'photographer', label: 'Photographer' },
                        { value: 'videographer', label: 'Videographer' },
                      ]}
                      value={editData.role_type || profile?.role_type || ''}
                      onChange={(e) => setEditData({...editData, role_type: e.target.value})}
                      placeholder="Select your role"
                    />
                    <div className="space-y-4">
                      <CCSelect
                        label="Gender Identity"
                        options={genderOptions}
                        value={editData.gender_identity || ''}
                        onChange={(e) => setEditData({...editData, gender_identity: e.target.value})}
                        placeholder="Select gender"
                      />
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Sexual Orientation</label>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {orientationOptions.map(opt => (
                            <CCButton
                              key={opt.value}
                              variant={editData.orientation_category?.includes(opt.value) ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => toggleArrayValue('orientation_category', opt.value)}
                            >
                              {opt.label}
                            </CCButton>
                          ))}
                        </div>
                      </div>
                    </div>
                    <LocationSelector
                      value={editData.base_location || {}}
                      onChange={(location) => setEditData({...editData, base_location: location})}
                    />
                    <div>
                      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Bio</label>
                      <div className="rounded-lg overflow-hidden border border-[#263248] [&_.ql-toolbar]:bg-[#1A2438] [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-[#263248] [&_.ql-container]:bg-[#121824] [&_.ql-container]:border-0 [&_.ql-editor]:text-[#E8EEF9] [&_.ql-editor]:min-h-[120px] [&_.ql-picker-label]:text-[#9AA6BC] [&_.ql-stroke]:stroke-[#9AA6BC] [&_.ql-fill]:fill-[#9AA6BC]">
                        <ReactQuill
                          value={editData.bio || ''}
                          onChange={(val) => setEditData({...editData, bio: val})}
                          placeholder="Tell others about yourself..."
                          modules={{ toolbar: [['bold','italic','underline'], [{ list: 'bullet' }], ['link'], ['clean']] }}
                        />
                      </div>
                    </div>
                    <ProfileThemeSelector
                      value={editData.profile_theme || 'default'}
                      onChange={(theme) => setEditData({...editData, profile_theme: theme})}
                    />
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-sm text-[#6B7A94]">Display Name</p>
                      <p className="text-[#E8EEF9] mt-1">{profile?.display_name || 'Not set'}</p>
                    </div>
                    {profile?.age && (
                      <div className="text-center">
                        <p className="text-sm text-[#6B7A94]">Age</p>
                        <p className="text-[#E8EEF9] mt-1">{profile.age}</p>
                      </div>
                    )}
                    {profile?.ethnicity && (
                      <div className="text-center">
                        <p className="text-sm text-[#6B7A94]">Ethnicity</p>
                        <p className="text-[#E8EEF9] mt-1">{profile.ethnicity}</p>
                      </div>
                    )}
                    {details?.gender_identity && (
                      <div className="text-center">
                        <p className="text-sm text-[#6B7A94]">Gender Identity</p>
                        <p className="text-[#E8EEF9] mt-1 capitalize">{details.gender_identity.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {details?.orientation_category && Array.isArray(details.orientation_category) && details.orientation_category.length > 0 && (
                      <div className="text-center">
                        <p className="text-sm text-[#6B7A94]">Sexual Orientation</p>
                        <div className="flex flex-wrap gap-2 mt-2 justify-center">
                          {details.orientation_category.map(o => (
                            <CCBadge key={o} variant="outline">{o}</CCBadge>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile?.bio && (
                      <div className="text-center">
                        <p className="text-sm text-[#6B7A94]">Bio</p>
                        <div
                          className="text-[#E8EEF9] mt-1 prose prose-invert prose-sm max-w-none text-center [&_a]:text-[#4F8CFF]"
                          dangerouslySetInnerHTML={{ __html: profile.bio }}
                        />
                      </div>
                    )}
                    {profile?.base_location?.city && (
                      <div className="text-center">
                        <p className="text-sm text-[#6B7A94]">Location</p>
                        <p className="text-[#E8EEF9] mt-1 flex items-center gap-1 justify-center">
                          <MapPin className="w-4 h-4" />
                          {profile.base_location.city && profile.base_location.state && profile.base_location.country 
                            ? `${profile.base_location.city}, ${profile.base_location.state}, ${profile.base_location.country}`
                            : profile.base_location.city}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CCCard>

            {/* Creator Sections - EDIT MODE */}
            {(profile?.role_type === 'creator' || profile?.is_admin) && isEditing && (
              <>
                {/* Scene Pairings */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Heart className="w-5 h-5 text-[#FF2DAA]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Scene Pairings</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {filteredScenePairings.map(sp => (
                        <CCButton
                          key={sp}
                          variant={editData.scene_pairings?.includes(sp) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('scene_pairings', sp)}
                        >
                          {sp}
                        </CCButton>
                      ))}
                    </div>
                    {editData.scene_pairings?.includes('Other') && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customValues.scene_pairings || ''}
                          onChange={(e) => setCustomValues({...customValues, scene_pairings: e.target.value})}
                          className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="Type custom scene pairing..."
                        />
                        <CCButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddCustomValue('scene_pairing', 'scene_pairings')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                </CCCard>

                {/* Compensation Preferences */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Briefcase className="w-5 h-5 text-[#4F8CFF]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Compensation Preferences</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {compensationPreferences.map(cp => (
                      <CCButton
                        key={cp.value}
                        variant={editData.compensation_preferences?.includes(cp.value) ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => toggleArrayValue('compensation_preferences', cp.value)}
                      >
                        {cp.label}
                      </CCButton>
                    ))}
                  </div>
                </CCCard>

                {/* Standard Acts */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Activity className="w-5 h-5 text-[#4F8CFF]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Standard Acts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {standardActs.map(sa => (
                        <CCButton
                          key={sa}
                          variant={editData.standard_acts?.includes(sa) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('standard_acts', sa)}
                        >
                          {sa}
                        </CCButton>
                      ))}
                    </div>
                    {editData.standard_acts?.includes('Other') && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customValues.standard_acts || ''}
                          onChange={(e) => setCustomValues({...customValues, standard_acts: e.target.value})}
                          className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="Type custom act..."
                        />
                        <CCButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddCustomValue('standard_act', 'standard_acts')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                </CCCard>

                {/* Fetish Acts */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Activity className="w-5 h-5 text-[#FF2DAA]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Fetish Acts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {fetishActs.map(fa => (
                        <CCButton
                          key={fa}
                          variant={editData.fetish_acts?.includes(fa) ? 'accent' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('fetish_acts', fa)}
                        >
                          {fa}
                        </CCButton>
                      ))}
                    </div>
                    {editData.fetish_acts?.includes('Other') && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customValues.fetish_acts || ''}
                          onChange={(e) => setCustomValues({...customValues, fetish_acts: e.target.value})}
                          className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="Type custom fetish act..."
                        />
                        <CCButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddCustomValue('fetish_act', 'fetish_acts')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                </CCCard>

                {/* Kink / Edge Acts */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Activity className="w-5 h-5 text-[#9333EA]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Kink / Edge Acts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {kinkEdgeActs.map(ke => (
                        <CCButton
                          key={ke}
                          variant={editData.kink_edge_acts?.includes(ke) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('kink_edge_acts', ke)}
                        >
                          {ke}
                        </CCButton>
                      ))}
                    </div>
                    {editData.kink_edge_acts?.includes('Other') && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customValues.kink_edge_acts || ''}
                          onChange={(e) => setCustomValues({...customValues, kink_edge_acts: e.target.value})}
                          className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="Type custom kink/edge act..."
                        />
                        <CCButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddCustomValue('kink_edge_act', 'kink_edge_acts')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                </CCCard>

                {/* Performance Positioning */}
                <CCCard padding="lg">
                  <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Performance Positioning</h3>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {performancePositioning.filter(showPositioning).map(pp => (
                        <CCButton
                          key={pp.value}
                          variant={editData.performance_positioning?.includes(pp.value) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('performance_positioning', pp.value)}
                        >
                          {pp.value}
                        </CCButton>
                      ))}
                    </div>
                    {editData.performance_positioning?.includes('Other') && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customValues.performance_positioning || ''}
                          onChange={(e) => setCustomValues({...customValues, performance_positioning: e.target.value})}
                          className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="Type custom positioning..."
                        />
                        <CCButton
                          variant="primary"
                          size="sm"
                          onClick={() => handleAddCustomValue('performance_positioning', 'performance_positioning')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                </CCCard>

                {/* Collaboration Rate */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Briefcase className="w-5 h-5 text-[#22C55E]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Collaboration Rate</h3>
                  </div>
                  <p className="text-xs text-[#6B7A94] text-center mb-3">This rate is used as the default when creating collaborations ("Use my rate").</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[#9AA6BC] text-sm">$</span>
                    <input
                      type="number"
                      value={editData.rates_text || ''}
                      onChange={(e) => setEditData({...editData, rates_text: e.target.value})}
                      className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                      placeholder="e.g., 1500"
                    />
                    <span className="text-[#9AA6BC] text-sm">USD</span>
                  </div>
                </CCCard>

                {/* Physical Details */}
                <CCCard padding="lg">
                  <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Physical Details</h3>
                  <div className="space-y-4">
                    {showFemaleFields && (
                      <>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={editData.physical_details?.natural_breasts || false}
                            onChange={(e) => setEditData({
                              ...editData, 
                              physical_details: {...editData.physical_details, natural_breasts: e.target.checked}
                            })}
                          />
                          <label className="text-sm text-[#E8EEF9]">Natural Breasts</label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Breast Size</label>
                            <input
                              type="text"
                              value={editData.physical_details?.breast_size || ''}
                              onChange={(e) => setEditData({
                                ...editData,
                                physical_details: {...editData.physical_details, breast_size: e.target.value}
                              })}
                              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9]"
                              placeholder="e.g., 34C"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Dress Size</label>
                            <input
                              type="text"
                              value={editData.physical_details?.dress_size || ''}
                              onChange={(e) => setEditData({
                                ...editData,
                                physical_details: {...editData.physical_details, dress_size: e.target.value}
                              })}
                              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9]"
                              placeholder="e.g., 6"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Measurements</label>
                          <input
                            type="text"
                            value={editData.physical_details?.measurements || ''}
                            onChange={(e) => setEditData({
                              ...editData,
                              physical_details: {...editData.physical_details, measurements: e.target.value}
                            })}
                            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9]"
                            placeholder="e.g., 34-24-36"
                          />
                        </div>
                      </>
                    )}
                    {showMaleFields && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Endowment Size (inches)</label>
                          <input
                            type="text"
                            value={editData.physical_details?.endowment_size || ''}
                            onChange={(e) => setEditData({
                              ...editData,
                              physical_details: {...editData.physical_details, endowment_size: e.target.value}
                            })}
                            className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9]"
                            placeholder="e.g., 7"
                          />
                        </div>
                        <CCSelect
                          label="Circumcision Status"
                          options={[
                            { value: 'cut', label: 'Cut' },
                            { value: 'uncut', label: 'Uncut' },
                          ]}
                          value={editData.physical_details?.circumcision_status || ''}
                          onChange={(e) => setEditData({
                            ...editData,
                            physical_details: {...editData.physical_details, circumcision_status: e.target.value}
                          })}
                        />
                      </>
                    )}
                  </div>
                </CCCard>

                {/* Availability & Travel */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <MapPinned className="w-5 h-5 text-[#4F8CFF]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Availability & Travel</h3>
                  </div>
                  <div className="space-y-4">
                    <CCSelect
                      label="Availability Type"
                      options={[
                        { value: 'local_only', label: 'Local Only' },
                        { value: 'available_for_travel', label: 'Available for Travel' },
                      ]}
                      value={editData.availability_type || ''}
                      onChange={(e) => setEditData({...editData, availability_type: e.target.value})}
                    />
                    {editData.availability_type === 'available_for_travel' && (
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Travel Regions</label>
                        <input
                          type="text"
                          value={editData.travel_regions?.join(', ') || ''}
                          onChange={(e) => setEditData({...editData, travel_regions: e.target.value.split(',').map(t => t.trim())})}
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9]"
                          placeholder="e.g., West Coast, Europe, etc."
                        />
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Link to={createPageUrl('AvailabilitySchedule')} className="flex-1">
                        <CCButton variant="outline" fullWidth>
                          Edit Availability Dates
                        </CCButton>
                      </Link>
                      <Link to={createPageUrl('TravelSchedule')} className="flex-1">
                        <CCButton variant="outline" fullWidth>
                          Edit Travel Schedule
                        </CCButton>
                      </Link>
                    </div>
                  </div>
                </CCCard>

                {/* Health & Testing */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <Shield className="w-5 h-5 text-[#22C55E]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Health & Testing</h3>
                    {isVerified && <CCBadge variant="success" size="sm">Verified</CCBadge>}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Testing Status (Legacy)</label>
                      <input
                        type="text"
                        value={editData.health_testing?.testing_status || ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          health_testing: {...editData.health_testing, testing_status: e.target.value}
                        })}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9]"
                        placeholder="e.g., Clean, Tested"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Last Test Date</label>
                      <input
                        type="date"
                        value={editData.health_testing?.last_test_date || ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          health_testing: {...editData.health_testing, last_test_date: e.target.value}
                        })}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9]"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CCSelect
                        label="HIV Status"
                        options={[
                          { value: '', label: 'Select status' },
                          { value: 'hiv_negative', label: 'HIV Negative' },
                          { value: 'hiv_positive_undetectable', label: 'HIV Positive – Undetectable (U=U)' },
                          { value: 'hiv_positive_detectable', label: 'HIV Positive – Detectable' },
                          { value: 'unknown', label: 'Unknown / Not Disclosed' },
                          { value: 'declined', label: 'Declined to State' },
                        ]}
                        value={editData.health_testing?.hiv_status || ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          health_testing: {...editData.health_testing, hiv_status: e.target.value}
                        })}
                      />

                      <CCSelect
                        label="STI Panel Status"
                        options={[
                          { value: '', label: 'Select status' },
                          { value: 'full_panel_negative', label: 'Full Panel Negative' },
                          { value: 'positive_managed', label: 'Positive – Managed / Treated' },
                          { value: 'pending_results', label: 'Pending Results' },
                          { value: 'expired', label: 'Expired' },
                          { value: 'not_tested', label: 'Not Tested' },
                          { value: 'declined', label: 'Declined to State' },
                        ]}
                        value={editData.health_testing?.sti_panel_status || ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          health_testing: {...editData.health_testing, sti_panel_status: e.target.value}
                        })}
                      />

                      <CCSelect
                        label="Testing Recency"
                        options={[
                          { value: '', label: 'Select recency' },
                          { value: 'within_14_days', label: 'Tested within 14 days' },
                          { value: 'within_30_days', label: 'Tested within 30 days' },
                          { value: 'within_60_days', label: 'Tested within 60 days' },
                          { value: 'older_than_60_days', label: 'Older than 60 days' },
                          { value: 'unknown', label: 'Unknown' },
                        ]}
                        value={editData.health_testing?.testing_recency || ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          health_testing: {...editData.health_testing, testing_recency: e.target.value}
                        })}
                      />

                      <CCSelect
                        label="Testing Provider"
                        options={[
                          { value: '', label: 'Select provider' },
                          { value: 'talent_testing_service', label: 'Talent Testing Service' },
                          { value: 'private_lab', label: 'Private Lab' },
                          { value: 'clinic_doctor', label: 'Clinic / Doctor' },
                          { value: 'self_reported', label: 'Self-Reported' },
                          { value: 'other', label: 'Other (Specify)' },
                        ]}
                        value={editData.health_testing?.testing_provider_type || ''}
                        onChange={(e) => setEditData({
                          ...editData,
                          health_testing: {...editData.health_testing, testing_provider_type: e.target.value}
                        })}
                      />
                    </div>

                    {editData.health_testing?.testing_provider_type === 'other' && (
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                          Specify Other Provider
                        </label>
                        <input
                          type="text"
                          value={editData.health_testing?.testing_provider_other || ''}
                          onChange={(e) => setEditData({
                            ...editData,
                            health_testing: {...editData.health_testing, testing_provider_other: e.target.value}
                          })}
                          placeholder="Enter provider name"
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94]"
                        />
                      </div>
                    )}

                    <CCSelect
                      label="Testing Visibility"
                      options={[
                        { value: 'public', label: 'Public' },
                        { value: 'private', label: 'Private' },
                        { value: 'collaboration_room_only', label: 'Collaboration Room Only' },
                        { value: 'verified_collaborators', label: 'Verified Collaborators' },
                      ]}
                      value={editData.health_testing?.testing_visibility || 'private'}
                      onChange={(e) => setEditData({
                        ...editData,
                        health_testing: {...editData.health_testing, testing_visibility: e.target.value}
                      })}
                    />
                    <p className="text-xs text-[#6B7A94]">
                      Control who can see your testing information
                    </p>

                    <div className="bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-lg p-3">
                      <p className="text-xs text-[#9AA6BC]">
                        <strong className="text-[#4F8CFF]">Note:</strong> These status fields are for your records only. 
                        Verification requires admin-reviewed TestingCredentials. Upload testing documents in Settings.
                      </p>
                    </div>
                  </div>
                </CCCard>
              </>
            )}

            {/* Creator Sections - VIEW MODE */}
            {(profile?.role_type === 'creator' || profile?.is_admin) && !isEditing && (
              <>
                {/* Scene Pairings */}
                {details?.scene_pairings && details.scene_pairings.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4 justify-center">
                      <Heart className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Scene Pairings</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {details.scene_pairings.map(sp => (
                        <CCBadge key={sp} variant="outline">{sp.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {/* Compensation Preferences */}
                {details?.compensation_preferences && details.compensation_preferences.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4 justify-center">
                      <Briefcase className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Compensation Preferences</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {details.compensation_preferences.map(cp => (
                        <CCBadge key={cp} variant="outline">
                          {cp}
                        </CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {/* Standard Acts */}
                {details?.standard_acts && details.standard_acts.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4 justify-center">
                      <Activity className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Standard Acts</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {details.standard_acts.map(sa => (
                        <CCBadge key={sa} variant="outline">{sa.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {/* Fetish Acts */}
                {details?.fetish_acts && details.fetish_acts.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4 justify-center">
                      <Activity className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Fetish Acts</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {details.fetish_acts.map(fa => (
                        <CCBadge key={fa} variant="outline">{fa.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {/* Kink / Edge Acts */}
                {details?.kink_edge_acts && details.kink_edge_acts.length > 0 && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4 justify-center">
                      <Activity className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Kink / Edge Acts</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {details.kink_edge_acts.map(ke => (
                        <CCBadge key={ke} variant="outline">{ke.replace(/_/g, ' ')}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {/* Performance Positioning */}
                {details?.performance_positioning && details.performance_positioning.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Performance Positioning</h3>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {details.performance_positioning.map(pp => (
                        <CCBadge key={pp} variant="outline">{pp}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {/* Collaboration Rate - view mode */}
                {details?.rates_text && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-2 justify-center">
                      <Briefcase className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Collaboration Rate</h3>
                    </div>
                    <p className="text-2xl font-bold text-[#22C55E] text-center">${details.rates_text} <span className="text-sm font-normal text-[#9AA6BC]">USD</span></p>
                  </CCCard>
                )}

                {/* Physical Details */}
                {details?.physical_details && Object.keys(details.physical_details).length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4 text-center">Physical Details</h3>
                    <div className="space-y-2 text-center">
                      {details.physical_details.breast_size && (
                        <p className="text-[#E8EEF9]">Breast Size: {details.physical_details.breast_size}</p>
                      )}
                      {details.physical_details.measurements && (
                        <p className="text-[#E8EEF9]">Measurements: {details.physical_details.measurements}</p>
                      )}
                      {details.physical_details.endowment_size && (
                        <p className="text-[#E8EEF9]">Endowment: {details.physical_details.endowment_size}"</p>
                      )}
                      {details.physical_details.circumcision_status && (
                        <p className="text-[#E8EEF9]">Circumcision: {details.physical_details.circumcision_status === 'cut' ? 'Cut' : 'Uncut'}</p>
                      )}
                    </div>
                  </CCCard>
                )}

                {/* Availability & Travel */}
                {details?.availability_type && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4 justify-center">
                      <MapPinned className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Availability & Travel</h3>
                    </div>
                    <p className="text-[#E8EEF9] mb-2 capitalize text-center">
                      {details.availability_type.replace(/_/g, ' ')}
                    </p>
                    {details.travel_regions && details.travel_regions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {details.travel_regions.map(tr => (
                          <CCBadge key={tr} variant="outline">{tr}</CCBadge>
                        ))}
                      </div>
                    )}
                  </CCCard>
                )}

                {/* Health & Testing */}
                {details?.health_testing?.testing_status && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4 justify-center">
                      <Shield className="w-5 h-5 text-[#9AA6BC]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Health & Testing</h3>
                      <CCBadge variant="outline" size="sm">Private by Default</CCBadge>
                    </div>
                    <div className="space-y-2 text-center">
                      <p className="text-[#E8EEF9]">Status: {details.health_testing.testing_status}</p>
                      {details.health_testing.last_test_date && (
                        <p className="text-[#E8EEF9]">Last Test: {new Date(details.health_testing.last_test_date).toLocaleDateString()}</p>
                      )}
                      <p className="text-[#6B7A94] text-sm">Visibility: {details.health_testing.testing_visibility?.replace(/_/g, ' ') || 'private'}</p>
                    </div>
                  </CCCard>
                )}
              </>
            )}

            {/* Availability and Travel */}
            <CCCard padding="lg">
              <div className="space-y-4">
                <AvailabilityTravelSection user={user} profile={profile} />
                {!isEditing && (
                  <div className="flex gap-3 pt-4 border-t border-[#263248]">
                    <Link to={createPageUrl('AvailabilitySchedule')} className="flex-1">
                      <CCButton variant="outline" fullWidth>
                        Edit Availability Dates
                      </CCButton>
                    </Link>
                    <Link to={createPageUrl('TravelSchedule')} className="flex-1">
                      <CCButton variant="outline" fullWidth>
                        Edit Travel Schedule
                      </CCButton>
                    </Link>
                  </div>
                )}
              </div>
            </CCCard>

            {/* AI Bio Generator - At the very bottom */}
            {isEditing && (
              <CCCard padding="lg">
                <BioGenerator 
                  profile={profile}
                  details={details}
                  onSelectBio={(bio) => setEditData({...editData, bio})}
                />
              </CCCard>
            )}
          </div>
        </CCTabsContent>

        <CCTabsContent value="analytics" activeTab={activeTab}>
          <ProfileAnalytics userId={user?.email} />
        </CCTabsContent>

        <CCTabsContent value="galleries" activeTab={activeTab}>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Public Gallery */}
            <CCCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#E8EEF9] flex-1 text-center">Public Gallery</h3>
                <CCButton 
                  variant="outline" 
                  size="sm" 
                  icon={Plus}
                  onClick={() => document.getElementById('public-gallery-upload').click()}
                >
                  Add
                </CCButton>
                <input
                  id="public-gallery-upload"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const publicGallery = galleries.find(g => g.type === 'public');
                    const items = publicGallery?.items || [];
                    
                    for (const file of files) {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      items.push({
                        id: Date.now().toString(),
                        url: file_url,
                        type: file.type.startsWith('video') ? 'video' : 'image',
                        order: items.length
                      });
                    }
                    
                    if (publicGallery) {
                      await base44.entities.Gallery.update(publicGallery.id, { items });
                    } else {
                      await base44.entities.Gallery.create({
                        user_id: user.email,
                        type: 'public',
                        name: 'Public Gallery',
                        items
                      });
                    }
                    queryClient.invalidateQueries(['myGalleries']);
                  }}
                />
              </div>
              <p className="text-sm text-[#6B7A94] mb-4 text-center">G-rated images visible to all verified members.</p>
              <GalleryGrid
                gallery={galleries.find(g => g.type === 'public')}
                onDelete={(i) => setDeleteConfirm({ galleryType: 'public', index: i })}
                onImageClick={(i) => setLightbox({ galleryType: 'public', index: i })}
                onReorder={async (reordered) => {
                  const gallery = galleries.find(g => g.type === 'public');
                  await base44.entities.Gallery.update(gallery.id, { items: reordered });
                  queryClient.invalidateQueries(['myGalleries']);
                }}
                onUpload={async (files) => {
                  const publicGallery = galleries.find(g => g.type === 'public');
                  const items = publicGallery?.items || [];
                  for (const file of files) {
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    items.push({ id: Date.now().toString(), url: file_url, type: file.type.startsWith('video') ? 'video' : 'image', order: items.length });
                  }
                  if (publicGallery) {
                    await base44.entities.Gallery.update(publicGallery.id, { items });
                  } else {
                    await base44.entities.Gallery.create({ user_id: user.email, type: 'public', name: 'Public Gallery', items });
                  }
                  queryClient.invalidateQueries(['myGalleries']);
                }}
              />
            </CCCard>

            {/* Private Gallery */}
            <CCCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#E8EEF9] flex items-center gap-2 flex-1 justify-center">
                  <Lock className="w-4 h-4" /> Private Gallery
                </h3>
                <CCButton 
                  variant="outline" 
                  size="sm" 
                  icon={Plus}
                  onClick={() => document.getElementById('private-gallery-upload').click()}
                >
                  Add
                </CCButton>
                <input
                  id="private-gallery-upload"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const privateGallery = galleries.find(g => g.type === 'private');
                    const items = privateGallery?.items || [];
                    
                    for (const file of files) {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      items.push({
                        id: Date.now().toString(),
                        url: file_url,
                        type: file.type.startsWith('video') ? 'video' : 'image',
                        order: items.length
                      });
                    }
                    
                    if (privateGallery) {
                      await base44.entities.Gallery.update(privateGallery.id, { items });
                    } else {
                      await base44.entities.Gallery.create({
                        user_id: user.email,
                        type: 'private',
                        name: 'Private Gallery',
                        items
                      });
                    }
                    queryClient.invalidateQueries(['myGalleries']);
                  }}
                />
              </div>
              <p className="text-sm text-[#6B7A94] mb-4 text-center">Only visible to users you grant permission.</p>
              <GalleryGrid
                gallery={galleries.find(g => g.type === 'private')}
                onDelete={(i) => setDeleteConfirm({ galleryType: 'private', index: i })}
                onImageClick={(i) => setLightbox({ galleryType: 'private', index: i })}
                onReorder={async (reordered) => {
                  const gallery = galleries.find(g => g.type === 'private');
                  await base44.entities.Gallery.update(gallery.id, { items: reordered });
                  queryClient.invalidateQueries(['myGalleries']);
                }}
              />
            </CCCard>
          </div>
        </CCTabsContent>
      </div>

      {/* Gallery Lightbox */}
      {lightbox && (() => {
        const gallery = galleries.find(g => g.type === lightbox.galleryType);
        return (
          <GalleryLightbox
            images={gallery?.items || []}
            initialIndex={lightbox.index}
            onClose={() => setLightbox(null)}
          />
        );
      })()}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#151D2B] border border-[#263248] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-[#EF4444]/20 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-[#EF4444]" />
            </div>
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-2">Delete Photo</h2>
            <p className="text-[#9AA6BC] text-sm mb-6">Are you sure you want to delete this photo? This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-[#263248] text-[#E8EEF9] rounded-lg font-medium hover:bg-[#1A2438] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const gallery = galleries.find(g => g.type === deleteConfirm.galleryType);
                  const updated = gallery.items.filter((_, idx) => idx !== deleteConfirm.index);
                  await base44.entities.Gallery.update(gallery.id, { items: updated });
                  queryClient.invalidateQueries(['myGalleries']);
                  setDeleteConfirm(null);
                  setDeleteSuccessModal(true);
                }}
                className="flex-1 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Success Modal */}
      {deleteSuccessModal && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-[#151D2B] border border-[#263248] rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-[#22C55E]" />
            </div>
            <h2 className="text-lg font-semibold text-[#E8EEF9] mb-2">Photo Deleted</h2>
            <p className="text-[#9AA6BC] text-sm mb-5">The photo has been removed from your gallery.</p>
            <button
              onClick={() => setDeleteSuccessModal(false)}
              className="w-full py-2 bg-[#4F8CFF] hover:bg-[#3A7AEE] text-white rounded-lg font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}