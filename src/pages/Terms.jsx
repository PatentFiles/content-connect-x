import React from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle } from 'lucide-react';

const LAST_UPDATED = 'March 25, 2026';

function Section({ number, title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold cc-text-fix-primary mb-4">{number}. {title}</h2>
      <div className="cc-text-fix-secondary space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

function Ul({ items }) {
  return (
    <ul className="list-disc pl-6 space-y-2">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-cc-bg pt-24 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto px-4"
      >
        <h1 className="text-4xl font-bold cc-text-fix-primary mb-2">Terms of Service</h1>
        <p className="cc-text-fix-secondary mb-10">Last updated: {LAST_UPDATED}</p>

        {/* Critical callout */}
        <div className="flex gap-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 mb-10">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <p className="text-sm cc-text-fix-primary">
            <strong>Important:</strong> Content Connect X is a professional creator collaboration
            platform exclusively. Use of this platform for any form of solicitation, escorting,
            prostitution, sex trafficking, or exploitation is strictly prohibited and may result
            in immediate account termination, evidence preservation, and referral to law enforcement.
          </p>
        </div>

        <Section number="1" title="Acceptance of Terms">
          <p>
            By accessing or using Content Connect X ("the Platform"), you agree to be bound by
            these Terms of Service and all applicable laws and regulations. If you do not agree
            with any of these terms, you are prohibited from using this Platform.
          </p>
          <p>
            These Terms constitute a legally binding agreement between you and Content Connect X.
            Your continued use of the Platform after any update to these Terms constitutes
            acceptance of the revised Terms.
          </p>
        </Section>

        <Section number="2" title="Eligibility">
          <p>
            You must be at least 18 years of age to use Content Connect X. By registering, you
            represent and warrant that:
          </p>
          <Ul items={[
            'You are at least 18 years old.',
            'You have the legal capacity to enter into these Terms.',
            'You will not misrepresent your age at any time.',
            'You are not subject to any court order or legal restriction that would prohibit use of this Platform.',
          ]} />
          <p>
            Any misrepresentation of age — including by a minor — constitutes a material breach
            of these Terms and will result in immediate account termination. All evidence related
            to suspected underage access will be preserved and may be reported to relevant authorities.
          </p>
        </Section>

        <Section number="3" title="Platform Purpose and Permitted Use">
          <p>
            Content Connect X is designed exclusively as a professional collaboration and safety
            infrastructure platform for adult content creators, photographers, videographers,
            talent agents, and studios. Its purpose is to:
          </p>
          <Ul items={[
            'Facilitate legitimate professional content creation partnerships.',
            'Provide structured consent and boundary documentation tools.',
            'Enable health and safety credential management.',
            'Support the negotiation and execution of professional contracts.',
            'Enforce community safety through identity verification and moderation.',
          ]} />
          <p>
            No use of the Platform for any purpose other than professional content collaboration
            is permitted. The Platform does not facilitate, broker, or enable personal services
            of a sexual nature.
          </p>
        </Section>

        <Section number="4" title="Strictly Prohibited Conduct">
          <p>
            The following conduct is strictly prohibited and constitutes grounds for immediate
            account suspension, permanent ban, and potential legal action:
          </p>

          <p className="font-semibold cc-text-fix-primary pt-2">4.1 — Solicitation and Illegal Sexual Activity</p>
          <Ul items={[
            'Soliciting, offering, or arranging payment for sexual acts, sexual services, or any form of in-person prostitution or escorting.',
            'Using the Platform\'s messaging, collaboration tools, or any other features to negotiate, arrange, or facilitate prostitution or escorting.',
            'Posting, implying, or communicating rates, availability, or willingness to perform sexual acts in exchange for payment, gifts, or other consideration outside of legitimate content agreements.',
            'Using coded language, abbreviations, or euphemisms (e.g., "roses," "donations," "GFE," "FBSM," "p4p," "incall," "outcall") to solicit or offer sexual services.',
          ]} />

          <p className="font-semibold cc-text-fix-primary pt-2">4.2 — Trafficking, Coercion, and Exploitation</p>
          <Ul items={[
            'Sex trafficking, labor trafficking, or any facilitation thereof.',
            'Recruiting, harboring, transporting, providing, obtaining, or maintaining persons through force, fraud, or coercion for commercial sex.',
            'Coercing, threatening, blackmailing, or otherwise compelling any person to engage in sexual activity or content creation.',
            'Exploiting any person through abuse of power, position, financial dependency, or vulnerability.',
          ]} />

          <p className="font-semibold cc-text-fix-primary pt-2">4.3 — Underage Activity</p>
          <Ul items={[
            'Any access, use, or attempted use of the Platform by any person under 18 years of age.',
            'Soliciting, recruiting, or engaging with any person who may be under 18.',
            'Creating, distributing, or facilitating the creation of any content depicting minors in a sexual context.',
            'Misrepresenting the age of any performer or collaborator.',
          ]} />

          <p className="font-semibold cc-text-fix-primary pt-2">4.4 — Non-Consensual Content and Threats</p>
          <Ul items={[
            'Distributing, threatening to distribute, or facilitating the distribution of non-consensual intimate images.',
            'Threatening to expose, "doxx," blackmail, or extort any person using intimate images, personal information, or other leverage.',
            'Publishing or sharing content that was created without the informed consent of all depicted persons.',
          ]} />

          <p className="font-semibold cc-text-fix-primary pt-2">4.5 — General Prohibited Conduct</p>
          <Ul items={[
            'Misrepresenting your identity, credentials, age, or role type.',
            'Harassing, threatening, or intimidating other users.',
            'Creating multiple accounts or circumventing a ban or suspension.',
            'Attempting to bypass or defeat any content moderation, safety, or security system.',
            'Using the Platform for any purpose that violates applicable local, national, or international law.',
          ]} />
        </Section>

        <Section number="5" title="Content Moderation and Automated Enforcement">
          <p>
            Content Connect X employs real-time, server-side content moderation on messages,
            collaboration details, profile text, and other user-generated content. You acknowledge
            and consent to this monitoring as a condition of Platform use.
          </p>
          <p>
            The moderation system may, without prior notice:
          </p>
          <Ul items={[
            'Block content that violates these Terms before it is saved or transmitted.',
            'Automatically suspend your account pending review if content triggers critical safety criteria.',
            'Automatically place your account under legal hold if content suggests underage activity, trafficking, or coercion.',
            'Generate internal safety reports that are reviewed by administrators.',
            'Escalate repeat violations to suspension or permanent ban.',
          ]} />
          <p>
            Automated enforcement actions are logged and subject to human review. You may
            contact support if you believe an action was taken in error.
          </p>
        </Section>

        <Section number="6" title="Enforcement Actions">
          <p>
            Violations of these Terms may result in any or all of the following, at our sole
            discretion and without prior notice:
          </p>
          <Ul items={[
            'Content removal or blocking.',
            'Formal warning.',
            'Temporary suspension of your account.',
            'Permanent ban from the Platform.',
            'Preservation of your account data and communications as evidence.',
            'Legal hold preventing account deletion pending investigation.',
            'Disclosure of information to law enforcement or regulatory agencies where required or permitted by law.',
          ]} />
          <p>
            <strong className="cc-text-fix-primary">Severe violations</strong> — including but not
            limited to suspected sex trafficking, underage activity, or non-consensual content
            distribution — will result in immediate account restriction, mandatory evidence
            preservation, and referral to appropriate law enforcement agencies.
          </p>
        </Section>

        <Section number="7" title="Verification Requirement">
          <p>
            All users must complete identity verification before accessing Platform features.
            Verification confirms your identity and confirms you are at least 18 years of age.
          </p>
          <p>
            Identity documents submitted for verification are stored in secure private storage
            accessible only to authorized reviewers. All document access is logged. Documents
            may be retained for compliance and safety purposes, and may be preserved indefinitely
            under legal hold conditions if your account is involved in a safety or legal
            investigation. See our Privacy Policy for full details.
          </p>
          <p>
            Providing false, altered, or another person's identification documents constitutes
            fraud and may result in criminal liability in addition to account termination.
          </p>
        </Section>

        <Section number="8" title="Health and Safety Documentation">
          <p>
            Users may optionally upload health testing documentation through the Platform.
            These documents are stored in secure private storage and are never publicly accessible.
            Access is governed by the user's sharing settings and, within Collaborations, by
            participant permissions. All document access is logged.
          </p>
        </Section>

        <Section number="9" title="Contracts and Agreements">
          <p>
            Content Connect X provides tools for creating professional contracts between users.
            We are not a party to any agreements made between users. Users are solely responsible
            for ensuring their agreements comply with all applicable laws and regulations.
          </p>
          <p>
            Contracts must not contain terms that violate these Terms of Service. Any contract
            term that facilitates prohibited conduct (including solicitation, escorting, or
            trafficking) is void, unenforceable, and may result in account termination.
          </p>
        </Section>

        <Section number="10" title="Subscriptions and Payments">
          <p>
            Access to Platform features requires an active subscription. Subscription fees are
            billed in advance. You may cancel at any time, but no refunds are provided for
            partial periods.
          </p>
          <p>
            Content Connect X does not process payments for collaborations between users. All
            compensation arrangements are made directly between parties outside the Platform.
            Content Connect X has no liability for any payment disputes between users.
          </p>
        </Section>

        <Section number="11" title="Content Ownership and License">
          <p>
            Users retain ownership of content they upload. By uploading content, you grant
            Content Connect X a limited, non-exclusive license to store, display, and distribute
            your content within the Platform solely for the purpose of operating the Platform.
          </p>
          <p>
            You represent and warrant that you own or have all necessary rights to any content
            you upload, and that such content does not violate any third party's rights or
            applicable law.
          </p>
        </Section>

        <Section number="12" title="Data Retention for Safety and Compliance">
          <p>
            Notwithstanding any account deletion request, Content Connect reserves the right to
            retain data — including communications, collaboration records, identity documents,
            and moderation logs — for as long as necessary to:
          </p>
          <Ul items={[
            'Comply with applicable legal obligations.',
            'Respond to lawful requests from law enforcement or regulatory agencies.',
            'Maintain evidence related to safety investigations, disputes, or potential illegal activity.',
            'Enforce these Terms.',
          ]} />
          <p>
            Accounts subject to a legal hold will not be fully deleted until the hold is lifted
            by an authorized administrator. Users will be notified of legal holds to the extent
            permitted by law.
          </p>
        </Section>

        <Section number="13" title="Termination">
          <p>
            We reserve the right to suspend or permanently terminate accounts that violate
            these Terms, at our sole discretion and without prior notice. Users may request
            account deletion at any time through account settings, subject to the data retention
            provisions in Section 12.
          </p>
        </Section>

        <Section number="14" title="Limitation of Liability">
          <p>
            Content Connect X is provided "as is" without warranties of any kind. To the maximum
            extent permitted by applicable law, we are not liable for any indirect, incidental,
            special, consequential, or punitive damages arising out of your use of the Platform,
            any disputes between users, or any outcomes of collaborations arranged through the Platform.
          </p>
        </Section>

        <Section number="15" title="Governing Law">
          <p>
            These Terms are governed by and construed in accordance with applicable law.
            Any disputes arising under these Terms shall be resolved in accordance with applicable
            jurisdiction. If any provision of these Terms is found to be unenforceable, the
            remaining provisions shall remain in full force and effect.
          </p>
        </Section>

        <Section number="16" title="Changes to Terms">
          <p>
            We may update these Terms at any time. We will notify you of significant changes
            via email or platform notification. Continued use of the Platform after changes
            constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section number="17" title="Contact">
          <p>
            For questions about these Terms, contact us at{' '}
            <a href="mailto:legal@contentconnect.com" className="text-[#4F8CFF] hover:underline">
              legal@onlycollabsx.com
            </a>
          </p>
          <p>
            To report suspected illegal activity, trafficking, or underage content, contact{' '}
            <a href="mailto:safety@contentconnect.com" className="text-[#EF4444] hover:underline">
              safety@onlycollabsx.com
            </a>
            {' '}or call the National Human Trafficking Hotline: 1-888-373-7888.
          </p>
        </Section>
      </motion.div>
    </div>
  );
}