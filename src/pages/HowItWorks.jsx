import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, 
  CreditCard, 
  Search, 
  Briefcase, 
  FileText,
  ArrowRight,
  CheckCircle,
  Users,
  MessageCircle,
  Lock
} from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';

const steps = [
  {
    step: 1,
    icon: ShieldCheck,
    title: 'Verify Your Identity',
    description: 'Complete our secure identity verification process to prove you are who you say you are. This keeps our community safe and builds trust among members.',
    details: [
      'Age verification required',
      'Identity document check',
      'Selfie verification',
      'Takes less than 5 minutes',
    ],
    color: 'primary',
  },
  {
    step: 2,
    icon: CreditCard,
    title: 'Choose Your Plan',
    description: 'Select a subscription plan that fits your needs. Different tiers offer different features based on whether you\'re a creator, photographer, agent, or studio.',
    details: [
      'Plans starting at $19/month',
      'Cancel anytime',
      'Role-specific features',
      'Upgrade or downgrade easily',
    ],
    color: 'accent',
  },
  {
    step: 3,
    icon: Search,
    title: 'Discover & Connect',
    description: 'Browse verified profiles, use smart filters to find your ideal collaborators, and connect with people who match your preferences and work style.',
    details: [
      'Filter by location & travel dates',
      'Match based on preferences',
      'See compensation types',
      'View verified badges',
    ],
    color: 'primary',
  },
  {
    step: 4,
    icon: Briefcase,
    title: 'Negotiate Collaborations',
    description: 'Create structured collaborations. Define scene types, boundaries, compensation, deliverables, and usage rights all in one organized space.',
    details: [
      'Scene builder with act checklist',
      'Clear boundary definitions',
      'Compensation terms',
      'Schedule & location planning',
    ],
    color: 'accent',
  },
  {
    step: 5,
    icon: FileText,
    title: 'Sign Contracts',
    description: 'Generate professional contracts from your collaboration details. All parties can e-sign, and contracts are versioned and archived for your records.',
    details: [
      'Multiple contract templates',
      'E-signature capture',
      'Version history tracking',
      'PDF export available',
    ],
    color: 'primary',
  },
];

const faqs = [
  {
    q: 'Why do I need to verify?',
    a: 'Verification protects everyone in the community by ensuring all members are real, of legal age, and who they claim to be.',
  },
  {
    q: 'Is my data safe?',
    a: 'Yes. We use industry-standard encryption and never share your verification documents with other members. Only verification status is visible.',
  },
  {
    q: 'Can I use the platform before verifying?',
    a: 'No. Verification is mandatory to access discovery, messaging, and all collaboration features. Your profile is hidden until verified.',
  },
  {
    q: 'How do payments work?',
    a: 'Content Connect X does not process collaboration payments. All compensation terms are recorded in contracts, but payments are handled externally between parties.',
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12">
      {/* Header */}
      <section className="px-4 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-[#E8EEF9] mb-4">
          How Content Connect X Works
          </h1>
          <p className="text-lg text-[#9AA6BC] max-w-2xl mx-auto">
            Our five-step process ensures safe, professional collaborations from start to finish.
          </p>
        </motion.div>
      </section>

      {/* Steps */}
      <section className="px-4 max-w-4xl mx-auto">
        <div className="relative">
          {/* Connection line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#4F8CFF] to-[#FF2DAA] hidden md:block" />

          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col md:flex-row gap-6 mb-12 ${
                i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              }`}
            >
              {/* Step number - center on desktop */}
              <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-[#151D2B] border-2 border-[#4F8CFF] items-center justify-center z-10">
                <span className="text-2xl font-bold text-[#4F8CFF]">{step.step}</span>
              </div>

              {/* Content */}
              <div className={`flex-1 ${i % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                <CCCard padding="lg">
                  <div className={`flex items-start gap-4 ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                    <div className={`w-12 h-12 rounded-xl bg-${step.color === 'primary' ? '[#4F8CFF]' : '[#FF2DAA]'}/20 flex items-center justify-center flex-shrink-0`}>
                      <step.icon className={`w-6 h-6 text-${step.color === 'primary' ? '[#4F8CFF]' : '[#FF2DAA]'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="md:hidden text-sm text-[#4F8CFF] font-medium mb-1">Step {step.step}</div>
                      <h3 className="text-xl font-semibold text-[#E8EEF9] mb-2">{step.title}</h3>
                      <p className="text-[#9AA6BC] text-sm mb-4">{step.description}</p>
                      <ul className={`space-y-2 ${i % 2 === 0 ? 'md:text-left' : ''}`}>
                        {step.details.map((detail) => (
                          <li key={detail} className="flex items-center gap-2 text-sm text-[#E8EEF9]">
                            <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CCCard>
              </div>

              {/* Spacer for alternating layout */}
              <div className="hidden md:block flex-1" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Key Points */}
      <section className="px-4 py-16 bg-[#121824] mt-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-[#E8EEF9] text-center mb-10">Key Platform Rules</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <CCCard padding="lg" className="text-center">
              <Lock className="w-10 h-10 text-[#4F8CFF] mx-auto mb-4" />
              <h3 className="font-semibold text-[#E8EEF9] mb-2">Verified Only</h3>
              <p className="text-sm text-[#9AA6BC]">
                Profile hidden until verified. No access to browse, search, or message without verification.
              </p>
            </CCCard>
            <CCCard padding="lg" className="text-center">
              <CreditCard className="w-10 h-10 text-[#FF2DAA] mx-auto mb-4" />
              <h3 className="font-semibold text-[#E8EEF9] mb-2">Subscription Required</h3>
              <p className="text-sm text-[#9AA6BC]">
                Active subscription needed for all platform features. Free trial available for new members.
              </p>
            </CCCard>
            <CCCard padding="lg" className="text-center">
              <FileText className="w-10 h-10 text-[#22C55E] mx-auto mb-4" />
              <h3 className="font-semibold text-[#E8EEF9] mb-2">Contract First</h3>
              <p className="text-sm text-[#9AA6BC]">
                All collaborations can generate contracts. Terms are recorded but payments happen externally.
              </p>
            </CCCard>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-[#E8EEF9] text-center mb-10">Quick Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <CCCard key={faq.q} padding="lg">
              <h3 className="font-semibold text-[#E8EEF9] mb-2">{faq.q}</h3>
              <p className="text-sm text-[#9AA6BC]">{faq.a}</p>
            </CCCard>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-12 text-center">
        <Link to={createPageUrl('Signup')}>
          <CCButton variant="primary" size="xl" iconRight={ArrowRight}>
            Get Started Now
          </CCButton>
        </Link>
      </section>
    </div>
  );
}