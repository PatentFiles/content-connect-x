import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import CCButton from './CCButton';

export default function CCErrorModal({ isOpen, onClose, title, message }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#151D2B] rounded-2xl border border-[#263248] shadow-2xl overflow-hidden"
            >
              {/* Gradient Header */}
              <div className="relative h-2 bg-gradient-to-r from-[#4F8CFF] via-[#8B5CF6] to-[#FF2DAA]" />
              
              {/* Content */}
              <div className="p-6">
                {/* Icon */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#4F8CFF]/20 to-[#FF2DAA]/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-[#4F8CFF]" />
                </div>
                
                {/* Title */}
                <h3 className="text-xl font-semibold text-[#E8EEF9] text-center mb-2">
                  {title}
                </h3>
                
                {/* Message */}
                <p className="text-[#9AA6BC] text-center mb-6">
                  {message}
                </p>
                
                {/* Button */}
                <CCButton
                  variant="primary"
                  onClick={onClose}
                  fullWidth
                >
                  Got it
                </CCButton>
              </div>
              
              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 text-[#6B7A94] hover:text-[#E8EEF9] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}