import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, Sparkles, Shield, Zap, Crown, ExternalLink } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCTabsList } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import { toast } from 'sonner';

const roleLabels = {
  creator: 'Creator',
  photographer: 'Photographer',
  videographer: 'Videographer',
  agent: 'Agent',
  studio: 'Studio',
};

const tierIcons = {
  basic: Shield,
  pro: Zap,
  elite: Crown,
  enterprise: Sparkles,
};

const tierColors = {
  basic:      { ring: '', bg: '' },
  pro:        { ring: 'ring-2 ring-[#4F8CFF]', bg: 'bg-[#4F8CFF]' },
  elite:      { ring: 'ring-2 ring-[#FF2DAA]', bg: 'bg-[#FF2DAA]' },
  enterprise: { ring: 'ring-2 ring-[#F59E0B]', bg: 'bg-[#F59E0B]' },
};

export default function Pricing() {
  const [activeRole, setActiveRole] = useState('creator');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectingPlan, setSelectingPlan] = useState(null);
  const queryClient = useQueryClient();

  // Auth / user state
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return null;
      return base44.auth.me();
    },
  });

  const { data: userProfile = [] } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch pricing tiers
  const { data: allTiers = [], isLoading } = useQuery({
    queryKey: ['pricingTiers'],
    queryFn: () => base44.entities.PricingTier.filter({ is_active: true }),
  });

  const currentSubscription = subscriptions[0];
  const currentProfile = userProfile[0];

  // When user selects a plan — if Stripe Payment Link configured, redirect there.
  // Otherwise, create a Subscription record in trial state and redirect to Dashboard.
  const selectPlanMutation = useMutation({
    mutationFn: async (plan) => {
      // If plan has a Stripe Payment Link, redirect to it
      const stripeLink = billingCycle === 'yearly'
        ? plan.stripe_payment_link_yearly
        : plan.stripe_payment_link_monthly;

      if (stripeLink) {
        // Append prefill params for Stripe to auto-fill email
        const url = user?.email
          ? `${stripeLink}?prefilled_email=${encodeURIComponent(user.email)}&client_reference_id=${user.email}`
          : stripeLink;
        window.open(url, '_blank');
        return { redirected: true };
      }

      // Fallback: create/update subscription in trial mode
      if (!user) {
        base44.auth.redirectToLogin(createPageUrl('Pricing'));
        return;
      }

      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);

      if (currentSubscription) {
        return base44.entities.Subscription.update(currentSubscription.id, {
          plan_id: plan.plan_id,
          status: 'trial',
          started_at: now.toISOString(),
          renews_at: trialEnd.toISOString(),
          payment_provider: 'stripe',
        });
      } else {
        return base44.entities.Subscription.create({
          user_id: user.email,
          plan_id: plan.plan_id,
          status: 'trial',
          started_at: now.toISOString(),
          renews_at: trialEnd.toISOString(),
          payment_provider: 'stripe',
        });
      }
    },
    onSuccess: (result) => {
      if (result?.redirected) {
        toast.info('Redirecting to secure checkout...', { duration: 3000 });
        return;
      }
      queryClient.invalidateQueries(['subscription']);
      toast.success('Plan selected! Your 14-day trial has started.');
      setSelectingPlan(null);
      setTimeout(() => {
        window.location.href = createPageUrl('Dashboard');
      }, 1000);
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
    },
  });

  const handleSelectPlan = (plan) => {
    if (!user) {
      base44.auth.redirectToLogin(createPageUrl('Pricing'));
      return;
    }
    setSelectingPlan(plan.plan_id);
    selectPlanMutation.mutate(plan);
  };

  if (isLoading) return <CCLoadingScreen message="Loading pricing..." />;

  // Group tiers by role, sorted by sort_order
  const sortByPrice = (a, b) => (a.price_monthly || 0) - (b.price_monthly || 0);
  const pricingData = {
    creator:      allTiers.filter(t => t.role_type === 'creator').sort(sortByPrice),
    photographer: allTiers.filter(t => t.role_type === 'photographer').sort(sortByPrice),
    videographer: allTiers.filter(t => t.role_type === 'videographer').sort(sortByPrice),
    agent:        allTiers.filter(t => t.role_type === 'agent').sort(sortByPrice),
    studio:       allTiers.filter(t => t.role_type === 'studio').sort(sortByPrice),
  };

  // If user has a profile, default to their role tab
  const defaultRole = currentProfile?.role_type || 'creator';
  const availableRoles = Object.keys(pricingData).filter(r => pricingData[r].length > 0);
  const tabs = availableRoles.map(key => ({ value: key, label: roleLabels[key] }));

  // Use profile role as active if we haven't overridden
  const displayRole = availableRoles.includes(activeRole) ? activeRole : availableRoles[0] || 'creator';

  return (
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12">
      {/* Header */}
      <section className="px-4 py-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold text-[#E8EEF9] mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-[#9AA6BC] max-w-2xl mx-auto mb-8">
            Choose the plan that fits your role and needs. All plans include verification and core platform features.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#121824] rounded-xl border border-[#263248]">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-[#4F8CFF] text-white shadow-lg'
                  : 'text-[#9AA6BC] hover:text-[#E8EEF9]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-[#4F8CFF] text-white shadow-lg'
                  : 'text-[#9AA6BC] hover:text-[#E8EEF9]'
              }`}
            >
              Yearly
              <span className="text-xs bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 rounded-full px-1.5 py-0.5 font-semibold">Save 17%</span>
            </button>
          </div>

          {/* Current plan banner */}
          {currentSubscription && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-full text-sm text-[#22C55E]"
            >
              <Check className="w-4 h-4" />
              Current plan: <strong>{currentSubscription.plan_id?.replace(/_/g, ' ')}</strong>
              &nbsp;({currentSubscription.status})
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Role tabs */}
      <section className="px-4 max-w-6xl mx-auto">
        {tabs.length > 0 && (
          <CCTabsList
            tabs={tabs}
            activeTab={displayRole}
            onChange={setActiveRole}
            className="mb-10 max-w-xl mx-auto"
          />
        )}

        {/* Pricing cards */}
        <AnimatePresence mode="wait">
          <motion.div
            key={displayRole}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`grid gap-6 ${
              pricingData[displayRole]?.length === 2
                ? 'md:grid-cols-2 max-w-3xl mx-auto'
                : pricingData[displayRole]?.length === 1
                ? 'max-w-sm mx-auto'
                : 'md:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {pricingData[displayRole]?.map((plan, i) => {
              const isHighlighted = plan.tier === 'pro' || plan.tier === 'elite';
              const tierStyle = tierColors[plan.tier] || tierColors.basic;
              const TierIcon = tierIcons[plan.tier] || Shield;
              const isCurrent = currentSubscription?.plan_id === plan.plan_id;
              const monthlyPrice = billingCycle === 'monthly'
                ? plan.price_monthly
                : (plan.price_yearly ? Math.round(plan.price_yearly / 12) : null);
              const hasStripeLink = billingCycle === 'yearly'
                ? !!plan.stripe_payment_link_yearly
                : !!plan.stripe_payment_link_monthly;

              return (
                <motion.div
                  key={plan.plan_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <CCCard
                    padding="none"
                    className={`relative overflow-hidden flex flex-col h-full ${tierStyle.ring}`}
                  >
                    {/* Popular / badge */}
                    {plan.tier === 'pro' && (
                      <div className={`${tierStyle.bg} py-1.5 text-center`}>
                        <span className="text-xs font-bold text-white tracking-wide flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3" /> MOST POPULAR
                        </span>
                      </div>
                    )}
                    {plan.tier === 'elite' && (
                      <div className={`${tierStyle.bg} py-1.5 text-center`}>
                        <span className="text-xs font-bold text-white tracking-wide flex items-center justify-center gap-1">
                          <Crown className="w-3 h-3" /> BEST VALUE
                        </span>
                      </div>
                    )}

                    <div className="p-6 flex flex-col flex-1">
                      {/* Plan Name & Icon */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isHighlighted ? `${tierStyle.bg}/20` : 'bg-[#263248]'
                        }`}>
                          <TierIcon className={`w-5 h-5 ${isHighlighted ? 'text-[#E8EEF9]' : 'text-[#9AA6BC]'}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-[#E8EEF9]">{plan.name}</h3>
                          <p className="text-xs text-[#6B7A94] capitalize">{plan.tier} tier</p>
                        </div>
                      </div>

                      {plan.description && (
                        <p className="text-sm text-[#9AA6BC] mb-4">{plan.description}</p>
                      )}

                      {/* Price */}
                      <div className="mb-5">
                        {monthlyPrice != null ? (
                          <>
                            <div className="flex items-end gap-1">
                              <span className="text-4xl font-bold text-[#E8EEF9]">${monthlyPrice}</span>
                              <span className="text-[#6B7A94] mb-1">/mo</span>
                            </div>
                            {billingCycle === 'yearly' && plan.price_yearly && (
                              <p className="text-xs text-[#22C55E] mt-1">
                                ${plan.price_yearly} billed yearly
                                &nbsp;• Save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(0)}/yr
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-2xl font-bold text-[#E8EEF9]">Contact Us</span>
                        )}
                      </div>

                      {/* CTA Button */}
                      <div className="mb-6">
                        {isCurrent ? (
                          <CCButton variant="outline" fullWidth disabled>
                            <Check className="w-4 h-4 mr-1" />
                            Current Plan
                          </CCButton>
                        ) : (
                          <CCButton
                            variant={isHighlighted ? 'primary' : 'outline'}
                            fullWidth
                            loading={selectingPlan === plan.plan_id && selectPlanMutation.isPending}
                            onClick={() => handleSelectPlan(plan)}
                            iconRight={hasStripeLink ? ExternalLink : ArrowRight}
                          >
                            {hasStripeLink ? 'Subscribe with Stripe' : user ? 'Start Free Trial' : 'Get Started'}
                          </CCButton>
                        )}
                        {!hasStripeLink && !isCurrent && (
                          <p className="text-center text-xs text-[#6B7A94] mt-2">14-day free trial • No credit card required</p>
                        )}
                      </div>

                      {/* Features */}
                      {plan.features?.length > 0 && (
                        <ul className="space-y-2.5 mt-auto">
                          {plan.features.map((feat) => (
                            <li key={feat} className="flex items-start gap-2 text-sm">
                              <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                              <span className="text-[#E8EEF9]">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Limits */}
                      {plan.limits && Object.keys(plan.limits).some(k => plan.limits[k]) && (
                        <div className="mt-4 pt-4 border-t border-[#263248]">
                          <p className="text-xs font-medium text-[#6B7A94] mb-2 uppercase tracking-wide">Limits</p>
                          <div className="grid grid-cols-2 gap-2">
                            {plan.limits.messages_per_day != null && (
                              <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
                                <p className="text-xs font-semibold text-[#4F8CFF]">{plan.limits.messages_per_day < 0 ? '∞' : plan.limits.messages_per_day}</p>
                                <p className="text-xs text-[#6B7A94]">msgs/day</p>
                              </div>
                            )}
                            {plan.limits.deal_rooms_per_month != null && (
                              <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
                                <p className="text-xs font-semibold text-[#4F8CFF]">{plan.limits.deal_rooms_per_month < 0 ? '∞' : plan.limits.deal_rooms_per_month}</p>
                                <p className="text-xs text-[#6B7A94]">collabs/mo</p>
                              </div>
                            )}
                            {plan.limits.gallery_items != null && (
                              <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
                                <p className="text-xs font-semibold text-[#4F8CFF]">{plan.limits.gallery_items < 0 ? '∞' : plan.limits.gallery_items}</p>
                                <p className="text-xs text-[#6B7A94]">gallery items</p>
                              </div>
                            )}
                            {plan.limits.shortlists != null && (
                              <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
                                <p className="text-xs font-semibold text-[#4F8CFF]">{plan.limits.shortlists < 0 ? '∞' : plan.limits.shortlists}</p>
                                <p className="text-xs text-[#6B7A94]">shortlists</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CCCard>
                </motion.div>
              );
            })}

            {/* No tiers for this role */}
            {pricingData[displayRole]?.length === 0 && (
              <div className="col-span-3 text-center py-16 text-[#6B7A94]">
                <p>No plans available for this role yet.</p>
                <p className="text-sm mt-1">Contact support to discuss custom pricing.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* Stripe Notice */}
      <section className="px-4 max-w-4xl mx-auto mt-12">
        <div className="p-4 bg-[#151D2B] border border-[#263248] rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#4F8CFF] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-[#9AA6BC]">
            <strong className="text-[#E8EEF9]">Secure Payments via Stripe.</strong>
            {' '}When a Stripe Payment Link is configured for a plan, clicking "Subscribe with Stripe" opens a secure Stripe-hosted checkout. Your payment info is never stored on our servers.
            {' '}Admins can configure Stripe Payment Links per plan in Admin → Pricing settings.
          </div>
        </div>
      </section>

      {/* FAQ link */}
      <section className="px-4 py-12 text-center">
        <p className="text-[#9AA6BC] mb-4">Have questions about pricing?</p>
        <Link to={createPageUrl('FAQ')}>
          <CCButton variant="outline" iconRight={ArrowRight}>View FAQ</CCButton>
        </Link>
      </section>
    </div>
  );
}