import React from 'react';
import { motion } from 'framer-motion';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto px-4"
      >
        <h1 className="text-4xl font-bold text-[#E8EEF9] mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none">
          <p className="text-[#9AA6BC] mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">1. Information We Collect</h2>
            <p className="text-[#9AA6BC] mb-4">We collect:</p>
            <ul className="list-disc pl-6 text-[#9AA6BC] space-y-2">
              <li><strong>Account Information:</strong> Email, name, role type, profile details</li>
              <li><strong>Verification Data:</strong> ID documents (processed by third-party providers, not stored by us)</li>
              <li><strong>Profile Content:</strong> Photos, bios, portfolios you upload</li>
              <li><strong>Communications:</strong> Messages sent through the platform</li>
              <li><strong>Usage Data:</strong> How you interact with our platform</li>
              <li><strong>Payment Information:</strong> Processed by third-party payment providers</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">2. How We Use Your Information</h2>
            <p className="text-[#9AA6BC] mb-4">We use your information to:</p>
            <ul className="list-disc pl-6 text-[#9AA6BC] space-y-2">
              <li>Provide and maintain the platform</li>
              <li>Verify your identity and age</li>
              <li>Process subscriptions</li>
              <li>Enable discovery and matching</li>
              <li>Facilitate communications between users</li>
              <li>Generate and store contracts</li>
              <li>Prevent fraud and ensure safety</li>
              <li>Improve our services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">3. Information Sharing</h2>
            <p className="text-[#9AA6BC] mb-4">We share information:</p>
            <ul className="list-disc pl-6 text-[#9AA6BC] space-y-2">
              <li><strong>With Other Users:</strong> Profile information you choose to make visible</li>
              <li><strong>Service Providers:</strong> Verification, payment, and hosting providers</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect rights</li>
            </ul>
            <p className="text-[#9AA6BC] mt-4">
              We never sell your personal information to third parties.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">4. Profile Visibility</h2>
            <p className="text-[#9AA6BC] mb-4">
              Your profile is only visible to verified, subscribed members. Public galleries are visible to these members. Private galleries require explicit permission from you.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">5. Verification Documents</h2>
            <p className="text-[#9AA6BC] mb-4">
              Identity documents submitted for verification are processed by our third-party KYC providers. We do not store copies of your ID documents. Only verification status (verified/not verified/pending) is stored.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">6. Data Security</h2>
            <p className="text-[#9AA6BC] mb-4">
              We implement industry-standard security measures including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">7. Data Retention</h2>
            <p className="text-[#9AA6BC] mb-4">
              We retain your data while your account is active. Upon account deletion, we remove your personal data within 30 days, except where required by law (e.g., contract records may be retained longer).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">8. Your Rights</h2>
            <p className="text-[#9AA6BC] mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 text-[#9AA6BC] space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and data</li>
              <li>Export your data</li>
              <li>Opt out of marketing communications</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">9. Cookies</h2>
            <p className="text-[#9AA6BC] mb-4">
              We use cookies for authentication, preferences, and analytics. You can control cookies through your browser settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">10. Children's Privacy</h2>
            <p className="text-[#9AA6BC] mb-4">
              Content Connect is strictly for users 18 and older. We do not knowingly collect information from anyone under 18.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">11. International Users</h2>
            <p className="text-[#9AA6BC] mb-4">
              Your information may be transferred and processed in countries other than your own. By using the platform, you consent to this transfer.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">12. Changes to Privacy Policy</h2>
            <p className="text-[#9AA6BC] mb-4">
              We may update this policy. We will notify you of significant changes via email or platform notification.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">13. Contact</h2>
            <p className="text-[#9AA6BC] mb-4">
              For privacy questions, contact us at privacy@contentconnect.com
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
}