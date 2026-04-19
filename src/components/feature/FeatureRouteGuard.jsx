import { useFeatureFlag } from '@/lib/featureFlags';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * FeatureRouteGuard — route guard for feature flags only.
 * Blocks entire route access when:
 * - Feature flag is OFF
 * 
 * ADMIN BYPASS: Admins can access all routes regardless of feature flags.
 * Subscription blocking is now handled globally via AuthContext.
 */
export default function FeatureRouteGuard({ 
  flag,
  children 
}) {
  const { user } = useAuth();
  const enabled = useFeatureFlag(flag);
  
  // Admin bypass: allow all routes
  const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';
  if (isAdmin) {
    return <>{children}</>;
  }

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

  return <>{children}</>;
}