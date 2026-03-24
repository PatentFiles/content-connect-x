import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTabNavigator } from './TabNavigator';
import { getPlatform } from '@/lib/usePlatform';

/**
 * Native-app-style page transitions — platform-aware:
 * - iOS / Android native push:  full-width horizontal slide (matches system nav)
 * - iOS / Android pop:          reverse slide
 * - Tab switch:                 fade only (no slide — standard tab behavior)
 * - Web:                        subtle 20px slide + fade (less jarring on desktop)
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const tabNav = useTabNavigator();
  const direction = tabNav?.navigationDirection?.current ?? 'forward';
  const platform = getPlatform();
  const isNative = platform === 'ios' || platform === 'android';

  // Native: full viewport width slide; Web: subtle offset
  const slideX = isNative ? '100%' : 24;
  const slideXBack = isNative ? '-30%' : -24; // iOS: old page peeks from left

  const easing = isNative
    ? [0.36, 0.66, 0.04, 1]   // iOS spring-like cubic
    : [0.25, 0.46, 0.45, 0.94];

  const duration = isNative ? 0.32 : 0.2;

  const variants = {
    forward: {
      initial: { opacity: isNative ? 1 : 0, x: slideX },
      animate: { opacity: 1, x: 0 },
      exit:    { opacity: isNative ? 1 : 0, x: slideXBack },
    },
    back: {
      initial: { opacity: isNative ? 1 : 0, x: slideXBack },
      animate: { opacity: 1, x: 0 },
      exit:    { opacity: isNative ? 1 : 0, x: slideX },
    },
    tab: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit:    { opacity: 0 },
    },
  };

  const v = variants[direction] ?? variants.forward;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname + location.search}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={{ duration, ease: easing }}
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}