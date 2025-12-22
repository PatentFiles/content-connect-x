import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, ArrowRight } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';

const faqCategories = [
  {
    name: 'Getting Started',
    faqs: [
      {
        q: 'What is Content Connect?',
        a: 'Content Connect is a verified, subscription-only collaboration platform for adult content professionals. We connect creators, photographers, videographers, agents, and studios in a safe, professional environment with built-in contracts and consent management.',
      },
      {
        q: 'Who can join Content Connect?',
        a: 'Content Connect is for adult content professionals including creators/performers, photographers, videographers, talent agents, and studios. All members must be 18+ and complete identity verification.',
      },
      {
        q: 'How do I sign up?',
        a: 'Click "Get Started" to create an account. You\'ll select your role (creator, photographer, etc.), complete identity verification, choose a subscription plan, and set up your profile. The entire process takes about 10-15 minutes.',
      },
      {
        q: 'Is there a free trial?',
        a: 'New members get a 7-day free trial after completing verification. During the trial, you can explore all features of your selected plan tier.',
      },
    ],
  },
  {
    name: 'Verification',
    faqs: [
      {
        q: 'Why is verification required?',
        a: 'Verification protects our community by ensuring all members are real people of legal age. It builds trust and helps prevent fraud, catfishing, and other issues common on unverified platforms.',
      },
      {
        q: 'What does verification involve?',
        a: 'Verification includes: 1) Submitting a government-issued ID, 2) Taking a live selfie to match your ID, 3) Age confirmation. We use industry-leading KYC providers to process verification securely.',
      },
      {
        q: 'How long does verification take?',
        a: 'Most verifications are completed within 5-10 minutes using our automated system. In some cases, manual review may take up to 24 hours.',
      },
      {
        q: 'Is my ID information safe?',
        a: 'Yes. Your ID documents are processed by our secure verification partners and are never stored on our servers or shared with other members. Only your verification status (verified/not verified) is visible.',
      },
      {
        q: 'What if my verification is rejected?',
        a: 'If rejected, you\'ll receive an email explaining why. Common reasons include blurry photos, expired ID, or mismatched selfie. You can resubmit with corrected documents.',
      },
    ],
  },
  {
    name: 'Subscriptions & Payments',
    faqs: [
      {
        q: 'What subscription plans are available?',
        a: 'We offer role-specific plans: Creator (Basic/Pro/Elite), Photographer (Basic/Pro), Videographer (Basic/Pro), Agent (Basic/Pro), and Studio (Basic/Pro/Enterprise). View our Pricing page for details.',
      },
      {
        q: 'Can I change my plan?',
        a: 'Yes, you can upgrade or downgrade your plan anytime. Upgrades take effect immediately, while downgrades apply at your next billing cycle.',
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'You can cancel anytime from your Settings page. Your access continues until the end of your current billing period. We don\'t offer prorated refunds.',
      },
      {
        q: 'Does Content Connect process collaboration payments?',
        a: 'No. Content Connect records compensation terms in contracts but does not process payments between members. All collaboration payments are handled externally between parties.',
      },
    ],
  },
  {
    name: 'Discovery & Matching',
    faqs: [
      {
        q: 'How does discovery work?',
        a: 'You can browse profiles using our "Near Me" feature or Search with filters. Filter by role type, location, travel dates, compensation preferences, categories, and more.',
      },
      {
        q: 'What are the "Looking For" preferences?',
        a: 'You can set preferences for who you want to work with based on gender identity (women, men, trans women, trans men) and orientation. Matching respects both your preferences and theirs.',
      },
      {
        q: 'Can I see profiles before subscribing?',
        a: 'No. Discovery, search, and profile viewing are only available to verified subscribers. This keeps the platform professional and protects member privacy.',
      },
      {
        q: 'What are travel dates?',
        a: 'Members can add upcoming travel plans to their profile. This helps you find collaborators who will be in your area or discover people in cities you\'re visiting.',
      },
    ],
  },
  {
    name: 'Deal Rooms & Contracts',
    faqs: [
      {
        q: 'What is a Deal Room?',
        a: 'A Deal Room is a structured workspace for negotiating collaborations. It includes a scene builder, boundary definitions, compensation terms, scheduling, deliverables, and usage rights all in one place.',
      },
      {
        q: 'What are scene types?',
        a: 'Scene types categorize content: Standard, Fetish, or Kink-Edge. Each type has relevant act checklists and boundary options.',
      },
      {
        q: 'How do contracts work?',
        a: 'Once a Deal Room is complete, you can generate a contract from the agreed terms. All parties e-sign, and the contract is stored with version history. You can export contracts as PDFs.',
      },
      {
        q: 'Are contracts legally binding?',
        a: 'Our contracts are designed to be comprehensive and professional, but legal enforceability varies by jurisdiction. We recommend consulting a legal professional for high-stakes agreements.',
      },
      {
        q: 'What contract templates are available?',
        a: 'We offer: Creator-to-Creator, Studio Release, Photo Service Agreement, Video Service Agreement, and Agent-Managed Agreement templates.',
      },
    ],
  },
  {
    name: 'Safety & Privacy',
    faqs: [
      {
        q: 'How is my privacy protected?',
        a: 'Your profile is only visible to verified subscribers. Private galleries require explicit permission to view. Personal information is never shared without consent.',
      },
      {
        q: 'Can I block someone?',
        a: 'Yes. You can block any member from your profile or from conversations. Blocked users cannot view your profile or contact you.',
      },
      {
        q: 'How do I report inappropriate behavior?',
        a: 'Use the Report button on any profile or in any conversation. Our trust & safety team reviews all reports within 24 hours.',
      },
      {
        q: 'What about testing/health credentials?',
        a: 'Members can optionally upload testing credentials which display as a badge with expiration date. Sharing full documents is permission-controlled and only available in Deal Rooms.',
      },
    ],
  },
];

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (categoryIndex, faqIndex) => {
    const key = `${categoryIndex}-${faqIndex}`;
    setOpenItems(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    faqs: category.faqs.filter(
      faq =>
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(category => category.faqs.length > 0);

  return (
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12">
      {/* Header */}
      <section className="px-4 py-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-[#E8EEF9] mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-[#9AA6BC] max-w-2xl mx-auto mb-8">
            Everything you need to know about Content Connect
          </p>

          {/* Search */}
          <div className="max-w-md mx-auto">
            <CCInput
              placeholder="Search questions..."
              icon={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </motion.div>
      </section>

      {/* FAQ Categories */}
      <section className="px-4 max-w-3xl mx-auto">
        {filteredCategories.map((category, categoryIndex) => (
          <motion.div
            key={category.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: categoryIndex * 0.1 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">{category.name}</h2>
            <div className="space-y-3">
              {category.faqs.map((faq, faqIndex) => {
                const key = `${categoryIndex}-${faqIndex}`;
                const isOpen = openItems[key];

                return (
                  <CCCard key={faq.q} padding="none" className="overflow-hidden">
                    <button
                      onClick={() => toggleItem(categoryIndex, faqIndex)}
                      className="w-full p-4 flex items-center justify-between text-left"
                    >
                      <span className="font-medium text-[#E8EEF9] pr-4">{faq.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-[#6B7A94] transition-transform flex-shrink-0 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="px-4 pb-4 pt-0">
                            <p className="text-[#9AA6BC] text-sm leading-relaxed">{faq.a}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CCCard>
                );
              })}
            </div>
          </motion.div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#9AA6BC]">No questions found matching "{searchQuery}"</p>
          </div>
        )}
      </section>

      {/* Contact CTA */}
      <section className="px-4 py-16 text-center">
        <CCCard padding="lg" className="max-w-xl mx-auto">
          <h3 className="text-xl font-semibold text-[#E8EEF9] mb-2">Still have questions?</h3>
          <p className="text-[#9AA6BC] mb-6">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <CCButton variant="primary" iconRight={ArrowRight}>
            Contact Support
          </CCButton>
        </CCCard>
      </section>
    </div>
  );
}