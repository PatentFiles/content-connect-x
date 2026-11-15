/**
 * Reusable marketing feature showcase component.
 * Displays only enabled features dynamically using the feature flag system.
 */
import { useFeatureFlag } from '@/lib/featureFlags';
import { MARKETING_FEATURES } from '@/lib/marketingFeatureMap';
import { motion } from 'framer-motion';
import {
  BriefcaseBusiness,
  FileSignature,
  HeartPulse,
  Images,
  Map,
  MessageCircle,
  Network,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

const featureIcons = {
  Messaging: MessageCircle,
  Collaborations: UsersRound,
  'Health Testing': HeartPulse,
  'Digital Contracts': FileSignature,
  'Identity Verification': ShieldCheck,
  'Hosting & Location Booking': Map,
  'Discovery & Matching': Search,
  'Portfolio Galleries': Images,
  'Agent & Studio Representation': BriefcaseBusiness,
  'Community & Trust Network': Network,
};

// Call all hooks at top level — one per known flag key
function useAllFeatureFlags() {
  return Object.fromEntries(
    Object.entries(MARKETING_FEATURES).map(([key, feature]) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return [feature.flag, useFeatureFlag(feature.flag)];
    })
  );
}

export default function MarketingFeatureShowcase({ onlyPage = null }) {
  const allFlags = useAllFeatureFlags();

  const features = Object.entries(MARKETING_FEATURES)
    .filter(([key, feature]) => {
      if (onlyPage && !feature.sections.includes(onlyPage)) return false;
      return allFlags[feature.flag];
    })
    .map(([key, feature]) => feature);

  if (features.length === 0) return null;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, i) => {
        const Icon = featureIcons[feature.label] || ShieldCheck;

        return (
          <motion.article
            key={feature.flag}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className="group relative overflow-hidden rounded-2xl border border-cc-border bg-cc-bg p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#4F8CFF]/70 hover:shadow-[0_16px_40px_rgba(79,140,255,0.12)]"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#4F8CFF] to-[#FF2DAA] opacity-70 transition-opacity group-hover:opacity-100" />
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 text-[#4F8CFF] ring-1 ring-[#4F8CFF]/20 transition-transform duration-300 group-hover:scale-110">
              <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="mb-2 text-lg font-semibold cc-text-fix-primary">{feature.label}</h3>
            <p className="text-sm leading-6 cc-text-fix-secondary">{feature.description}</p>
          </motion.article>
        );
      })}
    </div>
  );
}