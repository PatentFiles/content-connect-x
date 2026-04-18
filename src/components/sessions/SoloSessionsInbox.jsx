/**
 * SoloSessionsInbox
 *
 * Shows pending and upcoming solo sessions for either the host or guest role.
 * Used inside dashboard components — does not replace BookingRequestsInbox.
 * Feature-gated behind solo_sessions flag.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, CheckCircle, XCircle } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import CCBadge from '@/components/ui-custom/CCBadge';
import SoloSessionCard from './SoloSessionCard';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function SoloSessionsInbox({ user, asHost = false }) {
  const soloSessionsEnabled = useFeatureFlag('solo_sessions');
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['soloSessions', user?.email, asHost ? 'host' : 'guest'],
    queryFn: async () => {
      const filter = asHost ? { host_user_id: user.email } : { guest_user_id: user.email };
      return base44.entities.SoloSession.filter(filter, '-created_date', 20);
    },
    enabled: !!user?.email && soloSessionsEnabled,
  });

  // Fetch profiles for display
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['soloSessionProfiles', sessions],
    queryFn: async () => {
      const ids = [...new Set(sessions.flatMap(s => [s.host_user_id, s.guest_user_id]).filter(Boolean))];
      if (!ids.length) return [];
      const all = await base44.entities.UserProfile.list();
      return all.filter(p => ids.includes(p.user_id));
    },
    enabled: sessions.length > 0,
  });

  const getProfile = (userId) => allProfiles.find(p => p.user_id === userId);

  const handleAction = async (sessionId, action) => {
    setActionLoading(sessionId + action);
    try {
      await base44.functions.invoke('manageSoloSession', { action, session_id: sessionId });
      toast.success(action === 'confirm' ? 'Session confirmed!' : 'Session cancelled');
      queryClient.invalidateQueries(['soloSessions']);
    } catch (err) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (!soloSessionsEnabled) return null;
  if (isLoading) return <div className="text-[#6B7A94] text-sm py-4">Loading sessions...</div>;

  const pending = sessions.filter(s => s.status === 'pending_host');
  const upcoming = sessions.filter(s => ['confirmed', 'contract_pending', 'contract_signed', 'active'].includes(s.status));
  const past = sessions.filter(s => ['completed', 'cancelled'].includes(s.status));

  return (
    <div className="space-y-6">
      {/* Pending (host view) */}
      {asHost && pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#F59E0B]" />
            Pending Requests
            <CCBadge variant="warning" size="sm">{pending.length}</CCBadge>
          </h3>
          <div className="space-y-3">
            {pending.map(session => (
              <div key={session.id} className="space-y-2">
                <SoloSessionCard
                  session={session}
                  showHost={false}
                  guestProfile={getProfile(session.guest_user_id)}
                  hostProfile={getProfile(session.host_user_id)}
                />
                <div className="flex gap-2 pl-1">
                  <CCButton
                    variant="success"
                    size="sm"
                    icon={CheckCircle}
                    loading={actionLoading === session.id + 'confirm'}
                    onClick={() => handleAction(session.id, 'confirm')}
                  >
                    Confirm
                  </CCButton>
                  <CCButton
                    variant="outline"
                    size="sm"
                    icon={XCircle}
                    loading={actionLoading === session.id + 'cancel'}
                    onClick={() => handleAction(session.id, 'cancel')}
                  >
                    Decline
                  </CCButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#4F8CFF]" />
            Upcoming Sessions
          </h3>
          <div className="space-y-2">
            {upcoming.map(session => (
              <SoloSessionCard
                key={session.id}
                session={session}
                showHost={!asHost}
                guestProfile={getProfile(session.guest_user_id)}
                hostProfile={getProfile(session.host_user_id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pending.length === 0 && upcoming.length === 0 && past.length === 0 && (
        <CCEmpty
          icon={CalendarClock}
          title="No sessions yet"
          description={asHost ? 'Session booking requests will appear here.' : 'Your booked sessions will appear here.'}
        />
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#9AA6BC] mb-3 text-sm">Past Sessions</h3>
          <div className="space-y-2">
            {past.slice(0, 5).map(session => (
              <SoloSessionCard
                key={session.id}
                session={session}
                showHost={!asHost}
                guestProfile={getProfile(session.guest_user_id)}
                hostProfile={getProfile(session.host_user_id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}