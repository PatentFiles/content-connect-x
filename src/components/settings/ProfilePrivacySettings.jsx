import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import CCCard from '@/components/ui-custom/CCCard';
import { Eye, EyeOff, Users, Image, MessageCircle, Globe, Lock } from 'lucide-react';

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input type="checkbox" checked={!!checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-[#263248] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F8CFF]" />
    </label>
  );
}

function Row({ icon: Icon, label, desc, checked, onChange, iconColor = '#9AA6BC' }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#263248] last:border-0 gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: iconColor }} />
        <div>
          <p className="text-[#E8EEF9] text-sm font-medium">{label}</p>
          <p className="text-xs text-[#6B7A94] mt-0.5">{desc}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function ProfilePrivacySettings({ userId }) {
  const queryClient = useQueryClient();

  const { data: settingsArr = [] } = useQuery({
    queryKey: ['userSettings', userId],
    queryFn: () => base44.entities.UserSettings.filter({ user_id: userId }),
    enabled: !!userId,
  });
  const settings = settingsArr[0];
  const p = settings?.privacy || {};

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (settings) return base44.entities.UserSettings.update(settings.id, data);
      return base44.entities.UserSettings.create({ ...data, user_id: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      toast.success('Privacy settings saved');
    },
  });

  const update = (key, value) => {
    mutation.mutate({
      ...settings,
      privacy: { ...p, [key]: value },
    });
  };

  const commentOptions = [
    { value: 'everyone', label: 'Everyone', icon: Globe },
    { value: 'friends_only', label: 'Friends Only', icon: Users },
    { value: 'no_one', label: 'No One', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Visibility */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-1">Profile Visibility</h3>
        <p className="text-xs text-[#6B7A94] mb-4">Control who can see you and your content.</p>
        <div>
          <Row
            icon={EyeOff}
            label="Friends Only Profile"
            desc="Hide your profile completely from non-friends"
            checked={p.friends_only_profile ?? false}
            onChange={e => update('friends_only_profile', e.target.checked)}
            iconColor="#FF2DAA"
          />
          <Row
            icon={Eye}
            label="Show Location"
            desc="Display your city/region on your profile"
            checked={p.show_location ?? true}
            onChange={e => update('show_location', e.target.checked)}
          />
          <Row
            icon={Globe}
            label="Show Online Status"
            desc="Let others see when you were last active"
            checked={p.show_online_status ?? true}
            onChange={e => update('show_online_status', e.target.checked)}
          />
          <Row
            icon={MessageCircle}
            label="Approve Message Requests"
            desc="Require approval before receiving new messages"
            checked={p.message_requests_approval ?? false}
            onChange={e => update('message_requests_approval', e.target.checked)}
          />
        </div>
      </CCCard>

      {/* Gallery Privacy */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-1">Gallery Privacy</h3>
        <p className="text-xs text-[#6B7A94] mb-4">Manage gallery visibility and interaction settings.</p>
        <div>
          <Row
            icon={Image}
            label="Show Gallery Count"
            desc="Display how many photos are in your gallery on your profile"
            checked={p.show_gallery_count ?? true}
            onChange={e => update('show_gallery_count', e.target.checked)}
            iconColor="#4F8CFF"
          />
        </div>
        <div className="mt-4 pt-4 border-t border-[#263248]">
          <p className="text-sm font-medium text-[#E8EEF9] mb-1">Who can comment on your photos?</p>
          <p className="text-xs text-[#6B7A94] mb-3">Controls who can leave comments on your gallery images.</p>
          <div className="flex flex-wrap gap-2">
            {commentOptions.map(opt => {
              const Icon = opt.icon;
              const active = (p.gallery_comment_policy || 'everyone') === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => update('gallery_comment_policy', opt.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#4F8CFF] text-white'
                      : 'bg-[#263248] text-[#9AA6BC] hover:bg-[#1A2438] hover:text-[#E8EEF9]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </CCCard>
    </div>
  );
}