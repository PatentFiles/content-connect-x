/**
 * GlobalPullToRefresh
 * ───────────────────
 * A single document-level pull-to-refresh that attaches touch listeners directly
 * to `document` (not a wrapper div). This is the only correct approach for
 * body-scroll apps where pages use document.documentElement as the scroll container.
 *
 * Why document-level listeners?
 * - Pages have varied DOM structures; wrapping divs get blocked by inner scroll containers.
 * - document touchstart/touchmove fires before any React component handler.
 * - This is how native iOS Safari PTR works: it monitors the document scroll position.
 *
 * Scanner compatibility:
 * - Uses a fixed top indicator that appears over all content (z-[9999]).
 * - The indicator is a native-style spinner with "Pull to refresh" text.
 * - queryClient.invalidateQueries({ queryKey: [] }) invalidates ALL cached queries.
 *
 * Conflict prevention:
 * - Only activates when document.documentElement.scrollTop <= 2 (at top of page).
 * - Does NOT run on desktop (pointer: fine media query check).
 * - Does NOT run if a scrollable inner container absorbed the touch (checked via composedPath).
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

const PULL_THRESHOLD = 80;  // px to trigger refresh
const MAX_PULL = 110;        // max visual distance
const RESISTANCE = 0.45;     // damping factor

export default function GlobalPullToRefresh({ children }) {
  const queryClient = useQueryClient();
  const [pullY, setPullY] = useState(0);        // current pull distance (px)
  const [phase, setPhase] = useState('idle');   // 'idle' | 'pulling' | 'ready' | 'refreshing'

  const startY = useRef(0);
  const active = useRef(false);
  const refreshing = useRef(false);

  // Check if a touch event originated inside an inner scrollable container
  // that is NOT the document root. If so, we don't intercept.
  const isInsideInnerScroll = useCallback((e) => {
    for (const el of e.composedPath()) {
      if (!(el instanceof Element)) continue;
      if (el === document.documentElement || el === document.body) break;
      const style = window.getComputedStyle(el);
      const overflow = style.overflowY;
      if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) {
        return true;
      }
    }
    return false;
  }, []);

  const getDocScrollTop = () =>
    document.documentElement.scrollTop || document.body.scrollTop || 0;

  const onTouchStart = useCallback((e) => {
    if (refreshing.current) return;
    if (getDocScrollTop() > 2) return;         // not at top of page
    if (isInsideInnerScroll(e)) return;         // inside an inner scroll container
    startY.current = e.touches[0].clientY;
    active.current = true;
  }, [isInsideInnerScroll]);

  const onTouchMove = useCallback((e) => {
    if (!active.current || refreshing.current) return;
    if (getDocScrollTop() > 2) {
      active.current = false;
      setPullY(0);
      setPhase('idle');
      return;
    }

    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPullY(0);
      setPhase('idle');
      return;
    }

    const clamped = Math.min(delta * RESISTANCE, MAX_PULL);
    setPullY(clamped);
    setPhase(clamped >= PULL_THRESHOLD ? 'ready' : 'pulling');
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!active.current) return;
    active.current = false;

    if (pullY >= PULL_THRESHOLD && !refreshing.current) {
      refreshing.current = true;
      setPhase('refreshing');
      setPullY(PULL_THRESHOLD); // hold at threshold during spin

      try {
        await queryClient.invalidateQueries({ queryKey: [] });
      } finally {
        refreshing.current = false;
        setPullY(0);
        setPhase('idle');
      }
    } else {
      setPullY(0);
      setPhase('idle');
    }
  }, [pullY, queryClient]);

  useEffect(() => {
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const isVisible = phase !== 'idle';
  const progress = Math.min(pullY / PULL_THRESHOLD, 1);

  return (
    <>
      {/* ── Pull indicator ── fixed, always on top, pointer-events none */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{
          zIndex: 9999,
          height: isVisible ? `${pullY + 8}px` : '0px',
          overflow: 'hidden',
          transition: phase === 'refreshing' || phase === 'idle' ? 'height 0.25s ease' : 'none',
        }}
      >
        <div
          className="flex flex-col items-center justify-end pb-2 gap-1"
          style={{
            opacity: Math.min(progress * 2, 1),
            transform: `scale(${0.7 + progress * 0.3})`,
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg border"
            style={{
              backgroundColor: 'var(--cc-surface)',
              borderColor: 'var(--cc-border)',
            }}
          >
            <RefreshCw
              className={`w-4 h-4 ${phase === 'refreshing' ? 'animate-spin' : ''}`}
              style={{
                color: phase === 'ready' || phase === 'refreshing' ? 'var(--cc-blue)' : 'var(--cc-text-secondary)',
                transform: phase !== 'refreshing' ? `rotate(${progress * 180}deg)` : undefined,
                transition: 'color 0.15s ease',
              }}
            />
          </div>
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--cc-text-secondary)', whiteSpace: 'nowrap' }}
          >
            {phase === 'refreshing' ? 'Refreshing…' : phase === 'ready' ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* ── Page content — pushed down by pull distance ── */}
      <div
        style={{
          transform: isVisible ? `translateY(${pullY}px)` : 'translateY(0)',
          transition: phase === 'refreshing' || phase === 'idle' ? 'transform 0.25s ease' : 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </>
  );
}