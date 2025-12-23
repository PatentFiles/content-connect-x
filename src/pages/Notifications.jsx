import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Bell, MessageCircle, Briefcase, FileText, Users, CheckCircle, Check, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import AccessGate from '@/components/auth/AccessGate';
import { toast } from 'sonner';

const notificationIcons = {
  message: MessageCircle,
  collaboration_invite: Briefcase,
  collaboration_status: Briefcase,
  contract_sent: FileText,
  contract_signed: FileText,
  representation_invite: Users,
  roster_invite: Users,
  verification_approved: CheckCircle,
  verification_rejected: CheckCircle,
};

export default function Notifications() {
  const [filter, setFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['allNotifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_id: user?.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['allNotifications']);
      queryClient.invalidateQueries(['notifications']);
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allNotifications']);
      queryClient.invalidateQueries(['notifications']);
      toast.success('All notifications marked as read');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['allNotifications']);
      queryClient.invalidateQueries(['notifications']);
      toast.success('Notification deleted');
    },
  });

  if (userLoading) {
    return <CCLoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <AccessGate type="both" />;
  }

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.type === filter);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Header */}
      <div className="sticky top-16 z-30 bg-[#0B0F14]/95 backdrop-blur-xl border-b border-[#263248]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
                <Bell className="w-5 h-5 text-[#4F8CFF]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#E8EEF9]">Notifications</h1>
                <p className="text-xs text-[#6B7A94]">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <CCButton
                variant="outline"
                size="sm"
                icon={Check}
                onClick={() => markAllAsReadMutation.mutate()}
                loading={markAllAsReadMutation.isPending}
              >
                Mark all read
              </CCButton>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['all', 'unread', 'message', 'collaboration_invite', 'contract_sent'].map((f) => (
              <CCButton
                key={f}
                variant={filter === f ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : 
                 f === 'unread' ? 'Unread' :
                 f === 'message' ? 'Messages' :
                 f === 'collaboration_invite' ? 'Invites' :
                 f === 'contract_sent' ? 'Contracts' : f}
              </CCButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {notificationsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <CCCard key={i} padding="lg">
                <div className="animate-pulse flex gap-3">
                  <div className="w-10 h-10 bg-[#263248] rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[#263248] rounded w-3/4" />
                    <div className="h-3 bg-[#263248] rounded w-1/2" />
                  </div>
                </div>
              </CCCard>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <CCEmpty
            icon={Bell}
            title="No notifications"
            description={filter === 'unread' ? "You're all caught up!" : "No notifications to show"}
          />
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || Bell;
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CCCard
                    padding="lg"
                    className={!notification.read ? 'border-[#4F8CFF]/30 bg-[#4F8CFF]/5' : ''}
                  >
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        !notification.read ? 'bg-[#4F8CFF]/20' : 'bg-[#263248]'
                      }`}>
                        <Icon className={`w-6 h-6 ${!notification.read ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className={`font-semibold ${!notification.read ? 'text-[#E8EEF9]' : 'text-[#9AA6BC]'}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-[#4F8CFF] rounded-full flex-shrink-0 mt-2" />
                          )}
                        </div>
                        
                        <p className="text-sm text-[#9AA6BC] mb-3">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-[#6B7A94]">
                            {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                          </p>
                          
                          <div className="flex gap-2">
                            {notification.action_url && (
                              <Link to={notification.action_url}>
                                <CCButton
                                  variant="primary"
                                  size="sm"
                                  onClick={() => !notification.read && markAsReadMutation.mutate(notification.id)}
                                >
                                  View
                                </CCButton>
                              </Link>
                            )}
                            {!notification.read && (
                              <CCButton
                                variant="outline"
                                size="sm"
                                icon={Check}
                                onClick={() => markAsReadMutation.mutate(notification.id)}
                              >
                                Mark read
                              </CCButton>
                            )}
                            <CCButton
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => deleteMutation.mutate(notification.id)}
                              className="text-[#EF4444] hover:bg-[#EF4444]/10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CCCard>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}