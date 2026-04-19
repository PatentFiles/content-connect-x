import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CompliancePortal from '@/components/admin/CompliancePortal';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';

export default function CompliancePortalPage() {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  if (userLoading) {
    return <CCLoadingScreen message="Loading compliance portal..." />;
  }

  return (
    <FeatureRouteGuard flag="compliance_portal" requiresSubscription={false}>
      <CompliancePortal currentUser={user} />
    </FeatureRouteGuard>
  );
}