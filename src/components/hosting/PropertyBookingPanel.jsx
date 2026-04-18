/**
 * PropertyBookingPanel
 * Shown on PropertyDetail. Initiates a location_booking SoloSession
 * via the existing SoloSessionBookingModal — no new booking system.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Clock, Shield, Info, Pencil } from 'lucide-react';
import CCButton from '@/components/ui-custom/CCButton';
import CCBadge from '@/components/ui-custom/CCBadge';
import SoloSessionBookingModal from '@/components/sessions/SoloSessionBookingModal';
import { base44 } from '@/api/base44Client';
import { useFeatureFlag } from '@/lib/featureFlags';

export default function PropertyBookingPanel({ property, currentUser, isOwner }) {
  const [showBooking, setShowBooking] = useState(false);
  const soloEnabled = useFeatureFlag('solo_sessions');
  const hostingEnabled = useFeatureFlag('hosting_marketplace');
  const pricing = property.pricing || {};

  const handleBooked = (sessionId) => {
    setShowBooking(false);
    if (sessionId) {
      window.location.href = `/SoloSessionDetail?id=${sessionId}`;
    }
  };

  return (
    <div className="bg-[#151D2B] border border-[#263248] rounded-xl p-5 space-y-4">
      {/* Pricing summary */}
      <div>
        {pricing.hourly_rate ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#9AA6BC]">Hourly</span>
              <span className="font-semibold text-[#E8EEF9]">${pricing.hourly_rate} <span className="text-[#9AA6BC] font-normal">/ hr</span></span>
            </div>
            {pricing.half_day_rate && (
              <div className="flex items-center justify-between">
                <span className="text-[#9AA6BC]">Half-day</span>
                <span className="font-semibold text-[#E8EEF9]">${pricing.half_day_rate}</span>
              </div>
            )}
            {pricing.full_day_rate && (
              <div className="flex items-center justify-between">
                <span className="text-[#9AA6BC]">Full-day</span>
                <span className="font-semibold text-[#E8EEF9]">${pricing.full_day_rate}</span>
              </div>
            )}
            {pricing.minimum_hours && pricing.minimum_hours > 1 && (
              <div className="flex items-center gap-1.5 text-xs text-[#6B7A94]">
                <Clock className="w-3.5 h-3.5" />
                {pricing.minimum_hours}h minimum booking
              </div>
            )}
            {pricing.deposit_required && pricing.deposit_amount && (
              <div className="flex items-center gap-1.5 text-xs text-[#F59E0B]">
                <Info className="w-3.5 h-3.5" />
                ${pricing.deposit_amount} deposit required
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#9AA6BC]">Contact host for pricing</p>
        )}
      </div>

      {pricing.pricing_notes && (
        <p className="text-xs text-[#6B7A94] border-t border-[#263248] pt-3">{pricing.pricing_notes}</p>
      )}

      {/* Trust indicators */}
      <div className="flex flex-wrap gap-2">
        {property.rules?.verified_only && (
          <CCBadge variant="success" size="sm" icon={Shield}>Verified Users Only</CCBadge>
        )}
        {property.instant_book && (
          <CCBadge variant="primary" size="sm">⚡ Instant Book</CCBadge>
        )}
      </div>

      {/* CTA */}
      {isOwner ? (
        <Link to="/HostDashboard">
          <CCButton variant="outline" fullWidth icon={Pencil}>Manage This Listing</CCButton>
        </Link>
      ) : !currentUser ? (
        <div className="space-y-2">
          <CCButton variant="primary" fullWidth onClick={() => base44.auth.redirectToLogin()}>
            Sign In to Book
          </CCButton>
          <p className="text-xs text-[#6B7A94] text-center">Verified platform members only</p>
        </div>
      ) : !soloEnabled || !hostingEnabled ? (
        <div className="bg-[#0B0F14] rounded-lg p-3 text-center">
          <p className="text-xs text-[#9AA6BC]">Booking coming soon</p>
        </div>
      ) : (
        <CCButton
          variant="primary"
          fullWidth
          onClick={() => setShowBooking(true)}
        >
          {property.instant_book ? '⚡ Book Instantly' : 'Request to Book'}
        </CCButton>
      )}

      <p className="text-xs text-[#6B7A94] text-center">
        Exact address revealed after booking confirmation
      </p>

      {/* Booking modal — uses existing SoloSessionBookingModal with session_type=location_booking */}
      <SoloSessionBookingModal
        isOpen={showBooking}
        onClose={handleBooked}
        hostUserId={property.owner_user_id}
        hostProfile={null}
        hostScheduleEntry={{
          location_city: property.city,
          location_name: property.title,
          booking_notes: property.rules?.custom_rules || '',
        }}
      />
    </div>
  );
}