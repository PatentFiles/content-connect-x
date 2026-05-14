import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  CheckCircle, ArrowRight, ArrowLeft, X,
  User, MapPin, Briefcase, Shield, Camera,
  Sparkles, Globe, DollarSign, Heart, Search, MessageCircle,
} from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCInput from '../ui-custom/CCInput';
import CCCard from '../ui-custom/CCCard';
import CCBadge from '../ui-custom/CCBadge';
import LocationSelector from '../location/LocationSelector';
import CCTooltip from '../onboarding/CCTooltip';

// ─── Step definitions per role ────────────────────────────────────────────────
const WIZARD_STEPS = {
  creator: [
    { id: 'welcome',      title: 'Welcome',         icon: Sparkles },
    { id: 'basic',        title: 'Your Profile',     icon: User },
    { id: 'location',     title: 'Location',         icon: MapPin },
    { id: 'creator_info', title: 'Creator Details',  icon: Heart },
    { id: 'compensation', title: 'Compensation',     icon: DollarSign },
    { id: 'verification', title: 'Verification',     icon: Shield },
    { id: 'tour',         title: 'Platform Tour',    icon: Globe },
  ],
  agent: [
    { id: 'welcome',  title: 'Welcome',      icon: Sparkles },
    { id: 'basic',    title: 'Your Profile', icon: User },
    { id: 'location', title: 'Location',     icon: MapPin },
    { id: 'agency',   title: 'Agency Info',  icon: Briefcase },
    { id: 'verification', title: 'Verification', icon: Shield },
    { id: 'tour',     title: 'Platform Tour', icon: Globe },
  ],
  studio: [
    { id: 'welcome',  title: 'Welcome',      icon: Sparkles },
    { id: 'basic',    title: 'Your Profile', icon: User },
    { id: 'location', title: 'Location',     icon: MapPin },
    { id: 'studio',   title: 'Studio Info',  icon: Camera },
    { id: 'verification', title: 'Verification', icon: Shield },
    { id: 'tour',     title: 'Platform Tour', icon: Globe },
  ],
  photographer: [
    { id: 'welcome',  title: 'Welcome',      icon: Sparkles },
    { id: 'basic',    title: 'Your Profile', icon: User },
    { id: 'location', title: 'Location',     icon: MapPin },
    { id: 'services', title: 'Services',     icon: Camera },
    { id: 'verification', title: 'Verification', icon: Shield },
    { id: 'tour',     title: 'Platform Tour', icon: Globe },
  ],
  videographer: [
    { id: 'welcome',  title: 'Welcome',      icon: Sparkles },
    { id: 'basic',    title: 'Your Profile', icon: User },
    { id: 'location', title: 'Location',     icon: MapPin },
    { id: 'services', title: 'Services',     icon: Camera },
    { id: 'verification', title: 'Verification', icon: Shield },
    { id: 'tour',     title: 'Platform Tour', icon: Globe },
  ],
  video_editor: [
    { id: 'welcome',  title: 'Welcome',      icon: Sparkles },
    { id: 'basic',    title: 'Your Profile', icon: User },
    { id: 'location', title: 'Location',     icon: MapPin },
    { id: 'services', title: 'Services',     icon: Camera },
    { id: 'verification', title: 'Verification', icon: Shield },
    { id: 'tour',     title: 'Platform Tour', icon: Globe },
  ],
};

const SCENE_PAIRINGS = [
  'boy_girl','girl_girl','boy_boy','group','interracial',
  'trans_female_boy','trans_female_girl','solo',
];
const COMP_TYPES = ['paid','trade','free'];
const CONTENT_TYPES = ['straight','gay','trans'];
const SERVICE_TYPES = ['photography','videography','both'];

// ─── Small helpers ────────────────────────────────────────────────────────────
function FieldLabel({ label, tooltip }) {
  return (
    <span className="flex items-center gap-1.5 text-sm font-medium text-[#E8EEF9] mb-1.5">
      {label}
      {tooltip && <CCTooltip text={tooltip} position="right" />}
    </span>
  );
}

function MultiSelect({ options, selected = [], onChange, formatLabel }) {
  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            selected.includes(opt)
              ? 'bg-[#4F8CFF] border-[#4F8CFF] text-white'
              : 'bg-transparent border-[#263248] text-[#9AA6BC] hover:border-[#4F8CFF] hover:text-[#E8EEF9]'
          }`}
        >
          {formatLabel ? formatLabel(opt) : opt.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  );
}

// ─── Tour feature cards ───────────────────────────────────────────────────────
const TOUR_FEATURES = [
  {
    icon: Search,
    title: 'Discovery',
    desc: 'Browse verified members filtered by location, content type, availability, and more.',
    link: 'Discovery',
    color: 'text-[#4F8CFF]',
    bg: 'bg-[#4F8CFF]/10',
  },
  {
    icon: MessageCircle,
    title: 'Messaging',
    desc: 'Secure, verification-gated direct messaging. Start conversations from any profile.',
    link: 'Messages',
    color: 'text-[#FF2DAA]',
    bg: 'bg-[#FF2DAA]/10',
  },
  {
    icon: Briefcase,
    title: 'Collaborations',
    desc: 'Create deal rooms with scenes, schedules, acts, and testing requirements built in.',
    link: 'Collaborations',
    color: 'text-[#F59E0B]',
    bg: 'bg-[#F59E0B]/10',
  },
  {
    icon: Shield,
    title: 'Contracts',
    desc: 'Auto-generated e-sign contracts with full audit trail and consent management.',
    link: 'Contracts',
    color: 'text-[#22C55E]',
    bg: 'bg-[#22C55E]/10',
  },
];

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function ProfileWizard({ user, profile, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const roleType = profile?.role_type || 'creator';
  const steps = WIZARD_STEPS[roleType] || WIZARD_STEPS.creator;

  const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const updateProfileMutation = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      delete payload.contact_email;
      delete payload.contact_phone;
      return profile?.id
        ? base44.entities.UserProfile.update(profile.id, payload)
        : base44.entities.UserProfile.create({ ...payload, user_id: user.email });
    },
    onMutate: async (data) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['myProfile'] });
      // Snapshot previous state
      const previous = queryClient.getQueryData(['myProfile']);
      // Optimistically update
      queryClient.setQueryData(['myProfile'], (old) =>
        old ? old.map((p, i) => i === 0 ? { ...p, ...data } : p) : old
      );
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['myProfile'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
    },
  });

  const handleNext = async () => {
    const stepId = steps[currentStep].id;
    // Save data on substantive steps
    if (!['welcome', 'verification', 'tour'].includes(stepId)) {
      await updateProfileMutation.mutateAsync(formData);
    }
    if (currentStep === steps.length - 1) {
      await updateProfileMutation.mutateAsync({ ...formData, profile_complete: true });
      onComplete?.();
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-4 pt-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        <CCCard padding="none" className="flex flex-col overflow-hidden">
          {/* ── Header ── */}
          <div className="p-5 border-b border-[#263248] flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-[#E8EEF9]">
                Set Up Your Account
              </h2>
              <button
                onClick={onSkip}
                className="text-[#6B7A94] hover:text-[#E8EEF9] transition-colors"
                aria-label="Skip wizard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-[#263248] rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-gradient-to-r from-[#4F8CFF] to-[#FF2DAA] rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>

            {/* Step indicators — scroll on mobile */}
            <div className="flex justify-between gap-1 overflow-x-auto scrollbar-hide">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const done = idx < currentStep;
                const active = idx === currentStep;
                return (
                  <div key={step.id} className="flex flex-col items-center gap-1 min-w-[48px]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                      done   ? 'bg-[#22C55E]' :
                      active ? 'bg-[#4F8CFF]' :
                               'bg-[#263248]'
                    }`}>
                      {done
                        ? <CheckCircle className="w-4 h-4 text-white" />
                        : <Icon className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <span className={`text-[10px] text-center leading-tight ${active ? 'text-[#E8EEF9]' : 'text-[#6B7A94]'}`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Content ── */}
          <div className="p-6 overflow-y-auto flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {/* Step heading */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center flex-shrink-0">
                    <StepIcon className="w-5 h-5 text-[#4F8CFF]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">{currentStepData.title}</h3>
                    <p className="text-xs text-[#6B7A94]">Step {currentStep + 1} of {steps.length}</p>
                  </div>
                </div>

                {/* ── WELCOME ── */}
                {currentStepData.id === 'welcome' && (
                  <div className="text-center py-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center mx-auto mb-5">
                      <Sparkles className="w-10 h-10 text-[#4F8CFF]" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#E8EEF9] mb-2">
                      Welcome to Content Connect X
                    </h3>
                    <p className="text-[#9AA6BC] mb-6 max-w-md mx-auto leading-relaxed">
                      Let's take 3 minutes to set up your profile so you can start discovering
                      collaborators, signing contracts, and building your career.
                    </p>
                    <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
                      {[
                        { label: 'Verified', desc: 'Members only' },
                        { label: 'Contracts', desc: 'Built-in e-sign' },
                        { label: 'Safe', desc: 'Testing gated' },
                      ].map(item => (
                        <div key={item.label} className="p-3 bg-[#151D2B] rounded-xl text-center border border-[#263248]">
                          <p className="text-sm font-bold text-[#4F8CFF]">{item.label}</p>
                          <p className="text-xs text-[#6B7A94]">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── BASIC ── */}
                {currentStepData.id === 'basic' && (
                  <div className="space-y-4">
                    <div>
                      <FieldLabel
                        label="Display / Stage Name"
                        tooltip="This is what other members will see — use your stage name, agency name, or real name as you prefer."
                      />
                      <input
                        type="text"
                        placeholder="Your stage or business name"
                        value={formData.display_name ?? profile?.display_name ?? ''}
                        onChange={e => set('display_name', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                    </div>

                    <div>
                      <FieldLabel
                        label="Age"
                        tooltip="Must be 18+. This is stored privately; only your age is shown on your public profile."
                      />
                      <input
                        type="number"
                        placeholder="e.g. 24"
                        min={18}
                        max={99}
                        value={formData.age ?? profile?.age ?? ''}
                        onChange={e => set('age', parseInt(e.target.value))}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                    </div>

                    <div>
                      <FieldLabel
                        label="Bio"
                        tooltip="Describe your work style, what you're looking for, and anything that helps others decide to work with you."
                      />
                      <textarea
                        value={formData.bio ?? profile?.bio ?? ''}
                        onChange={e => set('bio', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[90px] transition-all"
                        placeholder="Tell others about yourself, your experience, what you enjoy creating..."
                      />
                    </div>

                    <div>
                      <FieldLabel
                        label="Profile Photo URL"
                        tooltip="Upload your photo on the Profile page and paste the URL here, or skip and add it later."
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={formData.avatar_url ?? profile?.avatar_url ?? ''}
                        onChange={e => set('avatar_url', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                      <p className="text-xs text-[#6B7A94] mt-1">You can upload a photo later on the Profile page.</p>
                    </div>
                  </div>
                )}

                {/* ── LOCATION ── */}
                {currentStepData.id === 'location' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#151D2B] border border-[#263248] rounded-xl text-sm text-[#9AA6BC] flex gap-2">
                      <MapPin className="w-4 h-4 text-[#4F8CFF] flex-shrink-0 mt-0.5" />
                      <span>
                        Your city and state are shown on your profile to help nearby collaborators find you.
                        Exact address is never shared.{' '}
                        <CCTooltip text="Location helps with proximity-sorted Discovery results and travel date matching." position="right" />
                      </span>
                    </div>
                    <LocationSelector
                      value={formData.base_location ?? profile?.base_location ?? {}}
                      onChange={loc => set('base_location', loc)}
                    />
                    <div className="flex items-center gap-3 p-3 bg-[#151D2B] border border-[#263248] rounded-xl">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.travel_enabled ?? profile?.travel_enabled ?? false}
                          onChange={e => set('travel_enabled', e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-[#E8EEF9]">I'm available for travel</span>
                      </label>
                      <CCTooltip text="Enables a travel badge on your profile and lets others see when you'll be in their city." position="right" />
                    </div>
                  </div>
                )}

                {/* ── CREATOR DETAILS ── */}
                {currentStepData.id === 'creator_info' && (
                  <div className="space-y-5">
                    <div>
                      <FieldLabel
                        label="Scene Pairings"
                        tooltip="Select the scene types you're open to performing. This helps match you with compatible creators."
                      />
                      <MultiSelect
                        options={SCENE_PAIRINGS}
                        selected={formData.scene_pairings ?? []}
                        onChange={v => set('scene_pairings', v)}
                      />
                    </div>

                    <div>
                      <FieldLabel
                        label="Content Types"
                        tooltip="The categories of content you create or participate in."
                      />
                      <MultiSelect
                        options={CONTENT_TYPES}
                        selected={formData.content_types ?? []}
                        onChange={v => set('content_types', v)}
                        formatLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
                      />
                    </div>

                    <div>
                      <FieldLabel
                        label="Rates (optional)"
                        tooltip="A free-form description of your rates. This is visible to verified members who view your profile."
                      />
                      <textarea
                        value={formData.rates_text ?? ''}
                        onChange={e => set('rates_text', e.target.value)}
                        placeholder="e.g. $500 for solo, $800 for B/G. Contact me for custom rates."
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px] transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* ── COMPENSATION (creator) ── */}
                {currentStepData.id === 'compensation' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-[#151D2B] border border-[#263248] rounded-xl text-sm text-[#9AA6BC]">
                      Choose the compensation arrangements you're open to. You can change these anytime on your Profile.
                    </div>
                    <div>
                      <FieldLabel
                        label="Compensation Types"
                        tooltip="'Paid' = you expect payment. 'Trade' = content in exchange for content. 'Free' = open to unpaid work."
                      />
                      <MultiSelect
                        options={COMP_TYPES}
                        selected={formData.compensation_preferences ?? []}
                        onChange={v => set('compensation_preferences', v)}
                        formatLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
                      />
                    </div>

                    <div>
                      <FieldLabel
                        label="Ethnicity (optional)"
                        tooltip="Optional. Used by studios and producers for casting purposes only."
                      />
                      <input
                        type="text"
                        placeholder="e.g. Hispanic, White, Black, Asian..."
                        value={formData.ethnicity ?? profile?.ethnicity ?? ''}
                        onChange={e => set('ethnicity', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* ── AGENCY (agent) ── */}
                {currentStepData.id === 'agency' && (
                  <div className="space-y-4">
                    <div>
                      <FieldLabel label="Agency Name" tooltip="The name of your agency as it will appear to creators you represent." />
                      <input
                        type="text"
                        placeholder="Your Agency Name"
                        value={formData.agency_name ?? ''}
                        onChange={e => set('agency_name', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                    </div>
                    <div>
                      <FieldLabel label="Default Commission Rate (%)" tooltip="Your standard commission percentage. This can be customized per creator representation." />
                      <input
                        type="number"
                        placeholder="e.g. 15"
                        min={0} max={100}
                        value={formData.commission_rate ?? ''}
                        onChange={e => set('commission_rate', parseFloat(e.target.value))}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                    </div>
                    <div>
                      <FieldLabel label="Content Types You Work With" tooltip="Used in Discovery to match you with relevant creators." />
                      <MultiSelect
                        options={CONTENT_TYPES}
                        selected={formData.content_types ?? []}
                        onChange={v => set('content_types', v)}
                        formatLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
                      />
                    </div>
                  </div>
                )}

                {/* ── STUDIO ── */}
                {currentStepData.id === 'studio' && (
                  <div className="space-y-4">
                    <div>
                      <FieldLabel label="Studio Name" tooltip="Your studio's official name as it will appear on contracts and your profile." />
                      <input
                        type="text"
                        placeholder="Your Studio Name"
                        value={formData.studio_name ?? ''}
                        onChange={e => set('studio_name', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                    </div>
                    <div>
                      <FieldLabel label="Content Types" tooltip="Types of content your studio produces. Used to match with relevant creators." />
                      <MultiSelect
                        options={CONTENT_TYPES}
                        selected={formData.content_types ?? []}
                        onChange={v => set('content_types', v)}
                        formatLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
                      />
                    </div>
                    <div>
                      <FieldLabel label="Booking Email (optional)" tooltip="An email address creators can use to reach your studio booking team." />
                      <input
                        type="email"
                        placeholder="booking@yourstudio.com"
                        value={formData.booking_email ?? ''}
                        onChange={e => set('booking_email', e.target.value)}
                        className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* ── SERVICES (photo/video) ── */}
                {currentStepData.id === 'services' && (
                  <div className="space-y-4">
                    <div>
                      <FieldLabel label="Service Type" tooltip="What you offer. You can do both photography and videography." />
                      <div className="flex gap-3">
                        {SERVICE_TYPES.map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => set('service_type', t)}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                              formData.service_type === t
                                ? 'bg-[#4F8CFF] border-[#4F8CFF] text-white'
                                : 'border-[#263248] text-[#9AA6BC] hover:border-[#4F8CFF]'
                            }`}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel label="Content Types You Film" tooltip="Lets studios and creators know what kind of scenes you're comfortable shooting." />
                      <MultiSelect
                        options={CONTENT_TYPES}
                        selected={formData.content_types ?? []}
                        onChange={v => set('content_types', v)}
                        formatLabel={v => v.charAt(0).toUpperCase() + v.slice(1)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {['hourly','half_day','full_day'].map(rateKey => (
                        <div key={rateKey}>
                          <FieldLabel label={rateKey.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} />
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7A94] text-sm">$</span>
                            <input
                              type="number"
                              placeholder="0"
                              value={formData[`rate_${rateKey}`] ?? ''}
                              onChange={e => set(`rate_${rateKey}`, parseFloat(e.target.value))}
                              className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-7 pr-3 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 transition-all"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── VERIFICATION ── */}
                {currentStepData.id === 'verification' && (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center text-center py-4">
                      <div className="w-16 h-16 rounded-2xl bg-[#4F8CFF]/20 flex items-center justify-center mb-4">
                        <Shield className="w-8 h-8 text-[#4F8CFF]" />
                      </div>
                      <h4 className="text-lg font-semibold text-[#E8EEF9] mb-2">Verify Your Identity</h4>
                      <p className="text-sm text-[#9AA6BC] max-w-sm">
                        Identity verification (18+ check) is required to message members, view profiles, and join collaborations.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Unlocks Discovery', desc: 'Browse and search all verified members.' },
                        { label: 'Unlocks Messaging', desc: 'Send and receive direct messages.' },
                        { label: 'Unlocks Collaborations', desc: 'Create deal rooms and sign contracts.' },
                      ].map(item => (
                        <div key={item.label} className="flex items-start gap-3 p-3 bg-[#151D2B] border border-[#263248] rounded-xl">
                          <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-[#E8EEF9]">{item.label}</p>
                            <p className="text-xs text-[#6B7A94]">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Link to={createPageUrl('Verification')} target="_blank">
                      <CCButton variant="primary" fullWidth iconRight={ArrowRight}>
                        Start Verification Now
                      </CCButton>
                    </Link>
                    <p className="text-xs text-center text-[#6B7A94]">
                      This opens the verification page. Come back here after submitting to continue.
                    </p>
                  </div>
                )}

                {/* ── PLATFORM TOUR ── */}
                {currentStepData.id === 'tour' && (
                  <div className="space-y-4">
                    <div className="text-center mb-2">
                      <p className="text-[#9AA6BC] text-sm">
                        You're all set! Here's a quick overview of what's available to you.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {TOUR_FEATURES.map(feat => {
                        const Icon = feat.icon;
                        return (
                          <Link key={feat.title} to={createPageUrl(feat.link)}>
                            <div className="p-4 bg-[#151D2B] border border-[#263248] rounded-xl hover:bg-[#1A2438] hover:border-[#4F8CFF]/40 transition-all h-full">
                              <div className={`w-9 h-9 rounded-lg ${feat.bg} flex items-center justify-center mb-2`}>
                                <Icon className={`w-5 h-5 ${feat.color}`} />
                              </div>
                              <p className="text-sm font-semibold text-[#E8EEF9] mb-1">{feat.title}</p>
                              <p className="text-xs text-[#6B7A94] leading-relaxed">{feat.desc}</p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    <div className="p-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-xl text-xs text-[#9AA6BC]">
                      💡 <strong className="text-[#E8EEF9]">Tip:</strong> Your Dashboard has an onboarding checklist showing remaining setup steps. It disappears automatically once complete.
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Footer ── */}
          <div className="p-5 border-t border-[#263248] flex justify-between items-center flex-shrink-0">
            <CCButton
              variant="outline"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={currentStep === 0}
              icon={ArrowLeft}
            >
              Back
            </CCButton>
            <span className="text-xs text-[#6B7A94]">
              {currentStep + 1} / {steps.length}
            </span>
            <CCButton
              variant="primary"
              onClick={handleNext}
              iconRight={currentStep < steps.length - 1 ? ArrowRight : undefined}
              loading={updateProfileMutation.isPending}
            >
              {currentStep === steps.length - 1 ? 'Go to Dashboard' : 'Next'}
            </CCButton>
          </div>
        </CCCard>
      </motion.div>
    </div>
  );
}