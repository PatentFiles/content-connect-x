import React from 'react';
import { motion } from 'framer-motion';

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto px-4"
      >
        <h1 className="text-4xl font-bold text-[#E8EEF9] mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-[#9AA6BC] mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">1. Acceptance of Terms</h2>
            <p className="text-[#9AA6BC] mb-4">
              By accessing or using Content Connect, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">2. Eligibility</h2>
            <p className="text-[#9AA6BC] mb-4">
              You must be at least 18 years old to use Content Connect. By using this platform, you represent and warrant that you are at least 18 years of age and have the legal capacity to enter into these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">3. Verification Requirement</h2>
            <p className="text-[#9AA6BC] mb-4">
              All users must complete identity verification before accessing platform features. Verification confirms your identity and age. Failure to verify or providing false information will result in account termination.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">4. Subscription and Payments</h2>
            <p className="text-[#9AA6BC] mb-4">
              Access to platform features requires an active subscription. Subscription fees are billed in advance. You may cancel at any time, but no refunds are provided for partial periods.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">5. User Conduct</h2>
            <p className="text-[#9AA6BC] mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 text-[#9AA6BC] space-y-2">
              <li>Misrepresent your identity or credentials</li>
              <li>Harass, threaten, or intimidate other users</li>
              <li>Share content without appropriate consent</li>
              <li>Use the platform for any illegal purpose</li>
              <li>Attempt to circumvent security measures</li>
              <li>Create multiple accounts</li>
              <li>Share account credentials</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">6. Contracts and Agreements</h2>
            <p className="text-[#9AA6BC] mb-4">
              Content Connect provides tools for creating contracts between users. We are not a party to any agreements made between users. Users are responsible for ensuring their agreements comply with applicable laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">7. Payment Disclaimer</h2>
            <p className="text-[#9AA6BC] mb-4">
              Content Connect does not process payments for collaborations between users. All compensation arrangements are made directly between parties outside our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">8. Content Ownership</h2>
            <p className="text-[#9AA6BC] mb-4">
              Users retain ownership of content they upload. By uploading content, you grant Content Connect a limited license to display and distribute your content within the platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">9. Termination</h2>
            <p className="text-[#9AA6BC] mb-4">
              We reserve the right to terminate accounts that violate these terms. Users may delete their accounts at any time through account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">10. Limitation of Liability</h2>
            <p className="text-[#9AA6BC] mb-4">
              Content Connect is provided "as is" without warranties. We are not liable for any disputes between users or outcomes of collaborations arranged through our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">11. Changes to Terms</h2>
            <p className="text-[#9AA6BC] mb-4">
              We may update these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">12. Contact</h2>
            <p className="text-[#9AA6BC] mb-4">
              For questions about these Terms, contact us at legal@contentconnect.com
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}