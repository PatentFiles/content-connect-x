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
  AlertTriangle
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';
import CCSelect from '@/components/ui-custom/CCSelect';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import AccessGate from '@/components/auth/AccessGate';
import AvailabilityCalendar from '@/components/collaboration/AvailabilityCalendar';



const compensationTypes = [
  { value: 'paid', label: 'Paid', description: 'Direct payment for services' },
  { value: 'trade', label: 'Trade', description: 'Content exchange/trade' },
  { value: 'free', label: 'Free', description: 'No compensation (TFP)' },
  { value: 'rev_share_external', label: 'Revenue Share', description: 'Split revenue externally' },
];

const scenePairings = [
  'Boy / Girl', 'Girl / Girl', 'Boy / Boy',
  'Trans Male / Trans Male', 'Trans Female / Trans Female', 'Trans Male / Trans Female',
  'Trans Female / Boy', 'Trans Female / Girl', 'Trans Male / Boy', 'Trans Male / Girl',
  'Trans Female / Trans Male', 'Non-Binary / Boy', 'Non-Binary / Girl',
  'Non-Binary / Trans Male', 'Non-Binary / Trans Female', 'Non-Binary / Non-Binary',
  'Boy / Boy / Girl', 'Boy / Girl / Girl', 'Boy / Boy / Boy', 'Girl / Girl / Girl',
  'Trans Male / Trans Male / Trans Male', 'Trans Female / Trans Female / Trans Female',
  'Trans Male / Trans Male / Girl', 'Trans Female / Trans Female / Boy',
  'Trans Male / Boy / Girl', 'Trans Female / Boy / Girl',
  'Trans Male / Girl / Girl', 'Trans Female / Boy / Boy',
  'Trans Male / Trans Female / Boy', 'Trans Male / Trans Female / Girl',
  'Trans Female / Trans Male / Girl', 'Trans Female / Trans Male / Boy',
  'Non-Binary / Boy / Girl', 'Non-Binary / Trans Male / Trans Female',
  'Non-Binary / Girl / Girl', 'Non-Binary / Boy / Boy',
  'Non-Binary / Non-Binary / Boy', 'Non-Binary / Non-Binary / Girl',
  'Boy / Girl / Boy / Girl', 'Boy / Boy / Girl / Girl',
  'Boy / Boy / Boy / Girl', 'Girl / Girl / Girl / Boy',
  'Trans Mixed Group', 'Trans Male Group', 'Trans Female Group', 'Non-Binary Mixed Group',
  'Boy / Boy / Boy / Boy', 'Girl / Girl / Girl / Girl',
  'Trans Male / Trans Male / Trans Male / Trans Male',
  'Trans Female / Trans Female / Trans Female / Trans Female',
  'Trans Male / Trans Female / Boy / Girl',
  'Group', 'Orgy', 'Trans Male Orgy', 'Trans Female Orgy', 'Non-Binary Group', 'Non-Binary Orgy',
  'Interracial', 'Other'
];

const standardActs = [
  'Solo', 'Group', 'Oral', 'Anal', 'Facial', 'Creampie', 'Swallowing',
  'Prints / Stills', 'Interracial', 'Orgy', 'Handjob', 'Footjob', 'Blowjob',
  'Cunnilingus', 'Anilingus', 'Outdoor Sex', 'Car Sex', 'Kissing', 'Edging',
  'Masturbation', 'Threesome', 'Foursome', 'Double Penetration', 'Triple Penetration',
  'Squirting', 'Prostate Massage', 'Pegging', 'StrapOn', 'Toy Play', 'Bukkake', 'Gloryhole', 'Other'
];

const fetishActs = [
  'Roleplay', 'Power Dynamics', 'Sensory Focus', 'Toy Use', 'Latex / Rubber',
  'Leather', 'Chastity', 'Cuckolding', 'Hotwifing', 'Voyeurism', 'Exhibitionism',
  'CFNM (Clothed Female Naked Male)', 'CMNF (Clothed Male Naked Female)', 'Age Gap', 'Other'
];

const kinkEdgeActs = [
  'Bondage', 'Dominant', 'Submissive', 'Power Exchange', 'Strap-On', 'Pegging',
  'Swinger', 'Hotwife', 'Cuckold', 'Impact Play', 'Sensory Deprivation', 'Breath Play', 'Other'
];

export default function CreateCollaboration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  
  // Get collaboration ID from URL for editing
  const urlParams = new URLSearchParams(window.location.search);
  const collaborationId = urlParams.get('id');
  const isEditing = !!collaborationId;

  const [customValues, setCustomValues] = useState({
    scene_pairings: '',
    standard_acts: '',
    fetish_acts: '',
    kink_edge_acts: ''
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
        }
      });
    }
  }, [existingCollaboration, isEditing]);

  const isVerified = verification?.[0]?.status === 'approved';
  const isSubscribed = subscription?.[0]?.status === 'active' || subscription?.[0]?.status === 'trial';

  // Fetch tags for acts
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.filter({ status: 'approved' }),
  });

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

  // Create/Update mutation
  const createMutation = useMutation({
    mutationFn: (data) => {
      const participantEmails = data.participant_emails 
        ? data.participant_emails.split(',').map(e => e.trim()).filter(e => e)
        : [];
      
      const payload = {
        ...data,
        participant_ids: [user.email, ...participantEmails],
        status: 'draft',
      };

      if (isEditing) {
        return base44.entities.Collaboration.update(collaborationId, payload);
      }
      return base44.entities.Collaboration.create(payload);
    },
    onSuccess: (result) => {
      navigate(createPageUrl(isEditing ? 'Collaborations' : `ViewCollaboration?id=${result.id}`));
    },
  });

  const updateForm = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
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

  if (userLoading || (isEditing && loadingCollab && !existingCollaboration) || !details) {
    return <CCLoadingScreen message="Loading..." />;
  }

  if (!user) return <AccessGate type="both" />;
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
          <CCInput
            label="Collaboration Name (Optional)"
            placeholder="e.g., Miami Beach Shoot, Studio Session..."
            value={formData.collaboration_name}
            onChange={(e) => updateForm('collaboration_name', e.target.value)}
          />
        </CCCard>

        {/* Step 1: Participants */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Who's involved?</h2>
            <p className="text-[#9AA6BC] mb-6">Add the email addresses of other participants.</p>

            <CCCard padding="lg">
              <CCInput
                label="Participant Emails"
                placeholder="email1@example.com, email2@example.com"
                hint="Comma-separated emails of other participants"
                value={formData.participant_emails}
                onChange={(e) => updateForm('participant_emails', e.target.value)}
              />
            </CCCard>
          </motion.div>
        )}

        {/* Step 2: Scene Pairings */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Scene Pairings</h2>
            <p className="text-[#9AA6BC] mb-6">Select the scene pairings for this collaboration.</p>

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
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Acts</h2>
            <p className="text-[#9AA6BC] mb-6">Select the acts for this collaboration.</p>

            {/* Standard Acts */}
            <CCCard padding="lg" className="mb-6">
              <h3 className="font-semibold text-[#E8EEF9] mb-4">Standard Acts</h3>
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
            </CCCard>

            {/* Fetish Acts */}
            <CCCard padding="lg" className="mb-6">
              <h3 className="font-semibold text-[#E8EEF9] mb-4">Fetish Acts</h3>
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
            </CCCard>

            {/* Kink/Edge Acts */}
            <CCCard padding="lg">
              <h3 className="font-semibold text-[#E8EEF9] mb-4">Kink / Edge Acts</h3>
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
            </CCCard>
          </motion.div>
        )}

        {/* Step 4: Boundaries */}
        {step === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Boundaries</h2>
            <p className="text-[#9AA6BC] mb-6">Define your boundaries and limits.</p>

            <CCCard padding="lg">
              <h3 className="font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                Boundaries
              </h3>
              <CCInput
                label="Hard No's"
                placeholder="Acts that are absolutely off limits..."
                hint="Comma-separated list"
                className="mb-4"
              />
              <CCInput
                label="Soft Limits"
                placeholder="Acts that may be negotiable..."
                hint="Comma-separated list"
                className="mb-4"
              />
              <label className="flex items-center gap-3 cursor-pointer">
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
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Compensation</h2>
            <p className="text-[#9AA6BC] mb-6">Define how participants will be compensated.</p>

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
                    <div>
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
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">When & Where</h2>
            <p className="text-[#9AA6BC] mb-6">Set the schedule and location details.</p>

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
              <h3 className="font-semibold text-[#E8EEF9] mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" /> Location
              </h3>
              <CCSelect
                label="Location Type"
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
            <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Deliverables & Rights</h2>
            <p className="text-[#9AA6BC] mb-6">Define what will be delivered and usage rights.</p>

            <CCCard padding="lg" className="mb-6">
              <h3 className="font-semibold text-[#E8EEF9] mb-4">Deliverables</h3>
              <div className="space-y-3">
                {[
                  { key: 'photo', label: 'Photos', icon: Camera },
                  { key: 'video', label: 'Video', icon: Video },
                  { key: 'raw_files', label: 'Raw Files Included', icon: null },
                  { key: 'editing_included', label: 'Editing Included', icon: null },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-3 cursor-pointer">
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
              <CCInput
                label="Delivery Timeline"
                type="number"
                value={formData.deliverables.delivery_timeline_days}
                onChange={(e) => updateForm('deliverables', {
                  ...formData.deliverables,
                  delivery_timeline_days: parseInt(e.target.value)
                })}
                hint="Days after shoot"
                className="mt-4"
              />
            </CCCard>

            <CCCard padding="lg" className="mb-6">
              <h3 className="font-semibold text-[#E8EEF9] mb-4">Usage Rights</h3>
              <div className="mb-4">
                <label className="text-sm text-[#9AA6BC] mb-2 block">Platforms</label>
                <p className="text-xs text-[#6B7A94] mb-3">Where content can be published</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {['OnlyFans', 'Fansly', 'Pornhub', 'ManyVids', 'Clips4Sale', 'Personal Website', 'Twitter/X', 'Instagram'].map(platform => {
                    const platformList = formData.usage_rights.platforms || [];
                    return (
                      <label key={platform} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={platformList.includes(platform)}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...platformList, platform]
                              : platformList.filter(p => p !== platform);
                            updateForm('usage_rights', {
                              ...formData.usage_rights,
                              platforms: updated
                            });
                          }}
                          className="w-4 h-4 rounded border-[#263248] bg-[#121824] text-[#4F8CFF] focus:ring-[#4F8CFF]/50"
                        />
                        <span className="text-sm text-[#E8EEF9]">{platform}</span>
                      </label>
                    );
                  })}
                </div>
                <CCInput
                  placeholder="Other platforms (comma-separated)"
                  value={formData.usage_rights.other_platforms}
                  onChange={(e) => updateForm('usage_rights', {
                    ...formData.usage_rights,
                    other_platforms: e.target.value
                  })}
                />
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