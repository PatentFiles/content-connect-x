import { useFeatureFlag } from '@/lib/featureFlags';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { isSubscriptionActive } from '@/lib/subscriptionGuard';
import SubscriptionBlockedScreen from '@/components/auth/SubscriptionBlockedScreen';

/**
 * FeatureRouteGuard — unified route guard for feature flags, subscription, and verification.
 * Blocks entire route access when:
 * - Feature flag is OFF
 * - Subscription is inactive (for non-public pages)
 */
export default function FeatureRouteGuard({ 
  flag, 
  requiresSubscription = true,
  children 
}) {
  const enabled = useFeatureFlag(flag);
  const { user, isAuthenticated } = useAuth();

  // Fetch subscription if authenticated
  const { data: subscription } = useQuery({
    queryKey: ['currentSubscription', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const subs = await base44.entities.Subscription.filter({ user_id: user.email });
      return subs[0] || null;
    },
    enabled: !!user?.email && isAuthenticated,
  });

  // Feature flag is OFF
  if (!enabled) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#263248] flex items-center justify-center">
            <Lock className="w-8 h-8 text-[#6B7A94]" />
          </div>
          <h1 className="text-xl font-bold text-[#E8EEF9] mb-2">Feature Unavailable</h1>
          <p className="text-[#9AA6BC] text-sm mb-6">This feature is not currently enabled on this platform.</p>
          <Link
            to="/Dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4F8CFF] hover:bg-[#3A7AEE] text-white rounded-lg text-sm font-medium transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Subscription is inactive (for authenticated users)
  if (isAuthenticated && requiresSubscription && !isSubscriptionActive(subscription)) {
    return <SubscriptionBlockedScreen reason={subscription?.status || 'no_subscription'} />;
  }

  return <>{children}</>;
}