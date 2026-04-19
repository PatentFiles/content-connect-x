import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import CCSelect from '../ui-custom/CCSelect';
import CCBadge from '../ui-custom/CCBadge';
import { toast } from 'sonner';
import VerificationModal from './VerificationModal';

const groupLabels = {
  FAN_PLATFORM: 'Fan Platforms',
  SOCIAL_TRAFFIC: 'Social / Traffic',
  DIRECT_CONTACT: 'Direct Contact',
  HUB: 'Website / Hub',
  TUBE_MODEL_PAGES: 'Tube / Model Pages',
  CREATOR_MARKETPLACES: 'Creator Marketplaces',
  KINK_COMMUNITY: 'Kink & Community',
  GAY_PLATFORMS: 'Gay Platforms',
  INTERNATIONAL: 'International',
  STUDIO_NICHE: 'Studio / Niche',
  CUSTOM: 'Custom Links',
};

const visibilityOptions = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'VERIFIED_ONLY', label: 'Verified Members Only' },
  { value: 'MATCHED_ONLY', label: 'After Match / Conversation' },
  { value: 'DEAL_ROOM_ONLY', label: 'Collaboration Only' },
  { value: 'PRIVATE', label: 'Private (Only Me)' },
];

const defaultVisibility = {
  FAN_PLATFORM: 'VERIFIED_ONLY',
  SOCIAL_TRAFFIC: 'VERIFIED_ONLY',
  DIRECT_CONTACT: 'DEAL_ROOM_ONLY',
  HUB: 'VERIFIED_ONLY',
  TUBE_MODEL_PAGES: 'VERIFIED_ONLY',
  CREATOR_MARKETPLACES: 'VERIFIED_ONLY',
  KINK_COMMUNITY: 'MATCHED_ONLY',
  GAY_PLATFORMS: 'MATCHED_ONLY',
  INTERNATIONAL: 'VERIFIED_ONLY',
  STUDIO_NICHE: 'VERIFIED_ONLY',
  CUSTOM: 'VERIFIED_ONLY',
};

const collapsedByDefault = ['TUBE_MODEL_PAGES', 'CREATOR_MARKETPLACES', 'KINK_COMMUNITY', 'GAY_PLATFORMS', 'INTERNATIONAL', 'STUDIO_NICHE'];

export default function SocialLinksManager({ user }) {
  const [expandedGroups, setExpandedGroups] = useState(['FAN_PLATFORM', 'SOCIAL_TRAFFIC', 'DIRECT_CONTACT', 'HUB', 'CUSTOM']);
  const [verifyingLink, setVerifyingLink] = useState(null);
  const queryClient = useQueryClient();

  const { data: platforms = [] } = useQuery({
    queryKey: ['socialPlatforms'],
    queryFn: () => base44.entities.SocialPlatform.filter({ is_enabled: true }),
  });

  const { data: userLinks = [] } = useQuery({
    queryKey: ['socialLinks', user?.email],
    queryFn: () => base44.entities.SocialLink.filter({ user_id: user?.email, is_active: true }),
    enabled: !!user?.email,
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['socialVerifications', user?.email],
    queryFn: () => base44.entities.SocialLinkVerification.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const createLinkMutation = useMutation({
    mutationFn: (data) => base44.entities.SocialLink.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialLinks']);
      toast.success('Link added');
    },
  });

  const updateLinkMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SocialLink.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialLinks']);
      toast.success('Link updated');
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id) => base44.entities.SocialLink.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries(['socialLinks']);
      toast.success('Link removed');
    },
  });

  const toggleGroup = (group) => {
    setExpandedGroups(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const getVerificationStatus = (linkId) => {
    const verification = verifications.find(v => v.social_link_id === linkId);
    return verification?.status || 'NOT_SUBMITTED';
  };

  const handleAddLink = (platformId, group) => {
    const platform = platforms.find(p => p.id === platformId);
    createLinkMutation.mutate({
      user_id: user.email,
      platform_id: platformId,
      value: '',
      normalized_value: '',
      visibility: defaultVisibility[group],
      is_active: true,
    });
  };

  const handleUpdateLink = (linkId, field, value) => {
    updateLinkMutation.mutate({
      id: linkId,
      data: { [field]: value },
    });
  };

  const groupedPlatforms = platforms.reduce((acc, platform) => {
    if (!acc[platform.group]) acc[platform.group] = [];
    acc[platform.group].push(platform);
    return acc;
  }, {});

  Object.keys(groupedPlatforms).forEach(key => {
    groupedPlatforms[key].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  });

  const groupOrder = ['FAN_PLATFORM', 'SOCIAL_TRAFFIC', 'DIRECT_CONTACT', 'HUB', 'TUBE_MODEL_PAGES', 'CREATOR_MARKETPLACES', 'KINK_COMMUNITY', 'GAY_PLATFORMS', 'INTERNATIONAL', 'STUDIO_NICHE', 'CUSTOM'];

  return (
    <div className="space-y-4">
      {groupOrder.map(group => {
        const groupPlatforms = groupedPlatforms[group] || [];
        if (groupPlatforms.length === 0) return null;

        const isExpanded = expandedGroups.includes(group);
        const groupLinks = userLinks.filter(link =>
          groupPlatforms.some(p => p.id === link.platform_id)
        );

        return (
          <CCCard key={group} padding="none">
            <button
              onClick={() => toggleGroup(group)}
              className="w-full p-4 flex items-center hover:bg-[#1A2438] transition-colors relative"
            >
              <div className="flex items-center gap-3 justify-center flex-1">
                <h3 className="font-semibold text-[#E8EEF9]">{groupLabels[group]}</h3>
                {groupLinks.length > 0 && (
                  <CCBadge variant="primary" size="sm">{groupLinks.length}</CCBadge>
                )}

              </div>
              {isExpanded ? <ChevronUp className="w-5 h-5 absolute right-4" /> : <ChevronDown className="w-5 h-5 absolute right-4" />}
            </button>

            {isExpanded && (
              <div className="p-4 space-y-4 border-t border-[#263248]">
                {group === 'DIRECT_CONTACT' && (
                  <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
                    <p className="text-sm text-[#F59E0B]">⚠️ Default visibility: Collaboration Only</p>
                  </div>
                )}

                {groupPlatforms.map(platform => {
                  const existingLinks = userLinks.filter(l => l.platform_id === platform.id);
                  
                  return (
                    <div key={platform.id}>
                      {existingLinks.length === 0 && (
                        <CCButton
                          variant="outline"
                          size="sm"
                          icon={Plus}
                          onClick={() => handleAddLink(platform.id, group)}
                          className="w-full"
                        >
                          Add {platform.display_name}
                        </CCButton>
                      )}

                      {existingLinks.map(link => {
                        const verificationStatus = getVerificationStatus(link.id);
                        return (
                          <div key={link.id} className="space-y-3 p-4 bg-[#121824] rounded-lg">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-medium text-[#E8EEF9]">{platform.display_name}</h4>
                              <div className="flex items-center gap-2">
                                {verificationStatus === 'VERIFIED' && (
                                  <CCBadge variant="success" size="sm" icon={ShieldCheck}>Verified</CCBadge>
                                )}
                                {verificationStatus === 'PENDING' && (
                                  <CCBadge variant="warning" size="sm">Pending</CCBadge>
                                )}
                                {verificationStatus === 'NOT_SUBMITTED' && (
                                  <CCBadge variant="default" size="sm">Unverified</CCBadge>
                                )}
                                <CCButton
                                  variant="ghost"
                                  size="sm"
                                  icon={Trash2}
                                  onClick={() => deleteLinkMutation.mutate(link.id)}
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-[#E8EEF9] mb-1.5">
                                {platform.input_type === 'HANDLE' ? 'Handle' : platform.input_type === 'URL' ? 'URL' : 'Value'}
                              </label>
                              <input
                                type="text"
                                value={link.value}
                                onChange={(e) => handleUpdateLink(link.id, 'value', e.target.value)}
                                placeholder={platform.input_type === 'HANDLE' ? 'username' : platform.input_type === 'URL' ? 'https://...' : 'Enter value'}
                                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
                              />
                            </div>

                            {platform.input_type === 'HANDLE' && platform.base_url && link.value && (
                              <p className="text-xs text-[#6B7A94]">
                                Preview: {platform.base_url}{link.value}
                              </p>
                            )}

                            <CCSelect
                              label="Visibility"
                              options={visibilityOptions}
                              value={link.visibility}
                              onChange={(e) => handleUpdateLink(link.id, 'visibility', e.target.value)}
                            />

                            <CCButton
                              variant="outline"
                              size="sm"
                              icon={ShieldCheck}
                              onClick={() => setVerifyingLink(link)}
                              disabled={verificationStatus === 'VERIFIED'}
                            >
                              Verify Ownership
                            </CCButton>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </CCCard>
        );
      })}

      {verifyingLink && (
        <VerificationModal
          link={verifyingLink}
          platform={platforms.find(p => p.id === verifyingLink.platform_id)}
          user={user}
          onClose={() => setVerifyingLink(null)}
        />
      )}
    </div>
  );
}