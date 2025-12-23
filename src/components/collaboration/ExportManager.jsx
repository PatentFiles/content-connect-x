import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Table, Code } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ExportManager({ collaborationId, collaborationName }) {
  const [exporting, setExporting] = useState(false);

  const { data: collaborations = [] } = useQuery({
    queryKey: ['collaboration', collaborationId],
    queryFn: () => base44.entities.Collaboration.filter({ id: collaborationId }),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['collaborationActivity', collaborationId],
    queryFn: () => base44.entities.CollaborationActivity.filter({ 
      deal_room_id: collaborationId 
    }),
  });

  const { data: participantRoles = [] } = useQuery({
    queryKey: ['participantRoles', collaborationId],
    queryFn: () => base44.entities.CollaborationParticipantRole.filter({
      collaboration_id: collaborationId
    }),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['collaborationMessages', collaborationId],
    queryFn: () => base44.entities.CollaborationMessage.filter({
      collaboration_id: collaborationId
    }),
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['disputes', collaborationId],
    queryFn: () => base44.entities.CollaborationDispute.filter({
      collaboration_id: collaborationId
    }),
  });

  const { data: confirmations = [] } = useQuery({
    queryKey: ['confirmations', collaborationId],
    queryFn: () => base44.entities.CollaborationConfirmation.filter({
      collaboration_id: collaborationId
    }),
  });

  const exportCSV = () => {
    setExporting(true);
    try {
      const csvRows = [];
      
      // Headers
      csvRows.push(['Collaboration Audit Log Export']);
      csvRows.push(['Generated', format(new Date(), 'PPpp')]);
      csvRows.push(['Collaboration', collaborationName || collaborationId]);
      csvRows.push([]);
      
      // Activities
      csvRows.push(['Activity Log']);
      csvRows.push(['Date', 'Actor', 'Role', 'Action', 'Description']);
      activities.forEach(act => {
        csvRows.push([
          format(new Date(act.created_date), 'PPpp'),
          act.actor_user_id,
          act.actor_role,
          act.action_type,
          act.description
        ]);
      });
      csvRows.push([]);
      
      // Messages metadata
      csvRows.push(['Message Metadata']);
      csvRows.push(['Date', 'Sender', 'Role', 'Preview']);
      messages.forEach(msg => {
        csvRows.push([
          format(new Date(msg.created_date), 'PPpp'),
          msg.sender_user_id,
          msg.sender_role,
          msg.message_body.substring(0, 50) + '...'
        ]);
      });
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collaboration-${collaborationId}-export.csv`;
      a.click();
      
      toast.success('CSV exported successfully');
    } catch (error) {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  const exportJSON = () => {
    setExporting(true);
    try {
      const data = {
        collaboration: collaborations[0],
        participants: participantRoles,
        activities: activities,
        messages: messages,
        disputes: disputes,
        confirmations: confirmations,
        exported_at: new Date().toISOString()
      };
      
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collaboration-${collaborationId}-export.json`;
      a.click();
      
      toast.success('JSON exported successfully');
    } catch (error) {
      toast.error('Failed to export JSON');
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = () => {
    toast.info('PDF export requires server-side processing. Use JSON for complete records.');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[#E8EEF9] mb-1">Export Audit Records</h3>
        <p className="text-xs text-[#6B7A94]">
          Download complete collaboration records for legal and compliance purposes
        </p>
      </div>

      <div className="grid gap-3">
        <CCCard hover padding="md" clickable onClick={exportCSV}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
              <Table className="w-5 h-5 text-[#22C55E]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#E8EEF9]">CSV Export</p>
              <p className="text-xs text-[#6B7A94]">Activity log & message metadata</p>
            </div>
            <Download className="w-5 h-5 text-[#9AA6BC]" />
          </div>
        </CCCard>

        <CCCard hover padding="md" clickable onClick={exportJSON}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#4F8CFF]/20 flex items-center justify-center">
              <Code className="w-5 h-5 text-[#4F8CFF]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#E8EEF9]">JSON Export</p>
              <p className="text-xs text-[#6B7A94]">Complete structured audit log</p>
            </div>
            <Download className="w-5 h-5 text-[#9AA6BC]" />
          </div>
        </CCCard>

        <CCCard hover padding="md" clickable onClick={exportPDF}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EF4444]/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#EF4444]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#E8EEF9]">PDF Export</p>
              <p className="text-xs text-[#6B7A94]">Human-readable legal record (coming soon)</p>
            </div>
            <Download className="w-5 h-5 text-[#9AA6BC]" />
          </div>
        </CCCard>
      </div>
    </div>
  );
}