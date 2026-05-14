/**
 * SoloSessionDetail — Full session management page.
 * Resolves all notification deep links: /SoloSessionDetail?id=...
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, MapPin, User, Shield, ArrowLeft,
  CheckCircle, XCircle, FileText, Zap, ArrowUpCircle,
  AlertTriangle, Key, LogIn, LogOut, RefreshCw, Lock
} from 'lucide-react';
import { format } from 'date-fns';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';

const STATUS_CONFIG = {
  draft:            { label: 'Draft',            color: 'default',  step: 0 },
  pending_host:     { label: 'Pending Host',      color: 'warning',  step: 1 },
  confirmed:        { label: 'Confirmed',         color: 'primary',  step: 2 },
  contract_pending: { label: 'Contract Pending',  color: 'accent',   step: 3 },
  contract_signed:  { label: 'Contract Signed',   color: 'success',  step: 4 },
  active:           { label: 'Active',            color: 'success',  step: 5 },
  completed:        { label: 'Completed',         color: 'success',  step: 6 },
  cancelled:        { label: 'Cancelled',         color: 'danger',   step: -1 },
  disputed:         { label: 'Disputed',          color: 'danger',   step: -1 },
};

const STEPS = ['Draft', 'Pending Host', 'Confirmed', 'Contract Pending', 'Contract Signed', 'Active', 'Completed'];

const EVENT_ICONS = {
  access_code_issued:      Key,
  access_code_reset:       RefreshCw,
  access_code_expired:     XCircle,
  checkin_gps:             MapPin,
  checkin_manual:          LogIn,
  checkout_completed:      LogOut,
  checkout_evidence_uploaded: LogOut,
  address_revealed:        MapPin,
  checkin_issue_reported:  AlertTriangle,
  smart_lock_unlocked:     Lock,
  smart_lock_locked:       Lock,
  smart_lock_error:        AlertTriangle,
};

export default function SoloSessionDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: session, isLoading } = useQuery({
    queryKey: ['soloSession', sessionId],
    queryFn: async () => {
      const sessions = await base44.entities.SoloSession.filter({ id: sessionId });
      return sessions[0] || null;
    },
    enabled: !!sessionId,
  });

  const { data: propertyData } = useQuery({
    queryKey: ['sessionProperty', session?.booking_snapshot?.property_id],
    queryFn: async () => {
      const props = await base44.entities.Property.filter({ id: session.booking_snapshot.property_id });
      return props[0] || null;
    },
    enabled: !!session?.booking_snapshot?.property_id,
  });

  const { data: accessEvents = [] } = useQuery({
    queryKey: ['bookingAccessEvents', sessionId],
    queryFn: async () => {
      const res = await base44.functions.invoke('manageBookingAccess', { action: 'get_events', session_id: sessionId });
      return res?.data?.events || [];
    },
    enabled: !!sessionId && !!session,
  });

  const { data: hostProfile } = useQuery({
    queryKey: ['hostProfileForSession', session?.host_user_id],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: session.host_user_id }),
    enabled: !!session?.host_user_id,
    select: data => data[0],
  });

  const { data: guestProfile } = useQuery({
    queryKey: ['guestProfileForSession', session?.guest_user_id],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: session.guest_user_id }),
    enabled: !!session?.guest_user_id,
    select: data => data[0],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['soloSession', sessionId] });

  const actionMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await base44.functions.invoke('manageSoloSession', payload);
      if (res?.data?.error) throw new Error(res.data.error);
      return res?.data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Session ${vars.action} successful`);
      invalidate();
      if (vars.action === 'upgrade_to_collaboration') {
        navigate('/Collaborations');
      }
    },
    onError: (err) => toast.error(err.message || 'Action failed'),
  });

  if (!sessionId) return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
      <div className="text-center">
        <p className="text-[#EF4444] text-lg font-semibold mb-2">No session ID provided</p>
        <Link to="/Dashboard" className="text-[#4F8CFF] hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  );

  if (isLoading) return <CCLoadingScreen message="Loading session..." />;

  if (!session) return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
      <div className="text-center">
        <p className="text-[#EF4444] text-lg font-semibold mb-2">Session not found</p>
        <Link to="/Dashboard" className="text-[#4F8CFF] hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  );

  const isHost = session.host_user_id === user?.email;
  const isGuest = session.guest_user_id === user?.email;
  const statusConf = STATUS_CONFIG[session.status] || STATUS_CONFIG.draft;
  const currentStep = statusConf.step;

  return (
    <FeatureRouteGuard flag="solo_sessions">
    <MobileRefreshPage onRefresh={() => queryClient.invalidateQueries({ queryKey: ['soloSession', sessionId] })}>
    <div className="min-h-screen bg-[#0B0F14] pb-24 md:pb-8">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back */}
        <Link to="/Dashboard" className="inline-flex items-center gap-2 text-sm text-[#9AA6BC] hover:text-[#E8EEF9] mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#E8EEF9] mb-1">{session.session_name || 'Session'}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <CCBadge variant={statusConf.color}>{statusConf.label}</CCBadge>
              <span className="text-xs text-[#6B7A94] capitalize">{session.session_type?.replace(/_/g, ' ')}</span>
              {isHost && <CCBadge variant="outline" size="sm">You are the Host</CCBadge>}
              {isGuest && <CCBadge variant="outline" size="sm">You are the Guest</CCBadge>}
            </div>
          </div>
        </div>

        {/* Progress Stepper */}
        {session.status !== 'cancelled' && session.status !== 'disputed' && (
          <CCCard padding="md" className="mb-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, i) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i < currentStep ? 'bg-[#22C55E] text-white' :
                      i === currentStep ? 'bg-[#4F8CFF] text-white ring-2 ring-[#4F8CFF]/30' :
                      'bg-[#263248] text-[#6B7A94]'
                    }`}>
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <span className="text-[9px] text-[#6B7A94] mt-1 text-center hidden sm:block" style={{maxWidth: 60}}>{step}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < currentStep ? 'bg-[#22C55E]' : 'bg-[#263248]'}`} />
                  )}
                </div>
              ))}
            </div>
          </CCCard>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Details */}
          <div className="md:col-span-2 space-y-4">
            {/* Schedule */}
            <CCCard padding="md">
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-[#4F8CFF]" /> Schedule</h3>
              <div className="space-y-2 text-sm">
                {session.schedule?.confirmed_date && (
                  <div className="flex items-center gap-2 text-[#9AA6BC]">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>{format(new Date(session.schedule.confirmed_date), 'MMMM d, yyyy')}</span>
                  </div>
                )}
                {(session.schedule?.start_time || session.schedule?.end_time) && (
                  <div className="flex items-center gap-2 text-[#9AA6BC]">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>{session.schedule.start_time || '?'} – {session.schedule.end_time || '?'}</span>
                    {session.schedule.duration_hours && <span className="text-[#6B7A94]">({session.schedule.duration_hours}h)</span>}
                  </div>
                )}
                {session.schedule?.timezone && <p className="text-xs text-[#6B7A94]">{session.schedule.timezone}</p>}
              </div>
            </CCCard>

            {/* Property */}
            {propertyData && (
              <CCCard padding="md">
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#FF2DAA]" /> Property</h3>
                <Link to={`/PropertyDetail?id=${propertyData.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  {propertyData.media?.[0]?.url && (
                    <img src={propertyData.media[0].url} alt={propertyData.title} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-[#E8EEF9]">{propertyData.title}</p>
                    <p className="text-xs text-[#9AA6BC]">{propertyData.city}{propertyData.state && `, ${propertyData.state}`}</p>
                    <p className="text-xs text-[#6B7A94] capitalize">{propertyData.property_type}</p>
                  </div>
                </Link>
              </CCCard>
            )}

            {/* Location fallback */}
            {!propertyData && session.location?.name && (
              <CCCard padding="md">
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#FF2DAA]" /> Location</h3>
                <p className="text-sm text-[#E8EEF9]">{session.location.name}</p>
                {session.location.city && <p className="text-xs text-[#9AA6BC]">{session.location.city}</p>}
                {session.location.notes && <p className="text-xs text-[#6B7A94] mt-1">{session.location.notes}</p>}
              </CCCard>
            )}

            {/* Participants */}
            <CCCard padding="md">
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2"><User className="w-4 h-4 text-[#4F8CFF]" /> Participants</h3>
              <div className="space-y-3">
                {hostProfile && (
                  <div className="flex items-center gap-3">
                    <img src={hostProfile.avatar_url || undefined} alt="" className="w-9 h-9 rounded-full bg-[#263248] object-cover flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#E8EEF9]">{hostProfile.display_name}</p>
                      <CCBadge variant="primary" size="sm">Host</CCBadge>
                    </div>
                  </div>
                )}
                {guestProfile && (
                  <div className="flex items-center gap-3">
                    <img src={guestProfile.avatar_url || undefined} alt="" className="w-9 h-9 rounded-full bg-[#263248] object-cover flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-[#E8EEF9]">{guestProfile.display_name}</p>
                      <CCBadge variant="outline" size="sm">Guest</CCBadge>
                    </div>
                  </div>
                )}
                {session.external_participants?.map((ep, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#263248] flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-[#6B7A94]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#E8EEF9]">{ep.name}</p>
                      <p className="text-xs text-[#6B7A94]">{ep.role} · External</p>
                    </div>
                  </div>
                ))}
              </div>
            </CCCard>

            {/* Compensation */}
            {session.compensation?.amount > 0 && (
              <CCCard padding="md">
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Compensation</h3>
                <p className="text-lg font-bold text-[#22C55E]">
                  ${session.compensation.amount} {session.compensation.currency || 'USD'}
                </p>
                <p className="text-xs text-[#9AA6BC] capitalize">{session.compensation.payment_type}</p>
                {session.compensation.notes && <p className="text-xs text-[#6B7A94] mt-1">{session.compensation.notes}</p>}
              </CCCard>
            )}

            {/* Contract */}
            {session.contract_id && (
              <CCCard padding="md">
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-[#4F8CFF]" /> Contract</h3>
                <Link to={`/ViewContract?id=${session.contract_id}`}>
                  <CCButton variant="outline" size="sm" icon={FileText}>View Contract</CCButton>
                </Link>
              </CCCard>
            )}

            {/* Access Events Timeline */}
            {accessEvents.length > 0 && (
              <CCCard padding="md">
                <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-[#4F8CFF]" /> Access Timeline</h3>
                <div className="space-y-2">
                  {accessEvents.map((ev, i) => {
                    const Icon = EVENT_ICONS[ev.event_type] || Shield;
                    return (
                      <div key={ev.id || i} className="flex items-start gap-3 p-2 bg-[#0B0F14] rounded-lg">
                        <div className="w-7 h-7 rounded-full bg-[#263248] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="w-3.5 h-3.5 text-[#9AA6BC]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#E8EEF9] capitalize">{ev.event_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-[#6B7A94]">{ev.actor_user_id}</p>
                          {ev.timestamp && <p className="text-xs text-[#6B7A94]">{format(new Date(ev.timestamp), 'MMM d, h:mm a')}</p>}
                          {ev.within_geofence !== null && ev.within_geofence !== undefined && (
                            <p className={`text-xs mt-0.5 ${ev.within_geofence ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
                              {ev.within_geofence ? '✓ Within geofence' : '⚠ Outside geofence'} {ev.distance_from_property_meters ? `(${ev.distance_from_property_meters}m)` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CCCard>
            )}
          </div>

          {/* Right: Actions */}
          <div className="space-y-4">
            <CCCard padding="md">
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-4">Actions</h3>
              <div className="space-y-2">
                {/* Host: Confirm pending session */}
                {isHost && session.status === 'pending_host' && (
                  <CCButton
                    variant="success"
                    fullWidth
                    icon={CheckCircle}
                    loading={actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ action: 'confirm', session_id: sessionId })}
                  >
                    Confirm Booking
                  </CCButton>
                )}

                {/* Mark contract signed */}
                {(isHost || isGuest) && session.status === 'contract_pending' && (
                  <CCButton
                    variant="primary"
                    fullWidth
                    icon={FileText}
                    loading={actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ action: 'contract_signed', session_id: sessionId })}
                  >
                    Mark Contract Signed
                  </CCButton>
                )}

                {/* Complete session */}
                {(isHost || isGuest) && ['active', 'contract_signed', 'confirmed'].includes(session.status) && (
                  <CCButton
                    variant="success"
                    fullWidth
                    icon={CheckCircle}
                    loading={actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ action: 'complete', session_id: sessionId })}
                  >
                    Mark Complete
                  </CCButton>
                )}

                {/* Upgrade to collaboration */}
                {(isHost || isGuest) && ['confirmed', 'contract_signed', 'active'].includes(session.status) && !session.upgraded_to_collaboration && (
                  <CCButton
                    variant="accent"
                    fullWidth
                    icon={ArrowUpCircle}
                    loading={actionMutation.isPending}
                    onClick={() => actionMutation.mutate({ action: 'upgrade_to_collaboration', session_id: sessionId })}
                  >
                    Upgrade to Collaboration
                  </CCButton>
                )}

                {/* Cancel */}
                {(isHost || isGuest) && !['completed', 'cancelled', 'disputed'].includes(session.status) && (
                  <CCButton
                    variant="danger"
                    fullWidth
                    icon={XCircle}
                    loading={actionMutation.isPending}
                    onClick={() => setShowCancelModal(true)}
                  >
                    Cancel Session
                  </CCButton>
                )}

                {/* View property */}
                {session.booking_snapshot?.property_id && (
                  <Link to={`/PropertyDetail?id=${session.booking_snapshot.property_id}`}>
                    <CCButton variant="outline" fullWidth icon={MapPin}>View Property</CCButton>
                  </Link>
                )}
              </div>
            </CCCard>

            {/* Session Meta */}
            <CCCard padding="md">
              <h3 className="text-sm font-semibold text-[#E8EEF9] mb-3">Session Info</h3>
              <div className="space-y-2 text-xs text-[#6B7A94]">
                <p>ID: <span className="text-[#9AA6BC] font-mono">{session.id?.slice(-8)}</span></p>
                <p>Type: <span className="text-[#9AA6BC] capitalize">{session.session_type?.replace(/_/g, ' ')}</span></p>
                <p>Mode: <span className="text-[#9AA6BC] capitalize">{session.booking_mode}</span></p>
                {session.created_date && (
                  <p>Created: <span className="text-[#9AA6BC]">{format(new Date(session.created_date), 'MMM d, yyyy')}</span></p>
                )}
                {session.upgraded_to_collaboration && (
                  <CCBadge variant="accent" size="sm">Upgraded to Collaboration</CCBadge>
                )}
              </div>
            </CCCard>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm">
            <CCCard padding="lg">
              <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">Cancel Session?</h3>
              <p className="text-sm text-[#9AA6BC] mb-4">This action cannot be undone. Please provide a reason (optional).</p>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px] mb-4"
                placeholder="Reason for cancellation..."
              />
              <div className="flex gap-3">
                <CCButton variant="outline" fullWidth onClick={() => setShowCancelModal(false)}>Keep Session</CCButton>
                <CCButton
                  variant="danger"
                  fullWidth
                  loading={actionMutation.isPending}
                  onClick={() => {
                    actionMutation.mutate({ action: 'cancel', session_id: sessionId, reason: cancelReason });
                    setShowCancelModal(false);
                  }}
                >
                  Confirm Cancel
                </CCButton>
              </div>
            </CCCard>
          </motion.div>
        </div>
      )}
    </div>
    </MobileRefreshPage>
    </FeatureRouteGuard>
  );
}