import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCInput from '@/components/ui-custom/CCInput';
import { Lock, Unlock, Save, FileText, Plus, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function CollaborativeEditor({ collaborationId, user }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [showNewDoc, setShowNewDoc] = useState(false);
  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documents = [] } = useQuery({
    queryKey: ['collaborationDocuments', collaborationId],
    queryFn: () => base44.entities.DealRoomDocument.filter({ deal_room_id: collaborationId }),
    enabled: !!collaborationId,
    refetchInterval: 5000,
  });

  // Create document mutation
  const createDocMutation = useMutation({
    mutationFn: (data) => base44.entities.DealRoomDocument.create({
      ...data,
      deal_room_id: collaborationId,
      created_by: user.email,
      content: '',
    }),
    onSuccess: (doc) => {
      queryClient.invalidateQueries(['collaborationDocuments']);
      setSelectedDoc(doc);
      setShowNewDoc(false);
      setTitle('');
      toast.success('Document created');
    },
  });

  // Update document mutation
  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DealRoomDocument.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['dealRoomDocuments']);
      toast.success('Document saved');
    },
  });

  const handleSave = () => {
    if (!selectedDoc) return;
    updateDocMutation.mutate({
      id: selectedDoc.id,
      data: {
        content,
        last_edited_by: user.email,
        version: selectedDoc.version + 1,
      },
    });
  };

  const toggleLock = () => {
    if (!selectedDoc) return;
    updateDocMutation.mutate({
      id: selectedDoc.id,
      data: {
        is_locked: !selectedDoc.is_locked,
        locked_by: !selectedDoc.is_locked ? user.email : null,
      },
    });
  };

  useEffect(() => {
    if (selectedDoc) {
      const updated = documents.find(d => d.id === selectedDoc.id);
      if (updated) {
        setSelectedDoc(updated);
        setContent(updated.content || '');
      }
    }
  }, [documents, selectedDoc?.id]);

  const isLocked = selectedDoc?.is_locked && selectedDoc?.locked_by !== user?.email;

  return (
    <div className="grid md:grid-cols-4 gap-4">
      {/* Document List */}
      <div className="md:col-span-1 space-y-3">
        <CCButton
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowNewDoc(!showNewDoc)}
          fullWidth
        >
          New Document
        </CCButton>

        {showNewDoc && (
          <CCCard className="p-3">
            <CCInput
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mb-2"
            />
            <CCButton
              variant="primary"
              size="sm"
              onClick={() => title && createDocMutation.mutate({ title })}
              fullWidth
            >
              Create
            </CCButton>
          </CCCard>
        )}

        <div className="space-y-2">
          {documents.map((doc) => (
            <CCCard
              key={doc.id}
              className={`p-3 cursor-pointer ${selectedDoc?.id === doc.id ? 'border-[#4F8CFF]' : ''}`}
              onClick={() => {
                setSelectedDoc(doc);
                setContent(doc.content || '');
              }}
            >
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-[#4F8CFF] mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#E8EEF9] truncate">{doc.title}</p>
                  <p className="text-xs text-[#6B7A94]">v{doc.version}</p>
                </div>
                {doc.is_locked && <Lock className="w-3 h-3 text-[#FF2DAA]" />}
              </div>
            </CCCard>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="md:col-span-3">
        {selectedDoc ? (
          <CCCard className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#E8EEF9]">{selectedDoc.title}</h3>
                <p className="text-xs text-[#6B7A94]">
                  Last edited by {selectedDoc.last_edited_by || selectedDoc.created_by}
                </p>
              </div>
              <div className="flex gap-2">
                <CCButton
                  variant="outline"
                  size="sm"
                  icon={selectedDoc.is_locked ? Lock : Unlock}
                  onClick={toggleLock}
                >
                  {selectedDoc.is_locked ? 'Unlock' : 'Lock'}
                </CCButton>
                <CCButton
                  variant="primary"
                  size="sm"
                  icon={Save}
                  onClick={handleSave}
                  disabled={isLocked}
                >
                  Save
                </CCButton>
              </div>
            </div>

            {isLocked && (
              <CCBadge variant="warning" className="mb-3">
                Document locked by {selectedDoc.locked_by}
              </CCBadge>
            )}

            <ReactQuill
              value={content}
              onChange={setContent}
              readOnly={isLocked}
              theme="snow"
              className="bg-[#121824] text-[#E8EEF9]"
              style={{ height: '400px', marginBottom: '50px' }}
            />
          </CCCard>
        ) : (
          <CCCard className="p-8 text-center">
            <FileText className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC]">Select or create a document to start editing</p>
          </CCCard>
        )}
      </div>
    </div>
  );
}