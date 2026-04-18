/**
 * BookingAccessWidget
 *
 * Shown on confirmed SoloSession detail/card views for host and guest.
 * Handles:
 *  - Address reveal (only in booking window or after)
 *  - GPS check-in (when enabled)
 *  - Access code request + reset
 *  - Checkout evidence upload
 *  - Access issue reporting
 *
 * All events write to BookingAccessEvent + AdminActionLog via manageBookingAccess backend.
 * Feature-gated: GPS behind gps_checkin flag, checkout evidence behind checkout_evidence_enabled flag.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useFeatureFlag } from '@/lib/featureFlags';
import {
  MapPin, Key, RefreshCw, Navigation, AlertTriangle,
  Camera, CheckCircle, ChevronDown, ChevronUp, Upload, Lock
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';

const INPUT = "w-full bg-[#121824] border border-[#263248] rounded-lg px-3 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50";

export default function BookingAccessWidget({ session, currentUser }) {
  const queryClient = useQueryClient();
  const gpsEnabled = useFeatureFlag('gps_checkin');
  const checkoutEvidenceEnabled = useFeatureFlag('checkout_evidence_enabled');

  const isHost = session?.host_user_id === currentUser?.email;
  const isGuest = session?.guest_user_id === currentUser?.email;

  const [expanded, setExpanded] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState(null);
  const [codeExpiry, setCodeExpiry] = useState(null);
  const [resetReason, setResetReason] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [issueDesc, setIssueDesc] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [checkoutFiles, setCheckoutFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef();

  // Fetch access info
  const { data: accessInfo, isLoading: accessLoading, refetch: refetchAccess } = useQuery({
    queryKey: ['bookingAccess', session?.id],
    queryFn: () => base44.functions.invoke('manageBookingAccess', {
      action: 'get_access',
      session_id: session?.id,
    }).then(r => r.data),
    enabled: !!session?.id && (isHost || isGuest),
    refetchInterval: 60000, // re-check every minute
  });

  // Request code
  const requestCodeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('manageBookingAccess', {
      action: 'request_code',
      session_id: session.id,
    }).then(r => r.data),
    onSuccess: (data) => {
      setCode(data.code);
      setCodeExpiry(data.expires_at);
      setShowCode(true);
    },
    onError: (e) => toast.error(e.message || 'Failed to get access code'),
  });

  // Reset code
  const resetCodeMutation = useMutation({
    mutationFn: () => base44.functions.invoke('manageBookingAccess', {
      action: 'reset_code',
      session_id: session.id,
      reset_reason: resetReason || 'Code not working',
    }).then(r => r.data),
    onSuccess: (data) => {
      setCode(data.code);
      setCodeExpiry(data.expires_at);
      setShowCode(true);
      setShowResetForm(false);
      setResetReason('');
      toast.success('New access code issued');
    },
    onError: (e) => toast.error(e.message || 'Reset failed'),
  });

  // GPS check-in
  const checkinMutation = useMutation({
    mutationFn: ({ lat, lng, accuracy }) => base44.functions.invoke('manageBookingAccess', {
      action: 'checkin',
      session_id: session.id,
      gps_lat: lat,
      gps_lng: lng,
      gps_accuracy_meters: accuracy,
    }).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['bookingAccess', session.id]);
      const msg = data.within_geofence === false
        ? `Checked in — you appear to be ${data.distance_meters}m from the property`
        : 'Checked in successfully ✓';
      toast.success(msg);
    },
    onError: (e) => toast.error(e.message || 'Check-in failed'),
  });

  // Report issue
  const reportIssueMutation = useMutation({
    mutationFn: (evidenceUrls) => base44.functions.invoke('manageBookingAccess', {
      action: 'report_issue',
      session_id: session.id,
      issue_description: issueDesc,
      evidence_urls: evidenceUrls || [],
    }).then(r => r.data),
    onSuccess: () => {
      setShowIssueForm(false);
      setIssueDesc('');
      toast.success('Issue reported — host and admin notified');
    },
    onError: (e) => toast.error(e.message || 'Report failed'),
  });

  // Checkout
  const checkoutMutation = useMutation({
    mutationFn: (evidenceUrls) => base44.functions.invoke('manageBookingAccess', {
      action: 'checkout',
      session_id: session.id,
      condition_notes: checkoutNotes,
      evidence_urls: evidenceUrls || [],
    }).then(r => r.data),
    onSuccess: () => {
      setShowCheckoutForm(false);
      setCheckoutNotes('');
      setCheckoutFiles([]);
      toast.success('Checkout submitted ✓');
    },
    onError: (e) => toast.error(e.message || 'Checkout failed'),
  });

  const handleGpsCheckin = () => {
    if (!navigator.geolocation) {
      // Fall back to manual check-in
      checkinMutation.mutate({ lat: null, lng: null, accuracy: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => checkinMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {
        // GPS denied — do manual check-in
        checkinMutation.mutate({ lat: null, lng: null, accuracy: null });
        toast.info('GPS unavailable — manual check-in recorded');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const uploadAndSubmit = async (action) => {
    const files = checkoutFiles;
    let urls = [];
    if (files.length > 0) {
      setUploadingFiles(true);
      try {
        urls = await Promise.all(files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return file_url;
        }));
      } catch {
        toast.error('File upload failed');
        setUploadingFiles(false);
        return;
      }
      setUploadingFiles(false);
    }
    if (action === 'checkout') checkoutMutation.mutate(urls);
    if (action === 'issue') reportIssueMutation.mutate(urls);
  };

  if (!session || (!isHost && !isGuest)) return null;

  const confirmedStatuses = ['confirmed','contract_pending','contract_signed','active'];
  if (!confirmedStatuses.includes(session.status)) return null;

  if (accessLoading) return <div className="text-xs text-[#6B7A94] py-2">Loading access info...</div>;

  const info = accessInfo || {};
  const canAct = info.in_window;
  const canSeeAddress = info.can_see_address;

  return (
    <CCCard padding="md" className="border-[#4F8CFF]/20 space-y-3">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[#4F8CFF]" />
          <div className="text-left">
            <p className="text-sm font-medium text-[#E8EEF9]">Property Access</p>
            <p className="text-xs text-[#6B7A94]">
              {canAct ? 'Booking window active' : info.after_end ? 'Booking ended' : 'Available when booking opens'}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#6B7A94]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A94]" />}
      </button>

      {expanded && (
        <div className="space-y-4 pt-2 border-t border-[#263248]">

          {/* Address reveal */}
          <div>
            <p className="text-xs font-medium text-[#9AA6BC] mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Property Address
            </p>
            {canSeeAddress ? (
              <p className="text-sm text-[#E8EEF9] font-mono bg-[#0B0F14] rounded-lg px-3 py-2 border border-[#263248]">
                {info.exact_address || 'Address on file — contact host if unclear'}
              </p>
            ) : (
              <p className="text-xs text-[#6B7A94] bg-[#0B0F14] rounded-lg px-3 py-2 border border-[#263248]">
                Exact address will appear here once your booking is confirmed and the booking window opens.
              </p>
            )}
          </div>

          {/* Access code (guest only, within window) */}
          {isGuest && (
            <div>
              <p className="text-xs font-medium text-[#9AA6BC] mb-1 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Entry Code
              </p>
              {!canAct ? (
                <p className="text-xs text-[#6B7A94]">Available {info.after_end ? 'N/A — booking ended' : 'when booking window opens'}</p>
              ) : showCode && code ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-[#0B0F14] rounded-lg px-3 py-3 border border-[#22C55E]/40">
                    <span className="text-2xl font-mono font-bold text-[#22C55E] tracking-widest">{code}</span>
                    <span className="text-xs text-[#6B7A94] ml-auto">
                      Expires {codeExpiry ? new Date(codeExpiry).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[#F59E0B] hover:underline flex items-center gap-1"
                    onClick={() => setShowResetForm(r => !r)}
                  >
                    <RefreshCw className="w-3 h-3" /> Code not working? Reset it
                  </button>
                </div>
              ) : (
                <CCButton
                  variant="primary"
                  size="sm"
                  icon={Key}
                  onClick={() => requestCodeMutation.mutate()}
                  loading={requestCodeMutation.isPending}
                >
                  Get Entry Code
                </CCButton>
              )}

              {/* Reset form */}
              {showResetForm && !info.after_end && (
                <div className="mt-2 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-[#F59E0B]">Code Reset</p>
                  <textarea
                    rows={2}
                    value={resetReason}
                    onChange={e => setResetReason(e.target.value)}
                    placeholder="Briefly describe the issue (e.g. code rejected at keypad)"
                    className={INPUT + ' resize-none'}
                  />
                  <CCButton
                    variant="warning"
                    size="sm"
                    icon={RefreshCw}
                    onClick={() => resetCodeMutation.mutate()}
                    loading={resetCodeMutation.isPending}
                    fullWidth
                  >
                    Reset Code
                  </CCButton>
                </div>
              )}
            </div>
          )}

          {/* GPS check-in (guest only, within window, flag enabled) */}
          {isGuest && canAct && gpsEnabled && (
            <div>
              <p className="text-xs font-medium text-[#9AA6BC] mb-1 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5" /> Check-In
              </p>
              <CCButton
                variant="outline"
                size="sm"
                icon={Navigation}
                onClick={handleGpsCheckin}
                loading={checkinMutation.isPending}
                fullWidth
              >
                Check In (GPS)
              </CCButton>
              <p className="text-[10px] text-[#6B7A94] mt-1">
                GPS data is private — only used for session evidence. Allow location when prompted.
              </p>
            </div>
          )}

          {/* Report access issue */}
          {canAct && (
            <div>
              <button
                type="button"
                className="text-xs text-[#F59E0B] hover:underline flex items-center gap-1"
                onClick={() => setShowIssueForm(f => !f)}
              >
                <AlertTriangle className="w-3 h-3" /> Report an access issue
              </button>
              {showIssueForm && (
                <div className="mt-2 p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg space-y-2">
                  <textarea
                    rows={2}
                    value={issueDesc}
                    onChange={e => setIssueDesc(e.target.value)}
                    placeholder="Describe the access issue..."
                    className={INPUT + ' resize-none'}
                  />
                  <CCButton
                    variant="danger"
                    size="sm"
                    icon={AlertTriangle}
                    onClick={() => uploadAndSubmit('issue')}
                    loading={reportIssueMutation.isPending || uploadingFiles}
                    fullWidth
                  >
                    Submit Issue Report
                  </CCButton>
                </div>
              )}
            </div>
          )}

          {/* Checkout evidence */}
          {checkoutEvidenceEnabled && canAct && (
            <div>
              <p className="text-xs font-medium text-[#9AA6BC] mb-1 flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" /> Checkout Evidence
              </p>
              {!showCheckoutForm ? (
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={Camera}
                  onClick={() => setShowCheckoutForm(true)}
                  fullWidth
                >
                  Submit Checkout
                </CCButton>
              ) : (
                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={checkoutNotes}
                    onChange={e => setCheckoutNotes(e.target.value)}
                    placeholder="Condition notes (e.g. space left clean, minor scuff noted on wall)"
                    className={INPUT + ' resize-none'}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[#4F8CFF] hover:underline flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> {checkoutFiles.length > 0 ? `${checkoutFiles.length} file(s) selected` : 'Attach photos/videos'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={e => setCheckoutFiles(Array.from(e.target.files))}
                    />
                  </div>
                  <CCButton
                    variant="success"
                    size="sm"
                    icon={CheckCircle}
                    onClick={() => uploadAndSubmit('checkout')}
                    loading={checkoutMutation.isPending || uploadingFiles}
                    fullWidth
                  >
                    Submit Checkout
                  </CCButton>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </CCCard>
  );
}