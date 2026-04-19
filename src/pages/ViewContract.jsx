import React from 'react';
import ContractViewer from '@/components/contracts/ContractViewer';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';

export default function ViewContract() {
  return (
    <FeatureRouteGuard flag="contracts" requiresSubscription={true}>
      <ContractViewer />
    </FeatureRouteGuard>
  );
}