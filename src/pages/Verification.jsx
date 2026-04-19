import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  Upload, 
  Camera, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ArrowRight,
  FileText,
  User,
  Lock
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';

const steps = [
  { 
    id: 'id', 
    title: 'Government ID', 
    description: 'Upload a clear photo of your government-issued ID',
    icon: FileText
  },
  { 
    id: 'selfie', 
    title: 'Selfie Verification', 
    description: 'Take a selfie that matches your ID photo',
    icon: Camera
  },
  { 
    id: 'review', 
    title: 'Review', 
    description: 'Our team will review your submission',
    icon: Clock
  },
];

export default function Verification() {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedId, setUploadedId] = useState(null);
  const [uploadedSelfie, setUploadedSelfie] = useState(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: verifications = [], isLoading: verificationLoading } = useQuery({
    queryKey: ['verification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const verification = verifications[0];
  const isVerified = verification?.status === 'approved';
  const isPending = verification?.status === 'pending';
  const isRejected = verification?.status === 'rejected';

  const submitVerificationMutation = useMutation({
    mutationFn: async () => {
      const data = {
        user_id: user.email,
        provider: 'manual',
        status: 'pending',
        documents_submitted: [
          { type: 'id', uri: uploadedId, submitted_at: new Date().toISOString() },
          { type: 'selfie', uri: uploadedSelfie, submitted_at: new Date().toISOString() },
        ],
      };
      
      if (verification) {
        return base44.entities.VerificationRecord.update(verification.id, data);
      }
      return base44.entities.VerificationRecord.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['verification']);
      setCurrentStep(2);
    },
  });

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Use private storage — sensitive identity documents must never be publicly accessible
    const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
    
    if (type === 'id') {
      setUploadedId(file_uri);
      setCurrentStep(1);
    } else {
      setUploadedSelfie(file_uri);
    }
  };

  if (userLoading || verificationLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  // Already verified
  if (isVerified) {
    return (
      <FeatureRouteGuard flag="verification" requiresSubscription={false}>
      <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12 px-4">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <CCCard padding="xl" className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-[#22C55E]" />
              </div>
              <h1 className="text-2xl font-bold text-[#E8EEF9] mb-3">You're Verified!</h1>
              <p className="text-[#9AA6BC] mb-6">
                Your identity has been verified. You have full access to all platform features.
              </p>
              <CCBadge variant="success" size="lg" icon={CheckCircle}>
                Verified on {new Date(verification.verified_at).toLocaleDateString()}
              </CCBadge>
              {verification.expires_at && (
                <p className="text-sm text-[#6B7A94] mt-4">
                  Expires: {new Date(verification.expires_at).toLocaleDateString()}
                </p>
              )}
            </CCCard>
          </motion.div>
        </div>
      </div>
      </FeatureRouteGuard>
    );
  }

  // Pending verification
  if (isPending) {
    return (
      <FeatureRouteGuard flag="verification" requiresSubscription={false}>
      <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12 px-4">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <CCCard padding="xl" className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#F59E0B]/20 flex items-center justify-center">
                <Clock className="w-10 h-10 text-[#F59E0B]" />
              </div>
              <h1 className="text-2xl font-bold text-[#E8EEF9] mb-3">Verification Pending</h1>
              <p className="text-[#9AA6BC] mb-6">
                Your verification is being reviewed. This usually takes less than 24 hours.
              </p>
              <CCBadge variant="warning" size="lg" icon={Clock}>
                Under Review
              </CCBadge>
              <p className="text-sm text-[#6B7A94] mt-4">
                We'll notify you by email when your verification is complete.
              </p>
            </CCCard>
          </motion.div>
        </div>
      </div>
      </FeatureRouteGuard>
    );
  }

  return (
    <FeatureRouteGuard flag="verification" requiresSubscription={false}>
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-[#4F8CFF]" />
          </div>
          <h1 className="text-3xl font-bold text-[#E8EEF9] mb-2">Identity Verification</h1>
          <p className="text-[#9AA6BC]">
            Verify your identity to access all platform features and build trust with other members.
          </p>
        </motion.div>

        {/* Rejected notice */}
        {isRejected && (
          <CCCard padding="md" className="mb-6 border-[#EF4444]">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[#E8EEF9]">Previous verification rejected</p>
                <p className="text-sm text-[#9AA6BC] mt-1">
                  {verification?.rejection_reason || 'Please try again with clearer documents.'}
                </p>
              </div>
            </div>
          </CCCard>
        )}

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  i < currentStep 
                    ? 'bg-[#22C55E]' 
                    : i === currentStep 
                      ? 'bg-[#4F8CFF]' 
                      : 'bg-[#263248]'
                }`}>
                  {i < currentStep ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : (
                    <step.icon className="w-5 h-5 text-white" />
                  )}
                </div>
                <p className={`text-xs mt-2 ${
                  i <= currentStep ? 'text-[#E8EEF9]' : 'text-[#6B7A94]'
                }`}>
                  {step.title}
                </p>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-16 md:w-24 h-0.5 mx-2 ${
                  i < currentStep ? 'bg-[#22C55E]' : 'bg-[#263248]'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <CCCard padding="xl">
          {currentStep === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <FileText className="w-12 h-12 text-[#4F8CFF] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[#E8EEF9] mb-2">Upload Government ID</h2>
              <p className="text-[#9AA6BC] mb-6">
                Please upload a clear photo of your government-issued ID (passport, driver's license, or national ID card).
              </p>
              
              {uploadedId ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 p-6 bg-[#121824] rounded-xl border border-[#22C55E]/30">
                    <CheckCircle className="w-10 h-10 text-[#22C55E]" />
                    <p className="text-[#E8EEF9] font-medium">ID document uploaded securely</p>
                    <p className="text-xs text-[#6B7A94]">Stored in private encrypted storage — not accessible publicly</p>
                    <CCBadge variant="success" icon={CheckCircle}>Uploaded</CCBadge>
                  </div>
                  <CCButton variant="primary" onClick={() => setCurrentStep(1)} iconRight={ArrowRight}>
                    Continue
                  </CCButton>
                </div>
              ) : (
                <div>
                  <label className="block">
                    <div className="border-2 border-dashed border-[#263248] rounded-xl p-8 cursor-pointer hover:border-[#4F8CFF] transition-colors">
                      <Upload className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
                      <p className="text-[#9AA6BC]">Click to upload or drag and drop</p>
                      <p className="text-xs text-[#6B7A94] mt-1">PNG, JPG up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'id')}
                    />
                  </label>
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <Camera className="w-12 h-12 text-[#4F8CFF] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[#E8EEF9] mb-2">Take a Selfie</h2>
              <p className="text-[#9AA6BC] mb-6">
                Take a clear selfie of your face. Make sure your face matches your ID photo.
              </p>
              
              {uploadedSelfie ? (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-3 p-6 bg-[#121824] rounded-xl border border-[#22C55E]/30">
                    <CheckCircle className="w-10 h-10 text-[#22C55E]" />
                    <p className="text-[#E8EEF9] font-medium">Selfie uploaded securely</p>
                    <p className="text-xs text-[#6B7A94]">Stored in private encrypted storage — not accessible publicly</p>
                    <CCBadge variant="success" icon={CheckCircle}>Uploaded</CCBadge>
                  </div>
                  <CCButton
                    variant="primary"
                    onClick={() => submitVerificationMutation.mutate()}
                    loading={submitVerificationMutation.isPending}
                    iconRight={ArrowRight}
                  >
                    Submit for Review
                  </CCButton>
                </div>
              ) : (
                <div>
                  <label className="block">
                    <div className="border-2 border-dashed border-[#263248] rounded-xl p-8 cursor-pointer hover:border-[#4F8CFF] transition-colors">
                      <Camera className="w-10 h-10 text-[#6B7A94] mx-auto mb-3" />
                      <p className="text-[#9AA6BC]">Click to take or upload a selfie</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'selfie')}
                    />
                  </label>
                </div>
              )}
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#22C55E]/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-[#22C55E]" />
              </div>
              <h2 className="text-xl font-semibold text-[#E8EEF9] mb-2">Submitted!</h2>
              <p className="text-[#9AA6BC] mb-6">
                Your verification documents have been submitted. We'll review them and notify you within 24 hours.
              </p>
              <CCBadge variant="warning" size="lg" icon={Clock}>
                Under Review
              </CCBadge>
            </motion.div>
          )}
        </CCCard>

        {/* Security Note */}
        <div className="mt-6 p-4 bg-[#121824] rounded-xl border border-[#263248]">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#4F8CFF] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[#E8EEF9] font-medium">Your privacy is protected</p>
              <p className="text-xs text-[#6B7A94] mt-1">
                Documents are uploaded to private encrypted storage and are never accessible publicly. Only authorized platform administrators can view them for verification purposes, and all access is logged. Only your verification status (approved/pending) is visible to other members.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </FeatureRouteGuard>
  );
}