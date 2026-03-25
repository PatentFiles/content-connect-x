import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Briefcase, Users, DollarSign, Shield, MapPin, Globe, Lock, Star } from 'lucide-react';
import CCButton from '../ui-custom/CCButton';
import CCBadge from '../ui-custom/CCBadge';

export default function AgentMarketplaceCard({
  agentProfile,
  agentDetails,
  representationStatus,
  reputationScore,
  onRequestRepresentation,
}) {
  const isRepresented = representationStatus?.status === 'ACTIVE';
  const hasPendingInvite = representationStatus?.status === 'INVITED';

  return (
    <div className="bg-[#151D2B] border border-[#263248] rounded-xl overflow-hidden hover:border-[#4F8CFF]/50 transition-all duration-200 flex flex-col h-full">
      {/* Header with avatar and status */}
      <div className="p-4 bg-gradient-to-r from-[#4F8CFF]/10 to-[#FF2DAA]/10 border-b border-[#263248]">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-[#263248] flex-shrink-0">
            {agentProfile?.avatar_url ? (
              <img src={agentProfile.avatar_url} alt={agentProfile.display_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Briefcase className="w-7 h-7 text-[#6B7A94]" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[#E8EEF9] truncate">{agentProfile?.display_name}</h3>
            {agentDetails?.agency_name && (
              <p className="text-xs text-[#9AA6BC] truncate">{agentDetails.agency_name}</p>
            )}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {isRepresented && <CCBadge variant="success" size="sm" icon={Lock}>Active</CCBadge>}
              {hasPendingInvite && <CCBadge variant="warning" size="sm">Pending</CCBadge>}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3 flex-1">
        {/* Reputation */}
        {reputationScore && (
          <div className="flex items-center gap-2 p-2 bg-[#0B0F14] rounded-lg">
            <Star className="w-4 h-4 text-[#F59E0B]" />
            <div className="flex-1">
              <p className="text-xs text-[#6B7A94]">Trust Score</p>
              <p className="text-sm font-semibold text-[#E8EEF9]">{reputationScore.score}/100</p>
            </div>
            <span className="text-xs text-[#4F8CFF] font-medium">{reputationScore.label}</span>
          </div>
        )}

        {/* Agency Details */}
        {agentDetails && (
          <>
            {/* Commission Rate */}
            {agentDetails.commission_rate != null && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-[#FF2DAA]" />
                <span className="text-[#9AA6BC]">
                  <span className="text-[#E8EEF9] font-medium">{agentDetails.commission_rate}%</span> commission
                </span>
              </div>
            )}

            {/* Roster Count */}
            {agentDetails.represented_creator_ids?.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-[#4F8CFF]" />
                <span className="text-[#9AA6BC]">
                  Represents <span className="text-[#E8EEF9] font-medium">{agentDetails.represented_creator_ids.length}</span> creators
                </span>
              </div>
            )}

            {/* Content Types */}
            {agentDetails.content_types?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {agentDetails.content_types.slice(0, 3).map(type => (
                  <CCBadge key={type} variant="outline" size="sm">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </CCBadge>
                ))}
                {agentDetails.content_types.length > 3 && (
                  <CCBadge variant="outline" size="sm">+{agentDetails.content_types.length - 3}</CCBadge>
                )}
              </div>
            )}

            {/* Website */}
            {agentDetails.website && (
              <a
                href={agentDetails.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#4F8CFF] hover:text-[#3A7AEE] transition-colors"
              >
                <Globe className="w-3 h-3" />
                Visit Agency
              </a>
            )}
          </>
        )}

        {/* Base Location */}
        {agentProfile?.base_location?.city && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-[#6B7A94]" />
            <span className="text-[#9AA6BC]">
              {agentProfile.base_location.city}{agentProfile.base_location.state && `, ${agentProfile.base_location.state}`}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-[#263248] space-y-2">
        <Link to={createPageUrl(`ViewProfile?id=${agentProfile.user_id}`)}>
          <CCButton variant="outline" size="sm" fullWidth>
            View Profile
          </CCButton>
        </Link>
        <CCButton
          variant="primary"
          size="sm"
          fullWidth
          disabled={isRepresented || hasPendingInvite}
          onClick={() => onRequestRepresentation(agentProfile.user_id)}
        >
          {isRepresented ? 'Represented' : hasPendingInvite ? 'Pending Invite' : 'Request Representation'}
        </CCButton>
      </div>
    </div>
  );
}