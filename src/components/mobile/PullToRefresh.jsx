import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 65;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(null);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (startYRef.current === null || isRefreshing) return;
    const dist = e.touches[0].clientY - startYRef.current;
    if (dist > 0) {
      // Dampen the pull with sqrt for natural feel
      setPullY(Math.min(Math.sqrt(dist) * 5, THRESHOLD + 20));
    }
  };

  const handleTouchEnd = async () => {
    if (startYRef.current === null) return;
    if (pullY >= THRESHOLD) {
      setIsRefreshing(true);
      setPullY(THRESHOLD);
      await onRefresh();
      setIsRefreshing(false);
    }
    setPullY(0);
    startYRef.current = null;
  };

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullY > 5 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
            style={{ height: isRefreshing ? THRESHOLD : pullY }}
          >
            <motion.div
              animate={{ rotate: isRefreshing ? 360 : progress * 180 }}
              transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
              className="w-8 h-8 rounded-full bg-[#151D2B] border border-[#263248] flex items-center justify-center shadow-lg"
            >
              <RefreshCw
                className="w-4 h-4"
                style={{ color: progress >= 1 ? '#4F8CFF' : '#6B7A94' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content shifted down during pull */}
      <motion.div
        animate={{ y: isRefreshing ? THRESHOLD : pullY }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  );
}