/**
 * PreCollaborationCheck
 *
 * Shows a readiness summary before confirming a collaboration or booking.
 * Aggregates: verification, testing, trust score, representation, schedule compatibility, flags.
 *
 * Props:
 *   targetUserId    — user being checked
 *   currentUserId   — the person viewing
 *   onProceed       — callback when user clicks "Proceed"
 *   onCancel        — callback when user cancels
 *   showProceed     — show proceed/cancel buttons (default true)
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ShieldCheck, FlaskConical, AlertTriangle, CheckCircle,
  Clock, Users, MapPin, XCircle, Loader2
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import ReputationBadge from '@/components/trust/ReputationBadge';
import { formatDistanceToNow } from 'date-fns';

function CheckRow({ icon: Icon, label, status, detail, variant = 'default' }) {
  const variants = {
    pass: 'text-[#22C55E]',
    warn: 'text-[#F59E0B]',
    fail: 'text-[#EF4444]',
    info: 'text-[#4F8CFF]',
    default: 'text-[#9AA6BC]',
  };

  const iconBg = {
    pass: 'bg-[#22C55E]/10',
    warn: 'bg-[#F59E0B]/10',
    fail: 'bg-[#EF4444]/10',
    info: 'bg-[#4F8CFF]/10',
    default: 'bg-[#263248]/50',
  };

  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#1A2438] last:border-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg[variant]}`}>
        <Icon className={`w-3.5 h-3.5 ${variants[variant]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[#E8EEF9]">{label}</p>
          {status && (
            <span className={`text-xs font-medium flex-shrink-0 ${variants[variant]}`}>{status}</span>
          )}
        </div>
        {detail && <p className="text-xs text-[#6B7A94] mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export default function PreCollaborationCheck({ targetUserId, currentUserId, onProceed, onCancel, showProceed = true }) {
  const { data: targetProfile } = useQuery({
    queryKey: ['precheck_profile', targetUserId],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: targetUserId }),
    enabled: !!targetUserId,
  });

  const { data: targetVerification } = useQuery({
    queryKey: ['precheck_verification', targetUserId],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: targetUserId }),
    enabled: !!targetUserId,
  });

  const { data: targetTesting } = useQuery({
    queryKey: ['precheck_testing', targetUserId],
    queryFn: () => base44.entities.TestingCredential.filter({ user_id: targetUserId }),
    enabled: !!targetUserId,
  });

  const { data: targetReputation } = useQuery({
    queryKey: ['precheck_reputation', targetUserId],
    queryFn: () => base44.entities.ReputationScore.filter({ user_id: targetUserId }),
    enabled: !!targetUserId,
  });

  const { data: targetDisputes } = useQuery({
    queryKey: ['precheck_disputes', targetUserId],
    queryFn: () => base44.entities.CollaborationDispute.filter({ filed_by: targetUserId }),
    enabled: !!targetUserId,
  });

  const { data: agentReps } = useQuery({
    queryKey: ['precheck_agent', targetUserId],
    queryFn: () => base44.entities.AgentRepresentation.filter({ creator_user_id: targetUserId, status: 'ACTIVE' }),
    enabled: !!targetUserId,
  });

  const profile = targetProfile?.[0];
  const verification = targetVerification?.[0];
  const testingCred = targetTesting?.[0];
  const reputation = targetReputation?.[0];
  const openDisputes = (targetDisputes || []).filter(d => !['resolved', 'dismissed'].includes(d.status)).length;
  const agentRep = agentReps?.[0];

  const isLoading = !profile && !!targetUserId;

  const now = new Date();
  const isVerified = verification?.status === 'approved';
  const isVerifExpired = verification?.status === 'expired';
  const testValid = testingCred?.status_badge === 'valid' && testingCred?.expires_at && new Date(testingCred.expires_at) > now;
  const testExpired = testingCred?.status_badge === 'expired' || (testingCred?.expires_at && new Date(testingCred.expires_at) <= now);

  // Determine overall readiness
  const blockers = [];
  const warnings = [];

  if (!isVerified) blockers.push('identity_unverified');
  if (profile?.suspended) blockers.push('account_suspended');
  if (profile?.banned) blockers.push('account_banned');
  if (openDisputes > 0) warnings.push('open_disputes');
  if (testExpired) warnings.push('testing_expired');
  if (!testValid && profile?.role_type === 'creator') warnings.push('testing_missing');
  if (reputation?.label === 'new') warnings.push('new_account');

  const hasBlockers = blockers.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-[#4F8CFF] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center pb-2 border-b border-[#263248]">
        <h3 className="text-base font-semibold text-[#E8EEF9]">
          Pre-Collaboration Check
        </h3>
        <p className="text-xs text-[#6B7A94] mt-1">
          Review {profile?.display_name || 'this user'}'s readiness before proceeding
        </p>
      </div>

      {/* Trust score */}
      {reputation && (
        <div className="flex items-center justify-between p-3 bg-[#121824] rounded-lg">
          <span className="text-sm text-[#9AA6BC]">Trust Standing</span>
          <ReputationBadge score={reputation} size="sm" />
        </div>
      )}

      {/* Checks */}
      <CCCard padding="md">
        {/* Identity */}
        <CheckRow
          icon={ShieldCheck}
          label="Identity Verification"
          status={isVerified ? 'Verified' : isVerifExpired ? 'Expired' : 'Not Verified'}
          variant={isVerified ? 'pass' : isVerifExpired ? 'warn' : 'fail'}
          detail={isVerified && verification?.verified_at ? `Verified ${formatDistanceToNow(new Date(verification.verified_at), { addSuffix: true })}` : isVerifExpired ? 'Verification has expired — may need renewal' : 'User has not completed identity verification'}
        />

        {/* Testing (creators only) */}
        {profile?.role_type === 'creator' && (
          <CheckRow
            icon={FlaskConical}
            label="Health Testing"
            status={testValid ? 'Current' : testExpired ? 'Expired' : 'Not Submitted'}
            variant={testValid ? 'pass' : testExpired ? 'warn' : 'warn'}
            detail={testValid && testingCred?.expires_at ? `Valid until ${new Date(testingCred.expires_at).toLocaleDateString()}` : testExpired ? 'Testing has expired — confirm fresh results before scene' : 'No verified testing on record'}
          />
        )}

        {/* Account status */}
        <CheckRow
          icon={profile?.suspended || profile?.banned ? XCircle : CheckCircle}
          label="Account Status"
          status={profile?.banned ? 'Banned' : profile?.suspended ? 'Suspended' : 'Active'}
          variant={profile?.banned ? 'fail' : profile?.suspended ? 'fail' : 'pass'}
          detail={profile?.suspension_reason || undefined}
        />

        {/* Open disputes */}
        <CheckRow
          icon={AlertTriangle}
          label="Dispute History"
          status={openDisputes > 0 ? `${openDisputes} Open` : 'Clear'}
          variant={openDisputes > 0 ? 'warn' : 'pass'}
          detail={openDisputes > 0 ? 'Has unresolved disputes — review before proceeding' : 'No open disputes'}
        />

        {/* Representation */}
        <CheckRow
          icon={Users}
          label="Representation"
          status={agentRep ? 'Agent Represented' : 'Independent'}
          variant={agentRep ? 'info' : 'default'}
          detail={agentRep ? `Represented by agent — ensure agent permissions are respected in contract` : 'Direct booking — no agent involved'}
        />

        {/* Response time */}
        {profile?.response_time_hours && (
          <CheckRow
            icon={Clock}
            label="Response Time"
            status={profile.response_time_hours <= 4 ? 'Fast' : profile.response_time_hours <= 24 ? 'Moderate' : 'Slow'}
            variant={profile.response_time_hours <= 24 ? 'pass' : 'warn'}
            detail={`Avg. response: ${profile.response_time_hours < 1 ? 'under 1 hour' : `~${Math.round(profile.response_time_hours)} hours`}`}
          />
        )}

        {/* Location */}
        {profile?.base_location?.city && (
          <CheckRow
            icon={MapPin}
            label="Location"
            status={`${profile.base_location.city}${profile.base_location.state ? ', ' + profile.base_location.state : ''}`}
            variant="info"
          />
        )}
      </CCCard>

      {/* Blockers */}
      {hasBlockers && (
        <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#EF4444]">
              <p className="font-semibold mb-1">Collaboration blocked</p>
              {blockers.includes('identity_unverified') && <p>• User has not completed identity verification</p>}
              {blockers.includes('account_suspended') && <p>• Account is currently suspended</p>}
              {blockers.includes('account_banned') && <p>• Account has been permanently banned</p>}
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {!hasBlockers && warnings.length > 0 && (
        <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[#F59E0B]">
              <p className="font-semibold mb-1">Review before proceeding</p>
              {warnings.includes('testing_expired') && <p>• Health testing has expired</p>}
              {warnings.includes('testing_missing') && <p>• No verified health testing on record</p>}
              {warnings.includes('open_disputes') && <p>• Has open unresolved disputes</p>}
              {warnings.includes('new_account') && <p>• Newer account — limited collaboration history</p>}
            </div>
          </div>
        </div>
      )}

      {/* All clear */}
      {!hasBlockers && warnings.length === 0 && (
        <div className="p-3 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#22C55E]" />
            <p className="text-xs text-[#22C55E] font-medium">All checks passed — ready to proceed</p>
          </div>
        </div>
      )}

      {/* Actions */}
      {showProceed && (
        <div className="flex gap-3 pt-2">
          {onCancel && (
            <CCButton variant="outline" size="sm" onClick={onCancel} fullWidth>
              Cancel
            </CCButton>
          )}
          <CCButton
            variant={hasBlockers ? 'outline' : 'primary'}
            size="sm"
            onClick={onProceed}
            disabled={hasBlockers}
            fullWidth
          >
            {hasBlockers ? 'Cannot Proceed' : 'Proceed'}
          </CCButton>
        </div>
      )}
    </div>
  );
}