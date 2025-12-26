import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export function useVerificationCheck(action) {
  const [checking, setChecking] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  useEffect(() => {
    const checkVerification = async () => {
      if (!user) {
        setChecking(false);
        return;
      }

      try {
        const result = await base44.functions.invoke('validateVerificationStatus', {
          action,
          target_user_id: user.email
        });

        setVerificationStatus(result.data);
        setBlocked(result.data.blocked);
      } catch (error) {
        console.error('Verification check error:', error);
        setBlocked(true);
      } finally {
        setChecking(false);
      }
    };

    checkVerification();
  }, [user, action]);

  return { checking, blocked, verificationStatus };
}