import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Circle,
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
          className="w-full flex items-center justify-between p-4 hover:bg-[#1A2438] transition-colors rounded-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#4F8CFF]" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-[#E8EEF9]">Get Started Checklist</p>
              <p className="text-xs text-[#6B7A94]">{completedCount} of {totalCount} steps complete</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Mini progress bar */}
            <div className="hidden sm:block w-24 h-1.5 bg-[#263248] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#4F8CFF] to-[#FF2DAA] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            {collapsed ? <ChevronDown className="w-4 h-4 text-[#6B7A94]" /> : <ChevronUp className="w-4 h-4 text-[#6B7A94]" />}
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
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        done ? 'opacity-50' : 'bg-[#151D2B] hover:bg-[#1A2438]'
                      }`}
                    >
                      {/* Check */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        done ? 'bg-[#22C55E]' : 'bg-[#263248]'
                      }`}>
                        {done
                          ? <CheckCircle className="w-4 h-4 text-white" />
                          : <Icon className="w-3.5 h-3.5 text-[#9AA6BC]" />
                        }
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-medium ${done ? 'line-through text-[#6B7A94]' : 'text-[#E8EEF9]'}`}>
                            {step.label}
                          </p>
                          <CCTooltip text={step.tooltip} position="top" />
                        </div>
                        {!done && (
                          <p className="text-xs text-[#6B7A94] truncate">{step.description}</p>
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