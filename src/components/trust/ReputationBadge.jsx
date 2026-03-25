/**
 * ReputationBadge — Displays the user's system-derived reputation score.
 *
 * Props:
 *   score     — ReputationScore entity record (or null)
 *   size      — 'sm' | 'md' | 'lg'
 *   showScore — show numeric score (admin-facing)
 *   compact   — just a badge, no tooltip
 */
import React, { useState } from 'react';
import { ShieldCheck, Star, TrendingUp, Award, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABEL_CONFIG = {
  trusted: {
    label: 'Trusted',
    icon: Award,
    colors: 'bg-[#4F8CFF]/20 border-[#4F8CFF]/50 text-[#4F8CFF]',
    glow: 'shadow-[0_0_12px_rgba(79,140,255,0.3)]',
    description: 'Consistently reliable collaborator with strong platform history',
  },
  highly_reliable: {
    label: 'Highly Reliable',
    icon: ShieldCheck,
    colors: 'bg-[#22C55E]/20 border-[#22C55E]/50 text-[#22C55E]',
    glow: 'shadow-[0_0_10px_rgba(34,197,94,0.2)]',
    description: 'Strong track record of completed collaborations',
  },
  reliable: {
    label: 'Reliable',
    icon: TrendingUp,
    colors: 'bg-[#34D399]/20 border-[#34D399]/40 text-[#34D399]',
    glow: '',
    description: 'Good standing with verified activity',
  },
  established: {
    label: 'Established',
    icon: Star,
    colors: 'bg-[#9AA6BC]/20 border-[#9AA6BC]/40 text-[#9AA6BC]',
    glow: '',
    description: 'Active member building their reputation',
  },
  new: {
    label: 'New Member',
    icon: Zap,
    colors: 'bg-[#6B7A94]/15 border-[#6B7A94]/30 text-[#6B7A94]',
    glow: '',
    description: 'Recently joined — building their track record',
  },
};

const SIZES = {
  sm: { badge: 'px-2 py-0.5 text-xs gap-1', icon: 'w-3 h-3' },
  md: { badge: 'px-3 py-1 text-xs gap-1.5', icon: 'w-3.5 h-3.5' },
  lg: { badge: 'px-4 py-1.5 text-sm gap-2', icon: 'w-4 h-4' },
};

export default function ReputationBadge({ score, size = 'md', showScore = false, compact = false, className }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!score) return null;

  const config = LABEL_CONFIG[score.label] || LABEL_CONFIG.new;
  const Icon = config.icon;
  const { badge, icon: iconSize } = SIZES[size] || SIZES.md;

  return (
    <div className="relative inline-block">
      <div
        className={cn(
          'inline-flex items-center rounded-full border font-medium cursor-default transition-all',
          config.colors,
          config.glow,
          badge,
          className
        )}
        onMouseEnter={() => !compact && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Icon className={iconSize} />
        <span>{config.label}</span>
        {showScore && (
          <span className="opacity-60 font-mono">{Math.round(score.score)}</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && !compact && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-52 bg-[#1A2438] border border-[#263248] rounded-lg p-3 shadow-xl text-xs text-[#9AA6BC] pointer-events-none">
          <p className="font-semibold text-[#E8EEF9] mb-1">{config.label}</p>
          <p>{config.description}</p>
          {score.score !== undefined && (
            <p className="mt-1 text-[#6B7A94]">Score: {Math.round(score.score)}/100</p>
          )}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#263248]" />
        </div>
      )}
    </div>
  );
}

/**
 * Score bar — visual progress indicator for admin detail views
 */
export function ReputationScoreBar({ score, showFactors = false }) {
  if (!score) return null;
  const config = LABEL_CONFIG[score.label] || LABEL_CONFIG.new;

  const pct = Math.round(score.score);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <ReputationBadge score={score} size="md" showScore />
        <span className="text-xs text-[#6B7A94]">
          +{score.factors?.positive_points || 0} / -{score.factors?.negative_points || 0}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[#1A2438] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', config.colors.split(' ')[0].replace('bg', 'bg').replace('/20', ''))}
          style={{ width: `${pct}%`, background: pct >= 80 ? '#4F8CFF' : pct >= 60 ? '#22C55E' : pct >= 40 ? '#34D399' : '#6B7A94' }}
        />
      </div>
      {showFactors && score.factors && (
        <div className="grid grid-cols-2 gap-1 text-xs text-[#6B7A94] mt-2">
          {score.factors.completed_collabs !== undefined && (
            <span>✓ {score.factors.completed_collabs} completed</span>
          )}
          {score.factors.cancelled_collabs > 0 && (
            <span className="text-[#EF4444]">✗ {score.factors.cancelled_collabs} cancelled</span>
          )}
          {score.factors.verification_status === 'approved' && (
            <span>✓ Identity verified</span>
          )}
          {score.factors.testing_compliance === 'valid' && (
            <span>✓ Testing current</span>
          )}
          {score.factors.moderation_flags > 0 && (
            <span className="text-[#EF4444]">⚠ {score.factors.moderation_flags} flag(s)</span>
          )}
        </div>
      )}
    </div>
  );
}