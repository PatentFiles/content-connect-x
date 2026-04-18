import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useFeatureFlag } from '@/lib/featureFlags';

export function useVerificationCheck(action) {
  const verificationEnabled = useFeatureFlag('verification');

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: verifications = [], isLoading } = useQuery({
    queryKey: ['myVerification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const profile = profiles[0];
  const isAdmin = profile?.is_admin;
  const isBanned = profile?.banned === true;
  const isSuspended = profile?.suspended === true;
  // If verification feature flag is OFF, treat everyone as verified
  const isVerified = !verificationEnabled || isAdmin || verifications.some(v => v.status === 'approved');
  const checking = isLoading;
  const blocked = !isVerified || isBanned || isSuspended;
  const blockReason = isBanned ? 'banned' : isSuspended ? 'suspended' : null;

  return {
    checking,
    blocked,
    blockReason,
    suspensionReason: profile?.suspension_reason,
    verificationStatus: { blocked, is_admin: isAdmin, banned: isBanned, suspended: isSuspended }
  };
}