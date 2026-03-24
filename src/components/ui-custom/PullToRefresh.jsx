import React, { useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 72;

/**
 * Pure-CSS pull-to-refresh wrapper. No external package needed.
 * Usage: <PullToRefresh onRefresh={async () => { ... }}>...</PullToRefresh>
 */
export default function PullToRefresh({ children, onRefresh, className = '', scrollable = true }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const touchStartY = useRef(0);
  const pullDistance = useMotionValue(0);
  const containerRef = useRef(null);

  const iconOpacity = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const iconRotate = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 180]);
  const contentY = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, PULL_THRESHOLD]);

  const handleTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (!el) return;
    // Only allow pull when already at top of scroll
    if (el.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    setPulling(true);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pulling || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;

    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      // Apply rubber-band dampening
      pullDistance.set(Math.min(delta * 0.45, PULL_THRESHOLD + 20));
    }
  }, [pulling, refreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    const current = pullDistance.get();

    if (current >= PULL_THRESHOLD) {
      setRefreshing(true);
      pullDistance.set(PULL_THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        pullDistance.set(0);
      }
    } else {
      pullDistance.set(0);
    }
  }, [pulling, pullDistance, onRefresh]);

  return (
    <div className={`relative ${className}`}>
      {/* Pull indicator */}
      <motion.div
        style={{ opacity: iconOpacity }}
        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
        aria-hidden="true"
      >
        <div className="mt-2 w-9 h-9 rounded-full bg-[#151D2B] border border-[#263248] flex items-center justify-center shadow-lg">
          <motion.div style={{ rotate: iconRotate }}>
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#4F8CFF]' : 'text-[#9AA6BC]'}`}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Scrollable content */}
      <motion.div
        ref={containerRef}
        style={{ y: contentY }}
        className={scrollable ? "h-full overflow-y-auto" : ""}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </motion.div>
    </div>
  );
}