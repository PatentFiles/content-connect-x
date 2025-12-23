import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { 
  Plus, 
  CheckCircle2, 
  FileText, 
  Calendar, 
  Users, 
  MessageCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import CCCard from '../ui-custom/CCCard';
import CCBadge from '../ui-custom/CCBadge';

const activityIcons = {
  created: Plus,
  status_changed: AlertCircle,
  task_added: CheckCircle2,
  task_completed: CheckCircle2,
  document_uploaded: FileText,
  event_scheduled: Calendar,
  member_added: Users,
  comment_added: MessageCircle,
  contract_sent: FileText,
};

const activityColors = {
  created: 'success',
  status_changed: 'warning',
  task_added: 'primary',
  task_completed: 'success',
  document_uploaded: 'primary',
  event_scheduled: 'accent',
  member_added: 'primary',
  comment_added: 'default',
  contract_sent: 'accent',
};

export default function ActivityFeed({ collaborationId }) {
  const { data: activities = [] } = useQuery({
    queryKey: ['collaborationActivities', collaborationId],
    queryFn: () => base44.entities.CollaborationActivity.filter({ collaboration_id: collaborationId }, '-created_date', 50),
    enabled: !!collaborationId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['activityProfiles'],
    queryFn: async () => {
      const userIds = [...new Set(activities.map(a => a.user_id))];
      if (!userIds.length) return [];
      return await Promise.all(
        userIds.map(id => base44.entities.UserProfile.filter({ user_id: id }).then(p => p[0]))
      );
    },
    enabled: activities.length > 0,
  });

  const getProfileByUserId = (userId) => {
    return profiles.find(p => p?.user_id === userId);
  };

  if (activities.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Activity Feed</h3>
        <CCCard padding="lg" className="text-center">
          <Activity className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-sm text-[#9AA6BC]">No activity yet</p>
        </CCCard>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Activity Feed</h3>
      <div className="space-y-3">
        {activities.map((activity, index) => {
          const Icon = activityIcons[activity.activity_type] || Activity;
          const profile = getProfileByUserId(activity.user_id);
          
          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-[#4F8CFF]" />
                  </div>
                  {index < activities.length - 1 && (
                    <div className="w-px bg-[#263248] flex-1 mt-2" />
                  )}
                </div>
                
                <div className="flex-1 pb-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className="text-sm font-medium text-[#E8EEF9]">
                        {profile?.display_name || 'Someone'}
                      </span>
                      <span className="text-sm text-[#9AA6BC] ml-2">
                        {activity.description}
                      </span>
                    </div>
                    <CCBadge variant={activityColors[activity.activity_type]} size="sm">
                      {activity.activity_type.replace('_', ' ')}
                    </CCBadge>
                  </div>
                  <p className="text-xs text-[#6B7A94]">
                    {formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}