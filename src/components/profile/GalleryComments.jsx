import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, Lock, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function GalleryComments({ galleryId, itemIndex, profileOwnerId, currentUser, commentPolicy = 'everyone' }) {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['galleryComments', galleryId, itemIndex],
    queryFn: () => base44.entities.GalleryComment.filter({ gallery_id: galleryId, item_index: itemIndex }),
    enabled: !!galleryId,
  });

  const addMutation = useMutation({
    mutationFn: (content) => base44.entities.GalleryComment.create({
      gallery_id: galleryId,
      item_index: itemIndex,
      profile_owner_id: profileOwnerId,
      commenter_user_id: currentUser?.email,
      commenter_display_name: currentUser?.full_name || currentUser?.email?.split('@')[0],
      content,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['galleryComments', galleryId, itemIndex]);
      setText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.GalleryComment.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['galleryComments', galleryId, itemIndex]),
  });

  const isOwner = currentUser?.email === profileOwnerId;
  const canComment = currentUser && commentPolicy !== 'no_one';

  if (commentPolicy === 'no_one' && !isOwner) {
    return (
      <div className="flex items-center gap-2 text-[#6B7A94] text-xs py-2">
        <Lock className="w-3 h-3" />
        <span>Comments disabled on this photo</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-[#9AA6BC]" />
        <span className="text-sm font-medium text-[#E8EEF9]">Comments ({comments.length})</span>
      </div>

      {/* Comment list */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-[#6B7A94] text-center py-2">No comments yet. Be the first!</p>
        ) : comments.map(c => (
          <div key={c.id} className="flex gap-2 group">
            <div className="w-6 h-6 rounded-full bg-[#263248] flex items-center justify-center flex-shrink-0 text-xs text-[#9AA6BC]">
              {(c.commenter_display_name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 bg-[#0B0F14] rounded-lg px-3 py-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#4F8CFF] truncate">
                  {c.commenter_display_name || c.commenter_user_id}
                </span>
                {(c.commenter_user_id === currentUser?.email || isOwner) && (
                  <button
                    onClick={() => deleteMutation.mutate(c.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-[#EF4444]" />
                  </button>
                )}
              </div>
              <p className="text-xs text-[#E8EEF9] mt-0.5 break-words">{c.content}</p>
              <p className="text-xs text-[#6B7A94] mt-1">
                {formatDistanceToNow(new Date(c.created_date), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Add comment */}
      {canComment && (
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && text.trim()) {
                e.preventDefault();
                addMutation.mutate(text.trim());
              }
            }}
            placeholder="Add a comment..."
            className="flex-1 bg-[#0B0F14] border border-[#263248] rounded-lg px-3 py-2 text-xs text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-1 focus:ring-[#4F8CFF]/50"
          />
          <button
            onClick={() => text.trim() && addMutation.mutate(text.trim())}
            disabled={!text.trim() || addMutation.isPending}
            className="p-2 bg-[#4F8CFF] hover:bg-[#3A7AEE] disabled:opacity-50 rounded-lg transition-colors"
          >
            <Send className="w-3 h-3 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}