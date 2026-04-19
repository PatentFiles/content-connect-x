/**
 * Reusable marketing feature showcase component.
 * Displays only enabled features dynamically using the feature flag system.
 */
import { useFeatureFlag } from '@/lib/featureFlags';
import { MARKETING_FEATURES } from '@/lib/marketingFeatureMap';
import { motion } from 'framer-motion';

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
    <div className="space-y-6">
      {features.map((feature, i) => (
        <motion.div
          key={feature.flag}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="p-6 bg-[#151D2B] border border-[#263248] rounded-xl hover:border-[#4F8CFF]/50 transition-colors"
        >
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">{feature.label}</h3>
          <p className="text-[#9AA6BC]">{feature.description}</p>
        </motion.div>
      ))}
    </div>
  );
}