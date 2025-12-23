import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  Circle,
  ArrowRight,
  ArrowLeft,
  X,
  User,
  MapPin,
  Briefcase,
  Shield,
  Camera,
  Phone
} from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCInput from '../ui-custom/CCInput';
import CCCard from '../ui-custom/CCCard';
import LocationSelector from '../location/LocationSelector';

const WIZARD_STEPS = {
  creator: [
    { id: 'basic', title: 'Basic Info', icon: User, fields: ['display_name', 'bio', 'avatar_url'] },
    { id: 'contact', title: 'Contact', icon: Phone, fields: ['contact_email', 'contact_phone'] },
    { id: 'location', title: 'Location', icon: MapPin, fields: ['base_location'] },
    { id: 'details', title: 'Creator Details', icon: Briefcase, fields: ['scene_pairings', 'compensation_preferences'] },
    { id: 'verification', title: 'Verification', icon: Shield, fields: ['verification'] },
  ],
  agent: [
    { id: 'basic', title: 'Basic Info', icon: User, fields: ['display_name', 'bio', 'avatar_url'] },
    { id: 'contact', title: 'Contact', icon: Phone, fields: ['contact_email', 'contact_phone'] },
    { id: 'agency', title: 'Agency Info', icon: Briefcase, fields: ['agency_name', 'commission_rate'] },
  ],
  studio: [
    { id: 'basic', title: 'Basic Info', icon: User, fields: ['display_name', 'bio', 'avatar_url'] },
    { id: 'contact', title: 'Contact', icon: Phone, fields: ['booking_email'] },
    { id: 'studio', title: 'Studio Info', icon: Camera, fields: ['studio_name', 'locations', 'content_types'] },
  ],
  photographer: [
    { id: 'basic', title: 'Basic Info', icon: User, fields: ['display_name', 'bio', 'avatar_url'] },
    { id: 'contact', title: 'Contact', icon: Phone, fields: ['contact_email', 'contact_phone'] },
    { id: 'services', title: 'Services', icon: Camera, fields: ['service_type', 'rates', 'content_types'] },
  ],
  videographer: [
    { id: 'basic', title: 'Basic Info', icon: User, fields: ['display_name', 'bio', 'avatar_url'] },
    { id: 'contact', title: 'Contact', icon: Phone, fields: ['contact_email', 'contact_phone'] },
    { id: 'services', title: 'Services', icon: Camera, fields: ['service_type', 'rates', 'content_types'] },
  ],
};

export default function ProfileWizard({ user, profile, onComplete, onSkip }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const roleType = profile?.role_type || 'creator';
  const steps = WIZARD_STEPS[roleType];

  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.entities.UserProfile.update(profile.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['myProfile']);
    },
  });

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      await updateProfileMutation.mutateAsync({ ...formData, profile_complete: true });
      onComplete?.();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepData = steps[currentStep];
  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <CCCard padding="none">
          {/* Header */}
          <div className="p-6 border-b border-[#263248]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#E8EEF9]">Complete Your Profile</h2>
              <button onClick={onSkip} className="text-[#6B7A94] hover:text-[#E8EEF9]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Progress Bar */}
            <div className="relative h-2 bg-[#263248] rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-[#4F8CFF]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            {/* Steps Indicator */}
            <div className="flex justify-between mt-4">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div key={step.id} className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-[#22C55E]' : 
                      isCurrent ? 'bg-[#4F8CFF]' : 
                      'bg-[#263248]'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : (
                        <Icon className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <span className={`text-xs ${isCurrent ? 'text-[#E8EEF9]' : 'text-[#6B7A94]'}`}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 min-h-[400px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center">
                    <StepIcon className="w-6 h-6 text-[#4F8CFF]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#E8EEF9]">{currentStepData.title}</h3>
                    <p className="text-sm text-[#6B7A94]">Step {currentStep + 1} of {steps.length}</p>
                  </div>
                </div>

                {/* Step-specific form fields */}
                <div className="space-y-4">
                  {currentStepData.id === 'basic' && (
                    <>
                      <CCInput
                        label="Display Name"
                        placeholder="Your stage/business name"
                        value={formData.display_name || profile?.display_name || ''}
                        onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      />
                      <div>
                        <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Bio</label>
                        <textarea
                          value={formData.bio || profile?.bio || ''}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[100px]"
                          placeholder="Tell others about yourself..."
                        />
                      </div>
                    </>
                  )}

                  {currentStepData.id === 'contact' && (
                    <>
                      <CCInput
                        label="Contact Email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.contact_email || ''}
                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                      />
                      <CCInput
                        label="Contact Phone (Optional)"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.contact_phone || ''}
                        onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      />
                    </>
                  )}

                  {currentStepData.id === 'location' && (
                    <LocationSelector
                      value={formData.base_location || profile?.base_location || {}}
                      onChange={(location) => setFormData({ ...formData, base_location: location })}
                    />
                  )}

                  {currentStepData.id === 'verification' && (
                    <div className="text-center py-8">
                      <Shield className="w-16 h-16 text-[#4F8CFF] mx-auto mb-4" />
                      <h4 className="text-lg font-semibold text-[#E8EEF9] mb-2">Get Verified</h4>
                      <p className="text-sm text-[#9AA6BC] mb-6">
                        Verification helps build trust and unlocks premium features
                      </p>
                      <CCButton variant="primary" onClick={() => window.location.href = '/Verification'}>
                        Start Verification
                      </CCButton>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[#263248] flex justify-between">
            <CCButton
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
              icon={ArrowLeft}
            >
              Back
            </CCButton>
            <CCButton
              variant="primary"
              onClick={handleNext}
              iconRight={currentStep < steps.length - 1 ? ArrowRight : undefined}
              loading={updateProfileMutation.isPending}
            >
              {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
            </CCButton>
          </div>
        </CCCard>
      </motion.div>
    </div>
  );
}