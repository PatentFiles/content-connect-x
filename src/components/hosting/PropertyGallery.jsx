import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function PropertyGallery({ media, title }) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (!media || media.length === 0) {
    return (
      <div className="aspect-video bg-[#121824] border border-[#263248] rounded-xl flex items-center justify-center text-[#6B7A94]">
        <p className="text-sm">No photos yet</p>
      </div>
    );
  }

  const sorted = [...media].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const current = sorted[active];

  return (
    <>
      <div className="space-y-2">
        {/* Main image */}
        <div
          className="relative aspect-video rounded-xl overflow-hidden cursor-pointer bg-[#121824]"
          onClick={() => setLightbox(true)}
        >
          {current.type === 'video' ? (
            <video src={current.url} className="w-full h-full object-cover" controls />
          ) : (
            <img src={current.url} alt={current.caption || title} className="w-full h-full object-cover" />
          )}
          {sorted.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); setActive(i => Math.max(0, i - 1)); }}
                disabled={active === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setActive(i => Math.min(sorted.length - 1, i + 1)); }}
                disabled={active === sorted.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white disabled:opacity-30 hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 rounded text-xs text-white">
                {active + 1} / {sorted.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {sorted.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {sorted.map((item, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  i === active ? 'border-[#4F8CFF]' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={item.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(false)}>
            <X className="w-6 h-6" />
          </button>
          <img
            src={current.url}
            alt={title}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}