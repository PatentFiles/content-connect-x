import React, { useState } from 'react';
import { X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VideoPlayer({ videoUrl, thumbnailUrl, title, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-4xl"
        >
          <div className="relative">
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 text-white hover:text-[#4F8CFF] transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {isPlaying ? (
                <video
                  src={videoUrl}
                  className="w-full h-full"
                  controls
                  autoPlay
                />
              ) : (
                <div
                  className="relative w-full h-full cursor-pointer group"
                  onClick={() => setIsPlaying(true)}
                >
                  <img
                    src={thumbnailUrl || videoUrl}
                    alt={title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/60 transition-colors">
                    <div className="w-20 h-20 rounded-full bg-[#4F8CFF] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-10 h-10 text-white ml-1" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {title && (
              <p className="text-white text-center mt-4 text-lg">{title}</p>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}