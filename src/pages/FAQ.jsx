import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, ArrowRight } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCInput from '@/components/ui-custom/CCInput';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';

const faqCategories = [
  {
    name: 'Getting Started',
    faqs: [
      {
        q: 'What is Content Connect X?',
        a: 'Content Connect X is a verified, subscription-only professional collaboration platform for adult content professionals. We connect creators, photographers, videographers, agents, and studios in a safe, structured environment with built-in consent documentation, contracts, and safety tools. The platform is strictly for professional content creation partnerships — it is not a hookup, escort, or personal services platform.',
      },
      {
        q: 'Who can join Content Connect X?',
        a: 'Content Connect X is for adult content professionals including creators/performers, photographers, videographers, talent agents, and studios. All members must be 18 or older and complete identity verification before accessing any platform features. Use of the platform by minors is strictly prohibited.',
      },
      {
        q: 'How do I sign up?',
        a: "Click \"Get Started\" to create an account. You'll select your role (creator, photographer, etc.), complete identity verification, choose a subscription plan, and set up your profile. The entire process takes about 10–15 minutes.",
      },
      {
        q: 'Is there a free trial?',
        a: 'New members get a 7-day free trial after completing verification. During the trial, you can explore all features of your selected plan tier.',
      },
    ],
  },
  {
    name: 'Prohibited Use',
    faqs: [
      {
        q: 'What is this platform NOT for?',
        a: 'Content Connect X is strictly for professional content collaboration. The following uses are explicitly prohibited and will result in immediate account termination: soliciting or offering payment for sexual acts or escorts; arranging in-person prostitution or escorting; sex trafficking or any facilitation thereof; coercion, exploitation, or threatening any person; any activity involving minors; non-consensual content or threats to distribute intimate images. Violations may also be reported to law enforcement.',
      },
      {
        q: 'Does Content Connect X allow escort or "GFE" arrangements?',
        a: 'No. Absolutely not. Any use of the platform to solicit, offer, or arrange escorting, in-person sexual services, or any form of prostitution is a severe violation of our Terms of Service. Such use results in immediate account suspension, evidence preservation, and may be referred to law enforcement. Coded language (e.g., "roses," "donations," "GFE," "p4p," "incall," "outcall") used to solicit or offer these services is also prohibited.',
      },
      {
        q: 'What happens if I violate the platform\'s prohibited use policy?',
        a: 'Depending on severity: content is blocked before saving, your account may be immediately suspended, a moderation case is created and reviewed by our safety team, repeat violations lead to permanent ban, and for severe violations (trafficking, underage activity, non-consensual content) your account data is preserved under legal hold and may be reported to law enforcement.',
      },
    ],
  },
  {
    name: 'Verification',
    faqs: [
      {
        q: 'Why is verification required?',
        a: 'Verification is a legal and safety requirement. It confirms that all members are real people who are at least 18 years of age. This protects the community from fraud, catfishing, underage access, and other risks that are common on unverified platforms.',
      },
      {
        q: 'What does verification involve?',
        a: 'Verification requires: (1) Submitting a government-issued photo ID, (2) Taking a live selfie to match your ID, and (3) Admin review. Your documents are reviewed by authorized administrators to confirm identity and age.',
      },
      {
        q: 'How long does verification take?',
        a: 'Verification is completed through manual administrator review, which typically takes up to 24 hours. You will receive a notification when your status is updated.',
      },
      {
        q: 'Are my identity documents stored?',
        a: 'Yes. Identity documents you submit — including your government ID and selfie — are stored in secure, encrypted private storage on our platform. This is required for age verification compliance and safety record-keeping. Access to your documents is restricted to authorized reviewers only, and all access events are logged. Documents are never visible to other members — only your verification status (Verified / Not Verified / Pending) is shown. Documents may be retained for compliance purposes or under legal hold even after account deletion. See our Privacy Policy for full details.',
      },
      {
        q: 'What if my verification is rejected?',
        a: "If rejected, you'll receive a notification explaining why. Common reasons include blurry or unreadable photos, an expired ID, or a selfie that doesn't clearly match the ID. You can resubmit with corrected documents.",
      },
      {
        q: 'Does my verification expire?',
        a: 'Yes. Verification records may expire after a set period (typically 12 months from approval). You will be notified before expiration and prompted to re-verify. Expired verification may restrict access to certain platform features.',
      },
    ],
  },
  {
    name: 'Health and Safety Documents',
    faqs: [
      {
        q: 'What are testing credentials?',
        a: 'Testing credentials are optional health and safety documents — such as recent STI/HIV lab results — that members can upload to the platform. Having current testing credentials may be required by some collaboration partners as a condition of working together.',
      },
      {
        q: 'Are my health documents stored securely?',
        a: 'Yes. Health and testing documents are stored in secure, encrypted private storage. They are never publicly accessible. You control exactly who can see your credentials through your sharing settings. Other users can only see a status badge (Valid / Expired / Pending Review) and expiration date unless you explicitly grant them access to view the full document.',
      },
      {
        q: 'Who can see my health documents?',
        a: "No one by default. You choose your visibility settings: you can show only the badge publicly, share credentials with collaboration participants, or share the full document with specific people. All document access is logged. Your documents are never visible to the public or to users you haven't granted access.",
      },
      {
        q: 'Can a collaboration require testing?',
        a: 'Yes. Collaboration creators can set a testing policy requiring participants to have valid credentials before joining. This is a safety feature to support informed consent and health compliance within professional content partnerships.',
      },
    ],
  },
  {
    name: 'Subscriptions & Payments',
    faqs: [
      {
        q: 'What subscription plans are available?',
        a: 'We offer role-specific plans: Creator (Basic/Pro/Elite), Photographer (Basic/Pro), Videographer (Basic/Pro), Agent (Basic/Pro), and Studio (Basic/Pro/Enterprise). View our Pricing page for full details and feature comparisons.',
      },
      {
        q: 'Can I change my plan?',
        a: 'Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately; downgrades apply at your next billing cycle.',
      },
      {
        q: 'How do I cancel my subscription?',
        a: "You can cancel at any time from your Settings page. Your access continues until the end of your current billing period. We don't offer prorated refunds.",
      },
      {
        q: 'Does Content Connect X process collaboration payments?',
        a: 'No. Content Connect X records compensation terms in contracts but does not process payments between members. All collaboration payments are handled externally between parties. Content Connect has no liability for payment disputes between users.',
      },
    ],
  },
  {
    name: 'Discovery & Matching',
    faqs: [
      {
        q: 'How does discovery work?',
        a: 'You can browse profiles using the "Near Me" feature or Search with filters. Filter by role type, location, travel dates, compensation preferences, categories, and more. All profiles visible on the platform belong to verified, subscribed members.',
      },
      {
        q: 'Can I see profiles before subscribing?',
        a: 'No. Discovery, search, and profile viewing are only available to verified subscribers. This keeps the platform professional and protects member privacy.',
      },
      {
        q: 'What are travel dates?',
        a: "Members can add upcoming travel plans to their profile. This helps you find collaborators who will be in your area, or discover people in cities you're visiting.",
      },
    ],
  },
  {
    name: 'Collaborations & Contracts',
    faqs: [
      {
        q: 'What is a Collaboration?',
        a: 'A Collaboration is a structured workspace for negotiating and managing professional content partnerships. It includes scene planning, boundary and consent documentation, compensation terms, scheduling, deliverables, and usage rights all in one place.',
      },
      {
        q: 'Can a Collaboration include sexual content?',
        a: "Yes — within the scope of professional adult content creation. Scene types include Standard, Fetish, and Kink-Edge categories with detailed act checklists and consent documentation. However, a Collaboration cannot be used to arrange escorting, in-person sexual services for payment, or any other prohibited use as defined in our Terms of Service.",
      },
      {
        q: 'How do contracts work?',
        a: 'Once a Collaboration is complete, you can generate a contract from the agreed terms. All parties e-sign, and the contract is stored with full version history. You can export contracts as PDFs.',
      },
      {
        q: 'Are contracts legally binding?',
        a: 'Our contracts are designed to be comprehensive and professional, but legal enforceability varies by jurisdiction. We recommend consulting a legal professional for high-stakes agreements. Any contract term that facilitates prohibited conduct is void and unenforceable under our Terms of Service.',
      },
    ],
  },
  {
    name: 'Safety, Moderation & Privacy',
    faqs: [
      {
        q: 'How does content moderation work?',
        a: "Content Connect X uses real-time, server-side content moderation that scans messages, collaboration details, and profile text before they are saved. This system runs on our backend — it cannot be bypassed from the frontend. Content that violates our policies is blocked before being stored or sent. Severe violations (such as underage references, solicitation, or trafficking language) trigger automatic account suspension and a mandatory safety review.",
      },
      {
        q: 'What happens when content is flagged?',
        a: "Flagged content is blocked before saving. Depending on severity: a warning is issued and the content is logged (low risk), the content is blocked and the user is notified (high risk), or the account is immediately suspended and placed under safety review (critical risk — e.g., underage references, trafficking language). All moderation actions are logged and reviewed by our safety team.",
      },
      {
        q: 'How is my privacy protected?',
        a: 'Your profile is only visible to verified subscribers. Private galleries require explicit permission to view. Identity documents and health credentials are stored in secure private storage and are never shared with other members without your permission. Personal information is never sold to third parties.',
      },
      {
        q: 'Can I block someone?',
        a: 'Yes. You can block any member from their profile or from any conversation. Blocked users cannot view your profile or contact you.',
      },
      {
        q: 'How do I report inappropriate behavior?',
        a: 'Use the Report button on any profile or in any conversation. Reports are reviewed by our trust & safety team. For urgent safety concerns — especially suspected underage activity, trafficking, or coercion — contact safety@contentconnect.com directly.',
      },
      {
        q: 'What happens when I report an underage concern?',
        a: "Reports citing underage concerns are treated as the highest-priority safety cases. The reported account is immediately suspended pending review, a legal hold is applied (preventing account deletion), and the case is escalated to a mandatory structured review by our safety team. Such cases cannot be silently dismissed — resolution requires documented justification.",
      },
    ],
  },
];

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (categoryIndex, faqIndex) => {
    const key = `${categoryIndex}-${faqIndex}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
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
    <MobileRefreshPage>
    <div className="min-h-screen bg-cc-bg pt-24 pb-12">
      {/* Header */}
      <section className="px-4 py-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-4xl md:text-5xl font-bold cc-text-fix-primary mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg cc-text-fix-secondary max-w-2xl mx-auto mb-8">
            Everything you need to know about Content Connect X
          </p>
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
            transition={{ delay: categoryIndex * 0.05 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold cc-text-fix-primary mb-4">{category.name}</h2>
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
                      <span className="font-medium cc-text-fix-primary pr-4">{faq.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 cc-text-fix-muted transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
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
                            <p className="cc-text-fix-secondary text-sm leading-relaxed">{faq.a}</p>
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
            <p className="cc-text-fix-secondary">No questions found matching "{searchQuery}"</p>
          </div>
        )}
      </section>

      {/* Contact CTA */}
      <section className="px-4 py-16 text-center">
        <CCCard padding="lg" className="max-w-xl mx-auto">
          <h3 className="text-xl font-semibold cc-text-fix-primary mb-2">Still have questions?</h3>
          <p className="cc-text-fix-secondary mb-4">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <p className="text-xs cc-text-fix-muted mb-6">
            To report urgent safety concerns — suspected trafficking, underage activity, or coercion —
            email <a href="mailto:safety@onlycollabsx.com" className="text-[#EF4444] hover:underline">safety@onlycollabsx.com</a> directly.
          </p>
          <CCButton variant="primary" iconRight={ArrowRight}>
            Contact Support
          </CCButton>
        </CCCard>
      </section>
    </div>
    </MobileRefreshPage>
  );
}