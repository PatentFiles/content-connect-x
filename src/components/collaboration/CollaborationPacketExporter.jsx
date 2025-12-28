import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, FileText, Shield, Download, CheckCircle } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCCard, { CCCardHeader, CCCardTitle, CCCardDescription, CCCardContent } from '../ui-custom/CCCard';
import CCBadge from '../ui-custom/CCBadge';
import { format } from 'date-fns';

export default function CollaborationPacketExporter({ collaboration, packetItems = [] }) {
  const queryClient = useQueryClient();
  const [exporting, setExporting] = useState(false);

  const attachTestingDocumentsMutation = useMutation({
    mutationFn: async () => {
      const participants = collaboration.participants || [];
      const attachedItems = [];

      // Attach testing documents for each participant
      for (const participant of participants) {
        const testingDocs = await base44.entities.TestingDocument.filter({
          user_id: participant.user_id,
          is_active: true,
          status: 'verified',
        });

        for (const doc of testingDocs) {
          const item = await base44.entities.CollaborationPacketItem.create({
            collaboration_id: collaboration.id,
            item_type: 'testing_document',
            related_entity_type: 'TestingDocument',
            related_entity_id: doc.id,
            title: `Testing Document - ${participant.display_name || participant.user_id}`,
            file_url: doc.file_url,
            metadata: {
              participant_id: participant.user_id,
              uploaded_at: doc.uploaded_at,
              file_name: doc.file_name,
            },
          });
          attachedItems.push(item);
        }
      }

      // Log to activity feed
      await base44.entities.CollaborationActivityLog.create({
        collaboration_id: collaboration.id,
        activity_type: 'packet_updated',
        actor_user_id: (await base44.auth.me()).email,
        description: `Attached ${attachedItems.length} testing documents to collaboration packet`,
        metadata: {
          items_count: attachedItems.length,
        },
      });

      return attachedItems;
    },
    onSuccess: (items) => {
      queryClient.invalidateQueries({ queryKey: ['collaborationPacketItems'] });
      toast.success(`Attached ${items.length} testing documents to packet`);
    },
    onError: (error) => {
      toast.error('Failed to attach testing documents: ' + error.message);
    },
  });

  const exportPacketMutation = useMutation({
    mutationFn: async () => {
      setExporting(true);
      
      // Generate packet manifest
      const manifest = {
        collaboration_id: collaboration.id,
        collaboration_title: collaboration.title,
        exported_at: new Date().toISOString(),
        items: packetItems.map(item => ({
          type: item.item_type,
          title: item.title,
          file_url: item.file_url,
          created_at: item.created_at,
          metadata: item.metadata,
        })),
      };

      // Create JSON blob and download
      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collaboration-packet-${collaboration.id}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setExporting(false);
      return manifest;
    },
    onSuccess: () => {
      toast.success('Packet exported successfully');
    },
    onError: (error) => {
      setExporting(false);
      toast.error('Failed to export packet: ' + error.message);
    },
  });

  const itemTypeIcons = {
    contract_pdf: FileText,
    contract_snapshot: FileText,
    testing_document: Shield,
    verification_summary: CheckCircle,
    activity_log_export: FileText,
  };

  const itemTypeLabels = {
    contract_pdf: 'Contract PDF',
    contract_snapshot: 'Contract Snapshot',
    testing_document: 'Testing Document',
    verification_summary: 'Verification Summary',
    activity_log_export: 'Activity Log',
  };

  return (
    <CCCard>
      <CCCardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CCCardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Collaboration Packet
            </CCCardTitle>
            <CCCardDescription>
              Audit package including contracts, testing documents, and activity logs
            </CCCardDescription>
          </div>
          <div className="flex gap-2">
            <CCButton
              variant="outline"
              size="sm"
              onClick={() => attachTestingDocumentsMutation.mutate()}
              loading={attachTestingDocumentsMutation.isLoading}
            >
              Attach Testing Docs
            </CCButton>
            <CCButton
              variant="primary"
              size="sm"
              icon={Download}
              onClick={() => exportPacketMutation.mutate()}
              loading={exporting}
            >
              Export Packet
            </CCButton>
          </div>
        </div>
      </CCCardHeader>
      <CCCardContent>
        {packetItems.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
            <p className="text-[#9AA6BC] mb-2">No items in packet yet</p>
            <p className="text-sm text-[#6B7A94]">
              Attach testing documents or export to generate packet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {packetItems.map((item) => {
              const Icon = itemTypeIcons[item.item_type] || FileText;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-[#121824] border border-[#263248] rounded-lg"
                >
                  <div className="p-2 bg-[#151D2B] rounded-lg">
                    <Icon className="w-4 h-4 text-[#4F8CFF]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#E8EEF9]">{item.title}</p>
                    <p className="text-xs text-[#6B7A94]">
                      {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <CCBadge variant="outline" size="sm">
                    {itemTypeLabels[item.item_type]}
                  </CCBadge>
                </div>
              );
            })}
          </div>
        )}
      </CCCardContent>
    </CCCard>
  );
}