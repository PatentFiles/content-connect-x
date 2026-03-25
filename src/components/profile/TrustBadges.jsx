/**
 * TrustBadges — Backend-driven trust indicators
 *
 * Displays verified identity, age verification, test status, and profile
 * completeness signals. All badge data comes from backend entity state —
 * not from UI-only flags.
 *
 * Props:
 *   profile        — UserProfile record
 *   verification   — VerificationRecord record (or null)
 *   testingCred    — TestingCredential record (or null)
 *   size           — 'sm' | 'md'
 *   showAll        — show all badges even if not earned (grayed out)
 */
import React from 'react';
import { ShieldCheck, Calendar, FlaskConical, Star, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

function Badge({ icon: IconComponent, label, sublabel, active, variant = 'primary', size = 'md' }) {
  const Icon = IconComponent;
  const variants = {
    primary: active ? 'bg-[#4F8CFF]/20 border-[#4F8CFF]/40 text-[#4F8CFF]' : 'bg-[#1A2438]/50 border-[#263248]/50 text-[#3A4A6B]',
    success: active ? 'bg-[#22C55E]/20 border-[#22C55E]/40 text-[#22C55E]' : 'bg-[#1A2438]/50 border-[#263248]/50 text-[#3A4A6B]',
    warning: active ? 'bg-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B]' : 'bg-[#1A2438]/50 border-[#263248]/50 text-[#3A4A6B]',
    accent: active ? 'bg-[#FF2DAA]/20 border-[#FF2DAA]/40 text-[#FF2DAA]' : 'bg-[#1A2438]/50 border-[#263248]/50 text-[#3A4A6B]',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs gap-1',
    md: 'px-3 py-1.5 text-xs gap-1.5',
  };

  const iconSizes = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5' };

  return (
    <div className={cn(
      'inline-flex items-center rounded-full border font-medium transition-all',
      variants[variant],
      sizes[size],
      !active && 'opacity-40'
    )}>
      <Icon className={iconSizes[size]} />
      <span>{label}</span>
      {sublabel && <span className="opacity-70">· {sublabel}</span>}
    </div>
  );
}

export default function TrustBadges({ profile, verification, testingCred, size = 'md', showAll = false, className }) {
  if (!profile) return null;

  const isIdVerified = verification?.status === 'approved';
  const isExpiredVerification = verification?.status === 'expired';

  const now = new Date();
  const testValid = testingCred?.status_badge === 'valid'
    && testingCred?.expires_at
    && new Date(testingCred.expires_at) > now;
  const testExpired = testingCred?.status_badge === 'expired'
    || (testingCred?.expires_at && new Date(testingCred.expires_at) <= now);

  const isRecentlyActive = profile?.last_active_at
    && new Date(profile.last_active_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const profileCompleteness = calculateCompleteness(profile);

  // Determine which badges to show
  const badges = [];

  // ID Verified badge — primary trust signal
  if (isIdVerified || showAll) {
    badges.push(
      <Badge
        key="id-verified"
        icon={ShieldCheck}
        label="ID Verified"
        active={isIdVerified}
        variant="primary"
        size={size}
      />
    );
  }

  // Test Verified badge — with expiry
  if (testValid) {
    const expiresIn = formatDistanceToNow(new Date(testingCred.expires_at), { addSuffix: true });
    badges.push(
      <Badge
        key="test-verified"
        icon={FlaskConical}
        label="Test Verified"
        sublabel={`exp. ${expiresIn}`}
        active={true}
        variant="success"
        size={size}
      />
    );
  } else if (testExpired && showAll) {
    badges.push(
      <Badge
        key="test-expired"
        icon={FlaskConical}
        label="Test Expired"
        active={false}
        variant="warning"
        size={size}
      />
    );
  }

  // Recently Active badge
  if (isRecentlyActive) {
    badges.push(
      <Badge
        key="recently-active"
        icon={Clock}
        label="Active"
        sublabel={formatDistanceToNow(new Date(profile.last_active_at), { addSuffix: true })}
        active={true}
        variant="success"
        size={size}
      />
    );
  }

  // Profile completeness (only show if high)
  if (profileCompleteness >= 80) {
    badges.push(
      <Badge
        key="complete-profile"
        icon={Star}
        label={`${profileCompleteness}% complete`}
        active={true}
        variant="accent"
        size={size}
      />
    );
  }

  if (badges.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {badges}
    </div>
  );
}

/**
 * Calculate profile completeness score (0-100)
 */
export function calculateCompleteness(profile) {
  if (!profile) return 0;
  const fields = [
    profile.display_name,
    profile.bio,
    profile.avatar_url,
    profile.role_type,
    profile.base_location?.city,
    profile.age,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}