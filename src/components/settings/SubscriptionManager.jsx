import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  ArrowRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCModal from '@/components/ui-custom/CCModal';
import { toast } from 'sonner';

const statusConfig = {
  active:    { label: 'Active',     variant: 'success', icon: CheckCircle },
  trial:     { label: 'Trial',      variant: 'warning', icon: Clock },
  cancelled: { label: 'Cancelled',  variant: 'danger',  icon: XCircle },
  past_due:  { label: 'Past Due',   variant: 'danger',  icon: AlertCircle },
  expired:   { label: 'Expired',    variant: 'danger',  icon: XCircle },
};

export default function SubscriptionManager({ user }) {
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: allTiers = [] } = useQuery({
    queryKey: ['pricingTiers'],
    queryFn: () => base44.entities.PricingTier.filter({ is_active: true }),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const sub = subscriptions[0];
      return base44.entities.Subscription.update(sub.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['subscription']);
      setShowCancelModal(false);
      toast.success('Subscription cancelled. You retain access until the billing period ends.');
    },
  });

  const currentSub = subscriptions[0];
  const currentTier = allTiers.find(t => t.plan_id === currentSub?.plan_id);
  const cfg = statusConfig[currentSub?.status] || statusConfig.trial;
  const StatusIcon = cfg.icon;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-[#263248] rounded-xl" />
        <div className="h-16 bg-[#263248] rounded-xl" />
      </div>
    );
  }

  if (!currentSub) {
    return (
      <CCCard padding="lg">
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-[#4F8CFF]" />
          </div>
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">No Active Subscription</h3>
          <p className="text-sm text-[#9AA6BC] mb-6">
            Choose a plan to unlock Discovery, Messaging, Collaborations, and more.
          </p>
          <Link to={createPageUrl('Pricing')}>
            <CCButton variant="primary" iconRight={ArrowRight}>
              View Plans
            </CCButton>
          </Link>
        </div>
      </CCCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Plan Card */}
      <CCCard padding="lg">
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-4">Current Plan</h3>
        <div className="p-4 bg-[#0B0F14] rounded-xl border border-[#263248] mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-[#E8EEF9] text-lg">
                  {currentTier?.name || currentSub.plan_id?.replace(/_/g, ' ')}
                </p>
                {currentTier?.tier === 'pro' && (
                  <Sparkles className="w-4 h-4 text-[#4F8CFF]" />
                )}
              </div>
              <p className="text-sm text-[#9AA6BC] capitalize">{currentTier?.role_type} plan</p>
            </div>
            <CCBadge variant={cfg.variant} icon={StatusIcon}>
              {cfg.label}
            </CCBadge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            {currentSub.started_at && (
              <div>
                <p className="text-[#6B7A94]">Started</p>
                <p className="text-[#E8EEF9]">{new Date(currentSub.started_at).toLocaleDateString()}</p>
              </div>
            )}
            {currentSub.renews_at && currentSub.status !== 'cancelled' && (
              <div>
                <p className="text-[#6B7A94]">
                  {currentSub.status === 'active' ? 'Renews' : 'Expires'}
                </p>
                <p className="text-[#E8EEF9]">{new Date(currentSub.renews_at).toLocaleDateString()}</p>
              </div>
            )}
            {currentSub.cancelled_at && (
              <div>
                <p className="text-[#6B7A94]">Cancelled</p>
                <p className="text-[#EF4444]">{new Date(currentSub.cancelled_at).toLocaleDateString()}</p>
              </div>
            )}
            {currentTier?.price_monthly && (
              <div>
                <p className="text-[#6B7A94]">Price</p>
                <p className="text-[#E8EEF9]">${currentTier.price_monthly}/mo</p>
              </div>
            )}
          </div>
        </div>

        {/* Plan Features */}
        {currentTier?.features?.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-[#9AA6BC] mb-2">Your plan includes:</p>
            <ul className="space-y-1">
              {currentTier.features.slice(0, 5).map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[#E8EEF9]">
                  <CheckCircle className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link to={createPageUrl('Pricing')} className="flex-1">
            <CCButton variant="outline" fullWidth iconRight={ArrowRight}>
              {currentSub.status === 'cancelled' ? 'Re-subscribe' : 'Change Plan'}
            </CCButton>
          </Link>

          {currentSub.status === 'active' && currentSub.external_subscription_id && (
            <CCButton
              variant="outline"
              icon={ExternalLink}
              onClick={() => window.open('https://billing.stripe.com/p/login/test_placeholder', '_blank')}
            >
              Billing Portal
            </CCButton>
          )}
        </div>
      </CCCard>

      {/* Past Due Warning */}
      {currentSub.status === 'past_due' && (
        <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#EF4444]">Payment Failed</p>
            <p className="text-xs text-[#9AA6BC] mt-1">
              Your last payment failed. Please update your payment method to continue access.
            </p>
          </div>
          <Link to={createPageUrl('Pricing')}>
            <CCButton variant="danger" size="sm">Update Payment</CCButton>
          </Link>
        </div>
      )}

      {/* Trial Banner */}
      {currentSub.status === 'trial' && (
        <div className="p-4 bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-xl flex items-start gap-3">
          <Clock className="w-5 h-5 text-[#4F8CFF] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#4F8CFF]">Trial Period Active</p>
            <p className="text-xs text-[#9AA6BC] mt-1">
              {currentSub.renews_at
                ? `Your trial ends ${new Date(currentSub.renews_at).toLocaleDateString()}. Subscribe to keep access.`
                : 'Subscribe to a paid plan to keep access after your trial ends.'}
            </p>
          </div>
          <Link to={createPageUrl('Pricing')}>
            <CCButton variant="primary" size="sm">Subscribe Now</CCButton>
          </Link>
        </div>
      )}

      {/* Cancel Subscription */}
      {currentSub.status === 'active' && (
        <CCCard padding="md" className="border-[#EF4444]/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#E8EEF9]">Cancel Subscription</p>
              <p className="text-xs text-[#6B7A94]">You retain access until the end of your billing period.</p>
            </div>
            <CCButton
              variant="ghost"
              size="sm"
              className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel
            </CCButton>
          </div>
        </CCCard>
      )}

      {/* Cancel Confirmation Modal */}
      <CCModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Subscription"
      >
        <div className="space-y-4">
          <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
            <p className="text-sm text-[#E8EEF9]">
              Are you sure you want to cancel? You'll lose access to:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[#9AA6BC]">
              <li>• Profile discovery and browsing</li>
              <li>• Messaging with other members</li>
              <li>• Creating and managing collaborations</li>
              <li>• Digital contract features</li>
            </ul>
          </div>
          <p className="text-xs text-[#6B7A94]">
            Your plan remains active until the end of your current billing period: {currentSub?.renews_at ? new Date(currentSub.renews_at).toLocaleDateString() : 'end of period'}.
          </p>
          <div className="flex gap-3 justify-end">
            <CCButton variant="outline" onClick={() => setShowCancelModal(false)}>
              Keep Subscription
            </CCButton>
            <CCButton
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
            >
              Yes, Cancel
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}