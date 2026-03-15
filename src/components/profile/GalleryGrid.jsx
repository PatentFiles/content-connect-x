import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Trash2, GripVertical, Image, Plus } from 'lucide-react';

export default function GalleryGrid({ gallery, onDelete, onReorder, onImageClick, onUpload }) {
  const items = gallery?.items || [];
  const [draggingFile, setDraggingFile] = useState(false);

  const handleDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = Array.from(items);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    onReorder(reordered);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDraggingFile(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length > 0 && onUpload) onUpload(files);
  };

  return (
    <div>
      {/* Drop zone for file upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
        onDragLeave={() => setDraggingFile(false)}
        onDrop={handleFileDrop}
        className={`mb-3 rounded-xl border-2 border-dashed transition-colors flex items-center justify-center gap-3 py-4 cursor-pointer text-sm font-medium
          ${draggingFile
            ? 'border-[#4F8CFF] bg-[#4F8CFF]/10 text-[#4F8CFF]'
            : 'border-[#263248] text-[#6B7A94] hover:border-[#4F8CFF]/50 hover:text-[#9AA6BC]'
          }`}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*,video/*';
          input.multiple = true;
          input.onchange = (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0 && onUpload) onUpload(files);
          };
          input.click();
        }}
      >
        <Plus className="w-4 h-4" />
        {draggingFile ? 'Drop to upload' : 'Click or drag photos here to add'}
      </div>

      {items.length === 0 ? (
        <div className="py-6 text-center text-[#6B7A94]">
          <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No images yet
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId={`gallery-${gallery?.id}`} direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-wrap gap-2"
              >
                {items.map((item, i) => (
                  <Draggable key={`${item.url}-${i}`} draggableId={`item-${gallery?.id}-${i}`} index={i}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="relative bg-[#121824] rounded-lg overflow-hidden"
                        style={{
                          width: 'calc(33.333% - 6px)',
                          aspectRatio: '1',
                          opacity: snapshot.isDragging ? 0.85 : 1,
                          ...provided.draggableProps.style,
                        }}
                      >
                        <div className="w-full h-full cursor-pointer" onClick={() => onImageClick(i)}>
                          {item.type === 'video' ? (
                            <video src={item.url} className="w-full h-full object-cover" />
                          ) : (
                            <img src={item.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div
                          {...provided.dragHandleProps}
                          className="absolute top-1 left-1 p-1 bg-black/60 rounded-full cursor-grab active:cursor-grabbing"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="w-3 h-3 text-white" />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(i); }}
                          className="absolute top-1 right-1 p-1 bg-black/60 rounded-full"
                        >
                          <Trash2 className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
}