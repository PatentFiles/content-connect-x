import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  BellOff, 
  Check, 
  Trash2,
  MessageCircle,
  Users,
  FileText,
  AlertTriangle,
  Shield,
  Calendar,
  CheckCircle,
  Unlock
} from 'lucide-react';
import { motion } from 'framer-motion';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import PullToRefresh from '@/components/ui-custom/PullToRefresh';
import { toast } from 'sonner';

export default function Notifications() {
  const [activeTab, setActiveTab] = useState('all');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_id: user?.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['notificationProfiles'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const notifQueryKey = ['notifications', user?.email];

  const markAsReadMutation = useMutation({
    mutationFn: (notificationId) =>
      base44.entities.Notification.update(notificationId, { read_at: new Date().toISOString() }),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notifQueryKey });
      const previous = queryClient.getQueryData(notifQueryKey);
      queryClient.setQueryData(notifQueryKey, (old = []) =>
        old.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(notifQueryKey, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notifQueryKey }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read_at);
      await Promise.all(
        unread.map(n =>
          base44.entities.Notification.update(n.id, { read_at: new Date().toISOString() })
        )
      );
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notifQueryKey });
      const previous = queryClient.getQueryData(notifQueryKey);
      const now = new Date().toISOString();
      queryClient.setQueryData(notifQueryKey, (old = []) =>
        old.map(n => n.read_at ? n : { ...n, read_at: now })
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(notifQueryKey, ctx.previous);
    },
    onSuccess: () => toast.success('All notifications marked as read'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notifQueryKey }),
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (notificationId) => base44.entities.Notification.delete(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notifQueryKey });
      const previous = queryClient.getQueryData(notifQueryKey);
      queryClient.setQueryData(notifQueryKey, (old = []) =>
        old.filter(n => n.id !== notificationId)
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(notifQueryKey, ctx.previous);
      toast.error('Failed to delete notification');
    },
    onSuccess: () => toast.success('Notification deleted'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notifQueryKey }),
  });

  const grantGalleryAccessMutation = useMutation({
    mutationFn: async ({ actorUserId, notificationId }) => {
      // Find all galleries for the current user
      const galleries = await base44.entities.Gallery.filter({ user_id: user.email });
      const privateGallery = galleries.find(g => g.type === 'private');
      if (privateGallery) {
        await base44.entities.GalleryPermission.create({
          owner_id: user.email,
          gallery_id: privateGallery.id,
          granted_to_user_id: actorUserId,
          status: 'granted',
          granted_at: new Date().toISOString(),
        });
      }
      // Mark notification as read and update title
      await base44.entities.Notification.update(notificationId, { 
        read_at: new Date().toISOString(),
        title: 'Private Gallery Access Request (Accepted)',
      });
      // Send notification to requester
      await base44.entities.Notification.create({
        user_id: actorUserId,
        type: 'messages',
        actor_user_id: user.email,
        title: 'Private Gallery Access Granted',
        body: 'Your request to view the private gallery has been accepted.',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Gallery access granted!');
    },
  });

  const getProfileByEmail = (email) => profiles.find(p => p.user_id === email);

  const typeIcons = {
    messages: MessageCircle,
    collaboration_invites: Users,
    role_changes: Shield,
    contract_updates: FileText,
    testing_deadlines: Calendar,
    dispute_updates: AlertTriangle,
    representation_actions: Shield,
    verification_status: CheckCircle,
    system_announcements: Bell,
  };

  const typeColors = {
    messages: 'primary',
    collaboration_invites: 'accent',
    role_changes: 'warning',
    contract_updates: 'primary',
    testing_deadlines: 'danger',
    dispute_updates: 'danger',
    representation_actions: 'success',
    verification_status: 'success',
    system_announcements: 'outline',
  };

  const filteredNotifications = activeTab === 'all' 
    ? notifications 
    : notifications.filter(n => !n.read_at);

  const unreadCount = notifications.filter(n => !n.read_at).length;

  if (isLoading) {
    return <CCLoadingScreen message="Loading notifications..." />;
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Notifications</h1>
                <p className="text-xs text-[#6B7A94]">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <CCButton
                variant="outline"
                size="sm"
                icon={Check}
                onClick={() => markAllReadMutation.mutate()}
                loading={markAllReadMutation.isPending}
              >
                Mark All Read
              </CCButton>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <PullToRefresh
        className="max-w-4xl mx-auto"
        scrollable={false}
        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['notifications', user?.email] })}
      >
      <div className="px-4 py-6">
        {/* Tabs */}
        <CCTabsList
          tabs={[
            { value: 'all', label: `All (${notifications.length})`, icon: Bell },
            { value: 'unread', label: `Unread (${unreadCount})`, icon: BellOff },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="mb-6"
        />

        {/* Notifications List */}
        <CCTabsContent value={activeTab} activeTab={activeTab}>
          {filteredNotifications.length === 0 ? (
            <CCEmpty
              icon={BellOff}
              title={activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
              description={activeTab === 'unread' ? "You're all caught up!" : "You haven't received any notifications yet."}
            />
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const actorProfile = getProfileByEmail(notification.actor_user_id);
                const isUnread = !notification.read_at;

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <CCCard
                      padding="lg"
                      hover
                      clickable
                      onClick={() => {
                        if (isUnread) {
                          markAsReadMutation.mutate(notification.id);
                        }
                        if (notification.action_url) {
                          window.location.href = notification.action_url;
                        }
                      }}
                      className={isUnread ? 'border-l-4 border-l-[#4F8CFF]' : ''}
                    >
                      <div className="flex gap-4">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-5 h-5 text-[#4F8CFF]" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <p className={`text-sm font-medium ${isUnread ? 'text-[#E8EEF9]' : 'text-[#9AA6BC]'}`}>
                              {notification.title}
                            </p>
                            {isUnread && (
                              <div className="w-2 h-2 rounded-full bg-[#4F8CFF] flex-shrink-0 mt-1" />
                            )}
                          </div>

                          <p className={`text-sm mb-2 ${isUnread ? 'text-[#9AA6BC]' : 'text-[#6B7A94]'}`}>
                            {notification.body}
                          </p>

                          <div className="flex items-center gap-2 flex-wrap">
                            <CCBadge variant={typeColors[notification.type] || 'outline'} size="sm">
                              {notification.type.replace(/_/g, ' ')}
                            </CCBadge>
                            {actorProfile && (
                              <span className="text-xs text-[#6B7A94]">
                                by {actorProfile.display_name}
                              </span>
                            )}
                            <span className="text-xs text-[#6B7A94]">
                              • {new Date(notification.created_date).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-start gap-2 flex-shrink-0">
                          {notification.title?.includes('Private Gallery Access Request') && !notification.title?.includes('Accepted') && notification.actor_user_id && (
                            <CCButton
                              variant="success"
                              size="sm"
                              icon={Unlock}
                              onClick={(e) => {
                                e.stopPropagation();
                                grantGalleryAccessMutation.mutate({
                                  actorUserId: notification.actor_user_id,
                                  notificationId: notification.id,
                                });
                              }}
                              loading={grantGalleryAccessMutation.isPending}
                            >
                              Accept
                            </CCButton>
                          )}
                          {isUnread && (
                            <CCButton
                              variant="ghost"
                              size="icon"
                              icon={Check}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsReadMutation.mutate(notification.id);
                              }}
                            />
                          )}
                          <CCButton
                            variant="ghost"
                            size="icon"
                            icon={Trash2}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            className="text-[#EF4444] hover:bg-[#EF4444]/10"
                          />
                        </div>
                      </div>
                    </CCCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CCTabsContent>
      </div>
      </PullToRefresh>
    </div>
  );
}