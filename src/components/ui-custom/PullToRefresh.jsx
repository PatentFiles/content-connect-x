import React, { useRef, useState, useCallback, useId } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 72;

/**
 * Native-feeling pull-to-refresh wrapper.
 * - Rubber-band pull animation
 * - ARIA live region announces refresh state to screen readers
 * - Respects prefers-reduced-motion (no animation when user prefers none)
 *
 * Usage: <PullToRefresh onRefresh={async () => { ... }}>...</PullToRefresh>
 */
export default function PullToRefresh({ children, onRefresh, className = '', scrollable = true }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const touchStartY = useRef(0);
  const pullDistance = useMotionValue(0);
  const containerRef = useRef(null);
  const statusId = useId();

  // Check reduced-motion preference once
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const iconOpacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const iconRotate = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 180]);
  const contentYMotion = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, PULL_THRESHOLD]);
  const contentY = prefersReducedMotion ? 0 : contentYMotion;

  const handleTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    setPulling(true);
    setStatusMsg('');
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;

    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      pullDistance.set(Math.min(delta * 0.45, PULL_THRESHOLD + 20));
      if (pullDistance.get() >= PULL_THRESHOLD) {
        setStatusMsg('Release to refresh');
      } else {
        setStatusMsg('Pull down to refresh');
      }
    }
  }, [pulling, refreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    const current = pullDistance.get();

    if (current >= PULL_THRESHOLD) {
      setRefreshing(true);
      setStatusMsg('Refreshing…');
      pullDistance.set(PULL_THRESHOLD);
      try {
        await onRefresh?.();
        setStatusMsg('Content updated');
      } finally {
        setRefreshing(false);
        pullDistance.set(0);
        // Clear the status message after a short delay so it's read once
        setTimeout(() => setStatusMsg(''), 1500);
      }
    } else {
      pullDistance.set(0);
      setStatusMsg('');
    }
  }, [pulling, pullDistance, onRefresh]);

  return (
    <div className={`relative ${className}`}>
      {/* ARIA live region — announces refresh state to screen readers */}
      <span
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMsg}
      </span>

      {/* Pull indicator */}
      <motion.div
        style={{ opacity: iconOpacity }}
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
        aria-hidden="true"
      >
        <div className="mt-2 w-9 h-9 rounded-full bg-[var(--cc-surface)] border border-[var(--cc-border)] flex items-center justify-center shadow-lg">
          <motion.div style={{ rotate: prefersReducedMotion ? 0 : iconRotate }}>
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin text-[var(--cc-blue)]' : 'text-[var(--cc-text-secondary)]'}`}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Scrollable content */}
      <motion.div
        ref={containerRef}
        style={{ y: contentY }}
        className={scrollable ? 'h-full overflow-y-auto' : ''}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-describedby={statusId}
      >
        {children}
      </motion.div>
    </div>
  );
}