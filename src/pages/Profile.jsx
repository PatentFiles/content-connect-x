import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
  MapPinned
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

const scenePairings = [
  { value: 'boy_girl', label: 'Boy / Girl' },
  { value: 'girl_girl', label: 'Girl / Girl' },
  { value: 'boy_boy', label: 'Boy / Boy' },
  { value: 'boy_boy_girl', label: 'Boy / Boy / Girl' },
  { value: 'boy_girl_girl', label: 'Boy / Girl / Girl' },
  { value: 'boy_boy_boy', label: 'Boy / Boy / Boy' },
  { value: 'girl_girl_girl', label: 'Girl / Girl / Girl' },
  { value: 'boy_girl_boy_girl', label: 'Boy / Girl / Boy / Girl' },
  { value: 'group', label: 'Group' },
  { value: 'gangbang', label: 'Gangbang' },
  { value: 'interracial', label: 'Interracial' },
  { value: 'trans_male_trans_female', label: 'Trans Male / Trans Female' },
  { value: 'trans_male_trans_male', label: 'Trans Male / Trans Male' },
  { value: 'trans_female_trans_female', label: 'Trans Female / Trans Female' },
  { value: 'trans_female_boy', label: 'Trans Female / Boy' },
  { value: 'trans_female_girl', label: 'Trans Female / Girl' },
  { value: 'other', label: 'Other' },
];

const compensationPreferences = [
  { value: 'paid', label: 'Paid' },
  { value: 'trade', label: 'Trade' },
  { value: 'free', label: 'Free' },
];

const standardActs = [
  { value: 'solo', label: 'Solo' },
  { value: 'solo_with_toys', label: 'Solo with Toys' },
  { value: 'boy_girl', label: 'Boy / Girl' },
  { value: 'girl_girl', label: 'Girl / Girl' },
  { value: 'boy_boy', label: 'Boy / Boy' },
  { value: 'facials', label: 'Facials' },
  { value: 'creampies', label: 'Creampies' },
  { value: 'swallowing', label: 'Swallowing' },
  { value: 'anal', label: 'Anal' },
  { value: 'interracial', label: 'Interracial' },
  { value: 'group', label: 'Group' },
  { value: 'orgy', label: 'Orgy' },
  { value: 'prints_stills', label: 'Prints / Stills' },
  { value: 'feature_dancing', label: 'Feature Dancing' },
  { value: 'softcore', label: 'Softcore' },
  { value: 'other', label: 'Other' },
];

const fetishActs = [
  { value: 'foot_jobs', label: 'Foot Jobs' },
  { value: 'rimming', label: 'Rimming' },
  { value: 'squirting', label: 'Squirting' },
  { value: 'other', label: 'Other' },
];

const kinkEdgeActs = [
  { value: 'bondage', label: 'Bondage' },
  { value: 'dominant_submissive', label: 'Dominant / Submissive' },
  { value: 'power_exchange', label: 'Power Exchange' },
  { value: 'roleplay', label: 'Roleplay' },
  { value: 'strap_on', label: 'Strap-On' },
  { value: 'pegging', label: 'Pegging' },
  { value: 'cuckold', label: 'Cuckold' },
  { value: 'hotwife', label: 'Hotwife' },
  { value: 'swingers', label: 'Swingers' },
  { value: 'toy_play', label: 'Toy Play' },
  { value: 'other', label: 'Other' },
];

const performancePositioning = [
  { value: 'top', label: 'Top', showFor: ['gay', 'bi'] },
  { value: 'bottom', label: 'Bottom', showFor: ['gay', 'bi'] },
  { value: 'versatile', label: 'Versatile', showFor: ['gay', 'bi'] },
  { value: 'switch', label: 'Switch', showFor: 'all' },
  { value: 'dominant', label: 'Dominant', showFor: 'all' },
  { value: 'submissive', label: 'Submissive', showFor: 'all' },
];

export default function Profile() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
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

  if (userLoading || profileLoading) {
    return <CCLoadingScreen message="Loading profile..." />;
  }

  const tabs = [
    { value: 'profile', label: 'Profile', icon: User },
    { value: 'galleries', label: 'Galleries', icon: Image },
  ];

  const showFemaleFields = editData.gender_identity === 'woman' || editData.gender_identity === 'trans_woman';
  const showMaleFields = editData.gender_identity === 'man' || editData.gender_identity === 'trans_man';
  const showPositioning = (pos) => {
    if (pos.showFor === 'all') return true;
    const orientations = editData.orientation_category || [];
    return pos.showFor.some(o => orientations.includes(o));
  };

  // Filter scene pairings based on gender identity
  const filteredScenePairings = filterScenePairings(editData.gender_identity, scenePairings);

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
            <div className="w-full h-full bg-gradient-to-br from-[#4F8CFF] via-[#7B5FA9] to-[#FF2DAA]" />
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
                    <CCBadge 
                      variant={
                        profile.role_type === 'creator' ? 'primary' :
                        profile.role_type === 'agent' ? 'accent' :
                        profile.role_type === 'studio' ? 'success' :
                        profile.role_type === 'photographer' ? 'warning' :
                        profile.role_type === 'videographer' ? 'danger' :
                        'default'
                      }
                    >
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
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Basic Information</h3>
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
                    <div className="grid grid-cols-2 gap-3">
                      <CCSelect
                        label="Gender Identity"
                        options={genderOptions}
                        value={editData.gender_identity || ''}
                        onChange={(e) => setEditData({...editData, gender_identity: e.target.value})}
                        placeholder="Select gender"
                      />
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Sexual Orientation</label>
                        <div className="flex flex-wrap gap-2">
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
                      <textarea
                        value={editData.bio || ''}
                        onChange={(e) => setEditData({...editData, bio: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px]"
                        placeholder="Tell others about yourself..."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-[#6B7A94]">Display Name</p>
                      <p className="text-[#E8EEF9] mt-1">{profile?.display_name || 'Not set'}</p>
                    </div>
                    {profile?.age && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Age</p>
                        <p className="text-[#E8EEF9] mt-1">{profile.age}</p>
                      </div>
                    )}
                    {profile?.ethnicity && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Ethnicity</p>
                        <p className="text-[#E8EEF9] mt-1">{profile.ethnicity}</p>
                      </div>
                    )}
                    {details?.gender_identity && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Gender Identity</p>
                        <p className="text-[#E8EEF9] mt-1 capitalize">{details.gender_identity.replace(/_/g, ' ')}</p>
                      </div>
                    )}
                    {details?.orientation_category && Array.isArray(details.orientation_category) && details.orientation_category.length > 0 && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Sexual Orientation</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {details.orientation_category.map(o => (
                            <CCBadge key={o} variant="outline">{o}</CCBadge>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile?.bio && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Bio</p>
                        <p className="text-[#E8EEF9] mt-1">{profile.bio}</p>
                      </div>
                    )}
                    {profile?.base_location?.city && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Location</p>
                        <p className="text-[#E8EEF9] mt-1 flex items-center gap-1">
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
                  <div className="flex items-center gap-2 mb-4">
                    <Heart className="w-5 h-5 text-[#FF2DAA]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Scene Pairings</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {filteredScenePairings.map(sp => (
                        <CCButton
                          key={sp.value}
                          variant={editData.scene_pairings?.includes(sp.value) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('scene_pairings', sp.value)}
                        >
                          {sp.label}
                        </CCButton>
                      ))}
                    </div>
                    {editData.scene_pairings?.includes('other') && (
                      <input
                        type="text"
                        value={editData.scene_pairings_other || ''}
                        onChange={(e) => setEditData({...editData, scene_pairings_other: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        placeholder="Specify other scene pairings..."
                      />
                    )}
                  </div>
                </CCCard>

                {/* Compensation Preferences */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="w-5 h-5 text-[#4F8CFF]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Compensation Preferences</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-[#4F8CFF]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Standard Acts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {standardActs.map(sa => (
                        <CCButton
                          key={sa.value}
                          variant={editData.standard_acts?.includes(sa.value) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('standard_acts', sa.value)}
                        >
                          {sa.label}
                        </CCButton>
                      ))}
                    </div>
                    {editData.standard_acts?.includes('other') && (
                      <input
                        type="text"
                        value={editData.standard_acts_other || ''}
                        onChange={(e) => setEditData({...editData, standard_acts_other: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        placeholder="Specify other acts..."
                      />
                    )}
                  </div>
                </CCCard>

                {/* Fetish Acts */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-[#FF2DAA]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Fetish Acts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {fetishActs.map(fa => (
                        <CCButton
                          key={fa.value}
                          variant={editData.fetish_acts?.includes(fa.value) ? 'accent' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('fetish_acts', fa.value)}
                        >
                          {fa.label}
                        </CCButton>
                      ))}
                    </div>
                    {editData.fetish_acts?.includes('other') && (
                      <input
                        type="text"
                        value={editData.fetish_acts_other || ''}
                        onChange={(e) => setEditData({...editData, fetish_acts_other: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        placeholder="Specify other fetish acts..."
                      />
                    )}
                  </div>
                </CCCard>

                {/* Kink / Edge Acts */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-[#9333EA]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Kink / Edge Acts</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {kinkEdgeActs.map(ke => (
                        <CCButton
                          key={ke.value}
                          variant={editData.kink_edge_acts?.includes(ke.value) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('kink_edge_acts', ke.value)}
                        >
                          {ke.label}
                        </CCButton>
                      ))}
                    </div>
                    {editData.kink_edge_acts?.includes('other') && (
                      <input
                        type="text"
                        value={editData.kink_edge_acts_other || ''}
                        onChange={(e) => setEditData({...editData, kink_edge_acts_other: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        placeholder="Specify other kink/edge acts..."
                      />
                    )}
                  </div>
                </CCCard>

                {/* Performance Positioning */}
                <CCCard padding="lg">
                  <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Performance Positioning</h3>
                  <div className="flex flex-wrap gap-2">
                    {performancePositioning.filter(showPositioning).map(pp => (
                      <CCButton
                        key={pp.value}
                        variant={editData.performance_positioning?.includes(pp.value) ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => toggleArrayValue('performance_positioning', pp.value)}
                      >
                        {pp.label}
                      </CCButton>
                    ))}
                  </div>
                </CCCard>

                {/* Physical Details */}
                <CCCard padding="lg">
                  <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Physical Details</h3>
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
                  <div className="flex items-center gap-2 mb-4">
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
                  </div>
                </CCCard>

                {/* Health & Testing */}
                <CCCard padding="lg">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-[#22C55E]" />
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">Health & Testing</h3>
                    <CCBadge variant="warning" size="sm">Private by Default</CCBadge>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Testing Status</label>
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
                    <CCSelect
                      label="Testing Visibility"
                      options={[
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

                {/* Compensation Preferences */}
                {details?.compensation_preferences && details.compensation_preferences.length > 0 && (
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

                {/* Standard Acts */}
                {details?.standard_acts && details.standard_acts.length > 0 && (
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

                {/* Fetish Acts */}
                {details?.fetish_acts && details.fetish_acts.length > 0 && (
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

                {/* Kink / Edge Acts */}
                {details?.kink_edge_acts && details.kink_edge_acts.length > 0 && (
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

                {/* Performance Positioning */}
                {details?.performance_positioning && details.performance_positioning.length > 0 && (
                  <CCCard padding="lg">
                    <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Performance Positioning</h3>
                    <div className="flex flex-wrap gap-2">
                      {details.performance_positioning.map(pp => (
                        <CCBadge key={pp} variant="primary">{pp}</CCBadge>
                      ))}
                    </div>
                  </CCCard>
                )}

                {/* Physical Details */}
                {details?.physical_details && Object.keys(details.physical_details).length > 0 && (
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
                      {details.physical_details.circumcision_status && (
                        <p className="text-[#E8EEF9]">Circumcision: {details.physical_details.circumcision_status === 'cut' ? 'Cut' : 'Uncut'}</p>
                      )}
                    </div>
                  </CCCard>
                )}

                {/* Availability & Travel */}
                {details?.availability_type && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPinned className="w-5 h-5 text-[#4F8CFF]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Availability & Travel</h3>
                    </div>
                    <p className="text-[#E8EEF9] mb-2 capitalize">
                      {details.availability_type.replace(/_/g, ' ')}
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

                {/* Health & Testing */}
                {details?.health_testing?.testing_status && (
                  <CCCard padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Shield className="w-5 h-5 text-[#22C55E]" />
                      <h3 className="text-lg font-semibold text-[#E8EEF9]">Health & Testing</h3>
                      <CCBadge variant="warning" size="sm">Private by Default</CCBadge>
                    </div>
                    <div className="space-y-2">
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

        <CCTabsContent value="galleries" activeTab={activeTab}>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Public Gallery */}
            <CCCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#E8EEF9]">Public Gallery</h3>
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
              <p className="text-sm text-[#6B7A94] mb-4">G-rated images visible to all verified members.</p>
              <div className="grid grid-cols-3 gap-2">
                {galleries.find(g => g.type === 'public')?.items?.map((item, i) => (
                  <div key={i} className="aspect-square bg-[#121824] rounded-lg overflow-hidden">
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  </div>
                )) || (
                  <div className="col-span-3 py-8 text-center text-[#6B7A94]">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No images yet
                  </div>
                )}
              </div>
            </CCCard>

            {/* Private Gallery */}
            <CCCard padding="lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#E8EEF9] flex items-center gap-2">
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
              <p className="text-sm text-[#6B7A94] mb-4">Only visible to users you grant permission.</p>
              <div className="grid grid-cols-3 gap-2">
                {galleries.find(g => g.type === 'private')?.items?.map((item, i) => (
                  <div key={i} className="aspect-square bg-[#121824] rounded-lg overflow-hidden">
                    <img src={item.url} alt="" className="w-full h-full object-cover" />
                  </div>
                )) || (
                  <div className="col-span-3 py-8 text-center text-[#6B7A94]">
                    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No images yet
                  </div>
                )}
              </div>
            </CCCard>
          </div>
        </CCTabsContent>
      </div>
    </div>
  );
}