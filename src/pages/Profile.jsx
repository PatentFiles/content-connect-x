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
  Calendar,
  Link as LinkIcon,
  ShieldCheck,
  Settings,
  Image,
  Lock
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCModal from '@/components/ui-custom/CCModal';
import LocationSelector from '@/components/location/LocationSelector';
import SocialLinksDisplay from '@/components/socials/SocialLinksDisplay';
import SocialLinksManager from '@/components/socials/SocialLinksManager';
import BioGenerator from '@/components/profile/BioGenerator';

const genderOptions = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'trans_woman', label: 'Trans Woman' },
  { value: 'trans_man', label: 'Trans Man' },
  { value: 'non_binary', label: 'Non-Binary' },
];

const orientationOptions = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bi', label: 'Bi' },
  { value: 'trans_woman', label: 'Trans Woman' },
  { value: 'trans_man', label: 'Trans Man' },
];

const collabTypes = [
  { value: 'paid', label: 'Paid' },
  { value: 'trade', label: 'Trade' },
  { value: 'free', label: 'Free' },
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
    enabled: !!user?.email && profile?.role_type === 'creator',
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
      display_name: editData.display_name || profile?.display_name,
      age: editData.age || profile?.age,
      ethnicity: editData.ethnicity || profile?.ethnicity,
      bio: editData.bio || profile?.bio,
      base_location: editData.base_location || profile?.base_location,
      travel_enabled: editData.travel_enabled ?? profile?.travel_enabled,
      profile_complete: true,
    };
    updateProfileMutation.mutate(profileData);

    if (profile?.role_type === 'creator') {
      const creatorData = {
        gender_identity: editData.gender_identity || details?.gender_identity,
        orientation_category: editData.orientation_category || details?.orientation_category,
        looking_for_genders: editData.looking_for_genders || details?.looking_for_genders,
        collab_types: editData.collab_types || details?.collab_types,
        tags: editData.tags || details?.tags,
        socials: editData.socials || details?.socials,
      };
      updateDetailsMutation.mutate(creatorData);
    }
  };

  if (userLoading || profileLoading) {
    return <CCLoadingScreen message="Loading profile..." />;
  }

  const tabs = [
    { value: 'profile', label: 'Profile', icon: User },
    { value: 'galleries', label: 'Galleries', icon: Image },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Cover & Avatar */}
      <div className="relative">
        <div className="h-48 md:h-64 relative overflow-hidden">
          <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: '#1A2438', stopOpacity: 1}} />
                <stop offset="50%" style={{stopColor: '#151D2B', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: '#0B0F14', stopOpacity: 1}} />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#bgGradient)" />
            <text 
              x="50%" 
              y="50%" 
              dominantBaseline="middle" 
              textAnchor="middle" 
              fill="white" 
              fontSize="120"
              fontWeight="bold"
              fontFamily="Inter, sans-serif"
              letterSpacing="8"
            >
              CONNECT
            </text>
          </svg>
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative -mt-16 md:-mt-20">
            <div className="flex flex-col gap-4">
              <div className="flex items-end gap-3">
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
                <CCButton
                  variant="primary"
                  icon={isEditing ? Save : Edit2}
                  onClick={isEditing ? handleSave : () => {
                    setEditData({
                      display_name: profile?.display_name,
                      age: profile?.age,
                      ethnicity: profile?.ethnicity,
                      bio: profile?.bio,
                      base_location: profile?.base_location,
                      travel_enabled: profile?.travel_enabled,
                      gender_identity: details?.gender_identity,
                      orientation_category: details?.orientation_category,
                      looking_for_genders: details?.looking_for_genders || [],
                      collab_types: details?.collab_types || [],
                      socials: details?.socials || {},
                    });
                    setIsEditing(true);
                  }}
                  loading={updateProfileMutation.isPending}
                  className="shrink-0 mb-2"
                >
                  {isEditing ? 'Save' : 'Edit'}
                </CCButton>
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-[#E8EEF9] truncate">
                  {profile?.display_name || 'Set up your profile'}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {profile?.role_type && (
                    <CCBadge variant="accent">{profile.role_type}</CCBadge>
                  )}
                  {isVerified && (
                    <CCBadge variant="success" icon={ShieldCheck}>Verified</CCBadge>
                  )}
                </div>
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
                    {profile?.role_type === 'creator' && (
                      <>
                        <CCSelect
                          label="Gender"
                          options={genderOptions}
                          value={editData.gender_identity || ''}
                          onChange={(e) => setEditData({...editData, gender_identity: e.target.value})}
                          placeholder="Select gender"
                        />
                        <CCSelect
                          label="Sexuality"
                          options={orientationOptions}
                          value={editData.orientation_category || ''}
                          onChange={(e) => setEditData({...editData, orientation_category: e.target.value})}
                          placeholder="Select sexuality"
                        />
                      </>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">Bio</label>
                      <textarea
                        value={editData.bio || ''}
                        onChange={(e) => setEditData({...editData, bio: e.target.value})}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px]"
                        placeholder="Tell others about yourself..."
                      />
                    </div>
                    <BioGenerator 
                      currentBio={editData.bio}
                      onSelectBio={(bio) => setEditData({...editData, bio})}
                    />
                    <LocationSelector
                      value={editData.base_location || {}}
                      onChange={(location) => setEditData({...editData, base_location: location})}
                    />
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-sm text-[#6B7A94]">Display Name</p>
                      <p className="text-[#E8EEF9] mt-1">{profile?.display_name || 'Not set'}</p>
                    </div>
                    {profile?.role_type === 'creator' && details?.orientation_category && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Sexuality</p>
                        <p className="text-[#E8EEF9] mt-1 capitalize">{details.orientation_category.replace('_', ' ')}</p>
                      </div>
                    )}
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
                    {profile?.role_type === 'creator' && details?.gender_identity && (
                      <div>
                        <p className="text-sm text-[#6B7A94]">Gender</p>
                        <p className="text-[#E8EEF9] mt-1 capitalize">{details.gender_identity.replace('_', ' ')}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-[#6B7A94]">Bio</p>
                      <p className="text-[#E8EEF9] mt-1">{profile?.bio || 'No bio yet'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-[#6B7A94]">Location</p>
                      <p className="text-[#E8EEF9] mt-1 flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {profile?.base_location?.city && profile?.base_location?.state && profile?.base_location?.country 
                          ? `${profile.base_location.city}, ${profile.base_location.state}, ${profile.base_location.country}`
                          : profile?.base_location?.city || 'Not set'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CCCard>

            {/* Creator Details */}
            {profile?.role_type === 'creator' && (
              <CCCard padding="lg" className="md:col-span-2">
                <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Creator Details</h3>
                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      <CCSelect
                        label="Gender Identity"
                        options={genderOptions}
                        value={editData.gender_identity || ''}
                        onChange={(e) => setEditData({...editData, gender_identity: e.target.value})}
                      />
                      <CCSelect
                        label="Sexuality"
                        options={orientationOptions}
                        value={editData.orientation_category || ''}
                        onChange={(e) => setEditData({...editData, orientation_category: e.target.value})}
                      />
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Collaboration Types</label>
                        <div className="flex flex-wrap gap-2">
                          {collabTypes.map(type => (
                            <CCButton
                              key={type.value}
                              variant={editData.collab_types?.includes(type.value) ? 'primary' : 'outline'}
                              size="sm"
                              onClick={() => {
                                const current = editData.collab_types || [];
                                const updated = current.includes(type.value)
                                  ? current.filter(v => v !== type.value)
                                  : [...current, type.value];
                                setEditData({...editData, collab_types: updated});
                              }}
                            >
                              {type.label}
                            </CCButton>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm text-[#6B7A94]">Gender Identity</p>
                        <p className="text-[#E8EEF9] mt-1 capitalize">{details?.gender_identity?.replace('_', ' ') || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#6B7A94]">Sexuality</p>
                        <p className="text-[#E8EEF9] mt-1 capitalize">{details?.orientation_category?.replace('_', ' ') || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#6B7A94]">Collaboration Types</p>
                        <div className="flex gap-2 mt-2">
                          {details?.collab_types?.map(type => (
                            <CCBadge key={type} variant={type === 'paid' ? 'success' : type === 'trade' ? 'warning' : 'default'}>
                              {type}
                            </CCBadge>
                          )) || <span className="text-[#6B7A94]">Not set</span>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
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