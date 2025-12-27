import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  Briefcase, 
  Users, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Camera, 
  Video,
  Check,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  AlertTriangle,
  Shield
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import AccessGate from '@/components/auth/AccessGate';
import { useVerificationCheck } from '@/components/auth/useVerificationCheck';
import VerificationRequired from '@/components/auth/VerificationRequired';
import AvailabilityCalendar from '@/components/collaboration/AvailabilityCalendar';



const compensationTypes = [
  { value: 'paid', label: 'Paid', description: 'Direct payment for services' },
  { value: 'trade', label: 'Trade', description: 'Content exchange/trade' },
  { value: 'free', label: 'Free', description: 'No compensation (TFP)' },
  { value: 'rev_share_external', label: 'Revenue Share', description: 'Split revenue externally' },
];

export default function CreateCollaboration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [actCategory, setActCategory] = useState(null); // 'standard', 'fetish', or 'kink'
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showAgentSearch, setShowAgentSearch] = useState(false);
  const [showStudioSearch, setShowStudioSearch] = useState(false);
  const [showPhotographerSearch, setShowPhotographerSearch] = useState(false);
  const [showVideographerSearch, setShowVideographerSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [emailError, setEmailError] = useState('');
  
  const { checking: verificationChecking, blocked: verificationBlocked } = useVerificationCheck('create_collaboration');
  
  // Get collaboration ID from URL for editing
  const urlParams = new URLSearchParams(window.location.search);
  const collaborationId = urlParams.get('id');
  const isEditing = !!collaborationId;

  const [customValues, setCustomValues] = useState({
    scene_pairings: '',
    standard_acts: '',
    fetish_acts: '',
    kink_edge_acts: '',
    custom_platform: ''
  });

  const [formData, setFormData] = useState({
    collaboration_name: '',
    participant_ids: [],

    scene_selected: [],
    standard_acts: [],
    fetish_acts: [],
    kink_edge_acts: [],
    boundaries: {
      hard_no: [],
      soft_limits: [],
      aftercare_required: false,
      aftercare_notes: '',
    },
    compensation_type: '',
    compensation_details: {
      amount: '',
      currency: 'USD',
      notes: '',
    },
    schedule: {
      proposed_dates: [],
      start_time: '',
      end_time: '',
    },
    location: {
      type: '',
      city: '',
      notes: '',
    },
    deliverables: {
      photo: false,
      video: false,
      raw_files: false,
      editing_included: false,
      delivery_timeline_days: 7,
    },
    usage_rights: {
      platforms: [],
      other_platforms: '',
      exclusivity: false,
      credit_required: true,
    },
    testing_requirements: {
      is_required: false,
      visibility_level: 'COLLABORATION_ROOM_ONLY',
      deadline_preset: '48h',
      deadline_custom_date: '',
      deadline_custom_time: '12:00',
      deadline_custom_ampm: 'PM',
      require_valid_credential: true,
      require_new_upload: false,
    },
    participant_emails: '',
  });

  // Auth check
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

  // Load existing collaboration if editing
  const { data: existingCollaboration, isLoading: loadingCollab } = useQuery({
    queryKey: ['collaboration', collaborationId],
    queryFn: async () => {
      const collabs = await base44.entities.Collaboration.filter({ id: collaborationId });
      return collabs[0];
    },
    enabled: isEditing,
  });

  // Load existing testing requirements if editing
  const { data: existingTestingReq } = useQuery({
    queryKey: ['testingRequirement', collaborationId],
    queryFn: async () => {
      const reqs = await base44.entities.TestingRequirement.filter({ collaboration_id: collaborationId });
      return reqs[0];
    },
    enabled: isEditing && !!collaborationId,
  });

  // Populate form with existing data
  useEffect(() => {
    if (existingCollaboration && isEditing) {
      setFormData({
        collaboration_name: existingCollaboration.collaboration_name || '',
        participant_ids: existingCollaboration.participant_ids || [],

        scene_selected: existingCollaboration.scene_selected || [],
        standard_acts: existingCollaboration.standard_acts || [],
        fetish_acts: existingCollaboration.fetish_acts || [],
        kink_edge_acts: existingCollaboration.kink_edge_acts || [],
        boundaries: existingCollaboration.boundaries || {
          hard_no: [],
          soft_limits: [],
          aftercare_required: false,
          aftercare_notes: ''
        },
        compensation_type: existingCollaboration.compensation_type || '',
        compensation_details: existingCollaboration.compensation_details || {
          amount: 0,
          currency: 'USD',
          split_details: '',
          notes: ''
        },
        schedule: existingCollaboration.schedule || {
          proposed_dates: [],
          confirmed_date: '',
          start_time: '',
          end_time: '',
          duration_hours: 0
        },
        location: existingCollaboration.location || {
          type: '',
          address: '',
          city: '',
          notes: ''
        },
        deliverables: existingCollaboration.deliverables || {
          photo: false,
          video: false,
          raw_files: false,
          editing_included: false,
          delivery_timeline_days: 0,
          notes: ''
        },
        usage_rights: existingCollaboration.usage_rights || {
          platforms: [],
          other_platforms: '',
          exclusivity: false,
          exclusivity_period_days: 0,
          resale_allowed: false,
          credit_required: false,
          notes: ''
        },
        testing_requirements: existingTestingReq ? {
          is_required: existingTestingReq.is_required,
          visibility_level: existingTestingReq.visibility_level,
          deadline_preset: '',
          deadline_custom_date: existingTestingReq.deadline_at ? existingTestingReq.deadline_at.split('T')[0] : '',
          deadline_custom_time: existingTestingReq.deadline_at ? new Date(existingTestingReq.deadline_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '12:00',
          deadline_custom_ampm: existingTestingReq.deadline_at ? (new Date(existingTestingReq.deadline_at).getHours() >= 12 ? 'PM' : 'AM') : 'PM',
          require_valid_credential: existingTestingReq.require_valid_credential,
          require_new_upload: existingTestingReq.require_new_upload,
        } : {
          is_required: false,
          visibility_level: 'COLLABORATION_ROOM_ONLY',
          deadline_preset: '48h',
          deadline_custom_date: '',
          deadline_custom_time: '12:00',
          deadline_custom_ampm: 'PM',
          require_valid_credential: true,
          require_new_upload: false,
        }
      });
    }
  }, [existingCollaboration, existingTestingReq, isEditing]);

  const isVerified = verification?.[0]?.status === 'approved';
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

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

  // Fetch creator details for filtering
  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['myCreatorDetails', user?.email],
    queryFn: () => base44.entities.CreatorDetails.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const details = creatorDetails[0];

  // Fetch current user's profile for location
  const { data: myProfiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });
  const myProfile = myProfiles[0];

  // Fetch my favorites
  const { data: myFavorites = [] } = useQuery({
    queryKey: ['myFavorites', user?.email],
    queryFn: () => base44.entities.Favorite.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch all profiles for search
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
    enabled: showUserSearch,
  });

  // Fetch all agents for search
  const { data: allAgents = [] } = useQuery({
    queryKey: ['allAgents'],
    queryFn: () => base44.entities.AgentDetails.list(),
    enabled: showAgentSearch,
  });

  // Fetch all studios for search
  const { data: allStudios = [] } = useQuery({
    queryKey: ['allStudios'],
    queryFn: () => base44.entities.StudioDetails.list(),
    enabled: showStudioSearch,
  });

  // Fetch all photographers for search
  const { data: allPhotographers = [] } = useQuery({
    queryKey: ['allPhotographers'],
    queryFn: () => base44.entities.ServiceDetails.filter({ service_type: 'photography' }),
    enabled: showPhotographerSearch,
  });

  // Fetch all videographers for search
  const { data: allVideographers = [] } = useQuery({
    queryKey: ['allVideographers'],
    queryFn: () => base44.entities.ServiceDetails.filter({ service_type: 'videography' }),
    enabled: showVideographerSearch,
  });

  // Fetch participant profiles based on emails
  const participantEmails = formData.participant_emails
    ? formData.participant_emails.split(',').map(e => e.trim()).filter(e => e)
    : [];

  const { data: participantProfiles = [] } = useQuery({
    queryKey: ['participantProfiles', participantEmails],
    queryFn: async () => {
      if (participantEmails.length === 0) return [];
      const profiles = await Promise.all(
        participantEmails.map(email =>
          base44.entities.UserProfile.filter({ user_id: email })
        )
      );
      return profiles.flat();
    },
    enabled: participantEmails.length > 0,
  });

  // Filter search results (exclude admin accounts)
  const filteredProfiles = allProfiles.filter(p => 
    !p.is_admin &&
    (p.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.user_id?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAgents = allAgents.filter(a => 
    a.agency_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStudios = allStudios.filter(s => 
    s.studio_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPhotographers = allPhotographers.filter(p => 
    p.user_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVideographers = allVideographers.filter(v => 
    v.user_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get favorite profiles
  const favoriteProfiles = allProfiles.filter(p => 
    myFavorites.some(f => f.target_user_id === p.user_id)
  );

  // Create/Update mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const participantEmails = data.participant_emails 
        ? data.participant_emails.split(',').map(e => e.trim()).filter(e => e)
        : [];
      
      const payload = {
        ...data,
        participant_ids: [user.email, ...participantEmails],
        status: 'draft',
      };

      let collaboration;
      if (isEditing) {
        collaboration = await base44.entities.Collaboration.update(collaborationId, payload);
      } else {
        collaboration = await base44.entities.Collaboration.create(payload);
      }

      // Auto-add exclusive studios as observers
      try {
        await base44.functions.invoke('autoAddStudioObserver', {
          collaboration_id: collaboration.id,
          participant_ids: payload.participant_ids
        });
      } catch (error) {
        console.error('Failed to auto-add studio observers:', error);
      }

      // Handle testing requirements
      const wasRequiredBefore = existingTestingReq?.is_required;
      const isRequiredNow = data.testing_requirements.is_required;

      if (isRequiredNow) {
        let deadlineAt;
        if (data.testing_requirements.deadline_preset) {
          const now = new Date();
          const hours = parseInt(data.testing_requirements.deadline_preset.replace('h', ''));
          deadlineAt = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
        } else if (data.testing_requirements.deadline_custom_date) {
          const dateStr = data.testing_requirements.deadline_custom_date;
          const timeStr = data.testing_requirements.deadline_custom_time;
          const ampm = data.testing_requirements.deadline_custom_ampm;
          let [hours, minutes] = timeStr.split(':').map(Number);
          if (ampm === 'PM' && hours !== 12) hours += 12;
          if (ampm === 'AM' && hours === 12) hours = 0;
          const date = new Date(dateStr);
          date.setHours(hours, minutes, 0, 0);
          deadlineAt = date.toISOString();
        }

        const testingReqPayload = {
          collaboration_id: collaboration.id,
          is_required: true,
          visibility_level: data.testing_requirements.visibility_level,
          deadline_at: deadlineAt,
          require_valid_credential: data.testing_requirements.require_valid_credential,
          require_new_upload: data.testing_requirements.require_new_upload,
          status: 'ACTIVE'
        };

        // Check if testing requirement exists
        const existingReqs = await base44.entities.TestingRequirement.filter({ 
          collaboration_id: collaboration.id 
        });
        
        if (existingReqs.length > 0) {
          await base44.entities.TestingRequirement.update(existingReqs[0].id, testingReqPayload);
        } else {
          await base44.entities.TestingRequirement.create(testingReqPayload);
        }

        // Send notification if newly enabled
        if (!wasRequiredBefore) {
          try {
            await base44.functions.invoke('sendTestingNotification', {
              collaboration_id: collaboration.id,
              notification_type: 'testing_enabled'
            });
          } catch (error) {
            console.error('Failed to send testing notification:', error);
          }
        }
      } else if (isEditing) {
        // Delete testing requirement if disabled
        const existingReqs = await base44.entities.TestingRequirement.filter({ 
          collaboration_id: collaboration.id 
        });
        if (existingReqs.length > 0) {
          await base44.entities.TestingRequirement.delete(existingReqs[0].id);
        }
      }

      return collaboration;
    },
    onSuccess: (result) => {
      navigate(createPageUrl(isEditing ? 'Collaborations' : `ViewCollaboration?id=${result.id}`));
    },
  });

  const updateForm = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleAddParticipant = async (email) => {
    // Check if email is registered
    const profiles = await base44.entities.UserProfile.filter({ user_id: email });
    if (profiles.length === 0) {
      setEmailError(`${email} isn't registered with Content Connect. Please add a registered user.`);
      return;
    }

    const current = formData.participant_emails;
    const emails = current ? current.split(',').map(e => e.trim()) : [];
    if (!emails.includes(email)) {
      updateForm('participant_emails', [...emails, email].join(', '));
    }
    setEmailError('');
  };

  const handleRemoveParticipant = (email) => {
    const current = formData.participant_emails;
    const emails = current ? current.split(',').map(e => e.trim()) : [];
    updateForm('participant_emails', emails.filter(e => e !== email).join(', '));
  };

  const toggleArrayValue = (field, value) => {
    const current = formData[field] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    updateForm(field, updated);
  };

  const handleAddCustomValue = async (category, field) => {
    const value = customValues[field]?.trim();
    if (!value) return;

    const current = formData[field] || [];
    if (!current.includes(value)) {
      updateForm(field, [...current, value]);
    }

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

    setCustomValues({...customValues, [field]: ''});
  };

  if (userLoading || verificationChecking || (isEditing && loadingCollab && !existingCollaboration) || !details) {
    return <CCLoadingScreen message="Loading..." />;
  }

  if (!user) return <AccessGate type="both" />;
  if (verificationBlocked) return <VerificationRequired action="create collaborations" />;
  if (!isVerified) return <AccessGate type="verification" />;
  if (!isSubscribed) return <AccessGate type="subscription" />;

  const totalSteps = 7;

  // Filter scene pairings based on orientation
  const orientations = details?.orientation_category || [];
  const genderIdentity = details?.gender_identity;
  const filteredScenePairings = details ? scenePairings.filter(sp => {
    // Boy/Boy only for gay, bisexual, pansexual
    if (sp.includes('Boy / Boy') && !sp.includes('Girl')) {
      return orientations.some(o => ['gay', 'bi', 'pan'].includes(o));
    }
    // Girl/Girl only for lesbian, bisexual, pansexual
    if (sp.includes('Girl / Girl') && !sp.includes('Boy')) {
      return orientations.some(o => ['lesbian', 'bi', 'pan'].includes(o));
    }
    // Trans pairings only for pan or trans/non-binary gender identities
    if (sp.includes('Trans') || sp.includes('Non-Binary')) {
      return orientations.some(o => ['pan'].includes(o)) || 
             ['trans_man', 'trans_woman', 'non_binary'].includes(genderIdentity);
    }
    // All other pairings available to everyone
    return true;
  }) : scenePairings;

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[#4F8CFF]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#E8EEF9]">
                {isEditing ? 'Edit Collaboration' : 'Create Collaboration'}
              </h1>
              <p className="text-xs text-[#6B7A94]">Step {step} of {totalSteps}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex gap-1">
            {Array(totalSteps).fill(0).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full ${
                  i < step ? 'bg-[#4F8CFF]' : 'bg-[#263248]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Collaboration Name */}
        <CCCard padding="lg" className="mb-6">
          <div className="text-center">
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">
              Collaboration Name (Optional)
            </label>
            <input
              placeholder="e.g., Miami Beach Shoot, Studio Session..."
              value={formData.collaboration_name}
              onChange={(e) => updateForm('collaboration_name', e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
        </CCCard>

        {/* Step 1: Participants */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2 text-center">Who's involved?</h2>
            <p className="text-[#9AA6BC] mb-6 text-center">Add participants, agents, or studios to this collaboration.</p>

            {/* Selected Participants */}
            {participantEmails.length > 0 && (
              <CCCard padding="lg" className="mb-4">
                <h3 className="font-semibold text-[#E8EEF9] mb-3">Selected Participants</h3>
                <div className="flex flex-wrap gap-2">
                  {participantEmails.map(email => {
                    const profile = participantProfiles.find(p => p.user_id === email);
                    return (
                      <div key={email} className="flex items-center gap-2 bg-[#121824] border border-[#263248] rounded-lg px-3 py-2">
                        <span className="text-sm text-[#E8EEF9]">
                          {profile?.display_name || email}
                        </span>
                        <button
                          onClick={() => handleRemoveParticipant(email)}
                          className="text-[#9AA6BC] hover:text-[#EF4444]"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CCCard>
            )}

            {/* Add Options */}
            <div className="space-y-3 mb-4">
              <CCButton
                variant="outline"
                icon={Users}
                fullWidth
                onClick={() => {
                  setShowUserSearch(!showUserSearch);
                  setShowAgentSearch(false);
                  setShowStudioSearch(false);
                  setShowPhotographerSearch(false);
                  setShowVideographerSearch(false);
                }}
              >
                Search Users
              </CCButton>
              <div className="grid grid-cols-2 gap-3">
                <CCButton
                  variant="outline"
                  icon={Briefcase}
                  onClick={() => {
                    setShowStudioSearch(!showStudioSearch);
                    setShowUserSearch(false);
                    setShowAgentSearch(false);
                    setShowPhotographerSearch(false);
                    setShowVideographerSearch(false);
                  }}
                >
                  Add Studio
                </CCButton>
                <CCButton
                  variant="outline"
                  icon={Users}
                  onClick={() => {
                    setShowAgentSearch(!showAgentSearch);
                    setShowUserSearch(false);
                    setShowStudioSearch(false);
                    setShowPhotographerSearch(false);
                    setShowVideographerSearch(false);
                  }}
                >
                  Add Agent
                </CCButton>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CCButton
                  variant="outline"
                  icon={Camera}
                  onClick={() => {
                    setShowPhotographerSearch(!showPhotographerSearch);
                    setShowUserSearch(false);
                    setShowAgentSearch(false);
                    setShowStudioSearch(false);
                    setShowVideographerSearch(false);
                  }}
                >
                  Add Photographer
                </CCButton>
                <CCButton
                  variant="outline"
                  icon={Video}
                  onClick={() => {
                    setShowVideographerSearch(!showVideographerSearch);
                    setShowUserSearch(false);
                    setShowAgentSearch(false);
                    setShowStudioSearch(false);
                    setShowPhotographerSearch(false);
                  }}
                >
                  Add Videographer
                </CCButton>
              </div>
            </div>

            {/* User Search */}
            {showUserSearch && (
              <CCCard padding="lg" className="mb-4">
                <h3 className="font-semibold text-[#E8EEF9] mb-3">Search Users</h3>
                <CCInput
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                
                {favoriteProfiles.length > 0 && searchQuery === '' && (
                  <div className="mb-4">
                    <p className="text-sm text-[#9AA6BC] mb-2">Favorites</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {favoriteProfiles.map(profile => (
                        <div
                          key={profile.user_id}
                          onClick={() => handleAddParticipant(profile.user_id)}
                          className="flex items-center gap-3 p-2 bg-[#121824] rounded-lg cursor-pointer hover:bg-[#1A2438]"
                        >
                          <CCAvatar src={profile.avatar_url} size="sm" />
                          <div className="flex-1">
                            <p className="text-sm text-[#E8EEF9]">{profile.display_name}</p>
                            <p className="text-xs text-[#6B7A94]">{profile.role_type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredProfiles.slice(0, 10).map(profile => (
                    <div
                      key={profile.user_id}
                      onClick={() => handleAddParticipant(profile.user_id)}
                      className="flex items-center gap-3 p-2 bg-[#121824] rounded-lg cursor-pointer hover:bg-[#1A2438]"
                    >
                      <CCAvatar src={profile.avatar_url} size="sm" />
                      <div className="flex-1">
                        <p className="text-sm text-[#E8EEF9]">{profile.display_name}</p>
                        <p className="text-xs text-[#6B7A94]">{profile.role_type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Agent Search */}
            {showAgentSearch && (
              <CCCard padding="lg" className="mb-4">
                <h3 className="font-semibold text-[#E8EEF9] mb-3">Search Agents</h3>
                <CCInput
                  placeholder="Search by agency name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredAgents.slice(0, 10).map(agent => (
                    <div
                      key={agent.user_id}
                      onClick={() => handleAddParticipant(agent.user_id)}
                      className="flex items-center gap-3 p-2 bg-[#121824] rounded-lg cursor-pointer hover:bg-[#1A2438]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#4F8CFF]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-[#E8EEF9]">{agent.agency_name}</p>
                        <p className="text-xs text-[#6B7A94]">Agent</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Studio Search */}
            {showStudioSearch && (
              <CCCard padding="lg" className="mb-4">
                <h3 className="font-semibold text-[#E8EEF9] mb-3">Search Studios</h3>
                <CCInput
                  placeholder="Search by studio name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredStudios.slice(0, 10).map(studio => (
                    <div
                      key={studio.user_id}
                      onClick={() => handleAddParticipant(studio.user_id)}
                      className="flex items-center gap-3 p-2 bg-[#121824] rounded-lg cursor-pointer hover:bg-[#1A2438]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#FF2DAA]/20 flex items-center justify-center">
                        <Briefcase className="w-5 h-5 text-[#FF2DAA]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-[#E8EEF9]">{studio.studio_name}</p>
                        <p className="text-xs text-[#6B7A94]">Studio</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Photographer Search */}
            {showPhotographerSearch && (
              <CCCard padding="lg" className="mb-4">
                <h3 className="font-semibold text-[#E8EEF9] mb-3">Search Photographers</h3>
                <CCInput
                  placeholder="Search photographers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredPhotographers.slice(0, 10).map(photographer => (
                    <div
                      key={photographer.user_id}
                      onClick={() => handleAddParticipant(photographer.user_id)}
                      className="flex items-center gap-3 p-2 bg-[#121824] rounded-lg cursor-pointer hover:bg-[#1A2438]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                        <Camera className="w-5 h-5 text-[#4F8CFF]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-[#E8EEF9]">{photographer.user_id}</p>
                        <p className="text-xs text-[#6B7A94]">Photographer</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Videographer Search */}
            {showVideographerSearch && (
              <CCCard padding="lg" className="mb-4">
                <h3 className="font-semibold text-[#E8EEF9] mb-3">Search Videographers</h3>
                <CCInput
                  placeholder="Search videographers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredVideographers.slice(0, 10).map(videographer => (
                    <div
                      key={videographer.user_id}
                      onClick={() => handleAddParticipant(videographer.user_id)}
                      className="flex items-center gap-3 p-2 bg-[#121824] rounded-lg cursor-pointer hover:bg-[#1A2438]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#FF2DAA]/20 flex items-center justify-center">
                        <Video className="w-5 h-5 text-[#FF2DAA]" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-[#E8EEF9]">{videographer.user_id}</p>
                        <p className="text-xs text-[#6B7A94]">Videographer</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CCCard>
            )}

            {/* Manual Email Entry */}
            <CCCard padding="lg">
              <h3 className="font-semibold text-[#E8EEF9] mb-3 text-center">Or add by email</h3>
              <div className="flex gap-2">
                <CCInput
                  placeholder="email@example.com"
                  value={formData.participant_emails}
                  onChange={(e) => {
                    updateForm('participant_emails', e.target.value);
                    setEmailError('');
                  }}
                  error={emailError}
                  className="flex-1"
                />
                <CCButton
                  variant="primary"
                  onClick={() => {
                    const emails = formData.participant_emails.split(',').map(e => e.trim()).filter(e => e);
                    const lastEmail = emails[emails.length - 1];
                    if (lastEmail) handleAddParticipant(lastEmail);
                  }}
                >
                  Add
                </CCButton>
              </div>
              {emailError && (
                <p className="text-sm text-[#EF4444] mt-2">{emailError}</p>
              )}
            </CCCard>
          </motion.div>
        )}

        {/* Step 2: Scene Pairings */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2 text-center">Scene Pairings</h2>
            <p className="text-[#9AA6BC] mb-6 text-center">Select the scene pairings for this collaboration.</p>

            <CCCard padding="lg">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {filteredScenePairings.map((sp) => (
                    <CCButton
                      key={sp}
                      variant={formData.scene_selected?.includes(sp) ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => toggleArrayValue('scene_selected', sp)}
                    >
                      {sp}
                    </CCButton>
                  ))}
                </div>
                {formData.scene_selected?.includes('Other') && (
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
                      icon={Plus}
                      onClick={() => handleAddCustomValue('scene_pairing', 'scene_selected')}
                    >
                      Add
                    </CCButton>
                  </div>
                )}
              </div>
            </CCCard>
          </motion.div>
        )}

        {/* Step 3: Acts */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2 text-center">Acts</h2>
            <p className="text-[#9AA6BC] mb-6 text-center">Choose a category to select acts.</p>

            {!actCategory ? (
              <div className="grid gap-4">
                <CCCard
                  hover
                  clickable
                  padding="lg"
                  onClick={() => setActCategory('standard')}
                >
                 <h3 className="font-semibold text-[#E8EEF9] mb-1 text-center">Standard</h3>
                 <p className="text-sm text-[#9AA6BC] text-center">Solo, group, oral, anal, and other standard acts</p>
                </CCCard>
                <CCCard
                 hover
                 clickable
                 padding="lg"
                 onClick={() => setActCategory('fetish')}
                >
                 <h3 className="font-semibold text-[#E8EEF9] mb-1 text-center">Fetish</h3>
                 <p className="text-sm text-[#9AA6BC] text-center">Roleplay, power dynamics, sensory focus, and more</p>
                </CCCard>
                <CCCard
                 hover
                 clickable
                 padding="lg"
                 onClick={() => setActCategory('kink')}
                >
                 <h3 className="font-semibold text-[#E8EEF9] mb-1 text-center">Kink</h3>
                 <p className="text-sm text-[#9AA6BC] text-center">Bondage, BDSM, impact play, and edge acts</p>
                </CCCard>
              </div>
            ) : (
              <CCCard padding="lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#E8EEF9] capitalize">{actCategory}</h3>
                  <CCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setActCategory(null)}
                  >
                    Change Category
                  </CCButton>
                </div>
                
                {actCategory === 'standard' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {standardActs.map((act) => (
                        <CCButton
                          key={act}
                          variant={formData.standard_acts?.includes(act) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('standard_acts', act)}
                        >
                          {act}
                        </CCButton>
                      ))}
                    </div>
                    {formData.standard_acts?.includes('Other') && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customValues.standard_acts || ''}
                          onChange={(e) => setCustomValues({...customValues, standard_acts: e.target.value})}
                          className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          placeholder="Type custom standard act..."
                        />
                        <CCButton
                          variant="primary"
                          size="sm"
                          icon={Plus}
                          onClick={() => handleAddCustomValue('standard_act', 'standard_acts')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                )}

                {actCategory === 'fetish' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {fetishActs.map((act) => (
                        <CCButton
                          key={act}
                          variant={formData.fetish_acts?.includes(act) ? 'accent' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('fetish_acts', act)}
                        >
                          {act}
                        </CCButton>
                      ))}
                    </div>
                    {formData.fetish_acts?.includes('Other') && (
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
                          icon={Plus}
                          onClick={() => handleAddCustomValue('fetish_act', 'fetish_acts')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                )}

                {actCategory === 'kink' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {kinkEdgeActs.map((act) => (
                        <CCButton
                          key={act}
                          variant={formData.kink_edge_acts?.includes(act) ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => toggleArrayValue('kink_edge_acts', act)}
                        >
                          {act}
                        </CCButton>
                      ))}
                    </div>
                    {formData.kink_edge_acts?.includes('Other') && (
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
                          icon={Plus}
                          onClick={() => handleAddCustomValue('kink_edge_act', 'kink_edge_acts')}
                        >
                          Add
                        </CCButton>
                      </div>
                    )}
                  </div>
                )}
              </CCCard>
            )}
          </motion.div>
        )}

        {/* Step 4: Boundaries */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2 text-center">Boundaries</h2>
            <p className="text-[#9AA6BC] mb-6 text-center">Define your boundaries and limits.</p>

            <CCCard padding="lg">
              <h3 className="font-semibold text-[#E8EEF9] mb-4 flex items-center justify-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                Boundaries
              </h3>
              <div className="text-center mb-4">
                <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Hard No's</label>
                <input
                  placeholder="Acts that are absolutely off limits..."
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
                <p className="text-xs text-[#6B7A94] mt-1">Comma-separated list</p>
              </div>
              <div className="text-center mb-4">
                <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Soft Limits</label>
                <input
                  placeholder="Acts that may be negotiable..."
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
                <p className="text-xs text-[#6B7A94] mt-1">Comma-separated list</p>
              </div>
              <label className="flex items-center justify-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.boundaries.aftercare_required}
                  onChange={(e) => updateForm('boundaries', {
                    ...formData.boundaries,
                    aftercare_required: e.target.checked
                  })}
                  className="w-5 h-5 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                />
                <span className="text-[#E8EEF9]">Aftercare required</span>
              </label>
            </CCCard>
          </motion.div>
        )}

        {/* Step 5: Compensation */}
        {step === 5 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2 text-center">Compensation</h2>
            <p className="text-[#9AA6BC] mb-6 text-center">Define how participants will be compensated.</p>

            <div className="space-y-4 mb-6">
              {compensationTypes.map((type) => (
                <CCCard
                  key={type.value}
                  hover
                  clickable
                  padding="md"
                  className={formData.compensation_type === type.value ? 'ring-2 ring-[#4F8CFF]' : ''}
                  onClick={() => updateForm('compensation_type', type.value)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-center">
                      <h3 className="font-semibold text-[#E8EEF9]">{type.label}</h3>
                      <p className="text-sm text-[#9AA6BC]">{type.description}</p>
                    </div>
                    {formData.compensation_type === type.value && (
                      <div className="w-6 h-6 rounded-full bg-[#4F8CFF] flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </CCCard>
              ))}
            </div>

            {formData.compensation_type === 'paid' && (
              <CCCard padding="lg">
                <h3 className="font-semibold text-[#E8EEF9] mb-4">Payment Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <CCInput
                    label="Amount"
                    type="number"
                    placeholder="0"
                    icon={DollarSign}
                    value={formData.compensation_details.amount}
                    onChange={(e) => updateForm('compensation_details', {
                      ...formData.compensation_details,
                      amount: e.target.value
                    })}
                  />
                  <CCSelect
                    label="Currency"
                    options={[
                      { value: 'USD', label: 'USD' },
                      { value: 'EUR', label: 'EUR' },
                      { value: 'GBP', label: 'GBP' },
                    ]}
                    value={formData.compensation_details.currency}
                    onChange={(e) => updateForm('compensation_details', {
                      ...formData.compensation_details,
                      currency: e.target.value
                    })}
                  />
                </div>
                <p className="text-xs text-[#6B7A94] mt-3">
                  Note: Payment will be handled externally between parties. Content Connect does not process payments.
                </p>
              </CCCard>
            )}
          </motion.div>
        )}

        {/* Step 6: Schedule & Location */}
        {step === 6 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2 text-center">When & Where</h2>
            <p className="text-[#9AA6BC] mb-6 text-center">Set the schedule and location details.</p>

            <CCCard padding="lg" className="mb-6">
              <h3 className="font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" /> Schedule
              </h3>
              
              {participantProfiles.length > 0 ? (
                <>
                  <AvailabilityCalendar
                    participantProfiles={participantProfiles}
                    myLocation={myProfile?.base_location}
                    selectedDates={formData.schedule.proposed_dates || []}
                    onDatesChange={(dates) => updateForm('schedule', {
                      ...formData.schedule,
                      proposed_dates: dates
                    })}
                  />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <CCInput
                      label="Start Time"
                      type="time"
                      value={formData.schedule.start_time}
                      onChange={(e) => updateForm('schedule', {
                        ...formData.schedule,
                        start_time: e.target.value
                      })}
                    />
                    <CCInput
                      label="End Time"
                      type="time"
                      value={formData.schedule.end_time}
                      onChange={(e) => updateForm('schedule', {
                        ...formData.schedule,
                        end_time: e.target.value
                      })}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
                  <p className="text-[#9AA6BC]">
                    Add participant emails in Step 1 to see their availability
                  </p>
                </div>
              )}
            </CCCard>

            <CCCard padding="lg">
              <h3 className="font-semibold text-[#E8EEF9] mb-4 flex items-center justify-center gap-2">
                <MapPin className="w-5 h-5" /> Location
              </h3>
              <div className="text-center mb-4">
                <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Location Type</label>
                <select
                  value={formData.location.type}
                  onChange={(e) => updateForm('location', {
                    ...formData.location,
                    type: e.target.value
                  })}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                >
                  <option value="">Select location type</option>
                  <option value="studio">Studio</option>
                  <option value="private">Private Location</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="travel">Travel Required</option>
                </select>
              </div>
              <div className="text-center">
                <label className="block text-sm font-medium text-[#E8EEF9] mb-2">City</label>
                <input
                  placeholder="e.g., Los Angeles, CA"
                  value={formData.location.city}
                  onChange={(e) => updateForm('location', {
                    ...formData.location,
                    city: e.target.value
                  })}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
              </div>
                options={[
                  { value: 'studio', label: 'Studio' },
                  { value: 'private', label: 'Private Location' },
                  { value: 'outdoor', label: 'Outdoor' },
                  { value: 'travel', label: 'Travel Required' },
                ]}
                value={formData.location.type}
                onChange={(e) => updateForm('location', {
                  ...formData.location,
                  type: e.target.value
                })}
                className="mb-4"
              />
              <CCInput
                label="City"
                placeholder="e.g., Los Angeles, CA"
                value={formData.location.city}
                onChange={(e) => updateForm('location', {
                  ...formData.location,
                  city: e.target.value
                })}
              />
            </CCCard>
          </motion.div>
        )}

        {/* Step 7: Deliverables & Rights */}
        {step === 7 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2 text-center">Deliverables & Rights</h2>
            <p className="text-[#9AA6BC] mb-6 text-center">Define what will be delivered and usage rights.</p>

            <CCCard padding="lg" className="mb-6">
              <h3 className="font-semibold text-[#E8EEF9] mb-4 text-center">Deliverables</h3>
              <div className="space-y-3">
                {[
                  { key: 'photo', label: 'Photos', icon: Camera },
                  { key: 'video', label: 'Video', icon: Video },
                  { key: 'raw_files', label: 'Raw Files Included', icon: null },
                  { key: 'editing_included', label: 'Editing Included', icon: null },
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.deliverables[item.key]}
                      onChange={(e) => updateForm('deliverables', {
                        ...formData.deliverables,
                        [item.key]: e.target.checked
                      })}
                      className="w-5 h-5 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                    />
                    <span className="text-[#E8EEF9] flex items-center gap-2">
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-4 text-center">
                <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Delivery Timeline</label>
                <input
                  type="number"
                  value={formData.deliverables.delivery_timeline_days}
                  onChange={(e) => updateForm('deliverables', {
                    ...formData.deliverables,
                    delivery_timeline_days: parseInt(e.target.value)
                  })}
                  className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                />
                <p className="text-xs text-[#6B7A94] mt-1">Days after shoot</p>
              </div>
            </CCCard>

            <CCCard padding="lg" className="mb-6">
              <h3 className="font-semibold text-[#E8EEF9] mb-4 text-center">Usage Rights</h3>
              <div className="mb-4">
                <label className="text-sm text-[#9AA6BC] mb-2 block text-center">Platforms</label>
                <p className="text-xs text-[#6B7A94] mb-3 text-center">Where content can be published</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {catalogItems
                    .filter(item => item.category === 'platform')
                    .map(item => {
                      const platformList = formData.usage_rights.platforms || [];
                      return (
                        <label key={item.value} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={platformList.includes(item.value)}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...platformList, item.value]
                                : platformList.filter(p => p !== item.value);
                              updateForm('usage_rights', {
                                ...formData.usage_rights,
                                platforms: updated
                              });
                            }}
                            className="w-4 h-4 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                          />
                          <span className="text-sm text-[#E8EEF9]">{item.value}</span>
                        </label>
                      );
                    })}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customValues.custom_platform || ''}
                    onChange={(e) => setCustomValues({...customValues, custom_platform: e.target.value})}
                    className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                    placeholder="Add another platform..."
                  />
                  <CCButton
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={async () => {
                      const value = customValues.custom_platform?.trim();
                      if (!value) return;

                      const currentPlatforms = formData.usage_rights.platforms || [];
                      if (!currentPlatforms.includes(value)) {
                        updateForm('usage_rights', {
                          ...formData.usage_rights,
                          platforms: [...currentPlatforms, value]
                        });
                      }

                      try {
                        await base44.entities.CustomValueSubmission.create({
                          submitted_by: user.email,
                          category: 'platform',
                          custom_value: value,
                          status: 'pending'
                        });
                      } catch (error) {
                        console.error('Failed to submit custom platform:', error);
                      }

                      setCustomValues({...customValues, custom_platform: ''});
                    }}
                  >
                    Add
                  </CCButton>
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.usage_rights.exclusivity}
                    onChange={(e) => updateForm('usage_rights', {
                      ...formData.usage_rights,
                      exclusivity: e.target.checked
                    })}
                    className="w-5 h-5 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                  />
                  <span className="text-[#E8EEF9]">Exclusive rights</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.usage_rights.credit_required}
                    onChange={(e) => updateForm('usage_rights', {
                      ...formData.usage_rights,
                      credit_required: e.target.checked
                    })}
                    className="w-5 h-5 rounded border-[#4F8CFF] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                  />
                  <span className="text-[#E8EEF9]">Credit required when posting</span>
                </label>
              </div>
            </CCCard>

            <CCCard padding="lg">
              <h3 className="font-semibold text-[#E8EEF9] mb-4 flex items-center justify-center gap-2">
                <Shield className="w-5 h-5" /> Testing Requirements
              </h3>
              
              <label className="flex items-center justify-center gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={formData.testing_requirements.is_required}
                  onChange={(e) => updateForm('testing_requirements', {
                    ...formData.testing_requirements,
                    is_required: e.target.checked
                  })}
                  className="w-5 h-5 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                />
                <span className="text-[#E8EEF9] font-medium">Testing Required</span>
              </label>

              {formData.testing_requirements.is_required && (
                <div className="space-y-4 pl-8 border-l-2 border-[#263248]">
                  <CCSelect
                    label="Testing Visibility"
                    options={[
                      { value: 'PRIVATE', label: 'Private (only you)' },
                      { value: 'COLLABORATION_ROOM_ONLY', label: 'Collaboration Room Only' },
                      { value: 'VERIFIED_COLLABORATORS', label: 'All Verified Collaborators' },
                    ]}
                    value={formData.testing_requirements.visibility_level}
                    onChange={(e) => updateForm('testing_requirements', {
                      ...formData.testing_requirements,
                      visibility_level: e.target.value
                    })}
                  />

                  <div>
                    <label className="text-sm text-[#9AA6BC] mb-2 block">Deadline</label>
                    <div className="flex gap-2 mb-3">
                      {['24h', '48h', '72h'].map(preset => (
                        <CCButton
                          key={preset}
                          variant={formData.testing_requirements.deadline_preset === preset ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => updateForm('testing_requirements', {
                            ...formData.testing_requirements,
                            deadline_preset: preset,
                            deadline_custom_date: ''
                          })}
                        >
                          {preset.replace('h', ' hours')}
                        </CCButton>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-xs text-[#6B7A94]">Or set custom deadline:</p>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="date"
                          value={formData.testing_requirements.deadline_custom_date}
                          onChange={(e) => updateForm('testing_requirements', {
                            ...formData.testing_requirements,
                            deadline_custom_date: e.target.value,
                            deadline_preset: ''
                          })}
                          className="col-span-2 bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-[#E8EEF9] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                        />
                        <div className="flex gap-1">
                          <input
                            type="time"
                            value={formData.testing_requirements.deadline_custom_time}
                            onChange={(e) => updateForm('testing_requirements', {
                              ...formData.testing_requirements,
                              deadline_custom_time: e.target.value
                            })}
                            className="flex-1 bg-[#121824] border border-[#263248] rounded-lg px-2 py-2 text-[#E8EEF9] text-xs focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.testing_requirements.require_valid_credential}
                        onChange={(e) => updateForm('testing_requirements', {
                          ...formData.testing_requirements,
                          require_valid_credential: e.target.checked
                        })}
                        className="w-5 h-5 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                      />
                      <span className="text-sm text-[#E8EEF9]">Require valid TestingCredential on file</span>
                    </label>
                    
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.testing_requirements.require_new_upload}
                        onChange={(e) => updateForm('testing_requirements', {
                          ...formData.testing_requirements,
                          require_new_upload: e.target.checked
                        })}
                        className="w-5 h-5 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                      />
                      <span className="text-sm text-[#E8EEF9]">Require new upload for this collaboration</span>
                    </label>
                  </div>
                </div>
              )}
            </CCCard>

          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <CCButton
            variant="outline"
            icon={ArrowLeft}
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            Back
          </CCButton>

          {step < totalSteps ? (
            <CCButton
              variant="primary"
              iconRight={ArrowRight}
              onClick={() => setStep(Math.min(totalSteps, step + 1))}
            >
              Continue
            </CCButton>
          ) : (
            <CCButton
              variant="primary"
              icon={Check}
              onClick={() => createMutation.mutate(formData)}
              loading={createMutation.isPending}
            >
              {isEditing ? 'Update Collaboration' : 'Create Collaboration'}
            </CCButton>
          )}
        </div>
      </div>
    </div>
  );
}