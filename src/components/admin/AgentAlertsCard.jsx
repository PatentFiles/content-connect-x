import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { createPageUrl } from '@/utils';
import CCCard, { CCCardHeader, CCCardTitle, CCCardContent } from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import { format } from 'date-fns';

export default function AgentAlertsCard() {
  const { data: flags = [] } = useQuery({
    queryKey: ['openAgentFlags'],
    queryFn: () => base44.entities.AgentFlag.filter({ status: 'OPEN' }, '-created_date', 10),
  });

  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedFlags = [...flags].sort((a, b) => 
    severityOrder[a.severity] - severityOrder[b.severity]
  );

  const severityConfig = {
    LOW: { variant: 'outline' },
    MEDIUM: { variant: 'warning' },
    HIGH: { variant: 'danger' },
    CRITICAL: { variant: 'danger' },
  };

  return (
    <CCCard padding="lg">
      <CCCardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
            <CCCardTitle>Agent Alerts</CCCardTitle>
          </div>
          <CCButton
            variant="ghost"
            size="sm"
            iconRight={ArrowRight}
            onClick={() => window.location.href = createPageUrl('AgentManagement')}
          >
            View All
          </CCButton>
        </div>
      </CCCardHeader>
      <CCCardContent>
        {sortedFlags.length === 0 ? (
          <p className="text-sm text-[#6B7A94] text-center py-4">No open flags</p>
        ) : (
          <div className="space-y-2">
            {sortedFlags.map((flag) => (
              <div
                key={flag.id}
                className="flex items-start justify-between py-2 border-b border-[#263248] last:border-0"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-[#E8EEF9]">{flag.title}</p>
                    <CCBadge variant={severityConfig[flag.severity].variant} size="sm">
                      {flag.severity}
                    </CCBadge>
                  </div>
                  <p className="text-xs text-[#6B7A94]">
                    {flag.category} • {format(new Date(flag.created_date), 'MMM d')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CCCardContent>
    </CCCard>
  );
}