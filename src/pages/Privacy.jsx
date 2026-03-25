import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

const LAST_UPDATED = 'March 25, 2026';

function Section({ number, title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold text-[#E8EEF9] mb-4">{number}. {title}</h2>
      <div className="text-[#9AA6BC] space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Ul({ items }) {
  return (
    <ul className="list-disc pl-6 space-y-2">
      {items.map((item, i) => <li key={i}>{typeof item === 'string' ? item : item}</li>)}
    </ul>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#0B0F14] pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto px-4"
      >
        <h1 className="text-4xl font-bold text-[#E8EEF9] mb-2">Privacy Policy</h1>
        <p className="text-[#9AA6BC] mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="flex gap-3 bg-[#4F8CFF]/10 border border-[#4F8CFF]/30 rounded-xl p-4 mb-10">
          <Lock className="w-5 h-5 text-[#4F8CFF] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#E8EEF9]">
            Content Connect collects and retains identity documents and health credentials
            in secure private storage as part of our safety and compliance infrastructure.
            This policy accurately describes what we store, how it is protected, and how
            long it may be retained.
          </p>
        </div>

        <Section number="1" title="Information We Collect">
          <p>We collect the following categories of information:</p>
          <Ul items={[
            <><strong className="text-[#E8EEF9]">Account Information:</strong> Email address, full name, role type, and profile details you provide during registration.</>,
            <><strong className="text-[#E8EEF9]">Identity Verification Documents:</strong> Government-issued identification documents and selfie images submitted during identity verification. These are stored in secure private storage on our platform. See Section 5 for full details.</>,
            <><strong className="text-[#E8EEF9]">Health and Safety Documents:</strong> Lab result documents and health credentials you choose to upload. These are stored in secure private storage. See Section 6 for full details.</>,
            <><strong className="text-[#E8EEF9]">Profile Content:</strong> Photos, videos, bios, portfolios, and other content you upload to your public or private galleries.</>,
            <><strong className="text-[#E8EEF9]">Communications:</strong> Messages sent through the Platform, collaboration details, and contract content.</>,
            <><strong className="text-[#E8EEF9]">Usage and Activity Data:</strong> How you interact with the Platform, session history, navigation patterns, and feature usage.</>,
            <><strong className="text-[#E8EEF9]">Moderation Records:</strong> Content moderation logs, safety flags, reports, and administrative actions related to your account.</>,
            <><strong className="text-[#E8EEF9]">Payment Information:</strong> Subscription billing is processed by third-party payment providers. We do not store full payment card details.</>,
          ]} />
        </Section>

        <Section number="2" title="How We Use Your Information">
          <p>We use your information to:</p>
          <Ul items={[
            'Provide, operate, and maintain the Platform.',
            'Verify your identity and confirm you are at least 18 years of age.',
            'Process subscriptions and manage account access.',
            'Enable discovery, matching, and professional collaboration.',
            'Facilitate and store communications between users.',
            'Generate, store, and manage professional contracts and agreements.',
            'Detect, prevent, and investigate fraud, illegal activity, and policy violations.',
            'Operate automated content moderation systems that scan messages and user input in real time.',
            'Enforce our Terms of Service and safety policies.',
            'Comply with applicable legal obligations and respond to lawful requests.',
            'Improve the Platform and develop new features.',
          ]} />
        </Section>

        <Section number="3" title="Information Sharing">
          <p>We share your information only in the following circumstances:</p>
          <Ul items={[
            <><strong className="text-[#E8EEF9]">With Other Users:</strong> Profile information you choose to make visible according to your privacy settings. Private galleries and health documents are shared only with explicit permission.</>,
            <><strong className="text-[#E8EEF9]">Service Providers:</strong> Trusted hosting, infrastructure, and analytics providers who process data on our behalf under strict confidentiality agreements.</>,
            <><strong className="text-[#E8EEF9]">Legal and Safety Requirements:</strong> When required or permitted by law, including in response to court orders, subpoenas, or law enforcement requests. We may also disclose information to prevent or respond to suspected illegal activity, trafficking, underage exploitation, or imminent harm.</>,
            <><strong className="text-[#E8EEF9]">Safety Investigations:</strong> Internal safety and compliance teams who review flagged content and moderation cases.</>,
          ]} />
          <p>We never sell your personal information to third parties.</p>
        </Section>

        <Section number="4" title="Profile Visibility">
          <p>
            Your profile is only visible to verified, subscribed members of the Platform.
            Public galleries are visible to these members. Private galleries require explicit
            permission granted by you before any other member can view them. Your real legal
            name is never displayed to other members — only your chosen display name is shown.
          </p>
          <p>
            Administrators have access to full profile data, including real names, for the
            purpose of safety review, verification, and compliance enforcement.
          </p>
        </Section>

        <Section number="5" title="Identity Verification Documents">
          <p>
            <strong className="text-[#E8EEF9]">What we store:</strong> Identity documents
            submitted during verification — including government-issued ID images and selfie
            photos — are stored in secure, encrypted private storage on our Platform.
          </p>
          <p>
            <strong className="text-[#E8EEF9]">Correction of prior statements:</strong> Previous
            versions of this policy incorrectly stated that "ID documents are not stored on
            our servers." This was inaccurate. Identity documents are stored by us in private
            storage as part of our age verification and safety compliance infrastructure.
          </p>
          <p>
            <strong className="text-[#E8EEF9]">Access controls:</strong> Document access is
            restricted to authorized administrators conducting identity verification reviews.
            No other users can access your identity documents. All access events are logged
            with the reviewer's identity, timestamp, and purpose.
          </p>
          <p>
            <strong className="text-[#E8EEF9]">Retention:</strong> Identity documents are
            retained for as long as your account is active, and may be retained beyond account
            deletion for compliance, legal hold, or law enforcement purposes. If your account
            is subject to a safety investigation, documents may be preserved indefinitely until
            the investigation is resolved.
          </p>
          <p>
            <strong className="text-[#E8EEF9]">What is visible to other users:</strong> Only
            your verification status (Verified / Not Verified / Pending) is visible to other
            members. Document contents are never shared with other users.
          </p>
        </Section>

        <Section number="6" title="Health and Safety Documents">
          <p>
            <strong className="text-[#E8EEF9]">What we store:</strong> Health testing documents
            you optionally upload — including lab results and STI panel documentation — are
            stored in secure, encrypted private storage. They are never publicly accessible.
          </p>
          <p>
            <strong className="text-[#E8EEF9]">Access controls:</strong> You control who can
            see your health credentials through your sharing settings. Within Collaborations,
            sharing with participants is governed by the testing policy you configure. Full
            document access requires explicit permission from you. All access is logged.
          </p>
          <p>
            <strong className="text-[#E8EEF9]">What is visible without permission:</strong> Only
            a testing status badge (Valid / Expired / Pending Review) and expiration date are
            visible to other members when you enable this setting. Document contents are never
            shared without your explicit permission.
          </p>
          <p>
            <strong className="text-[#E8EEF9]">Retention:</strong> Health documents may be
            retained beyond account deletion if related to an active safety investigation or
            legal hold.
          </p>
        </Section>

        <Section number="7" title="Content Moderation and Automated Processing">
          <p>
            Content Connect employs automated, server-side content moderation systems that
            analyze messages, collaboration text, and profile content in real time. This
            processing occurs before content is saved or transmitted. By using the Platform,
            you consent to this automated processing as described in our Terms of Service.
          </p>
          <p>
            Moderation events — including flagged content, blocked messages, and automated
            safety reports — are logged and retained as part of our safety and compliance record.
            These records may be retained beyond account deletion.
          </p>
        </Section>

        <Section number="8" title="Data Security">
          <p>
            We implement industry-standard security measures including:
          </p>
          <Ul items={[
            'Encryption of sensitive documents in private storage (identity documents, health credentials).',
            'Time-limited signed URLs for document access — direct, permanent links to sensitive documents do not exist.',
            'Access logging for all sensitive document retrievals.',
            'Role-based access controls restricting sensitive data to authorized administrators.',
            'Encrypted data transmission.',
          ]} />
          <p>
            No method of electronic storage or transmission is 100% secure. While we implement
            strong safeguards, we cannot guarantee absolute security.
          </p>
        </Section>

        <Section number="9" title="Data Retention">
          <p>We retain your data as follows:</p>
          <Ul items={[
            <><strong className="text-[#E8EEF9]">Active accounts:</strong> Data is retained while your account is active.</>,
            <><strong className="text-[#E8EEF9]">Deleted accounts:</strong> Upon account deletion, personal profile data is anonymized. However, communications, collaboration records, contracts, and moderation logs may be retained to fulfill legal obligations and maintain platform integrity.</>,
            <><strong className="text-[#E8EEF9]">Identity and health documents:</strong> May be retained beyond deletion for compliance, legal hold, or law enforcement purposes.</>,
            <><strong className="text-[#E8EEF9]">Legal hold:</strong> Accounts flagged for safety or legal investigation will not be fully deleted until the hold is lifted. Deletion requests are blocked when a legal hold is active.</>,
            <><strong className="text-[#E8EEF9]">Safety records:</strong> Moderation logs, safety reports, and administrative action records are retained for compliance and may be disclosed to law enforcement.</>,
          ]} />
        </Section>

        <Section number="10" title="Your Rights">
          <p>
            Subject to applicable law and the safety and compliance exceptions described in
            this policy, you have the right to:
          </p>
          <Ul items={[
            'Access a copy of your personal data.',
            'Correct inaccurate data.',
            'Request account deletion (subject to legal hold and data retention obligations).',
            'Opt out of non-essential marketing communications.',
          ]} />
          <p>
            Note: The right to deletion does not apply to data retained under legal hold,
            law enforcement obligation, or safety investigation. Identity documents and
            moderation records may be exempt from deletion requests where retention is
            required for compliance purposes.
          </p>
        </Section>

        <Section number="11" title="Children's Privacy">
          <p>
            Content Connect is strictly for users who are 18 years of age or older. We do not
            knowingly collect information from anyone under 18. If we discover that a minor has
            accessed or registered on the Platform, their account will be immediately terminated,
            their data preserved as required by law, and the matter may be reported to appropriate
            child protection authorities.
          </p>
          <p>
            If you have reason to believe a minor has accessed this Platform, contact us
            immediately at{' '}
            <a href="mailto:safety@contentconnect.com" className="text-[#EF4444] hover:underline">
              safety@contentconnect.com
            </a>
          </p>
        </Section>

        <Section number="12" title="Cookies and Tracking">
          <p>
            We use cookies for authentication, session management, preferences, and analytics.
            You can control cookies through your browser settings, though disabling certain
            cookies may affect Platform functionality.
          </p>
        </Section>

        <Section number="13" title="International Users">
          <p>
            Your information may be stored and processed in countries other than your own.
            By using the Platform, you consent to this transfer. We implement appropriate
            safeguards for international data transfers as required by applicable law.
          </p>
        </Section>

        <Section number="14" title="Changes to This Policy">
          <p>
            We may update this Privacy Policy at any time. We will notify you of significant
            changes via email or platform notification. The "Last Updated" date at the top of
            this policy reflects the most recent revision. Continued use of the Platform after
            changes constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section number="15" title="Contact">
          <p>
            For general privacy questions:{' '}
            <a href="mailto:privacy@contentconnect.com" className="text-[#4F8CFF] hover:underline">
              privacy@contentconnect.com
            </a>
          </p>
          <p>
            To report suspected illegal activity, underage content, or urgent safety concerns:{' '}
            <a href="mailto:safety@contentconnect.com" className="text-[#EF4444] hover:underline">
              safety@contentconnect.com
            </a>
          </p>
        </Section>
      </motion.div>
    </div>
  );
}