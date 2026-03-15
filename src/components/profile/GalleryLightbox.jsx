import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageCircle } from 'lucide-react';
import GalleryComments from './GalleryComments';

export default function GalleryLightbox({
  images,
  initialIndex,
  onClose,
  galleryId,
  profileOwnerId,
  currentUser,
  commentPolicy = 'everyone',
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState(null);
  const [showComments, setShowComments] = useState(true);

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
  const hasCommentFeature = !!galleryId && commentPolicy !== 'no_one';

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/95 flex"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image pane */}
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10">
          <div className="text-white/60 text-sm font-medium">{currentIndex + 1} / {images.length}</div>
          <div className="flex items-center gap-2">
            {hasCommentFeature && (
              <button
                onClick={() => setShowComments(v => !v)}
                className={`p-2 rounded-full transition-colors ${showComments ? 'bg-[#4F8CFF]' : 'bg-white/10 hover:bg-white/20'}`}
              >
                <MessageCircle className="w-5 h-5 text-white" />
              </button>
            )}
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Prev / Next */}
        {currentIndex > 0 && (
          <button
            onClick={() => goTo(currentIndex - 1)}
            className="absolute left-3 p-2 bg-white/10 rounded-full hover:bg-white/20 z-10"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
        )}
        {currentIndex < images.length - 1 && (
          <button
            onClick={() => goTo(currentIndex + 1)}
            className="absolute right-3 p-2 bg-white/10 rounded-full hover:bg-white/20 z-10"
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
            transition={{ duration: 0.18 }}
            className="flex items-center justify-center"
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease' }}
          >
            {current?.type === 'video' ? (
              <video src={current.url} controls className="max-h-[80vh] max-w-[80vw] object-contain" />
            ) : (
              <img
                src={current?.url}
                alt=""
                className="max-h-[80vh] max-w-[80vw] object-contain cursor-zoom-in select-none"
                onClick={() => setZoom(z => z === 1 ? 2.5 : 1)}
                draggable={false}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <span className="text-white/50 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.5))} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-1.5">
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

      {/* Comments panel */}
      <AnimatePresence>
        {showComments && galleryId && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-80 bg-[#151D2B] border-l border-[#263248] flex flex-col overflow-hidden flex-shrink-0"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#263248]">
              <h3 className="text-sm font-semibold text-[#E8EEF9]">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-[#6B7A94] hover:text-[#E8EEF9]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <GalleryComments
                galleryId={galleryId}
                itemIndex={currentIndex}
                profileOwnerId={profileOwnerId}
                currentUser={currentUser}
                commentPolicy={commentPolicy}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}