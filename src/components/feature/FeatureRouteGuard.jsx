import { useFeatureFlag } from '@/lib/featureFlags';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

/**
 * FeatureRouteGuard — blocks the entire route when a feature flag is OFF.
 * Unlike FeatureGate (which only hides UI), this prevents access to the page itself.
 */
export default function FeatureRouteGuard({ flag, children }) {
  const enabled = useFeatureFlag(flag);

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