import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Building2, Eye, Pencil, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import { toast } from 'sonner';
import FeatureGate from '@/components/feature/FeatureGate';
import PropertyForm from '@/components/hosting/PropertyForm';
import HostOnboardingChecklist from '@/components/hosting/HostOnboardingChecklist';
import HostOnboardingGateModal from '@/components/hosting/HostOnboardingGateModal';
import SoloSessionsInbox from '@/components/sessions/SoloSessionsInbox';
import ProHostSubscriptionPanel from '@/components/hosting/ProHostSubscriptionPanel';
import HostPricingSettings from '@/components/hosting/HostPricingSettings';

const STATUS_VARIANTS = {
  draft: 'outline',
  pending_review: 'warning',
  active: 'success',
  paused: 'default',
  suspended: 'danger',
  archived: 'default',
};

export default function HostDashboard() {
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [showHostOnboardingModal, setShowHostOnboardingModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['myProperties', user?.email],
    queryFn: () => base44.entities.Property.filter({ owner_user_id: user?.email }),
    enabled: !!user?.email,
  });

  const { data: profile } = useQuery({
    queryKey: ['myProfile', user?.email],
    queryFn: async () => {
      const r = await base44.entities.UserProfile.filter({ user_id: user?.email });
      return r[0];
    },
    enabled: !!user?.email,
  });

  // Gate: require host_account_active before property creation
  const canCreateProperty = profile?.host_account_active === true;
  const handleAddProperty = () => {
    if (!canCreateProperty) {
      setShowHostOnboardingModal(true);
      return;
    }
    setEditingProperty(null);
    setShowForm(true);
  };

  const toggleStatus = async (property) => {
    const newStatus = property.status === 'active' ? 'paused' : 'active';
    await base44.entities.Property.update(property.id, { status: newStatus });
    queryClient.invalidateQueries(['myProperties', user?.email]);
    toast.success(`Listing ${newStatus === 'active' ? 'activated' : 'paused'}`);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingProperty(null);
    queryClient.invalidateQueries(['myProperties', user?.email]);
  };

  if (isLoading) return <CCLoadingScreen message="Loading your properties..." />;

  const activeCount = properties.filter(p => p.status === 'active').length;
  const draftCount = properties.filter(p => p.status === 'draft').length;

  return (
    <FeatureGate flag="hosting_marketplace" fallback={
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-8">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-[#6B7A94] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#E8EEF9] mb-2">Hosting</h2>
          <p className="text-[#9AA6BC]">The hosting marketplace is not yet enabled.</p>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#E8EEF9]">My Properties</h1>
              <p className="text-sm text-[#9AA6BC] mt-1">{activeCount} active · {draftCount} draft</p>
            </div>
            <CCButton
              variant="primary"
              icon={Plus}
              onClick={handleAddProperty}
              disabled={!canCreateProperty}
              title={canCreateProperty ? '' : 'Complete host onboarding first'}
            >
              Add Property
            </CCButton>
          </div>

          {/* Host onboarding modal gate */}
          {showHostOnboardingModal && (
            <HostOnboardingGateModal
              profile={profile}
              onClose={() => setShowHostOnboardingModal(false)}
              onCompleted={() => {
                setShowHostOnboardingModal(false);
                queryClient.invalidateQueries(['myProfile', user?.email]);
              }}
            />
          )}

          {/* Property form */}
          {showForm && (
            <PropertyForm
              property={editingProperty}
              ownerUserId={user?.email}
              onSaved={handleSaved}
              onCancel={() => { setShowForm(false); setEditingProperty(null); }}
            />
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Listings', value: activeCount, color: 'text-[#22C55E]' },
              { label: 'Total Listings', value: properties.length, color: 'text-[#4F8CFF]' },
              { label: 'Drafts', value: draftCount, color: 'text-[#F59E0B]' },
            ].map(stat => (
              <CCCard key={stat.label} padding="md">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-[#6B7A94] mt-1">{stat.label}</p>
              </CCCard>
            ))}
          </div>

          {/* Onboarding checklist — shown when user has no active listings */}
          {activeCount === 0 && (
            <HostOnboardingChecklist properties={properties} />
          )}

          {/* Property list */}
          {properties.length === 0 ? (
            <CCEmpty
              icon={Building2}
              title="No properties yet"
              description="List your first property to start accepting bookings."
              action={handleAddProperty}
              actionLabel="Add Property"
            />
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[#E8EEF9]">Your Listings</h2>
              {properties.map(property => {
                const cover = property.media?.find(m => m.is_cover) || property.media?.[0];
                return (
                  <CCCard key={property.id} padding="md">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#263248] flex-shrink-0">
                        {cover ? (
                          <img src={cover.url} alt={property.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-7 h-7 text-[#6B7A94]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-[#E8EEF9] truncate">{property.title}</p>
                          <CCBadge variant={STATUS_VARIANTS[property.status] || 'default'} size="sm">
                            {property.status}
                          </CCBadge>
                        </div>
                        <p className="text-xs text-[#9AA6BC] mt-0.5 capitalize">
                          {property.property_type} · {property.city}{property.state && `, ${property.state}`}
                        </p>
                        {property.pricing?.hourly_rate && (
                          <p className="text-xs text-[#6B7A94] mt-0.5">${property.pricing.hourly_rate}/hr</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link to={`/PropertyDetail?id=${property.id}`}>
                          <CCButton variant="ghost" size="icon" title="View">
                            <Eye className="w-4 h-4" />
                          </CCButton>
                        </Link>
                        <CCButton
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => { setEditingProperty(property); setShowForm(true); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </CCButton>
                        <CCButton
                          variant="ghost"
                          size="icon"
                          title={property.status === 'active' ? 'Pause' : 'Activate'}
                          onClick={() => toggleStatus(property)}
                        >
                          {property.status === 'active'
                            ? <ToggleRight className="w-5 h-5 text-[#22C55E]" />
                            : <ToggleLeft className="w-5 h-5 text-[#6B7A94]" />
                          }
                        </CCButton>
                      </div>
                    </div>
                  </CCCard>
                );
              })}
            </div>
          )}

          {/* Pricing settings */}
          <HostPricingSettings user={user} />

          {/* Pro Host */}
          <ProHostSubscriptionPanel user={user} />

          {/* Booking inbox */}
          <div>
            <h2 className="text-sm font-semibold text-[#E8EEF9] mb-3">Booking Requests</h2>
            <SoloSessionsInbox user={user} asHost={true} />
          </div>
        </div>
      </div>
    </FeatureGate>
  );
}