import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Upload, FileText, MessageCircle } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCInput from '../ui-custom/CCInput';
import CCModal from '../ui-custom/CCModal';
import { CCTabsList, CCTabsContent } from '../ui-custom/CCTabs';
import { toast } from 'sonner';

export default function VerificationModal({ link, platform, user, onClose }) {
  const [activeTab, setActiveTab] = useState('bio_token');
  const [verificationCode] = useState(`CC-VERIFY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
  const [proofUrl, setProofUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const queryClient = useQueryClient();

  const submitVerificationMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.SocialLinkVerification.create({
        social_link_id: link.id,
        user_id: user.email,
        platform_id: platform.id,
        method: data.method,
        status: 'PENDING',
        proof_data_json: data.proofData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['socialVerifications']);
      toast.success('Verification submitted for review');
      onClose();
    },
  });

  const handleSubmitBioToken = () => {
    submitVerificationMutation.mutate({
      method: 'BIO_TOKEN',
      proofData: {
        verification_code: verificationCode,
        profile_url: proofUrl,
      },
    });
  };

  const handleSubmitWebsite = () => {
    submitVerificationMutation.mutate({
      method: 'WEBSITE_META',
      proofData: {
        website_url: proofUrl,
        verification_code: verificationCode,
      },
    });
  };

  const handleSubmitDmCode = () => {
    submitVerificationMutation.mutate({
      method: 'DM_CODE',
      proofData: {
        verification_code: verificationCode,
      },
    });
  };

  const handleSubmitScreenshot = async () => {
    if (!uploadedFile) {
      toast.error('Please upload a screenshot');
      return;
    }

    const { file_url } = await base44.integrations.Core.UploadFile({ file: uploadedFile });
    
    submitVerificationMutation.mutate({
      method: 'SCREENSHOT',
      proofData: {
        screenshot_url: file_url,
      },
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const tabs = [
    { value: 'bio_token', label: 'Bio Token', icon: FileText },
    { value: 'website', label: 'Website', icon: FileText },
    { value: 'dm_code', label: 'DM Code', icon: MessageCircle },
    { value: 'screenshot', label: 'Screenshot', icon: Upload },
  ];

  return (
    <CCModal
      isOpen={true}
      onClose={onClose}
      title={`Verify ${platform.display_name} Ownership`}
      size="xl"
    >
      <div className="space-y-6">
        <div className="p-4 bg-[#121824] rounded-lg">
          <p className="text-sm text-[#E8EEF9] mb-2">Your Link:</p>
          <p className="text-[#4F8CFF] font-mono">{link.value}</p>
        </div>

        <CCTabsList tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Bio Token Method */}
        <CCTabsContent value="bio_token" activeTab={activeTab}>
          <div className="space-y-4">
            <div className="p-4 bg-[#121824] rounded-lg">
              <p className="text-sm text-[#9AA6BC] mb-3">
                Step 1: Copy this verification code
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-[#0B0F14] rounded-lg text-[#4F8CFF] font-mono">
                  {verificationCode}
                </code>
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={Copy}
                  onClick={() => copyToClipboard(verificationCode)}
                >
                  Copy
                </CCButton>
              </div>
            </div>

            <div className="p-4 bg-[#121824] rounded-lg">
              <p className="text-sm text-[#9AA6BC] mb-3">
                Step 2: Add it to your bio or pinned post on {platform.display_name}
              </p>
            </div>

            <CCInput
              label="Step 3: Enter your profile URL"
              placeholder={`https://${platform.display_name.toLowerCase()}.com/yourprofile`}
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
            />

            <CCButton
              variant="primary"
              fullWidth
              onClick={handleSubmitBioToken}
              loading={submitVerificationMutation.isPending}
              disabled={!proofUrl}
            >
              Submit for Review
            </CCButton>
          </div>
        </CCTabsContent>

        {/* Website Method */}
        <CCTabsContent value="website" activeTab={activeTab}>
          <div className="space-y-4">
            <div className="p-4 bg-[#121824] rounded-lg">
              <p className="text-sm text-[#9AA6BC] mb-3">
                Step 1: Add this meta tag to your website's &lt;head&gt;
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-[#0B0F14] rounded-lg text-[#4F8CFF] text-xs overflow-x-auto">
                  {`<meta name="content-connect-verification" content="${verificationCode}" />`}
                </code>
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={Copy}
                  onClick={() => copyToClipboard(`<meta name="content-connect-verification" content="${verificationCode}" />`)}
                >
                  Copy
                </CCButton>
              </div>
            </div>

            <CCInput
              label="Step 2: Enter your website URL"
              placeholder="https://yourwebsite.com"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
            />

            <CCButton
              variant="primary"
              fullWidth
              onClick={handleSubmitWebsite}
              loading={submitVerificationMutation.isPending}
              disabled={!proofUrl}
            >
              Submit for Review
            </CCButton>
          </div>
        </CCTabsContent>

        {/* DM Code Method */}
        <CCTabsContent value="dm_code" activeTab={activeTab}>
          <div className="space-y-4">
            <div className="p-4 bg-[#121824] rounded-lg">
              <p className="text-sm text-[#9AA6BC] mb-3">
                Send this code in a DM to our official {platform.display_name} account
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-[#0B0F14] rounded-lg text-[#4F8CFF] font-mono">
                  {verificationCode}
                </code>
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={Copy}
                  onClick={() => copyToClipboard(verificationCode)}
                >
                  Copy
                </CCButton>
              </div>
            </div>

            <CCButton
              variant="primary"
              fullWidth
              onClick={handleSubmitDmCode}
              loading={submitVerificationMutation.isPending}
            >
              I've Sent the DM - Submit
            </CCButton>
          </div>
        </CCTabsContent>

        {/* Screenshot Method */}
        <CCTabsContent value="screenshot" activeTab={activeTab}>
          <div className="space-y-4">
            <div className="p-4 bg-[#121824] rounded-lg">
              <p className="text-sm text-[#9AA6BC] mb-3">
                Upload a screenshot showing:
              </p>
              <ul className="list-disc list-inside text-sm text-[#9AA6BC] space-y-1">
                <li>You're logged into the account</li>
                <li>The profile URL or username matches your link</li>
                <li>The profile is clearly visible</li>
              </ul>
            </div>

            <div className="border-2 border-dashed border-[#263248] rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setUploadedFile(e.target.files[0])}
                className="hidden"
                id="screenshot-upload"
              />
              <label htmlFor="screenshot-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-3 text-[#6B7A94]" />
                {uploadedFile ? (
                  <p className="text-sm text-[#E8EEF9]">{uploadedFile.name}</p>
                ) : (
                  <p className="text-sm text-[#9AA6BC]">Click to upload screenshot</p>
                )}
              </label>
            </div>

            <CCButton
              variant="primary"
              fullWidth
              onClick={handleSubmitScreenshot}
              loading={submitVerificationMutation.isPending}
              disabled={!uploadedFile}
            >
              Submit for Review
            </CCButton>
          </div>
        </CCTabsContent>
      </div>
    </CCModal>
  );
}