import React from 'react';
import ContractViewer from '@/components/contracts/ContractViewer';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';

export default function ViewContract() {
  return (
    <FeatureRouteGuard flag="contracts" requiresSubscription={true}>
      <MobileRefreshPage>
        <ContractViewer />
      </MobileRefreshPage>
    </FeatureRouteGuard>
  );
}