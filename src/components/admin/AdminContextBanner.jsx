import React from 'react';
import { Eye, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';

const roleLabels = {
  creator: 'Creator',
  agent: 'Agent',
  studio: 'Studio',
  photographer: 'Photographer',
  videographer: 'Videographer',
};

export default function AdminContextBanner({ currentView, onReturnToAdmin }) {
  if (currentView === 'admin') return null;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-16 left-0 right-0 z-30 bg-[#4F8CFF]/10 backdrop-blur-xl border-b border-[#4F8CFF]/30"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#4F8CFF]" />
          <p className="text-sm text-[#E8EEF9]">
            Admin viewing as <span className="font-semibold">{roleLabels[currentView]}</span>
          </p>
          <CCBadge variant="primary" size="sm">View Mode</CCBadge>
        </div>
        <CCButton
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          onClick={onReturnToAdmin}
        >
          Return to Admin
        </CCButton>
      </div>
    </motion.div>
  );
}