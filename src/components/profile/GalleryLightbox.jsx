import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

export default function GalleryLightbox({ images, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
      if (e.key === 'ArrowRight') goTo(currentIndex + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentIndex]);

  const goTo = (index) => {
    if (index < 0 || index >= images.length) return;
    setCurrentIndex(index);
    setZoom(1);
  };

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(diff > 0 ? currentIndex + 1 : currentIndex - 1);
    setTouchStart(null);
  };

  const current = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Prev */}
      {currentIndex > 0 && (
        <button
          onClick={() => goTo(currentIndex - 1)}
          className="absolute left-3 md:left-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Next */}
      {currentIndex < images.length - 1 && (
        <button
          onClick={() => goTo(currentIndex + 1)}
          className="absolute right-3 md:right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"
        >
          <ChevronRight className="w-6 h-6 text-white" />
        </button>
      )}

      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
          style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease' }}
        >
          {current?.type === 'video' ? (
            <video
              src={current.url}
              controls
              className="max-h-[85vh] max-w-[85vw] object-contain"
            />
          ) : (
            <img
              src={current?.url}
              alt=""
              className="max-h-[85vh] max-w-[85vw] object-contain cursor-zoom-in select-none"
              onClick={() => setZoom(z => z === 1 ? 2.5 : 1)}
              draggable={false}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Zoom controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
        <button
          onClick={() => setZoom(z => Math.max(1, z - 0.5))}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <span className="flex items-center text-white/60 text-sm px-1">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(z => Math.min(4, z + 0.5))}
          className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}