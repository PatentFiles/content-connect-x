import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTabNavigator } from './TabNavigator';

/**
 * Native-app-style page transitions:
 * - Forward (push): slide in from right, old page slides out to left
 * - Back  (pop):  slide in from left, old page slides out to right
 * - Tab switch:   fade only (no horizontal slide — matches iOS tab bar behavior)
 */
export default function PageTransition({ children }) {
  const location = useLocation();
  const tabNav = useTabNavigator();

  // Read direction set by TabNavigator before navigation
  const direction = tabNav?.navigationDirection?.current ?? 'forward';

  const variants = {
    forward: {
      initial: { opacity: 0, x: 20 },
      animate: { opacity: 1, x: 0 },
      exit:    { opacity: 0, x: -20 },
    },
    back: {
      initial: { opacity: 0, x: -20 },
      animate: { opacity: 1, x: 0 },
      exit:    { opacity: 0, x: 20 },
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
        transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}