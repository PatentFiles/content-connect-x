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
  video_editor: 'Video Editor',
  host: 'Host',
};

export default function AdminContextBanner({ currentView, onReturnToAdmin }) {
  if (currentView === 'admin') return null;

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-16 left-0 right-0 z-30 bg-[#4F8CFF]/10 backdrop-blur-xl border-b border-[#4F8CFF]/30 md:pl-64"
    >
      <div className="px-4 py-2.5">
        {/* Title */}
        <div className="flex items-center gap-2 justify-center mb-2">
          <Eye className="w-4 h-4 text-[#4F8CFF]" />
          <p className="text-sm text-[#E8EEF9]">
            Admin viewing as <span className="font-semibold">{roleLabels[currentView]}</span>
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2 justify-center max-w-sm mx-auto">
          <CCBadge variant="primary" size="md" className="flex-1 justify-center py-1.5">
            View Mode
          </CCBadge>
          <CCButton
            variant="outline"
            size="sm"
            icon={ArrowLeft}
            onClick={onReturnToAdmin}
            className="flex-1"
          >
            Return to Admin
          </CCButton>
        </div>
      </div>
    </motion.div>
  );
}