import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  LogOut,
  ChevronRight,
  Moon,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (isLoading) {
    return <CCLoadingScreen message="Loading settings..." />;
  }

  const currentSubscription = subscription[0];
  const currentProfile = profile[0];

  const tabs = [
    { value: 'account', label: 'Account', icon: User },
    { value: 'privacy', label: 'Privacy', icon: Shield },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'subscription', label: 'Subscription', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
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
                    <p className="text-sm text-[#6B7A94]">Full Name</p>
                    <p className="text-[#E8EEF9]">{user?.full_name || 'Not set'}</p>
                  </div>
                  <CCButton variant="outline" size="sm">Edit</CCButton>
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
                      <p className="text-sm text-[#6B7A94]">Last changed: Never</p>
                    </div>
                  </div>
                  <CCButton variant="outline" size="sm">Change</CCButton>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-[#6B7A94]" />
                    <div>
                      <p className="text-[#E8EEF9]">Two-Factor Authentication</p>
                      <p className="text-sm text-[#6B7A94]">Not enabled</p>
                    </div>
                  </div>
                  <CCButton variant="outline" size="sm">Enable</CCButton>
                </div>
              </div>
            </CCCard>

            <CCCard padding="lg" className="border-[#EF4444]/30">
              <h3 className="text-lg font-semibold text-[#EF4444] mb-4">Danger Zone</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#E8EEF9]">Delete Account</p>
                  <p className="text-sm text-[#6B7A94]">Permanently delete your account and all data</p>
                </div>
                <CCButton 
                  variant="danger" 
                  size="sm" 
                  icon={Trash2}
                  onClick={() => setShowDeleteModal(true)}
                >
                  Delete
                </CCButton>
              </div>
            </CCCard>
          </div>
        </CCTabsContent>

        {/* Privacy Tab */}
        <CCTabsContent value="privacy" activeTab={activeTab}>
          <CCCard padding="lg">
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Privacy Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-[#263248]">
                <div>
                  <p className="text-[#E8EEF9]">Profile Visibility</p>
                  <p className="text-sm text-[#6B7A94]">Who can see your profile</p>
                </div>
                <CCBadge variant="primary">Verified Members</CCBadge>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[#263248]">
                <div>
                  <p className="text-[#E8EEF9]">Show Location</p>
                  <p className="text-sm text-[#6B7A94]">Display your location on profile</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#263248] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4F8CFF]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F8CFF]"></div>
                </label>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-[#263248]">
                <div>
                  <p className="text-[#E8EEF9]">Show Online Status</p>
                  <p className="text-sm text-[#6B7A94]">Let others see when you're online</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#263248] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4F8CFF]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F8CFF]"></div>
                </label>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[#E8EEF9]">Message Requests</p>
                  <p className="text-sm text-[#6B7A94]">Require approval before receiving messages</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#263248] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4F8CFF]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F8CFF]"></div>
                </label>
              </div>
            </div>
          </CCCard>
        </CCTabsContent>

        {/* Notifications Tab */}
        <CCTabsContent value="notifications" activeTab={activeTab}>
          <CCCard padding="lg">
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { title: 'New Messages', desc: 'Get notified when you receive messages' },
                { title: 'Deal Room Updates', desc: 'Updates on your deal rooms' },
                { title: 'Contract Signatures', desc: 'When contracts are signed' },
                { title: 'Profile Views', desc: 'When someone views your profile' },
                { title: 'Marketing', desc: 'News and updates from Content Connect' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-[#263248] last:border-0">
                  <div>
                    <p className="text-[#E8EEF9]">{item.title}</p>
                    <p className="text-sm text-[#6B7A94]">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked={i < 4} className="sr-only peer" />
                    <div className="w-11 h-6 bg-[#263248] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#4F8CFF]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F8CFF]"></div>
                  </label>
                </div>
              ))}
            </div>
          </CCCard>
        </CCTabsContent>

        {/* Subscription Tab */}
        <CCTabsContent value="subscription" activeTab={activeTab}>
          <CCCard padding="lg">
            <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Current Plan</h3>
            {currentSubscription ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#121824] rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-[#E8EEF9] capitalize">
                        {currentSubscription.plan_id?.replace(/_/g, ' ')}
                      </p>
                      <CCBadge 
                        variant={currentSubscription.status === 'active' ? 'success' : 'warning'}
                        className="mt-1"
                      >
                        {currentSubscription.status}
                      </CCBadge>
                    </div>
                    <CCButton variant="outline" size="sm">Change Plan</CCButton>
                  </div>
                  <div className="text-sm text-[#9AA6BC]">
                    {currentSubscription.renews_at && (
                      <p>Renews: {new Date(currentSubscription.renews_at).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                <CCButton variant="outline" fullWidth>
                  Manage Billing
                </CCButton>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-[#9AA6BC] mb-4">No active subscription</p>
                <CCButton variant="primary">Subscribe Now</CCButton>
              </div>
            )}
          </CCCard>
        </CCTabsContent>

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

      {/* Delete Account Modal */}
      <CCModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
      >
        <div className="space-y-4">
          <p className="text-[#9AA6BC]">
            Are you sure you want to delete your account? This action cannot be undone. All your data, including profile, messages, contracts, and galleries will be permanently deleted.
          </p>
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </CCButton>
            <CCButton variant="danger">
              Delete My Account
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}