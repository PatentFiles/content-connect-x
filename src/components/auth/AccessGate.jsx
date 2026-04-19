import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import { ShieldAlert, CreditCard, Lock, ArrowRight } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function AccessGate({ type = 'verification', profile, children, user }) {
  const verificationEnabled = useFeatureFlag('verification');

  // Admin bypass — always pass for admins
  const isAdmin = user?.role === 'admin' || user?.role_type === 'admin';
  if (isAdmin) {
    return <>{children}</>;
  }

  // If verification flag is OFF, verification gate doesn't apply
  if (type === 'verification' && !verificationEnabled) {
    return children ? <>{children}</> : null;
  }

  const gates = {
    verification: {
      icon: ShieldAlert,
      title: 'Verification Required',
      description: 'To protect our community and ensure authentic connections, all members must complete identity verification before accessing the platform.',
      buttonText: 'Start Verification',
      buttonLink: 'Verification',
      features: [
        'Verify your identity securely',
        'Takes less than 5 minutes',
        'Your data is protected and never shared',
      ],
    },
    subscription: {
      icon: CreditCard,
      title: 'Subscription Required',
      description: 'Subscribe to access discovery, messaging, and collaboration features. Choose a plan that fits your needs.',
      buttonText: 'View Plans',
      buttonLink: 'Pricing',
      features: [
        'Unlimited profile browsing',
        'Direct messaging with verified members',
        'Create and manage deal rooms',
        'Digital contract signing',
      ],
    },
    both: {
      icon: Lock,
      title: 'Complete Your Setup',
      description: 'You\'re almost there! Complete verification and subscribe to unlock the full platform.',
      buttonText: 'Continue Setup',
      buttonLink: 'Verification',
      features: [
        'Step 1: Verify your identity',
        'Step 2: Choose a subscription plan',
        'Step 3: Set up your profile',
        'Step 4: Start connecting!',
      ],
    },
  };

  const gate = gates[type];
  const Icon = gate.icon;

  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <CCCard padding="xl" className="text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
            <Icon className="w-10 h-10 text-[#4F8CFF]" />
          </div>

          {/* Title & Description */}
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-3">{gate.title}</h1>
          <p className="text-[#9AA6BC] mb-8">{gate.description}</p>

          {/* Features */}
          <div className="bg-[#121824] rounded-xl p-4 mb-8 text-left">
            <ul className="space-y-3">
              {gate.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-[#E8EEF9]">
                  <div className="w-5 h-5 rounded-full bg-[#4F8CFF]/20 flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-3 h-3 text-[#4F8CFF]" />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <Link to={createPageUrl(gate.buttonLink)}>
            <CCButton variant="primary" size="lg" fullWidth iconRight={ArrowRight}>
              {gate.buttonText}
            </CCButton>
          </Link>

          {/* Help text */}
          <p className="mt-6 text-xs text-[#6B7A94]">
            Need help? <Link to={createPageUrl('FAQ')} className="text-[#4F8CFF] hover:underline">Visit our FAQ</Link> or contact support.
          </p>
        </CCCard>
      </motion.div>
    </div>
  );
}