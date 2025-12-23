import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Shield, FileText } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ComplianceDashboard() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: complianceRecords = [] } = useQuery({
    queryKey: ['complianceRecords'],
    queryFn: () => base44.entities.ComplianceRecord.list('-created_date'),
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['complianceCollaborations'],
    queryFn: async () => {
      const collabIds = [...new Set(complianceRecords.map(r => r.collaboration_id))];
      if (!collabIds.length) return [];
      const allCollabs = await base44.entities.Collaboration.list();
      return allCollabs.filter(c => collabIds.includes(c.id));
    },
    enabled: complianceRecords.length > 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['complianceProfiles'],
    queryFn: async () => {
      const userIds = [...new Set(complianceRecords.map(r => r.creator_user_id))];
      if (!userIds.length) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: complianceRecords.length > 0,
  });

  const exportCompliancePacket = (record) => {
    try {
      const collaboration = collaborations.find(c => c.id === record.collaboration_id);
      const profile = profiles.find(p => p.user_id === record.creator_user_id);
      
      const packet = {
        record_id: record.id,
        collaboration: collaboration,
        creator: profile,
        verification_snapshot: record.verification_snapshot_json,
        contract_snapshot: record.contract_snapshot_json,
        confirmation_snapshot: record.confirmation_snapshot_json,
        finalized_at: record.finalized_at,
        exported_at: new Date().toISOString()
      };

      const json = JSON.stringify(packet, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-${record.id}.json`;
      a.click();
      
      toast.success('Compliance packet exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const filteredRecords = complianceRecords.filter(record => {
    if (searchTerm === '') return true;
    const profile = profiles.find(p => p.user_id === record.creator_user_id);
    const collaboration = collaborations.find(c => c.id === record.collaboration_id);
    return (
      record.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collaboration?.collaboration_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#E8EEF9] mb-2">Compliance Records</h2>
        <p className="text-sm text-[#6B7A94]">2257-style recordkeeping for legal compliance</p>
      </div>

      {/* Search */}
      <CCCard padding="lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
          <input
            type="text"
            placeholder="Search records by creator or collaboration..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
          />
        </div>
      </CCCard>

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <CCCard padding="lg" className="text-center">
          <FileText className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
          <p className="text-sm text-[#9AA6BC]">No compliance records found</p>
        </CCCard>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map(record => {
            const collaboration = collaborations.find(c => c.id === record.collaboration_id);
            const profile = profiles.find(p => p.user_id === record.creator_user_id);
            
            return (
              <CCCard key={record.id} padding="lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-[#4F8CFF]" />
                      <p className="text-sm font-medium text-[#E8EEF9]">
                        {profile?.display_name || record.creator_user_id}
                      </p>
                      {record.immutable && (
                        <CCBadge variant="success" size="sm">Finalized</CCBadge>
                      )}
                    </div>
                    <p className="text-xs text-[#6B7A94] mb-2">
                      Collaboration: {collaboration?.collaboration_name || record.collaboration_id}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-[#9AA6BC]">
                      {record.verification_snapshot_json && (
                        <CCBadge variant="primary" size="sm">Verification ✓</CCBadge>
                      )}
                      {record.contract_snapshot_json && (
                        <CCBadge variant="primary" size="sm">Contract ✓</CCBadge>
                      )}
                      {record.confirmation_snapshot_json && (
                        <CCBadge variant="primary" size="sm">Confirmation ✓</CCBadge>
                      )}
                    </div>
                    {record.finalized_at && (
                      <p className="text-xs text-[#6B7A94] mt-2">
                        Finalized: {format(new Date(record.finalized_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    )}
                  </div>
                  <CCButton
                    variant="outline"
                    size="sm"
                    icon={Download}
                    onClick={() => exportCompliancePacket(record)}
                  >
                    Export
                  </CCButton>
                </div>
              </CCCard>
            );
          })}
        </div>
      )}
    </div>
  );
}