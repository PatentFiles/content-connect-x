import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Settings as SettingsIcon, LogOut, User, Bell, CreditCard, Trash2, Lock } from 'lucide-react';
import { CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import NotificationPreferences from '@/components/settings/NotificationPreferences';
import DeleteAccountFlow from '@/components/settings/DeleteAccountFlow';
import HostPricingSettings from '@/components/hosting/HostPricingSettings';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';

export default function HostSettings() {
  const [activeTab, setActiveTab] = useState('account');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [editingName, setEditingName] = useState('');
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: userSettings = [] } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: () => base44.entities.UserSettings.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles[0];
  const settings = userSettings[0];

  const updateNameMutation = useMutation({
    mutationFn: async (name) => {
      if (profile) {
        return base44.entities.UserProfile.update(profile.id, { display_name: name });
      }
      return base44.entities.UserProfile.create({ user_id: user.email, display_name: name, role_type: 'creator' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      setShowNameModal(false);
      toast.success('Display name updated');
    },
    onError: () => toast.error('Failed to update name'),
  });

  const handleLogout = () => base44.auth.logout();

  if (isLoading) return <CCLoadingScreen message="Loading settings..." />;

  const tabs = [
    { value: 'account', label: 'Account', icon: User },
    { value: 'hosting', label: 'Hosting', icon: CreditCard },
    { value: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <FeatureRouteGuard flag="hosting_marketplace">
    <MobileRefreshPage onRefresh={() => {
      queryClient.invalidateQueries({ queryKey: ['myProfile', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['userSettings', user?.email] });
    }}>
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div
        className="sticky z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]"
        style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-[#06B6D4]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#E8EEF9]">Host Settings</h1>
              <p className="text-xs text-[#6B7A94]">Manage your host account</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
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
                    <p className="text-sm text-[#6B7A94]">Display / Business Name</p>
                    <p className="text-[#E8EEF9]">{profile?.display_name || 'Not set'}</p>
                  </div>
                  <CCButton variant="outline" size="sm" onClick={() => { setEditingName(profile?.display_name || ''); setShowNameModal(true); }}>
                    Edit
                  </CCButton>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-[#6B7A94]">Account Type</p>
                    <p className="text-[#E8EEF9]">Host</p>
                  </div>
                </div>
              </div>
            </CCCard>

            <CCCard padding="lg">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Security</h3>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-[#6B7A94]" />
                  <div>
                    <p className="text-[#E8EEF9]">Password</p>
                    <p className="text-sm text-[#6B7A94]">Managed via your login provider</p>
                  </div>
                </div>
                <CCButton variant="outline" size="sm" onClick={() => toast.info('Password management is handled by your login provider.')}>
                  Change
                </CCButton>
              </div>
            </CCCard>

            <CCCard padding="lg" className="border-[#EF4444]/30">
              <h3 className="text-lg font-semibold text-[#EF4444] mb-4">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#E8EEF9]">Delete Account</p>
                  <p className="text-sm text-[#6B7A94]">Anonymize and deactivate your account.</p>
                </div>
                <CCButton variant="danger" size="sm" icon={Trash2} onClick={() => setShowDeleteModal(true)}>
                  Delete
                </CCButton>
              </div>
            </CCCard>
          </div>
        </CCTabsContent>

        {/* Hosting Tab */}
        <CCTabsContent value="hosting" activeTab={activeTab}>
          <HostPricingSettings user={user} />
        </CCTabsContent>

        {/* Notifications Tab */}
        <CCTabsContent value="notifications" activeTab={activeTab}>
          <NotificationPreferences user={user} />
        </CCTabsContent>

        {/* Logout */}
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
      <CCModal isOpen={showNameModal} onClose={() => setShowNameModal(false)} title="Edit Display Name">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Display / Business Name</label>
            <input
              type="text"
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              placeholder="Your name or business name"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setShowNameModal(false)}>Cancel</CCButton>
            <CCButton variant="primary" onClick={() => updateNameMutation.mutate(editingName)} loading={updateNameMutation.isPending}>
              Save
            </CCButton>
          </div>
        </div>
      </CCModal>

      <DeleteAccountFlow isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} userEmail={user?.email} />
      </div>
    </MobileRefreshPage>
    </FeatureRouteGuard>
  );
}