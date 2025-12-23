import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tantml:react-query';
import { FileText, Upload, Download, Trash2, Folder } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import CCButton from '../ui-custom/CCButton';
import CCCard from '../ui-custom/CCCard';
import CCInput from '../ui-custom/CCInput';
import CCSelect from '../ui-custom/CCSelect';
import CCBadge from '../ui-custom/CCBadge';
import CCModal from '../ui-custom/CCModal';
import { toast } from 'sonner';

export default function DocumentRepository({ dealRoomId }) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newDoc, setNewDoc] = useState({
    title: '',
    category: 'other',
    description: '',
    file_url: '',
  });
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['collaborationDocuments', dealRoomId],
    queryFn: () => base44.entities.CollaborationDocument.filter({ deal_room_id: dealRoomId }, '-created_date'),
    enabled: !!dealRoomId,
  });

  const uploadMutation = useMutation({
    mutationFn: (data) => base44.entities.CollaborationDocument.create({
      ...data,
      deal_room_id: dealRoomId,
      uploaded_by: user?.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationDocuments']);
      setShowUploadModal(false);
      setNewDoc({
        title: '',
        category: 'other',
        description: '',
        file_url: '',
      });
      toast.success('Document uploaded');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CollaborationDocument.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['collaborationDocuments']);
      toast.success('Document deleted');
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewDoc({
        ...newDoc,
        file_url,
        file_type: file.type,
        file_size: file.size,
        title: newDoc.title || file.name,
      });
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const categoryColors = {
    contract: 'accent',
    release: 'warning',
    reference: 'primary',
    schedule: 'success',
    other: 'default',
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const groupedDocs = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#E8EEF9]">Documents</h3>
        <CCButton variant="primary" size="sm" icon={Upload} onClick={() => setShowUploadModal(true)}>
          Upload
        </CCButton>
      </div>

      {documents.length === 0 ? (
        <CCCard padding="lg" className="text-center">
          <Folder className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-sm text-[#9AA6BC] mb-4">No documents yet</p>
          <CCButton variant="primary" size="sm" icon={Upload} onClick={() => setShowUploadModal(true)}>
            Upload First Document
          </CCButton>
        </CCCard>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedDocs).map(([category, docs]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <Folder className="w-4 h-4 text-[#6B7A94]" />
                <span className="text-sm font-medium text-[#9AA6BC] capitalize">{category} ({docs.length})</span>
              </div>
              <div className="space-y-2">
                {docs.map(doc => (
                  <motion.div key={doc.id} layout>
                    <CCCard padding="md" hover>
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-[#4F8CFF] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-[#E8EEF9] truncate">{doc.title}</h4>
                            <CCBadge variant={categoryColors[doc.category]} size="sm">
                              {doc.category}
                            </CCBadge>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-[#9AA6BC] mb-1 line-clamp-1">{doc.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-[#6B7A94]">
                            <span>{formatFileSize(doc.file_size || 0)}</span>
                            <span>•</span>
                            <span>{format(new Date(doc.created_date), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <CCButton variant="outline" size="sm" icon={Download}>
                              Download
                            </CCButton>
                          </a>
                          {doc.uploaded_by === user?.email && (
                            <CCButton
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => {
                                if (confirm('Delete this document?')) {
                                  deleteMutation.mutate(doc.id);
                                }
                              }}
                              className="text-[#EF4444] hover:bg-[#EF4444]/10"
                            />
                          )}
                        </div>
                      </div>
                    </CCCard>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <CCModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Document"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Select File</label>
            <label className="flex items-center justify-center gap-2 p-6 bg-[#151D2B] border-2 border-dashed border-[#263248] rounded-lg cursor-pointer hover:border-[#4F8CFF] transition-colors">
              <Upload className="w-5 h-5 text-[#6B7A94]" />
              <span className="text-sm text-[#9AA6BC]">
                {uploading ? 'Uploading...' : newDoc.file_url ? 'File uploaded' : 'Click to upload'}
              </span>
              <input
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>

          <CCInput
            label="Document Title"
            placeholder="Enter document title"
            value={newDoc.title}
            onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
            required
          />

          <CCSelect
            label="Category"
            value={newDoc.category}
            onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
          >
            <option value="contract">Contract</option>
            <option value="release">Release Form</option>
            <option value="reference">Reference</option>
            <option value="schedule">Schedule</option>
            <option value="other">Other</option>
          </CCSelect>

          <div>
            <label className="block text-sm font-medium text-[#E8EEF9] mb-2">Description (Optional)</label>
            <textarea
              value={newDoc.description}
              onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2.5 text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50 min-h-[80px]"
              placeholder="Document description..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <CCButton variant="outline" onClick={() => setShowUploadModal(false)}>
              Cancel
            </CCButton>
            <CCButton
              variant="primary"
              onClick={() => uploadMutation.mutate(newDoc)}
              loading={uploadMutation.isPending}
              disabled={!newDoc.file_url || !newDoc.title}
            >
              Upload Document
            </CCButton>
          </div>
        </div>
      </CCModal>
    </div>
  );
}