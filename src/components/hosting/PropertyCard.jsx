import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Users, Zap } from 'lucide-react';
import CCAvatar from '@/components/ui-custom/CCAvatars';
import SavePropertyToFavoritesButton from './SavePropertyToFavoritesButton';

export default function PropertyCard({ property, ownerProfile, currentUserEmail }) {
  const cover = property.media?.find(m => m.is_cover) || property.media?.[0];
  const pricing = property.pricing || {};

  return (
    <Link to={`/PropertyDetail?id=${property.id}`} className="block group">
      <div className="bg-[#151D2B] border border-[#263248] rounded-xl overflow-hidden hover:border-[#3A4A6B] transition-all duration-200 hover:shadow-lg">
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] bg-[#0B0F14] overflow-hidden">
          {cover ? (
            <img
              src={cover.url}
              alt={property.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#263248]">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 16H6c-.55 0-1-.45-1-1V6c0-.55.45-1 1-1h12c.55 0 1 .45 1 1v12c0 .55-.45 1-1 1z"/>
              </svg>
            </div>
          )}
          {/* Favorite button */}
          {currentUserEmail && (
            <div className="absolute top-2 right-2">
              <SavePropertyToFavoritesButton propertyId={property.id} userEmail={currentUserEmail} />
            </div>
          )}
          {/* Badges overlay */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            <span className="px-2 py-0.5 bg-black/60 backdrop-blur-sm rounded-md text-xs text-white capitalize">
              {property.property_type}
            </span>
            {property.instant_book && (
              <span className="px-2 py-0.5 bg-[#22C55E]/80 backdrop-blur-sm rounded-md text-xs text-white flex items-center gap-1">
                <Zap className="w-3 h-3" /> Instant
              </span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-[#E8EEF9] text-sm leading-snug line-clamp-2 group-hover:text-[#4F8CFF] transition-colors">
              {property.title}
            </h3>
          </div>

          <p className="text-xs text-[#9AA6BC] flex items-center gap-1 mt-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {property.city}{property.state && `, ${property.state}`}
          </p>

          <div className="flex items-center justify-between mt-2.5">
            {/* Pricing */}
            <div className="text-sm">
              {pricing.hourly_rate ? (
                <span className="font-semibold text-[#E8EEF9]">
                  ${pricing.hourly_rate}
                  <span className="text-xs font-normal text-[#9AA6BC]">/hr</span>
                </span>
              ) : (
                <span className="text-xs text-[#6B7A94]">Contact for pricing</span>
              )}
            </div>

            {/* Host avatar */}
            {ownerProfile && (
              <div className="flex items-center gap-1.5">
                <CCAvatar src={ownerProfile.avatar_url} size="xs" />
                <span className="text-xs text-[#9AA6BC] truncate max-w-[80px]">
                  {ownerProfile.display_name?.split(' ')[0]}
                </span>
              </div>
            )}
          </div>

          {/* Capacity */}
          {property.capacity?.max_people && (
            <p className="text-xs text-[#6B7A94] flex items-center gap-1 mt-1.5">
              <Users className="w-3 h-3" /> Up to {property.capacity.max_people} people
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}