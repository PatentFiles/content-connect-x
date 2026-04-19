/**
 * FeatureGate — conditional rendering based on feature flags.
 *
 * Usage:
 *   <FeatureGate flag="messaging">
 *     <MessagesButton />
 *   </FeatureGate>
 *
 *   // With custom fallback:
 *   <FeatureGate flag="hosting_marketplace" fallback={<ComingSoon />}>
 *     <HostingPage />
 *   </FeatureGate>
 *
 *   // Inverted (render when flag is OFF):
 *   <FeatureGate flag="hosting_marketplace" invert>
 *     <ComingSoonBanner />
 *   </FeatureGate>
 */

import { useFeatureFlag } from '@/lib/featureFlags';

/**
 * FeatureGate — conditional rendering based on feature flags.
 * Accepts either `flag` or `feature` prop (both work identically).
 *
 * Usage:
 *   <FeatureGate flag="messaging">...</FeatureGate>
 *   <FeatureGate feature="messaging">...</FeatureGate>
 *   <FeatureGate flag="hosting_marketplace" fallback={<ComingSoon />}>...</FeatureGate>
 *   <FeatureGate flag="hosting_marketplace" invert>...</FeatureGate>
 */
export default function FeatureGate({ flag, feature, children, fallback = null, invert = false }) {
  const flagKey = flag || feature;
  const value = useFeatureFlag(flagKey);
  const isEnabled = Boolean(value);
  const shouldRender = invert ? !isEnabled : isEnabled;
  return shouldRender ? <>{children}</> : <>{fallback}</>;
}