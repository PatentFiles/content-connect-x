import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { Check, X, ArrowRight, Sparkles } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { CCTabs, CCTabsList, CCTabsContent } from '@/components/ui-custom/CCTabs';

const pricingData = {
  creator: [
    {
      name: 'Creator Basic',
      price: { monthly: 19, yearly: 190 },
      description: 'For creators just getting started',
      features: [
        { text: 'Verified profile badge', included: true },
        { text: 'Browse & search profiles', included: true },
        { text: '10 messages/day', included: true },
        { text: '2 deal rooms/month', included: true },
        { text: 'Public gallery (10 items)', included: true },
        { text: 'Basic contract templates', included: true },
        { text: 'Private gallery', included: false },
        { text: 'Priority support', included: false },
      ],
      popular: false,
    },
    {
      name: 'Creator Pro',
      price: { monthly: 39, yearly: 390 },
      description: 'For active content creators',
      features: [
        { text: 'Verified profile badge', included: true },
        { text: 'Browse & search profiles', included: true },
        { text: 'Unlimited messages', included: true },
        { text: '10 deal rooms/month', included: true },
        { text: 'Public gallery (50 items)', included: true },
        { text: 'Private gallery (25 items)', included: true },
        { text: 'All contract templates', included: true },
        { text: 'Priority support', included: true },
      ],
      popular: true,
    },
    {
      name: 'Creator Elite',
      price: { monthly: 79, yearly: 790 },
      description: 'For established professionals',
      features: [
        { text: 'Everything in Pro', included: true },
        { text: 'Unlimited deal rooms', included: true },
        { text: 'Unlimited galleries', included: true },
        { text: 'Featured in discovery', included: true },
        { text: 'Analytics dashboard', included: true },
        { text: 'Custom contract clauses', included: true },
        { text: 'Dedicated support', included: true },
        { text: 'Early access features', included: true },
      ],
      popular: false,
    },
  ],
  photographer: [
    {
      name: 'Photo Basic',
      price: { monthly: 29, yearly: 290 },
      description: 'For freelance photographers',
      features: [
        { text: 'Verified profile badge', included: true },
        { text: 'Portfolio showcase (20 items)', included: true },
        { text: 'Rate & package listings', included: true },
        { text: '20 messages/day', included: true },
        { text: '5 deal rooms/month', included: true },
        { text: 'Photo service contracts', included: true },
        { text: 'Gear list display', included: true },
        { text: 'Priority support', included: false },
      ],
      popular: false,
    },
    {
      name: 'Photo Pro',
      price: { monthly: 59, yearly: 590 },
      description: 'For full-time professionals',
      features: [
        { text: 'Everything in Basic', included: true },
        { text: 'Unlimited portfolio items', included: true },
        { text: 'Unlimited messages', included: true },
        { text: 'Unlimited deal rooms', included: true },
        { text: 'Featured in discovery', included: true },
        { text: 'Booking calendar', included: true },
        { text: 'Analytics dashboard', included: true },
        { text: 'Priority support', included: true },
      ],
      popular: true,
    },
  ],
  videographer: [
    {
      name: 'Video Basic',
      price: { monthly: 29, yearly: 290 },
      description: 'For freelance videographers',
      features: [
        { text: 'Verified profile badge', included: true },
        { text: 'Portfolio showcase (10 videos)', included: true },
        { text: 'Rate & package listings', included: true },
        { text: '20 messages/day', included: true },
        { text: '5 deal rooms/month', included: true },
        { text: 'Video service contracts', included: true },
        { text: 'Gear list display', included: true },
        { text: 'Priority support', included: false },
      ],
      popular: false,
    },
    {
      name: 'Video Pro',
      price: { monthly: 59, yearly: 590 },
      description: 'For full-time professionals',
      features: [
        { text: 'Everything in Basic', included: true },
        { text: 'Unlimited portfolio items', included: true },
        { text: 'Unlimited messages', included: true },
        { text: 'Unlimited deal rooms', included: true },
        { text: 'Featured in discovery', included: true },
        { text: 'Booking calendar', included: true },
        { text: 'Analytics dashboard', included: true },
        { text: 'Priority support', included: true },
      ],
      popular: true,
    },
  ],
  agent: [
    {
      name: 'Agent Basic',
      price: { monthly: 49, yearly: 490 },
      description: 'For independent agents',
      features: [
        { text: 'Manage up to 5 creators', included: true },
        { text: 'Creator dashboard', included: true },
        { text: 'Unlimited messages', included: true },
        { text: '20 deal rooms/month', included: true },
        { text: 'Agent-managed contracts', included: true },
        { text: 'Permission controls', included: true },
        { text: 'Multi-creator calendar', included: false },
        { text: 'Analytics dashboard', included: false },
      ],
      popular: false,
    },
    {
      name: 'Agent Pro',
      price: { monthly: 99, yearly: 990 },
      description: 'For agencies',
      features: [
        { text: 'Manage unlimited creators', included: true },
        { text: 'Everything in Basic', included: true },
        { text: 'Unlimited deal rooms', included: true },
        { text: 'Multi-creator calendar', included: true },
        { text: 'Analytics dashboard', included: true },
        { text: 'Bulk messaging', included: true },
        { text: 'Team collaboration', included: true },
        { text: 'Priority support', included: true },
      ],
      popular: true,
    },
  ],
  studio: [
    {
      name: 'Studio Basic',
      price: { monthly: 79, yearly: 790 },
      description: 'For small studios',
      features: [
        { text: 'Studio profile & locations', included: true },
        { text: 'Unlimited messages', included: true },
        { text: 'Shortlists & favorites', included: true },
        { text: 'Studio release contracts', included: true },
        { text: '20 deal rooms/month', included: true },
        { text: '1 staff seat', included: true },
        { text: 'Booking inquiries', included: true },
        { text: 'Analytics', included: false },
      ],
      popular: false,
    },
    {
      name: 'Studio Pro',
      price: { monthly: 149, yearly: 1490 },
      description: 'For established studios',
      features: [
        { text: 'Everything in Basic', included: true },
        { text: '5 staff seats', included: true },
        { text: 'Unlimited deal rooms', included: true },
        { text: 'Custom contract templates', included: true },
        { text: 'Analytics dashboard', included: true },
        { text: 'Talent database', included: true },
        { text: 'Priority support', included: true },
        { text: 'API access', included: true },
      ],
      popular: true,
    },
    {
      name: 'Studio Enterprise',
      price: { monthly: 299, yearly: 2990 },
      description: 'For large productions',
      features: [
        { text: 'Everything in Pro', included: true },
        { text: 'Unlimited staff seats', included: true },
        { text: 'White-label options', included: true },
        { text: 'Dedicated account manager', included: true },
        { text: 'Custom integrations', included: true },
        { text: 'SLA guarantee', included: true },
        { text: 'On-site training', included: true },
        { text: 'Volume discounts', included: true },
      ],
      popular: false,
    },
  ],
};

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

  const tabs = Object.keys(pricingData).map(key => ({
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
          {pricingData[activeRole].map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <CCCard
                padding="none"
                className={`relative overflow-hidden ${
                  plan.popular ? 'ring-2 ring-[#4F8CFF]' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <CCBadge variant="primary" className="rounded-none rounded-bl-lg">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Most Popular
                    </CCBadge>
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[#E8EEF9] mb-1">{plan.name}</h3>
                  <p className="text-sm text-[#9AA6BC] mb-4">{plan.description}</p>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-[#E8EEF9]">
                      ${billingCycle === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12)}
                    </span>
                    <span className="text-[#6B7A94]">/month</span>
                    {billingCycle === 'yearly' && (
                      <p className="text-sm text-[#22C55E] mt-1">
                        ${plan.price.yearly} billed yearly
                      </p>
                    )}
                  </div>

                  <Link to={createPageUrl('Signup')}>
                    <CCButton
                      variant={plan.popular ? 'primary' : 'outline'}
                      fullWidth
                      className="mb-6"
                    >
                      Get Started
                    </CCButton>
                  </Link>

                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-start gap-2 text-sm">
                        {feature.included ? (
                          <Check className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-4 h-4 text-[#6B7A94] flex-shrink-0 mt-0.5" />
                        )}
                        <span className={feature.included ? 'text-[#E8EEF9]' : 'text-[#6B7A94]'}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CCCard>
            </motion.div>
          ))}
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