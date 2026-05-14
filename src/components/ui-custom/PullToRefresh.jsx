import React, { useRef, useState, useCallback, useId } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 72;

/**
 * Native-feeling pull-to-refresh wrapper.
 *
 * Two modes:
 *   scrollable=true  → the motion div itself is the scroll container (overflow-y-auto).
 *                      Use for panels/lists that live inside a fixed-height area (e.g. Messages sidebar).
 *   scrollable=false → the page/document is the scroll container. Touch events are attached to the
 *                      motion div but scroll-position is read from document.documentElement.
 *                      Use for full-page layouts where body/document handles scrolling.
 *
 * The key fix: when scrollable=false, check document.documentElement.scrollTop (not el.scrollTop)
 * to decide whether we're at the top of the page before allowing the pull gesture.
 */
export default function PullToRefresh({ children, onRefresh, className = '', scrollable = true }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const touchStartY = useRef(0);
  const pullDistance = useMotionValue(0);
  const containerRef = useRef(null);
  const statusId = useId();

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const iconOpacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const iconRotate = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 180]);
  const contentYMotion = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, PULL_THRESHOLD]);
  const contentY = prefersReducedMotion ? 0 : contentYMotion;

  /**
   * Returns the current scroll position of whichever container owns the scrolling.
   * scrollable=true  → the motion div itself scrolls
   * scrollable=false → the document scrolls (body-scroll pages)
   */
  const getScrollTop = useCallback(() => {
    if (scrollable) {
      return containerRef.current?.scrollTop ?? 0;
    }
    // Body-scroll: document.documentElement.scrollTop is the correct value on iOS Safari
    return document.documentElement.scrollTop || document.body.scrollTop || 0;
  }, [scrollable]);

  const handleTouchStart = useCallback((e) => {
    if (getScrollTop() > 0) return;
    touchStartY.current = e.touches[0].clientY;
    setPulling(true);
    setStatusMsg('');
  }, [getScrollTop]);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    if (getScrollTop() > 0) return;

    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      // Prevent default only when we're pulling (not normal scroll)
      // This is safe because scrollTop is 0 at this point
      pullDistance.set(Math.min(delta * 0.45, PULL_THRESHOLD + 20));
      if (pullDistance.get() >= PULL_THRESHOLD) {
        setStatusMsg('Release to refresh');
      } else {
        setStatusMsg('Pull down to refresh');
      }
    }
  }, [pulling, refreshing, pullDistance, getScrollTop]);

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
        setTimeout(() => setStatusMsg(''), 1500);
      }
    } else {
      pullDistance.set(0);
      setStatusMsg('');
    }
  }, [pulling, pullDistance, onRefresh]);

  return (
    <div
      className={`relative ${className}`}
      style={{ overscrollBehaviorY: scrollable ? 'contain' : 'auto' }}
    >
      {/* ARIA live region */}
      <span
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMsg}
      </span>

      {/* Pull indicator — sits above content */}
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

      {/* Content */}
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