import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, ShieldCheck, Crown, ChevronDown, ChevronUp, Eye, Ban, UserX } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import CCBadge from '../ui-custom/CCBadge';
import CCAvatar from '../ui-custom/CCAvatars';
import CCEmpty from '../ui-custom/CCEmpty';
import { toast } from 'sonner';

export default function UserManager({ currentUser }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUserId, setExpandedUserId] = useState(null);
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['allProfiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date'),
  });

  const { data: verifications = [] } = useQuery({
    queryKey: ['allVerifications'],
    queryFn: () => base44.entities.VerificationRecord.list(),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['allSubscriptions'],
    queryFn: () => base44.entities.Subscription.list(),
  });

  const { data: creatorDetails = [] } = useQuery({
    queryKey: ['allCreatorDetails'],
    queryFn: () => base44.entities.CreatorDetails.list(),
    enabled: expandedUserId !== null,
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({ id, isAdmin }) => base44.entities.UserProfile.update(id, { is_admin: !isAdmin }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allProfiles']);
      toast.success('Admin status updated');
    },
  });

  const getVerificationForUser = (userId) => verifications.find(v => v.user_id === userId);
  const getSubscriptionForUser = (userId) => subscriptions.find(s => s.user_id === userId);
  const getCreatorDetailsForUser = (userId) => creatorDetails.find(d => d.user_id === userId);

  const filteredProfiles = profiles.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.display_name?.toLowerCase().includes(q) ||
           p.user_id?.toLowerCase().includes(q) ||
           p.role_type?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#E8EEF9]">User Management</h3>
          <p className="text-sm text-[#6B7A94]">{profiles.length} total users</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
        <input
          type="text"
          placeholder="Search by name, email, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 focus:border-[#4F8CFF] transition-all duration-200"
        />
      </div>

      {/* Users List */}
      {profilesLoading ? (
        <div className="text-center py-8 text-[#6B7A94]">Loading users...</div>
      ) : filteredProfiles.length === 0 ? (
        <CCEmpty
          icon={Users}
          title="No users found"
          description={searchQuery ? 'Try different search terms.' : 'No users registered yet.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredProfiles.map((profile) => {
            const isExpanded = expandedUserId === profile.user_id;
            const verification = getVerificationForUser(profile.user_id);
            const subscription = getSubscriptionForUser(profile.user_id);
            const details = getCreatorDetailsForUser(profile.user_id);

            return (
              <CCCard key={profile.id} padding="none">
                {/* Main row */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <CCAvatar
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        size="md"
                        verified={verification?.status === 'approved'}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-[#E8EEF9]">{profile.display_name || 'No name'}</h4>
                          {profile.is_admin && (
                            <CCBadge variant="warning" icon={Crown} size="sm">Admin</CCBadge>
                          )}
                        </div>
                        <p className="text-sm text-[#6B7A94]">{profile.user_id}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <CCBadge variant="accent" size="sm">{profile.role_type}</CCBadge>
                          <CCBadge 
                            variant={verification?.status === 'approved' ? 'success' : 'warning'} 
                            size="sm"
                          >
                            {verification?.status || 'No verification'}
                          </CCBadge>
                          <CCBadge
                            variant={subscription?.status === 'active' ? 'success' : 'default'}
                            size="sm"
                          >
                            {subscription?.status || 'No subscription'}
                          </CCBadge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {profile.user_id !== currentUser.email && (
                        <CCButton
                          variant={profile.is_admin ? 'warning' : 'primary'}
                          size="sm"
                          icon={Crown}
                          onClick={() => toggleAdminMutation.mutate({ id: profile.id, isAdmin: profile.is_admin })}
                          loading={toggleAdminMutation.isPending}
                        >
                          {profile.is_admin ? 'Remove Admin' : 'Make Admin'}
                        </CCButton>
                      )}
                      <CCButton
                        variant="ghost"
                        size="sm"
                        icon={isExpanded ? ChevronUp : ChevronDown}
                        onClick={() => setExpandedUserId(isExpanded ? null : profile.user_id)}
                      >
                        {isExpanded ? 'Hide' : 'Details'}
                      </CCButton>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[#263248] overflow-hidden"
                    >
                      <div className="p-4 bg-[#121824] space-y-4">
                        {/* Profile Details */}
                        <div>
                          <h5 className="text-sm font-medium text-[#E8EEF9] mb-2">Profile Details</h5>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-[#6B7A94]">Bio:</span>
                              <p className="text-[#E8EEF9]">{profile.bio || 'None'}</p>
                            </div>
                            <div>
                              <span className="text-[#6B7A94]">Location:</span>
                              <p className="text-[#E8EEF9]">
                                {profile.base_location?.city || 'Not set'}
                                {profile.base_location?.state && `, ${profile.base_location.state}`}
                              </p>
                            </div>
                            <div>
                              <span className="text-[#6B7A94]">Travel:</span>
                              <p className="text-[#E8EEF9]">{profile.travel_enabled ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                              <span className="text-[#6B7A94]">Last Active:</span>
                              <p className="text-[#E8EEF9]">
                                {profile.last_active_at ? new Date(profile.last_active_at).toLocaleString() : 'Never'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Verification Details */}
                        {verification && (
                          <div>
                            <h5 className="text-sm font-medium text-[#E8EEF9] mb-2">Verification</h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-[#6B7A94]">Status:</span>
                                <p className="text-[#E8EEF9] capitalize">{verification.status}</p>
                              </div>
                              <div>
                                <span className="text-[#6B7A94]">Provider:</span>
                                <p className="text-[#E8EEF9]">{verification.provider}</p>
                              </div>
                              {verification.verified_at && (
                                <div>
                                  <span className="text-[#6B7A94]">Verified:</span>
                                  <p className="text-[#E8EEF9]">{new Date(verification.verified_at).toLocaleDateString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Subscription Details */}
                        {subscription && (
                          <div>
                            <h5 className="text-sm font-medium text-[#E8EEF9] mb-2">Subscription</h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <span className="text-[#6B7A94]">Plan:</span>
                                <p className="text-[#E8EEF9]">{subscription.plan_id}</p>
                              </div>
                              <div>
                                <span className="text-[#6B7A94]">Status:</span>
                                <p className="text-[#E8EEF9] capitalize">{subscription.status}</p>
                              </div>
                              {subscription.renews_at && (
                                <div>
                                  <span className="text-[#6B7A94]">Renews:</span>
                                  <p className="text-[#E8EEF9]">{new Date(subscription.renews_at).toLocaleDateString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Creator Details */}
                        {profile.role_type === 'creator' && details && (
                          <div>
                            <h5 className="text-sm font-medium text-[#E8EEF9] mb-2">Creator Details</h5>
                            <div className="flex flex-wrap gap-2">
                              {details.tags?.map(tag => (
                                <CCBadge key={tag} variant="outline" size="sm">{tag}</CCBadge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CCCard>
            );
          })}
        </div>
      )}
    </div>
  );
}