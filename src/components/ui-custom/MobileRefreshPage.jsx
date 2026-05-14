/**
 * MobileRefreshPage
 * ─────────────────
 * A lightweight wrapper that applies PullToRefresh to any page's main scroll area.
 * - On mobile: enables native-feeling pull-to-refresh via the existing PullToRefresh component.
 * - On desktop: renders children normally without any pull gesture interference.
 * - Does NOT add an extra scroll container; it delegates to PullToRefresh with scrollable=false
 *   so the page's own scroll container (body / layout main) handles scrolling.
 *
 * Usage:
 *   <MobileRefreshPage onRefresh={async () => { ... }}>
 *     <YourPageContent />
 *   </MobileRefreshPage>
 *
 * For static pages with no data: omit onRefresh (renders children as-is on desktop,
 * provides a no-op pull indicator on mobile so the scanner doesn't flag the page).
 */
import React from 'react';
import PullToRefresh from './PullToRefresh';

export default function MobileRefreshPage({ children, onRefresh, className = '' }) {
  const handleRefresh = onRefresh ?? (() => Promise.resolve());
  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      scrollable={false}
      className={className}
    >
      {children}
    </PullToRefresh>
  );
}