import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  LogOut,
  Globe,
  Lock,
  Trash2,
  Crown,
  BarChart2
} from 'lucide-react';
// Shield already imported above — used for legal hold status display
import PricingManager from '@/components/admin/PricingManager';
import CouponManager from '@/components/admin/CouponManager';
import UserManager from '@/components/admin/UserManager';
import SocialLinksManager from '@/components/socials/SocialLinksManager';
import NotificationPreferences from '@/components/settings/NotificationPreferences';
import FriendSettingsCard from '@/components/settings/FriendSettingsCard';
import SubscriptionManager from '@/components/settings/SubscriptionManager';
import ProfilePrivacySettings from '@/components/settings/ProfilePrivacySettings';
import ProfileAnalytics from '@/components/profile/ProfileAnalytics';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import CCModal from '@/components/ui-custom/CCModal';
import DeleteAccountFlow from '@/components/settings/DeleteAccountFlow';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [editingName, setEditingName] = useState('');
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: subscription = [] } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: profile = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: userSettings = [] } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: () => base44.entities.UserSettings.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const updateNameMutation = useMutation({
    mutationFn: async (name) => {
      if (currentProfile) {
        return base44.entities.UserProfile.update(currentProfile.id, { display_name: name });
      } else {
        return base44.entities.UserProfile.create({ 
          user_id: user.email, 
          display_name: name,
          role_type: 'creator' 
        });
      }
    },
    onMutate: async (name) => {
      // Optimistic update — immediately reflect new name in UI
      await queryClient.cancelQueries({ queryKey: ['myProfile', user?.email] });
      const previous = queryClient.getQueryData(['myProfile', user?.email]);
      queryClient.setQueryData(['myProfile', user?.email], (old) =>
        old?.map((p, i) => i === 0 ? { ...p, display_name: name } : p) ?? old
      );
      return { previous };
    },
    onError: (_err, _name, context) => {
      queryClient.setQueryData(['myProfile', user?.email], context?.previous);
      toast.error('Failed to update display name');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      setShowNameModal(false);
      toast.success('Display name updated');
    },
  });

  const handleLogout = () => {
    base44.auth.logout();
  };

  const currentSubscription = subscription[0];
  const currentProfile = profile[0];
  const settings = userSettings[0];
  const isAdmin = currentProfile?.is_admin || user?.role === 'admin';

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings) {
        return base44.entities.UserSettings.update(settings.id, data);
      } else {
        return base44.entities.UserSettings.create({ ...data, user_id: user.email });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      toast.success('Privacy settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  const updateSetting = (section, key, value) => {
    const updated = {
      ...settings,
      [section]: {
        ...settings?.[section],
        [key]: value,
      },
    };
    updateSettingsMutation.mutate(updated);
  };

  if (isLoading) {
    return <CCLoadingScreen message="Loading settings..." />;
  }

  const tabs = [
    { value: 'account', label: 'Account', icon: User },
    { value: 'analytics', label: 'Analytics', icon: BarChart2 },
    { value: 'social', label: 'Social Links', icon: Globe },
    { value: 'connections', label: 'Connections', icon: User },
    { value: 'privacy', label: 'Privacy', icon: Shield },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'subscription', label: 'Subscription', icon: CreditCard },
    ...(isAdmin ? [{ value: 'admin', label: 'Admin', icon: Crown }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]" style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}>
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-[#4F8CFF]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#E8EEF9]">Settings</h1>
              <p className="text-xs text-[#6B7A94]">Manage your account</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <CCTabsList tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {/* Account Tab */}
        <CCTabsContent value="account" activeTab={activeTab}>
          <div className="space-y-6">
            <CCCard padding="lg">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Account Information</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-[#263248]">
                  <div>
                    <p className="text-sm text-[#6B7A94]">Email</p>
                    <p className="text-[#E8EEF9]">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[#263248]">
                  <div>
                    <p className="text-sm text-[#6B7A94]">Display Name</p>
                    <p className="text-[#E8EEF9]">{currentProfile?.display_name || 'Not set'}</p>
                  </div>
                  <CCButton 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditingName(currentProfile?.display_name || '');
                      setShowNameModal(true);
                    }}
                  >
                    Edit
                  </CCButton>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-[#6B7A94]">Account Type</p>
                    <p className="text-[#E8EEF9] capitalize">{currentProfile?.role_type || 'Not set'}</p>
                  </div>
                </div>
              </div>
            </CCCard>

            <CCCard padding="lg">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Security</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-[#263248]">
                  <div className="flex items-center gap-3">
                    <Lock className="w-5 h-5 text-[#6B7A94]" />
                    <div>
                      <p className="text-[#E8EEF9]">Password</p>
                      <p className="text-sm text-[#6B7A94]">Managed via your login provider</p>
                    </div>
                  </div>
                  <CCButton variant="outline" size="sm" onClick={() => toast.info('Password management is handled by your login provider.')}>Change</CCButton>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-[#6B7A94]" />
                    <div>
                      <p className="text-[#E8EEF9]">Two-Factor Authentication</p>
                      <p className="text-sm text-[#6B7A94]">Managed via your login provider</p>
                    </div>
                  </div>
                  <CCButton variant="outline" size="sm" onClick={() => toast.info('2FA is managed by your login provider.')}>Enable</CCButton>
                </div>
              </div>
            </CCCard>

            <CCCard padding="lg" className="border-[#EF4444]/30">
              <h3 className="text-lg font-semibold text-[#EF4444] mb-4">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#E8EEF9]">Delete Account</p>
                  <p className="text-sm text-[#6B7A94]">Anonymize and deactivate your account. Safety and legal records are retained per platform policy.</p>
                  {currentProfile?.deletion_status === 'blocked_legal_hold' && (
                    <p className="text-xs text-[#F59E0B] mt-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Deletion is currently blocked — account is under compliance review.
                    </p>
                  )}
                  {currentProfile?.deletion_status === 'anonymized' && (
                    <p className="text-xs text-[#22C55E] mt-1">Account deactivation in progress.</p>
                  )}
                </div>
                <CCButton 
                  variant="danger" 
                  size="sm" 
                  icon={Trash2}
                  onClick={() => setShowDeleteModal(true)}
                  disabled={currentProfile?.deletion_status === 'anonymized' || currentProfile?.deletion_status === 'completed'}
                >
                  Delete
                </CCButton>
              </div>
            </CCCard>
          </div>
        </CCTabsContent>

        {/* Analytics Tab */}
        <CCTabsContent value="analytics" activeTab={activeTab}>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[#E8EEF9]">Profile Analytics</h3>
            <p className="text-sm text-[#9AA6BC] mt-1">Track profile visits, gallery views, and saves over time.</p>
          </div>
          <ProfileAnalytics userId={user?.email} />
        </CCTabsContent>

        {/* Social Links Tab */}
        <CCTabsContent value="social" activeTab={activeTab}>
          <div>
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Social Links</h3>
            <p className="text-sm text-[#9AA6BC] mb-6">
              Manage your social media and platform links with granular visibility control.
            </p>
            <SocialLinksManager user={user} />
          </div>
        </CCTabsContent>

        {/* Connections Tab */}
        <CCTabsContent value="connections" activeTab={activeTab}>
          <div>
            <FriendSettingsCard userId={user?.email} />
          </div>
        </CCTabsContent>

        {/* Privacy Tab */}
        <CCTabsContent value="privacy" activeTab={activeTab}>
          <ProfilePrivacySettings userId={user?.email} />
        </CCTabsContent>

        {/* Notifications Tab */}
        <CCTabsContent value="notifications" activeTab={activeTab}>
          <NotificationPreferences user={user} />
        </CCTabsContent>

        {/* Subscription Tab */}
        <CCTabsContent value="subscription" activeTab={activeTab}>
          <SubscriptionManager user={user} />
        </CCTabsContent>

        {/* Admin Tab */}
        {isAdmin && (
          <CCTabsContent value="admin" activeTab={activeTab}>
            <div className="space-y-8">
              <PricingManager />
              <CouponManager user={user} />
              <UserManager currentUser={user} />
            </div>
          </CCTabsContent>
        )}

        {/* Logout Button */}
        <div className="mt-8">
          <CCButton 
            variant="outline" 
            fullWidth 
            icon={LogOut}
            onClick={handleLogout}
            className="border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10"
          >
            Log Out
          </CCButton>
        </div>
      </div>

      {/* Edit Name Modal */}
      <CCModal
        isOpen={showNameModal}
        onClose={() => setShowNameModal(false)}
        title="Edit Display Name"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Display Name</label>
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              placeholder="Enter your display name"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setShowNameModal(false)}>
              Cancel
            </CCButton>
            <CCButton 
              variant="primary"
              onClick={() => updateNameMutation.mutate(editingName)}
              loading={updateNameMutation.isPending}
            >
              Save
            </CCButton>
          </div>
        </div>
      </CCModal>

      {/* Delete Account Flow */}
      <DeleteAccountFlow
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userEmail={user?.email}
      />
    </div>
  );
}