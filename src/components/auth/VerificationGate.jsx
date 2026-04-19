/**
 * VerificationGate — renders children only when the user is verified
 * (or when the `verification` feature flag is OFF, in which case all users pass).
 *
 * Usage:
 *   <VerificationGate isVerified={isVerified} isAdmin={isAdmin}>
 *     <ProtectedContent />
 *   </VerificationGate>
 *
 *   // With custom fallback:
 *   <VerificationGate isVerified={isVerified} fallback={<AccessGate type="verification" />}>
 *     <Page />
 *   </VerificationGate>
 */

import { useFeatureFlag } from '@/lib/featureFlags';
import AccessGate from '@/components/auth/AccessGate';

export default function VerificationGate({ isVerified, isAdmin = false, user, fallback, children }) {
  const verificationEnabled = useFeatureFlag('verification');
  
  // Standard admin check: both role and role_type
  const adminCheck = isAdmin || user?.role === 'admin' || user?.role_type === 'admin';

  // If verification flag is OFF, everyone passes
  if (!verificationEnabled) return <>{children}</>;

  // GLOBAL VERIFICATION ENFORCEMENT:
  // Admins always bypass verification
  if (adminCheck) return <>{children}</>;

  // Non-admins MUST be verified when flag is ON
  if (!isVerified) {
    return fallback ? <>{fallback}</> : <AccessGate type="verification" user={user} />;
  }

  // User is verified — grant access
  return <>{children}</>;
}