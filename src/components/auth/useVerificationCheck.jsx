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
  const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';
  const isBanned = profile?.banned === true;
  const isSuspended = profile?.suspended === true;
  
  // GLOBAL VERIFICATION ENFORCEMENT:
  // - Admins bypass verification
  // - If verification flag OFF, everyone passes
  // - Otherwise, must have approved verification
  const isVerified = isAdmin || !verificationEnabled || verifications.some(v => v.status === 'approved');
  const checking = isLoading;
  const blocked = !isVerified || isBanned || isSuspended;
  const blockReason = isBanned ? 'banned' : isSuspended ? 'suspended' : !isVerified ? 'verification_required' : null;

  return {
    checking,
    blocked,
    blockReason,
    suspensionReason: profile?.suspension_reason,
    isVerified,
    isAdmin,
    verificationStatus: { blocked, is_admin: isAdmin, banned: isBanned, suspended: isSuspended }
  };
}