import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Users, Shield, FileText, Calendar, AlertTriangle, CheckCircle, Bell } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import { toast } from 'sonner';

export default function NotificationPreferences({ user }) {
  const queryClient = useQueryClient();

  // Fetch all notification preferences for this user
  const { data: preferences = [] } = useQuery({
    queryKey: ['notificationPreferences', user?.email],
    queryFn: () => base44.entities.NotificationPreference.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ notificationType, enabled, channels }) => {
      const existing = preferences.find(p => p.notification_type === notificationType);
      
      if (existing) {
        return base44.entities.NotificationPreference.update(existing.id, {
          enabled,
          channels: channels || existing.channels
        });
      } else {
        return base44.entities.NotificationPreference.create({
          user_id: user.email,
          notification_type: notificationType,
          enabled,
          channels: channels || { in_app: true, email: true }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
  });

  const notificationTypes = [
    {
      type: 'messages',
      title: 'Messages',
      description: 'New direct messages and collaboration chat',
      icon: MessageCircle,
      defaultEnabled: true
    },
    {
      type: 'collaboration_invites',
      title: 'Collaboration Invites',
      description: 'When someone invites you to collaborate',
      icon: Users,
      defaultEnabled: true
    },
    {
      type: 'role_changes',
      title: 'Role Changes',
      description: 'When your role changes in a collaboration',
      icon: Shield,
      defaultEnabled: true
    },
    {
      type: 'contract_updates',
      title: 'Contract Updates',
      description: 'Contract creation, updates, and signatures',
      icon: FileText,
      defaultEnabled: true
    },
    {
      type: 'testing_deadlines',
      title: 'Testing Deadlines',
      description: 'Reminders for testing credential uploads',
      icon: Calendar,
      defaultEnabled: true
    },
    {
      type: 'dispute_updates',
      title: 'Disputes & Revocations',
      description: 'Consent revocations and dispute updates',
      icon: AlertTriangle,
      defaultEnabled: true
    },
    {
      type: 'representation_actions',
      title: 'Representation Actions',
      description: 'Agent and studio representation updates',
      icon: Shield,
      defaultEnabled: true
    },
    {
      type: 'verification_status',
      title: 'Verification Status',
      description: 'Identity verification approvals and rejections',
      icon: CheckCircle,
      defaultEnabled: true
    },
    {
      type: 'system_announcements',
      title: 'System Announcements',
      description: 'Platform updates and important notices',
      icon: Bell,
      defaultEnabled: false
    }
  ];

  const getPreferenceForType = (type) => {
    const pref = preferences.find(p => p.notification_type === type);
    const defaultType = notificationTypes.find(nt => nt.type === type);
    return {
      enabled: pref ? pref.enabled : defaultType?.defaultEnabled ?? true,
      channels: pref?.channels || { in_app: true, email: true }
    };
  };

  const handleToggle = (type) => {
    const current = getPreferenceForType(type);
    updatePreferenceMutation.mutate({
      notificationType: type,
      enabled: !current.enabled,
      channels: current.channels
    });
  };

  const handleChannelToggle = (type, channel) => {
    const current = getPreferenceForType(type);
    const newChannels = {
      ...current.channels,
      [channel]: !current.channels[channel]
    };
    updatePreferenceMutation.mutate({
      notificationType: type,
      enabled: current.enabled,
      channels: newChannels
    });
  };

  return (
    <div className="space-y-6">
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Notification Preferences</h3>
        <p className="text-sm text-[#6B7A94] mb-6">
          Choose what notifications you want to receive and how you want to receive them.
        </p>

        <div className="space-y-4">
          {notificationTypes.map((item) => {
            const Icon = item.icon;
            const pref = getPreferenceForType(item.type);

            return (
              <div key={item.type} className="py-3 border-b border-[#263248] last:border-0">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-[#4F8CFF]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#E8EEF9] font-medium">{item.title}</p>
                      <p className="text-sm text-[#6B7A94] mt-0.5">{item.description}</p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
                    <input
                      type="checkbox"
                      checked={pref.enabled}
                      onChange={() => handleToggle(item.type)}
                      className="sr-only peer"
                      disabled={updatePreferenceMutation.isPending}
                    />
                    <div className="w-11 h-6 bg-[#263248] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4F8CFF]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F8CFF]"></div>
                  </label>
                </div>

                {/* Channel toggles */}
                {pref.enabled && (
                  <div className="ml-11 flex gap-4 text-xs mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-[#9AA6BC] hover:text-[#E8EEF9]">
                      <input
                        type="checkbox"
                        checked={pref.channels?.in_app ?? true}
                        onChange={() => handleChannelToggle(item.type, 'in_app')}
                        className="w-4 h-4"
                        disabled={updatePreferenceMutation.isPending}
                      />
                      <span>In-App</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-[#9AA6BC] hover:text-[#E8EEF9]">
                      <input
                        type="checkbox"
                        checked={pref.channels?.email ?? true}
                        onChange={() => handleChannelToggle(item.type, 'email')}
                        className="w-4 h-4"
                        disabled={updatePreferenceMutation.isPending}
                      />
                      <span>Email</span>
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CCCard>
    </div>
  );
}