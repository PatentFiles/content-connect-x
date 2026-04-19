import { CreditCard, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import CCButton from '@/components/ui-custom/CCButton';
import { getSubscriptionBlockMessage } from '@/lib/subscriptionGuard';

export default function SubscriptionBlockedScreen({ reason = 'inactive', onResubscribe }) {
  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#FF2DAA]/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-[#FF2DAA]" />
        </div>
        <h1 className="text-2xl font-bold text-[#E8EEF9] mb-3">Subscription Required</h1>
        <p className="text-[#9AA6BC] mb-6">
          {getSubscriptionBlockMessage(reason)}
        </p>

        <div className="bg-[#151D2B] border border-[#263248] rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-[#4F8CFF] flex-shrink-0 mt-1" />
            <div className="text-left">
              <p className="font-semibold text-[#E8EEF9] text-sm mb-1">Reactivate Your Subscription</p>
              <p className="text-xs text-[#9AA6BC]">
                Choose a plan that works for you and regain full platform access.
              </p>
            </div>
          </div>
        </div>

        <Link to="/Pricing" className="block mb-3">
          <CCButton variant="primary" size="lg" fullWidth icon={CreditCard}>
            View Plans
          </CCButton>
        </Link>

        <Link to="/">
          <CCButton variant="outline" size="lg" fullWidth>
            ← Back to Home
          </CCButton>
        </Link>
      </div>
    </div>
  );
}