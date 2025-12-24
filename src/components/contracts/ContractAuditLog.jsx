import React from 'react';
import { format } from 'date-fns';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { 
  FileText, Send, CheckCircle, Download, AlertTriangle, 
  XCircle, Clock, Shield, Edit
} from 'lucide-react';

const actionConfig = {
  contract_created: { label: 'Contract Created', icon: FileText, variant: 'default' },
  contract_generated: { label: 'Contract Generated', icon: FileText, variant: 'primary' },
  version_created: { label: 'Version Created', icon: Edit, variant: 'primary' },
  contract_sent: { label: 'Contract Sent', icon: Send, variant: 'warning' },
  signature_added: { label: 'Signature Added', icon: CheckCircle, variant: 'success' },
  contract_signed: { label: 'Contract Signed', icon: CheckCircle, variant: 'success' },
  contract_completed: { label: 'Contract Completed', icon: CheckCircle, variant: 'success' },
  pdf_generated: { label: 'PDF Generated', icon: FileText, variant: 'primary' },
  pdf_downloaded: { label: 'PDF Downloaded', icon: Download, variant: 'default' },
  reminder_scheduled: { label: 'Reminder Scheduled', icon: Clock, variant: 'default' },
  reminder_sent: { label: 'Reminder Sent', icon: Send, variant: 'warning' },
  contract_disputed: { label: 'Contract Disputed', icon: AlertTriangle, variant: 'danger' },
  contract_voided: { label: 'Contract Voided', icon: XCircle, variant: 'danger' },
  contract_expired: { label: 'Contract Expired', icon: AlertTriangle, variant: 'danger' },
};

export default function ContractAuditLog({ logs }) {
  const sortedLogs = [...logs].sort((a, b) => 
    new Date(b.created_date) - new Date(a.created_date)
  );

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {sortedLogs.length === 0 ? (
        <p className="text-[#9AA6BC] text-center py-8">No audit log entries</p>
      ) : (
        sortedLogs.map((log) => {
          const config = actionConfig[log.action] || actionConfig.contract_created;
          const Icon = config.icon;
          
          return (
            <CCCard key={log.id} padding="md">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${config.variant === 'default' ? '[#263248]' : config.variant === 'primary' ? '[#4F8CFF]/20' : config.variant === 'success' ? '[#22C55E]/20' : config.variant === 'warning' ? '[#F59E0B]/20' : '[#EF4444]/20'}`}>
                  <Icon className={`w-4 h-4 text-${config.variant === 'default' ? '[#9AA6BC]' : config.variant === 'primary' ? '[#4F8CFF]' : config.variant === 'success' ? '[#22C55E]' : config.variant === 'warning' ? '[#F59E0B]' : '[#EF4444]'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-medium text-[#E8EEF9]">{config.label}</h4>
                    <CCBadge variant={config.variant} size="sm">
                      {log.action.replace(/_/g, ' ')}
                    </CCBadge>
                  </div>
                  <p className="text-xs text-[#6B7A94]">
                    {log.actor_email ? `By ${log.actor_email}` : 'System'} • {format(new Date(log.created_date), 'MMM d, yyyy h:mm a')}
                  </p>
                  {log.metadata_json && Object.keys(log.metadata_json).length > 0 && (
                    <div className="mt-2 text-xs text-[#9AA6BC]">
                      {JSON.stringify(log.metadata_json, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            </CCCard>
          );
        })
      )}
    </div>
  );
}