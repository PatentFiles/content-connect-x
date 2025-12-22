import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';

const roleLabels = {
  creator: 'Creator',
  photographer: 'Photographer',
  videographer: 'Videographer',
  agent: 'Agent',
  studio: 'Studio',
};

export default function Pricing() {
  const [activeRole, setActiveRole] = useState('creator');
  const [billingCycle, setBillingCycle] = useState('monthly');

  // Fetch pricing tiers from database
  const { data: allTiers = [], isLoading } = useQuery({
    queryKey: ['pricingTiers'],
    queryFn: () => base44.entities.PricingTier.filter({ is_active: true }),
  });

  if (isLoading) {
    return <CCLoadingScreen message="Loading pricing..." />;
  }

  // Group tiers by role
  const pricingData = {
    creator: allTiers.filter(t => t.role_type === 'creator'),
    photographer: allTiers.filter(t => t.role_type === 'photographer'),
    videographer: allTiers.filter(t => t.role_type === 'videographer'),
    agent: allTiers.filter(t => t.role_type === 'agent'),
    studio: allTiers.filter(t => t.role_type === 'studio'),
  };

  const availableRoles = Object.keys(pricingData).filter(role => pricingData[role].length > 0);
  const tabs = availableRoles.map(key => ({
    value: key,
    label: roleLabels[key],
  }));

  return (
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12">
      {/* Header */}
      <section className="px-4 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-[#E8EEF9] mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-[#9AA6BC] max-w-2xl mx-auto mb-8">
            Choose the plan that fits your role and needs. All plans include verification and core platform features.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-[#121824] rounded-lg border border-[#263248]">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly' 
                  ? 'bg-[#4F8CFF] text-white' 
                  : 'text-[#9AA6BC] hover:text-[#E8EEF9]'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                billingCycle === 'yearly' 
                  ? 'bg-[#4F8CFF] text-white' 
                  : 'text-[#9AA6BC] hover:text-[#E8EEF9]'
              }`}
            >
              Yearly
              <CCBadge variant="success" size="sm">Save 17%</CCBadge>
            </button>
          </div>
        </motion.div>
      </section>

      {/* Role tabs */}
      <section className="px-4 max-w-6xl mx-auto">
        <CCTabsList 
          tabs={tabs} 
          activeTab={activeRole} 
          onChange={setActiveRole}
          className="mb-8 max-w-xl mx-auto"
        />

        {/* Pricing cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pricingData[activeRole]?.map((plan, i) => {
            const isPro = plan.tier === 'pro';
            return (
              <motion.div
                key={plan.plan_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <CCCard
                  padding="none"
                  className={`relative overflow-hidden ${
                    isPro ? 'ring-2 ring-[#4F8CFF]' : ''
                  }`}
                >
                  {isPro && (
                    <div className="absolute top-0 right-0">
                      <CCBadge variant="primary" className="rounded-none rounded-bl-lg">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Most Popular
                      </CCBadge>
                    </div>
                  )}

                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-[#E8EEF9] mb-1">{plan.name}</h3>
                    <p className="text-sm text-[#9AA6BC] mb-4">{plan.description || `${plan.tier} tier for ${plan.role_type}s`}</p>
                    
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-[#E8EEF9]">
                        ${billingCycle === 'monthly' ? plan.price_monthly : Math.round(plan.price_yearly / 12)}
                      </span>
                      <span className="text-[#6B7A94]">/month</span>
                      {billingCycle === 'yearly' && (
                        <p className="text-sm text-[#22C55E] mt-1">
                          ${plan.price_yearly} billed yearly
                        </p>
                      )}
                    </div>

                    <Link to={createPageUrl('Signup')}>
                      <CCButton
                        variant={isPro ? 'primary' : 'outline'}
                        fullWidth
                        className="mb-6"
                      >
                        Get Started
                      </CCButton>
                    </Link>

                    <ul className="space-y-3">
                      {plan.features?.map((featureText) => (
                        <li key={featureText} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                          <span className="text-[#E8EEF9]">{featureText}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CCCard>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* FAQ link */}
      <section className="px-4 py-16 text-center">
        <p className="text-[#9AA6BC] mb-4">Have questions about pricing?</p>
        <Link to={createPageUrl('FAQ')}>
          <CCButton variant="outline" iconRight={ArrowRight}>
            View FAQ
          </CCButton>
        </Link>
      </section>
    </div>
  );
}