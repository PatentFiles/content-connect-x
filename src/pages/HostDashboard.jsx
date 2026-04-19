import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Building2, Eye, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import CCCard from '@/components/ui-custom/CCCard';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCButton from '@/components/ui-custom/CCButton';
import CCEmpty from '@/components/ui-custom/CCEmpty';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import { toast } from 'sonner';
import FeatureGate from '@/components/feature/FeatureGate';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard';
import PropertyForm from '@/components/hosting/PropertyForm';
import HostOnboardingChecklist from '@/components/hosting/HostOnboardingChecklist';
import HostOnboardingGateModal from '@/components/hosting/HostOnboardingGateModal';
import SoloSessionsInbox from '@/components/sessions/SoloSessionsInbox';
import ProHostSubscriptionPanel from '@/components/hosting/ProHostSubscriptionPanel';
import HostPricingSettings from '@/components/hosting/HostPricingSettings';
import { canCreateProperty } from '@/lib/hostReadiness';

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

  const hostReady = canCreateProperty(profile);

  const handleAddProperty = () => {
    if (!hostReady) {
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
    <FeatureRouteGuard flag="hosting_marketplace">
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#E8EEF9]">My Properties</h1>
              <p className="text-sm text-[#9AA6BC] mt-1">{activeCount} active · {draftCount} draft</p>
            </div>
            <div className="relative group">
              <CCButton
                variant="primary"
                icon={Plus}
                onClick={handleAddProperty}
                className={!hostReady ? 'opacity-50' : ''}
              >
                Add Property
              </CCButton>
              {!hostReady && (
                <div className="absolute right-0 top-full mt-1.5 z-10 hidden group-hover:block">
                  <div className="bg-[#1A2438] border border-[#263248] rounded-lg px-3 py-2 text-xs text-[#9AA6BC] whitespace-nowrap shadow-lg">
                    Complete host setup to add a property
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Host onboarding modal gate */}
          {showHostOnboardingModal && (
            <HostOnboardingGateModal
              profile={profile}
              onClose={() => setShowHostOnboardingModal(false)}
              onCompleted={() => {
                setShowHostOnboardingModal(false);
                queryClient.invalidateQueries({ queryKey: ['myProfile', user?.email] });
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
            <HostOnboardingChecklist
              properties={properties}
              profile={profile}
              onAddProperty={hostReady ? handleAddProperty : null}
            />
          )}

          {/* Property list */}
          {properties.length === 0 ? (
            <CCEmpty
              icon={Building2}
              title="No properties yet"
              description={hostReady
                ? "List your first property to start accepting bookings."
                : "Complete your host setup to start listing properties."}
              action={handleAddProperty}
              actionLabel={hostReady ? "Add Property" : "Complete Setup"}
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
    </FeatureRouteGuard>
  );
}