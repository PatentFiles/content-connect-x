import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CCCard, { CCCardHeader, CCCardTitle, CCCardDescription, CCCardContent } from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import CCSelect from '../ui-custom/CCSelect';
import { Shield, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function FriendSettingsCard({ userId }) {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState(null);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['friendSettings', userId],
    queryFn: async () => {
      const result = await base44.entities.FriendSettings.filter({ user_id: userId });
      return result[0] || {
        user_id: userId,
        friend_request_policy: 'MESSAGE_FIRST',
        allow_collaboration_invites_non_friends: false,
        friend_count_visibility: 'PUBLIC',
        friend_request_daily_limit: 10
      };
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  // Save settings
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (settings.id) {
        return await base44.entities.FriendSettings.update(settings.id, data);
      } else {
        return await base44.entities.FriendSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['friendSettings']);
      toast.success('Settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  if (isLoading || !localSettings) return null;

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(localSettings);

  return (
    <CCCard>
      <CCCardHeader>
        <CCCardTitle>Connections & Privacy</CCCardTitle>
        <CCCardDescription>Control who can send you friend requests and see your connections</CCCardDescription>
      </CCCardHeader>
      <CCCardContent>
        <div className="space-y-4">
          {/* Friend Request Policy */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">
              Friend Request Policy
            </label>
            <CCSelect
              value={localSettings.friend_request_policy}
              onChange={(value) => setLocalSettings({
                ...localSettings,
                friend_request_policy: value
              })}
              options={[
                { value: 'EVERYONE', label: 'Everyone' },
                { value: 'MESSAGE_FIRST', label: 'Message First (Recommended)' },
                { value: 'NO_ONE', label: 'No One' }
              ]}
            />
            <p className="text-xs text-[#6B7A94] mt-1">
              {localSettings.friend_request_policy === 'EVERYONE' && 'Anyone can send you friend requests'}
              {localSettings.friend_request_policy === 'MESSAGE_FIRST' && 'Requires a replied message before friend requests'}
              {localSettings.friend_request_policy === 'NO_ONE' && 'You will not receive friend requests'}
            </p>
          </div>

          {/* Require Message Before Friend Request Toggle */}
          <div className="flex items-center justify-between p-3 bg-[#121824] rounded-lg">
            <div>
              <p className="text-sm font-medium text-[#E8EEF9]">
                Require message reply before accepting friend requests
              </p>
              <p className="text-xs text-[#6B7A94] mt-1">
                Users must send you a message and wait for your reply before they can send a friend request
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.friend_request_policy === 'MESSAGE_FIRST'}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                friend_request_policy: e.target.checked ? 'MESSAGE_FIRST' : 'EVERYONE'
              })}
              disabled={localSettings.friend_request_policy === 'NO_ONE'}
              className="w-5 h-5"
            />
          </div>

          {/* Collaboration Invites */}
          <div className="flex items-center justify-between p-3 bg-[#121824] rounded-lg">
            <div>
              <p className="text-sm font-medium text-[#E8EEF9]">
                Allow collaboration invites from non-friends
              </p>
              <p className="text-xs text-[#6B7A94] mt-1">
                Let anyone invite you to collaborations
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.allow_collaboration_invites_non_friends}
              onChange={(e) => setLocalSettings({
                ...localSettings,
                allow_collaboration_invites_non_friends: e.target.checked
              })}
              className="w-5 h-5"
            />
          </div>

          {/* Friend Count Visibility */}
          <div>
            <label className="text-sm font-medium text-[#E8EEF9] mb-2 block">
              Friend Count Visibility
            </label>
            <CCSelect
              value={localSettings.friend_count_visibility}
              onChange={(value) => setLocalSettings({
                ...localSettings,
                friend_count_visibility: value
              })}
              options={[
                { value: 'PUBLIC', label: 'Public' },
                { value: 'VERIFIED_ONLY', label: 'Verified Members Only' },
                { value: 'PRIVATE', label: 'Private' }
              ]}
            />
            <p className="text-xs text-[#6B7A94] mt-1">
              Control who can see your friend count
            </p>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <CCButton
              variant="primary"
              icon={Save}
              fullWidth
              onClick={() => saveMutation.mutate(localSettings)}
              loading={saveMutation.isPending}
            >
              Save Changes
            </CCButton>
          )}
        </div>
      </CCCardContent>
    </CCCard>
  );
}