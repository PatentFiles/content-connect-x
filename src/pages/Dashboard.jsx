import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import CreatorDashboard from '../components/dashboards/CreatorDashboard';
import AgentDashboard from '../components/dashboards/AgentDashboard';
import StudioDashboard from '../components/dashboards/StudioDashboard';
import PhotographerDashboard from '../components/dashboards/PhotographerDashboard';
import VideographerDashboard from '../components/dashboards/VideographerDashboard';
import ProfileWizard from '../components/profile/ProfileWizard';
import OnboardingChecklist from '../components/onboarding/OnboardingChecklist';
import PullToRefresh from '../components/ui-custom/PullToRefresh';

export default function Dashboard() {
  const [showWizard, setShowWizard] = useState(false);
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [], isLoading: profileLoading } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: user?.email }),
    enabled: !!user?.email,
  });

  if (userLoading || profileLoading) {
    return <CCLoadingScreen message="Loading dashboard..." />;
  }

  const profile = profiles[0];
  const roleType = profile?.role_type || 'creator';

  // Show wizard automatically for new users who haven't completed their profile
  const shouldShowWizard = profile && !profile.profile_complete && !showWizard;
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const autoShowWizard = shouldShowWizard && !wizardDismissed;

  const dashboards = {
    creator:      <CreatorDashboard user={user} profile={profile} />,
    agent:        <AgentDashboard user={user} profile={profile} />,
    studio:       <StudioDashboard user={user} profile={profile} />,
    photographer: <PhotographerDashboard user={user} profile={profile} />,
    videographer: <VideographerDashboard user={user} profile={profile} />,
  };

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
      queryClient.invalidateQueries({ queryKey: ['myProfile', user?.email] }),
      queryClient.invalidateQueries({ queryKey: ['myCollaborations', user?.email] }),
      queryClient.invalidateQueries({ queryKey: ['myContracts', user?.email] }),
      queryClient.invalidateQueries({ queryKey: ['myTasks', user?.email] }),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen" scrollable={false}>
      {/* Onboarding checklist — rendered inside dashboards below */}
      {(autoShowWizard || showWizard) && (
        <ProfileWizard
          user={user}
          profile={profile}
          onComplete={() => { setShowWizard(false); setWizardDismissed(true); }}
          onSkip={() => { setShowWizard(false); setWizardDismissed(true); }}
        />
      )}
      {React.cloneElement(dashboards[roleType] || dashboards.creator, {
        onboardingChecklist: <OnboardingChecklist user={user} profile={profile} />,
        onOpenWizard: () => setShowWizard(true),
      })}
    </PullToRefresh>
  );
}