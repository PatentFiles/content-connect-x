import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Shield, AlertCircle } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';

export default function VerificationRequired({ action, message }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
      <CCCard padding="lg" className="max-w-md w-full">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#F59E0B]/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-[#F59E0B]" />
          </div>
          
          <h2 className="text-xl font-bold text-[#E8EEF9] mb-2">
            Verification Required
          </h2>
          
          <p className="text-[#9AA6BC] mb-6">
            {message || `You must be verified to ${action || 'perform this action'}.`}
          </p>

          <div className="bg-[#121824] border border-[#263248] rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#4F8CFF] flex-shrink-0 mt-0.5" />
              <div className="text-left text-sm text-[#9AA6BC]">
                Age verification (18+) is required to access this feature. 
                This helps us maintain a safe and compliant platform.
              </div>
            </div>
          </div>

          <CCButton
            variant="primary"
            fullWidth
            onClick={() => navigate(createPageUrl('Verification'))}
          >
            Complete Verification
          </CCButton>
        </div>
      </CCCard>
    </div>
  );
}