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

export default function VerificationGate({ isVerified, isAdmin = false, fallback, children }) {
  const verificationEnabled = useFeatureFlag('verification');

  // If verification flag is OFF, everyone passes
  if (!verificationEnabled) return <>{children}</>;

  // Admins always pass
  if (isAdmin) return <>{children}</>;

  // Verified users pass
  if (isVerified) return <>{children}</>;

  // Blocked — show fallback or default AccessGate
  return fallback ? <>{fallback}</> : <AccessGate type="verification" />;
}