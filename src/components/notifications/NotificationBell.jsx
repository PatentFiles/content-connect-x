import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Bell, MessageCircle, Briefcase, FileText, Users, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CCBadge from '../ui-custom/CCBadge';
import { formatDistanceToNow } from 'date-fns';

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

export default function NotificationBell({ user }) {
  const [open, setOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_id: user?.email }, '-created_date', 10),
    enabled: !!user?.email,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { read_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
    },
  });

  const unreadCount = notifications.filter(n => !n.read_at).length;

  const handleNotificationClick = (notification) => {
    if (!notification.read_at) {
      markAsReadMutation.mutate(notification.id);
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-[#151D2B] transition-colors"
      >
        <Bell className="w-5 h-5 text-[#9AA6BC]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-[#EF4444] text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-80 bg-[#151D2B] border border-[#263248] rounded-lg shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-[#263248] flex items-center justify-between">
                <h3 className="font-semibold text-[#E8EEF9]">Notifications</h3>
                <Link
                  to={createPageUrl('Notifications')}
                  onClick={() => setOpen(false)}
                  className="text-xs text-[#4F8CFF] hover:underline"
                >
                  View All
                </Link>
              </div>

              <div className="overflow-y-auto flex-1">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-12 h-12 text-[#6B7A94] mx-auto mb-2" />
                    <p className="text-sm text-[#6B7A94]">No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = notificationIcons[notification.type] || Bell;
                    return (
                      <Link
                        key={notification.id}
                        to={notification.action_url || createPageUrl('Notifications')}
                        onClick={() => handleNotificationClick(notification)}
                        className={`block p-4 border-b border-[#263248] hover:bg-[#1A2438] transition-colors ${
                          !notification.read_at ? 'bg-[#4F8CFF]/5' : ''
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            !notification.read_at ? 'bg-[#4F8CFF]/20' : 'bg-[#263248]'
                          }`}>
                            <Icon className={`w-5 h-5 ${!notification.read_at ? 'text-[#4F8CFF]' : 'text-[#6B7A94]'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium mb-1 ${!notification.read_at ? 'text-[#E8EEF9]' : 'text-[#9AA6BC]'}`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-[#6B7A94] line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-[#6B7A94] mt-1">
                              {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                            </p>
                          </div>
                          {!notification.read_at && (
                            <div className="w-2 h-2 bg-[#4F8CFF] rounded-full flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}