import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { MapPin, Users, Clock, DollarSign, ChevronLeft, Star, Shield, CheckCircle, Calendar, AlertTriangle } from 'lucide-react';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import CCBadge from '@/components/ui-custom/CCBadge';
import CCCard from '@/components/ui-custom/CCCard';
import CCButton from '@/components/ui-custom/CCButton';
import { CCLoadingScreen } from '@/components/ui-custom/CCLoading';
import PropertyGallery from '@/components/hosting/PropertyGallery';
import PropertyBookingPanel from '@/components/hosting/PropertyBookingPanel';
import LocationContractClauses from '@/components/hosting/LocationContractClauses';
import PropertyReviewsSection from '@/components/property/PropertyReviewsSection';
import { useFeatureFlag } from '@/lib/featureFlags';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import FeatureRouteGuard from '@/components/feature/FeatureRouteGuard.jsx';
import MobileRefreshPage from '@/components/ui-custom/MobileRefreshPage';
import { useQueryClient } from '@tanstack/react-query';

export default function PropertyDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const propertyId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [galleryIndex, setGalleryIndex] = useState(0);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => base44.entities.Property.filter({ id: propertyId }),
    enabled: !!propertyId,
  });
  const property = properties[0];

  const { data: ownerProfiles = [] } = useQuery({
    queryKey: ['ownerProfile', property?.owner_user_id],
    queryFn: () => base44.entities.UserProfile.filter({ user_id: property?.owner_user_id }),
    enabled: !!property?.owner_user_id,
  });
  const ownerProfile = ownerProfiles[0];

  const { data: ownerVerifications = [] } = useQuery({
    queryKey: ['ownerVerification', property?.owner_user_id],
    queryFn: () => base44.entities.VerificationRecord.filter({ user_id: property?.owner_user_id }),
    enabled: !!property?.owner_user_id,
  });
  const isOwnerVerified = ownerVerifications[0]?.status === 'approved';
  const isOwner = user?.email === property?.owner_user_id;
  const locationClausesEnabled = useFeatureFlag('location_contract_clauses');
  const cancellationPoliciesEnabled = useFeatureFlag('cancellation_policies');
  const reviewsEnabled = useFeatureFlag('property_reviews_enabled');

  const { data: cancellationPolicies = [] } = useQuery({
    queryKey: ['cancellationPolicy', property?.id],
    queryFn: () => base44.entities.CancellationPolicy.filter({ property_id: property.id }),
    enabled: !!property?.id && cancellationPoliciesEnabled,
  });
  const cancellationPolicy = cancellationPolicies[0];

  if (isLoading) return <CCLoadingScreen message="Loading property..." />;
  if (!property) return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-[#6B7A94] mx-auto mb-3" />
        <p className="text-[#9AA6BC]">Property not found.</p>
        <Link to="/HostingMarketplace" className="text-[#4F8CFF] text-sm mt-2 inline-block">← Back to listings</Link>
      </div>
    </div>
  );

  const coverImage = property.media?.find(m => m.is_cover) || property.media?.[0];
  const amenityList = property.amenities || [];
  const pricing = property.pricing || {};

  return (
    <FeatureRouteGuard flag="hosting_marketplace" requiresSubscription={true}>
    <MobileRefreshPage onRefresh={() => {
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['ownerProfile', property?.owner_user_id] });
    }}>
      <div className="min-h-screen bg-[#0B0F14] pb-20 md:pb-8">
      {/* Back nav */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <Link to="/HostingMarketplace" className="inline-flex items-center gap-1 text-sm text-[#9AA6BC] hover:text-[#E8EEF9] transition-colors mb-4">
          <ChevronLeft className="w-4 h-4" /> Back to listings
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">

          {/* Main content — 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Gallery */}
            <PropertyGallery media={property.media || []} title={property.title} />

            {/* Title & badges */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-[#E8EEF9]">{property.title}</h1>
                  <p className="text-[#9AA6BC] flex items-center gap-1 mt-1">
                    <MapPin className="w-4 h-4" />
                    {property.city}{property.state && `, ${property.state}`}
                    <span className="text-[#6B7A94] text-xs ml-2">· Exact address shared after confirmed booking</span>
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <CCBadge variant="outline" size="sm" className="capitalize">{property.property_type}</CCBadge>
                  {property.instant_book && (
                    <CCBadge variant="success" size="sm">⚡ Instant Book</CCBadge>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm text-[#9AA6BC]">
                {property.capacity?.max_people && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" /> Up to {property.capacity.max_people} people
                  </span>
                )}
                {property.capacity?.sq_ft && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> {property.capacity.sq_ft} sq ft
                  </span>
                )}
                {pricing.hourly_rate && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4" /> ${pricing.hourly_rate}/hr
                  </span>
                )}
                {property.total_bookings > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> {property.total_bookings} bookings
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {property.description && (
              <CCCard padding="lg">
                <h3 className="text-base font-semibold text-[#E8EEF9] mb-2">About this space</h3>
                <div
                  className="text-sm text-[#9AA6BC] leading-relaxed prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(property.description) }}
                />
              </CCCard>
            )}

            {/* Amenities */}
            {amenityList.length > 0 && (
              <CCCard padding="lg">
                <h3 className="text-base font-semibold text-[#E8EEF9] mb-3">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {amenityList.map(a => (
                    <span key={a} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#121824] border border-[#263248] rounded-lg text-sm text-[#E8EEF9]">
                      <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
                      {a}
                    </span>
                  ))}
                </div>
              </CCCard>
            )}

            {/* House Rules */}
            {property.rules && (
              <CCCard padding="lg">
                <h3 className="text-base font-semibold text-[#E8EEF9] mb-3">House Rules</h3>
                <div className="space-y-2 text-sm text-[#9AA6BC]">
                  {property.rules.no_smoking && <p className="flex items-center gap-2"><span className="text-[#EF4444]">✕</span> No smoking</p>}
                  {property.rules.no_alcohol && <p className="flex items-center gap-2"><span className="text-[#EF4444]">✕</span> No alcohol</p>}
                  {property.rules.no_outside_vendors && <p className="flex items-center gap-2"><span className="text-[#EF4444]">✕</span> No outside vendors</p>}
                  {property.rules.verified_only && <p className="flex items-center gap-2"><span className="text-[#22C55E]">✓</span> Verified users only</p>}
                  {property.rules.custom_rules && <p className="mt-2 border-t border-[#263248] pt-2">{property.rules.custom_rules}</p>}
                </div>
              </CCCard>
            )}

            {/* Cancellation policy */}
            {cancellationPoliciesEnabled && cancellationPolicy && (
              <CCCard padding="lg">
                <h3 className="text-base font-semibold text-[#E8EEF9] mb-2">Cancellation Policy</h3>
                <CCBadge variant="warning" size="sm" className="capitalize mb-2">{cancellationPolicy.preset}</CCBadge>
                <p className="text-sm text-[#9AA6BC]">{cancellationPolicy.description || cancellationPolicy.label}</p>
              </CCCard>
            )}

            {/* Location contract clauses preview */}
            {locationClausesEnabled && (
              <LocationContractClauses property={property} cancellationPolicy={cancellationPolicy} />
            )}

            {/* Reviews section */}
            {reviewsEnabled && (
              <CCCard padding="lg">
                <h3 className="text-base font-semibold text-[#E8EEF9] mb-4">Guest Reviews</h3>
                <PropertyReviewsSection propertyId={property.id} />
              </CCCard>
            )}

            {/* Host profile card */}
            {ownerProfile && (
              <CCCard padding="lg">
                <h3 className="text-base font-semibold text-[#E8EEF9] mb-3">About the Host</h3>
                <Link to={`/ViewProfile?id=${ownerProfile.user_id}`} className="flex items-center gap-3 group">
                  <CCAvatar src={ownerProfile.avatar_url} size="lg" verified={isOwnerVerified} />
                  <div>
                    <p className="font-medium text-[#E8EEF9] group-hover:text-[#4F8CFF] transition-colors">
                      {ownerProfile.display_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <CCBadge variant="outline" size="sm" className="capitalize">{property.owner_type}</CCBadge>
                      {isOwnerVerified && (
                        <CCBadge variant="success" size="sm" icon={Shield}>Verified</CCBadge>
                      )}
                      {property.insurance?.insurance_verified && (
                        <CCBadge variant="success" size="sm">🛡 Insured</CCBadge>
                      )}
                    </div>
                    {ownerProfile.bio && (
                      <p className="text-xs text-[#9AA6BC] mt-1 line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: ownerProfile.bio?.replace(/<[^>]*>/g, '') }}
                      />
                    )}
                  </div>
                </Link>
              </CCCard>
            )}
          </div>

          {/* Booking panel — sticky sidebar */}
          <div className="lg:col-span-1 mt-6 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <PropertyBookingPanel
                property={property}
                currentUser={user}
                isOwner={isOwner}
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </MobileRefreshPage>
    </FeatureRouteGuard>
  );
}