import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useVerificationCheck(action) {
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
  const isVerified = isAdmin || verifications.some(v => v.status === 'approved');
  const checking = isLoading;
  const blocked = !isVerified;

  return { checking, blocked, verificationStatus: { blocked, is_admin: isAdmin } };
}