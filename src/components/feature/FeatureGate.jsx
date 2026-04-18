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

import React from 'react';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function FeatureGate({ flag, children, fallback = null, invert = false }) {
  const value = useFeatureFlag(flag);
  const isEnabled = Boolean(value);
  const shouldRender = invert ? !isEnabled : isEnabled;
  return shouldRender ? <>{children}</> : <>{fallback}</>;
}