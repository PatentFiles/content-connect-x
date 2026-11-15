import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  User,
  Shield,
  CreditCard,
  Compass,
  MessageCircle,
} from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import CCTooltip from './CCTooltip';

const steps = [
  {
    id: 'profile',
    label: 'Complete your profile',
    description: 'Add your display name, bio, and photo so others can find you.',
    icon: User,
    action: 'Profile',
    actionLabel: 'Edit Profile',
    tooltip: 'A complete profile gets 3x more collaboration invites.',
  },
  {
    id: 'verified',
    label: 'Verify your identity',
    description: 'Required to message members and join collaborations.',
    icon: Shield,
    action: 'Verification',
    actionLabel: 'Get Verified',
    tooltip: 'Verification confirms you are 18+ and builds trust with potential collaborators.',
  },
  {
    id: 'subscribed',
    label: 'Choose a plan',
    description: 'Unlock Discovery, Messaging, and Collaborations.',
    icon: CreditCard,
    action: 'Pricing',
    actionLabel: 'View Plans',
    tooltip: 'Even the basic tier gives you full Discovery access and messaging.',
  },
  {
    id: 'discovered',
    label: 'Explore Discovery',
    description: 'Browse verified members near you and save favorites.',
    icon: Compass,
    action: 'Discovery',
    actionLabel: 'Discover Now',
    tooltip: 'Use filters to find creators by location, scene type, availability, and more.',
  },
  {
    id: 'messaged',
    label: 'Send your first message',
    description: 'Start a conversation with someone you want to collaborate with.',
    icon: MessageCircle,
    action: 'Messages',
    actionLabel: 'Go to Messages',
    tooltip: 'All messages are gated — only verified members can contact each other.',
  },
];

export default function OnboardingChecklist({ user, profile }) {
  const [collapsed, setCollapsed] = useState(false);

  const { data: verifications = [] } = useQuery({
    queryKey: ['myVerification', user?.email],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscription', user?.email],
    queryFn: () => base44.entities.Subscription.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', user?.email],
    queryFn: async () => {
      const all = await base44.entities.Conversation.list();
      return all.filter(c => c.participant_ids?.includes(user?.email));
    },
    enabled: !!user?.email,
  });

  const isVerified = verifications[0]?.status === 'approved';
  const isSubscribed = ['active', 'trial'].includes(subscriptions[0]?.status);
  const hasMessaged = conversations.length > 0;
  const profileComplete = !!(profile?.profile_complete && profile?.bio && profile?.display_name);

  const statusMap = {
    profile:    profileComplete,
    verified:   isVerified,
    subscribed: isSubscribed,
    discovered: false, // No persistent signal, keep as a prompt
    messaged:   hasMessaged,
  };

  const completedCount = Object.values(statusMap).filter(Boolean).length;
  const totalCount = steps.length;
  const allDone = completedCount === totalCount;
  const progressPct = (completedCount / totalCount) * 100;

  // Hide once fully complete
  if (allDone) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <CCCard padding="none">
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-between p-4 transition-colors rounded-xl"
          style={{ '--hover-bg': 'var(--cc-surface-hover)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cc-blue) 20%, transparent), color-mix(in srgb, var(--cc-pink) 20%, transparent))' }}>
              <Sparkles className="w-5 h-5" style={{ color: 'var(--cc-blue)' }} />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--cc-text-primary)' }}>Get Started Checklist</p>
              <p className="text-xs" style={{ color: 'var(--cc-text-muted)' }}>{completedCount} of {totalCount} steps complete</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Mini progress bar */}
            <div className="hidden sm:block w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--cc-border)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(to right, var(--cc-blue), var(--cc-pink))' }}
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            {collapsed ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--cc-text-muted)' }} /> : <ChevronUp className="w-4 h-4" style={{ color: 'var(--cc-text-muted)' }} />}
          </div>
        </button>

        {/* Steps */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                {steps.map((step, i) => {
                  const done = statusMap[step.id];
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                      style={{
                        opacity: done ? 0.5 : 1,
                        backgroundColor: done ? 'transparent' : 'var(--cc-surface-hover)',
                      }}
                      onMouseEnter={e => { if (!done) e.currentTarget.style.backgroundColor = 'var(--cc-border)'; }}
                      onMouseLeave={e => { if (!done) e.currentTarget.style.backgroundColor = 'var(--cc-surface-hover)'; }}
                    >
                      {/* Check */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: done ? '#22C55E' : 'var(--cc-border)' }}
                      >
                        {done
                          ? <CheckCircle className="w-4 h-4 text-white" />
                          : <Icon className="w-3.5 h-3.5" style={{ color: 'var(--cc-text-secondary)' }} />
                        }
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: done ? 'var(--cc-text-muted)' : 'var(--cc-text-primary)',
                              textDecoration: done ? 'line-through' : 'none',
                            }}
                          >
                            {step.label}
                          </p>
                          <CCTooltip text={step.tooltip} position="top" />
                        </div>
                        {!done && (
                          <p className="text-xs truncate" style={{ color: 'var(--cc-text-muted)' }}>{step.description}</p>
                        )}
                      </div>

                      {/* Action */}
                      {!done && (
                        <Link to={createPageUrl(step.action)} className="flex-shrink-0">
                          <CCButton variant="primary" size="sm">{step.actionLabel}</CCButton>
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CCCard>
    </motion.div>
  );
}