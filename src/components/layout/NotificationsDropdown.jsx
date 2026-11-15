import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, MessageCircle, FileText, Briefcase, Eye, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';
import { toast } from 'sonner';

const notificationIcons = {
  message: MessageCircle,
  deal_room: Briefcase,
  contract: FileText,
  profile_view: Eye,
  system: AlertCircle,
};

export default function NotificationsDropdown({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('Notification deleted');
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      toast.success('All marked as read');
    },
  });

  return (
    <div className="relative">
      <CCButton 
        variant="ghost" 
        size="icon" 
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF2DAA] rounded-full" />
        )}
      </CCButton>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-[#151D2B] border border-[#263248] rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#263248] flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-[#E8EEF9]">Notifications</h3>
                  {unreadCount > 0 && (
                    <p className="text-xs text-[#6B7A94]">{unreadCount} unread</p>
                  )}
                </div>
                {notifications.length > 0 && (
                  <CCButton
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    loading={markAllAsReadMutation.isPending}
                  >
                    Mark all read
                  </CCButton>
                )}
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-[#6B7A94] opacity-50" />
                    <p className="text-[#9AA6BC] text-sm">No notifications yet</p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((notification) => {
                      const Icon = notificationIcons[notification.type] || AlertCircle;
                      return (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-[#263248] hover:bg-[#1A2438] transition-colors ${
                            !notification.is_read ? 'bg-[#4F8CFF]/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              notification.type === 'message' ? 'bg-[#4F8CFF]/20 text-[#4F8CFF]' :
                              notification.type === 'deal_room' ? 'bg-[#FF2DAA]/20 text-[#FF2DAA]' :
                              notification.type === 'contract' ? 'bg-[#22C55E]/20 text-[#22C55E]' :
                              'bg-[#263248] text-[#9AA6BC]'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="font-medium text-[#E8EEF9] text-sm">{notification.title}</p>
                                  <p className="text-sm text-[#9AA6BC] mt-1 line-clamp-2">{notification.message}</p>
                                  <p className="text-xs text-[#6B7A94] mt-2">
                                    {new Date(notification.created_date).toLocaleString()}
                                  </p>
                                </div>
                                {!notification.is_read && (
                                  <CCBadge variant="accent" size="sm">New</CCBadge>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 mt-3">
                                {notification.link && (
                                  <Link 
                                    to={notification.link}
                                    onClick={() => {
                                      markAsReadMutation.mutate(notification.id);
                                      setIsOpen(false);
                                    }}
                                  >
                                    <CCButton variant="outline" size="sm">
                                      View
                                    </CCButton>
                                  </Link>
                                )}
                                {!notification.is_read && (
                                  <CCButton
                                    variant="ghost"
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
                                  className="text-[#EF4444] hover:text-[#EF4444]"
                                >
                                  Delete
                                </CCButton>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}