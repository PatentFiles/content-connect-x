import React from 'react';
import { format } from 'date-fns';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { FileText, Lock } from 'lucide-react';

export default function ContractVersionHistory({ versions, contractId }) {
  const sortedVersions = [...versions].sort((a, b) => b.version_number - a.version_number);

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {sortedVersions.length === 0 ? (
        <p className="text-[#9AA6BC] text-center py-8">No version history available</p>
      ) : (
        sortedVersions.map((version) => (
          <CCCard key={version.id} padding="md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <FileText className="w-5 h-5 text-[#4F8CFF] mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-[#E8EEF9]">
                      Version {version.version_number}
                    </h4>
                    {version.is_locked && (
                      <CCBadge variant="warning" size="sm" icon={Lock}>
                        Locked
                      </CCBadge>
                    )}
                  </div>
                  <p className="text-xs text-[#6B7A94] mb-2">
                    By {version.created_by} • {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                  {version.change_summary && (
                    <p className="text-sm text-[#9AA6BC]">{version.change_summary}</p>
                  )}
                </div>
              </div>
            </div>
          </CCCard>
        ))
      )}
    </div>
  );
}