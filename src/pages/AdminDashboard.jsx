import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  Tag,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Ban
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import CCModal from '@/components/ui-custom/CCModal';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';

// User Management Component
function UserManagement({ currentUser }) {
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date'),
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['allProfilesForUsers'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: ({ userId, currentRole }) => {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      return base44.entities.User.update(userId, { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allUsers']);
    },
  });

  const getProfileForUser = (email) => allProfiles.find(p => p.user_id === email);

  const filteredUsers = allUsers.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const profile = getProfileForUser(u.email);
    return u.email?.toLowerCase().includes(q) ||
           u.full_name?.toLowerCase().includes(q) ||
           profile?.display_name?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
        <input
          type="text"
          placeholder="Search users by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
        />
      </div>

      {usersLoading ? (
        <div className="text-center py-8 text-[#9AA6BC]">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <CCEmpty
          icon={Users}
          title="No users found"
          description={searchQuery ? 'Try different search terms.' : 'No users registered yet.'}
        />
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const profile = getProfileForUser(user.email);
            const isCurrentUser = user.email === currentUser.email;
            
            return (
              <CCCard key={user.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CCAvatar src={profile?.avatar_url} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-[#E8EEF9]">
                          {profile?.display_name || user.full_name || 'No name'}
                        </p>
                        {user.role === 'admin' && (
                          <CCBadge variant="warning" size="sm">Admin</CCBadge>
                        )}
                      </div>
                      <p className="text-sm text-[#6B7A94]">{user.email}</p>
                      {profile?.role_type && profile.role_type !== 'admin' && (
                        <CCBadge variant="accent" size="sm" className="mt-1">
                          {profile.role_type}
                        </CCBadge>
                      )}
                    </div>
                  </div>
                  {!isCurrentUser && (
                    <CCButton
                      variant={user.role === 'admin' ? 'warning' : 'primary'}
                      size="sm"
                      onClick={() => toggleAdminMutation.mutate({ 
                        userId: user.id, 
                        currentRole: user.role 
                      })}
                      loading={toggleAdminMutation.isPending}
                    >
                      {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </CCButton>
                  )}
                  {isCurrentUser && (
                    <CCBadge variant="primary" size="sm">You</CCBadge>
                  )}
                </div>
              </CCCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('verifications');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const queryClient = useQueryClient();

  // Check if admin
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profile = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const isAdmin = profile[0]?.is_admin || profile[0]?.role_type === 'admin' || user?.role === 'admin';

  // Fetch pending verifications
  const { data: pendingVerifications = [], isLoading: verificationsLoading } = useQuery({
    queryKey: ['pendingVerifications'],
    queryFn: () => base44.entities.VerificationRecord.filter({ status: 'pending' }),
    enabled: isAdmin,
  });

  // Fetch pending tags
  const { data: pendingTags = [] } = useQuery({
    queryKey: ['pendingTags'],
    queryFn: () => base44.entities.Tag.filter({ status: 'pending' }),
    enabled: isAdmin,
  });

  // Fetch reports
  const { data: reports = [] } = useQuery({
    queryKey: ['pendingReports'],
    queryFn: () => base44.entities.Report.filter({ status: 'pending' }),
    enabled: isAdmin,
  });

  // Fetch total users count
  const { data: allUsers = [] } = useQuery({
    queryKey: ['totalUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });
  const totalUsersCount = allUsers.length;

  // Fetch user profiles for verifications
  const { data: userProfiles = [] } = useQuery({
    queryKey: ['verificationProfiles', pendingVerifications],
    queryFn: async () => {
      const userIds = pendingVerifications.map(v => v.user_id);
      const profiles = await base44.entities.UserProfile.list();
      return profiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: pendingVerifications.length > 0,
  });

  // Approve verification mutation
  const approveVerificationMutation = useMutation({
    mutationFn: (id) => base44.entities.VerificationRecord.update(id, {
      status: 'approved',
      verified_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingVerifications']);
      setSelectedVerification(null);
    },
  });

  // Reject verification mutation
  const rejectVerificationMutation = useMutation({
    mutationFn: ({ id, reason }) => base44.entities.VerificationRecord.update(id, {
      status: 'rejected',
      rejection_reason: reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingVerifications']);
      setSelectedVerification(null);
    },
  });

  // Approve tag mutation
  const approveTagMutation = useMutation({
    mutationFn: (id) => base44.entities.Tag.update(id, { status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingTags']);
    },
  });

  // Block tag mutation
  const blockTagMutation = useMutation({
    mutationFn: (id) => base44.entities.Tag.update(id, { status: 'blocked' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pendingTags']);
    },
  });

  if (userLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <CCCard padding="xl" className="text-center max-w-md">
          <Shield className="w-16 h-16 text-[#EF4444] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-2">Access Denied</h1>
          <p className="text-[#9AA6BC]">You don't have permission to access the admin dashboard.</p>
        </CCCard>
      </div>
    );
  }

  const tabs = [
    { value: 'verifications', label: 'Verifications', icon: Shield },
    { value: 'tags', label: 'Tags', icon: Tag },
    { value: 'reports', label: 'Reports', icon: AlertTriangle },
    { value: 'users', label: 'Users', icon: Users },
  ];

  const getProfileForVerification = (v) => userProfiles.find(p => p.user_id === v.user_id);

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EF4444]/20 to-[#F59E0B]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#E8EEF9]">Admin Dashboard</h1>
              <p className="text-xs text-[#6B7A94]">Platform management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{pendingVerifications.length}</p>
                <p className="text-xs text-[#6B7A94]">Pending Verifications</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
                <Tag className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{pendingTags.length}</p>
                <p className="text-xs text-[#6B7A94]">Pending Tags</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EF4444]/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{reports.length}</p>
                <p className="text-xs text-[#6B7A94]">Open Reports</p>
              </div>
            </div>
          </CCCard>
          <CCCard padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#E8EEF9]">{totalUsersCount}</p>
                <p className="text-xs text-[#6B7A94]">Total Users</p>
              </div>
            </div>
          </CCCard>
        </div>

        <CCTabsList tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

        {/* Verifications Tab */}
        <CCTabsContent value="verifications" activeTab={activeTab}>
          {verificationsLoading ? (
            <div className="text-center py-8 text-[#9AA6BC]">Loading...</div>
          ) : pendingVerifications.length === 0 ? (
            <CCEmpty
              icon={CheckCircle}
              title="All caught up!"
              description="No pending verifications to review."
            />
          ) : (
            <div className="space-y-4">
              {pendingVerifications.map((v) => {
                const profile = getProfileForVerification(v);
                return (
                  <CCCard key={v.id} padding="lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CCAvatar src={profile?.avatar_url} size="lg" />
                        <div>
                          <p className="font-medium text-[#E8EEF9]">{profile?.display_name || v.user_id}</p>
                          <p className="text-sm text-[#6B7A94]">{v.user_id}</p>
                          <p className="text-xs text-[#6B7A94]">
                            Submitted: {new Date(v.created_date).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <CCButton
                          variant="outline"
                          size="sm"
                          icon={Eye}
                          onClick={() => setSelectedVerification(v)}
                        >
                          Review
                        </CCButton>
                        <CCButton
                          variant="success"
                          size="sm"
                          icon={CheckCircle}
                          onClick={() => approveVerificationMutation.mutate(v.id)}
                          loading={approveVerificationMutation.isPending}
                        >
                          Approve
                        </CCButton>
                        <CCButton
                          variant="danger"
                          size="sm"
                          icon={XCircle}
                          onClick={() => rejectVerificationMutation.mutate({ id: v.id, reason: 'Documents unclear' })}
                        >
                          Reject
                        </CCButton>
                      </div>
                    </div>
                  </CCCard>
                );
              })}
            </div>
          )}
        </CCTabsContent>

        {/* Tags Tab */}
        <CCTabsContent value="tags" activeTab={activeTab}>
          {pendingTags.length === 0 ? (
            <CCEmpty
              icon={Tag}
              title="No pending tags"
              description="All user-submitted tags have been reviewed."
            />
          ) : (
            <div className="space-y-3">
              {pendingTags.map((tag) => (
                <CCCard key={tag.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <CCBadge variant="outline" size="lg">{tag.tag_text}</CCBadge>
                      <p className="text-sm text-[#6B7A94] mt-1">
                        Category: {tag.category} • Submitted by: {tag.created_by_user_id}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <CCButton
                        variant="success"
                        size="sm"
                        onClick={() => approveTagMutation.mutate(tag.id)}
                      >
                        Approve
                      </CCButton>
                      <CCButton
                        variant="danger"
                        size="sm"
                        onClick={() => blockTagMutation.mutate(tag.id)}
                      >
                        Block
                      </CCButton>
                    </div>
                  </div>
                </CCCard>
              ))}
            </div>
          )}
        </CCTabsContent>

        {/* Reports Tab */}
        <CCTabsContent value="reports" activeTab={activeTab}>
          {reports.length === 0 ? (
            <CCEmpty
              icon={AlertTriangle}
              title="No open reports"
              description="All reports have been handled."
            />
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <CCCard key={report.id} padding="lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <CCBadge 
                        variant={report.reason === 'harassment' ? 'danger' : 'warning'}
                        className="mb-2"
                      >
                        {report.reason}
                      </CCBadge>
                      <p className="text-[#E8EEF9]">{report.details}</p>
                      <p className="text-sm text-[#6B7A94] mt-2">
                        Reporter: {report.reporter_id} • Target: {report.target_user_id}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <CCButton variant="outline" size="sm" icon={Eye}>
                        Investigate
                      </CCButton>
                      <CCButton variant="danger" size="sm" icon={Ban}>
                        Ban User
                      </CCButton>
                    </div>
                  </div>
                </CCCard>
              ))}
            </div>
          )}
        </CCTabsContent>

        {/* Users Tab */}
        <CCTabsContent value="users" activeTab={activeTab}>
          <UserManagement currentUser={user} />
        </CCTabsContent>
      </div>

      {/* Verification Review Modal */}
      <CCModal
        isOpen={!!selectedVerification}
        onClose={() => setSelectedVerification(null)}
        title="Review Verification"
        size="lg"
      >
        {selectedVerification && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {selectedVerification.documents_submitted?.map((doc, i) => (
                <div key={i} className="text-center">
                  <p className="text-sm text-[#6B7A94] mb-2 capitalize">{doc.type}</p>
                  <img 
                    src={doc.url} 
                    alt={doc.type}
                    className="w-full h-48 object-cover rounded-lg bg-[#121824]"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end pt-4 border-t border-[#263248]">
              <CCButton 
                variant="danger" 
                onClick={() => rejectVerificationMutation.mutate({ 
                  id: selectedVerification.id, 
                  reason: 'Documents unclear or do not match' 
                })}
              >
                Reject
              </CCButton>
              <CCButton 
                variant="success"
                onClick={() => approveVerificationMutation.mutate(selectedVerification.id)}
                loading={approveVerificationMutation.isPending}
              >
                Approve
              </CCButton>
            </div>
          </div>
        )}
      </CCModal>
    </div>
  );
}