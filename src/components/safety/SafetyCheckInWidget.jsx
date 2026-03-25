/**
 * SafetyCheckInWidget
 *
 * Compact, mobile-friendly safety check-in UI for collaboration detail pages.
 * Lets users check in before and mark safe after a real-world meeting.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { toast } from 'sonner';

export default function SafetyCheckInWidget({ collaborationId, userId }) {
  const [expanded, setExpanded] = useState(false);
  const [expectedEnd, setExpectedEnd] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const queryClient = useQueryClient();

  const { data: checkInStatus } = useQuery({
    queryKey: ['safetyCheckin', collaborationId, userId],
    queryFn: () => base44.functions.invoke('safetyCheckIn', { collaboration_id: collaborationId }, { queryParams: { action: 'get_status' } }).then(r => r.data?.data),
    enabled: !!collaborationId && !!userId,
    refetchInterval: 60000,
  });

  const checkInMutation = useMutation({
    mutationFn: () => base44.functions.invoke('safetyCheckIn', {
      collaboration_id: collaborationId,
      expected_end_time: expectedEnd ? new Date(expectedEnd).toISOString() : null,
      location_shared: locationHint || null,
    }, { queryParams: { action: 'check_in' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safetyCheckin', collaborationId] });
      toast.success('Safety check-in recorded ✓');
      setExpanded(false);
    },
    onError: (e) => toast.error(e.message || 'Check-in failed'),
  });

  const markSafeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('safetyCheckIn', {
      check_in_id: checkInStatus?.id
    }, { queryParams: { action: 'mark_safe' } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safetyCheckin', collaborationId] });
      toast.success('Marked as safe ✓');
    },
    onError: (e) => toast.error(e.message || 'Failed'),
  });

  const status = checkInStatus?.status;

  const statusConfig = {
    checked_in: { icon: Clock, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30', label: 'Checked In — waiting for safe confirmation' },
    safe: { icon: CheckCircle, color: 'text-[#22C55E]', bg: 'bg-[#22C55E]/10 border-[#22C55E]/30', label: 'Marked Safe ✓' },
    escalated: { icon: AlertTriangle, color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10 border-[#EF4444]/30', label: 'Safety check escalated — admin notified' },
    missed: { icon: AlertTriangle, color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10 border-[#EF4444]/30', label: 'Missed check-out' },
  };

  const cfg = statusConfig[status];

  if (status === 'safe') {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg border ${cfg.bg}`}>
        <CheckCircle className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
        <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
      </div>
    );
  }

  if (status === 'checked_in') {
    return (
      <div className={`p-3 rounded-lg border ${cfg.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${cfg.color}`} />
            <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
          </div>
          <CCButton
            variant="success"
            size="sm"
            icon={CheckCircle}
            onClick={() => markSafeMutation.mutate()}
            loading={markSafeMutation.isPending}
          >
            Mark Safe
          </CCButton>
        </div>
        {checkInStatus?.expected_end_time && (
          <p className="text-xs text-[#9AA6BC] mt-1 ml-6">
            Expected end: {new Date(checkInStatus.expected_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    );
  }

  if (status === 'escalated' || status === 'missed') {
    return (
      <div className={`flex items-center gap-2 p-3 rounded-lg border ${cfg.bg}`}>
        <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
        <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
      </div>
    );
  }

  // No active check-in
  return (
    <CCCard padding="md" className="border-[#4F8CFF]/20">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#4F8CFF]" />
          <div>
            <p className="text-sm font-medium text-[#E8EEF9]">Safety Check-In</p>
            <p className="text-xs text-[#6B7A94]">Optional — lets trusted contacts know you're safe</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 pt-4 border-t border-[#263248]">
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">Expected end time (optional)</label>
            <input
              type="datetime-local"
              value={expectedEnd}
              onChange={e => setExpectedEnd(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
          <div>
            <label className="block text-xs text-[#9AA6BC] mb-1">General area (city only, optional)</label>
            <input
              type="text"
              placeholder="e.g. Los Angeles, CA"
              value={locationHint}
              onChange={e => setLocationHint(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            />
          </div>
          <div className="flex items-start gap-2 p-2 bg-[#121824] rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#9AA6BC]">
              This is a voluntary safety tool. The platform does not monitor your location. You are responsible for your own safety. Contact emergency services (911) in any real emergency.
            </p>
          </div>
          <CCButton
            variant="primary"
            size="sm"
            icon={Shield}
            onClick={() => checkInMutation.mutate()}
            loading={checkInMutation.isPending}
            fullWidth
          >
            Check In
          </CCButton>
        </div>
      )}
    </CCCard>
  );
}