import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Eye, Shield, FileText, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCButton from '@/components/ui-custom/CCButton';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CompliancePortal({ currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('all');

  // Check access
  const { data: portalAccess = [] } = useQuery({
    queryKey: ['myPortalAccess', currentUser?.email],
    queryFn: () => base44.entities.CompliancePortalAccess.filter({ 
      user_id: currentUser?.email,
      active: true 
    }),
    enabled: !!currentUser?.email,
  });

  const access = portalAccess[0];
  const hasAccess = !!access;

  const { data: complianceRecords = [] } = useQuery({
    queryKey: ['portalComplianceRecords'],
    queryFn: () => base44.entities.ComplianceRecord.list('-created_date'),
    enabled: hasAccess,
  });

  const { data: collaborations = [] } = useQuery({
    queryKey: ['portalCollaborations'],
    queryFn: async () => {
      const collabIds = [...new Set(complianceRecords.map(r => r.collaboration_id))];
      if (!collabIds.length) return [];
      const allCollabs = await base44.entities.Collaboration.list();
      return allCollabs.filter(c => collabIds.includes(c.id));
    },
    enabled: hasAccess && complianceRecords.length > 0,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['portalProfiles'],
    queryFn: async () => {
      const userIds = [...new Set(complianceRecords.map(r => r.creator_user_id))];
      if (!userIds.length) return [];
      const allProfiles = await base44.entities.UserProfile.list();
      return allProfiles.filter(p => userIds.includes(p.user_id));
    },
    enabled: hasAccess && complianceRecords.length > 0,
  });

  const exportRecord = (record) => {
    try {
      const collaboration = collaborations.find(c => c.id === record.collaboration_id);
      const profile = profiles.find(p => p.user_id === record.creator_user_id);
      
      const packet = {
        compliance_record_id: record.id,
        collaboration_name: collaboration?.collaboration_name,
        creator: profile?.display_name,
        verification_snapshot: record.verification_snapshot_json,
        contract_snapshot: record.contract_snapshot_json,
        confirmation_snapshot: record.confirmation_snapshot_json,
        finalized_at: record.finalized_at,
        jurisdiction: collaboration?.jurisdiction,
        exported_at: new Date().toISOString(),
        exported_by: currentUser.email
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

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
        <CCCard padding="xl" className="text-center max-w-md">
          <Lock className="w-16 h-16 text-[#EF4444] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#E8EEF9] mb-2">Access Restricted</h1>
          <p className="text-[#9AA6BC]">
            You do not have access to the Compliance Portal. Contact an administrator if you require access.
          </p>
        </CCCard>
      </div>
    );
  }

  const filteredRecords = complianceRecords.filter(record => {
    const collaboration = collaborations.find(c => c.id === record.collaboration_id);
    const profile = profiles.find(p => p.user_id === record.creator_user_id);
    
    const matchesSearch = searchTerm === '' || 
      profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collaboration?.collaboration_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesJurisdiction = jurisdictionFilter === 'all' || 
      collaboration?.jurisdiction === jurisdictionFilter;
    
    // Filter by allowed jurisdictions
    const jurisdictionAllowed = !access.allowed_jurisdictions?.length || 
      access.allowed_jurisdictions.includes(collaboration?.jurisdiction);
    
    return matchesSearch && matchesJurisdiction && jurisdictionAllowed;
  });

  return (
    <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-[#4F8CFF]" />
            <div>
              <h1 className="text-2xl font-bold text-[#E8EEF9]">Compliance Portal</h1>
              <p className="text-sm text-[#6B7A94]">Read-only access to compliance records</p>
            </div>
          </div>
          <CCBadge variant="accent">{access.role}</CCBadge>
        </div>

        {/* Filters */}
        <CCCard padding="lg" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A94]" />
              <input
                type="text"
                placeholder="Search by creator or collaboration..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#121824] border border-[#263248] rounded-lg pl-10 pr-4 py-2 text-sm text-[#E8EEF9] placeholder-[#6B7A94] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
              />
            </div>
            <select
              value={jurisdictionFilter}
              onChange={(e) => setJurisdictionFilter(e.target.value)}
              className="w-full bg-[#121824] border border-[#263248] rounded-lg px-4 py-2 text-sm text-[#E8EEF9] focus:outline-none focus:ring-2 focus:ring-[#4F8CFF]/50"
            >
              <option value="all">All Jurisdictions</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="EU">European Union</option>
              <option value="CA">Canada</option>
              <option value="AU">Australia</option>
              <option value="OTHER">Other</option>
            </select>
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
                        {collaboration?.jurisdiction && (
                          <CCBadge variant="outline" size="sm">{collaboration.jurisdiction}</CCBadge>
                        )}
                        {record.immutable && (
                          <CCBadge variant="success" size="sm">Finalized</CCBadge>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7A94] mb-2">
                        Collaboration: {collaboration?.collaboration_name || record.collaboration_id}
                      </p>
                      <div className="flex flex-wrap gap-2">
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
                    <div className="flex gap-2">
                      <CCButton
                        variant="outline"
                        size="sm"
                        icon={Download}
                        onClick={() => exportRecord(record)}
                      >
                        Export
                      </CCButton>
                    </div>
                  </div>
                </CCCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}