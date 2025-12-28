import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CCCard from '../ui-custom/CCCard';
import CCButton from '../ui-custom/CCButton';
import { UserPlus, MessageCircle, Shield } from 'lucide-react';

export default function FriendGateWarning({ targetUserId, targetName, suggestedAction, eligibility }) {
  return (
    <CCCard padding="lg" className="border-[#F59E0B]/30 bg-[#F59E0B]/5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-[#F59E0B]" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#E8EEF9] mb-2">
            Friendship Required
          </h3>
          <p className="text-sm text-[#9AA6BC] mb-4">
            To start a collaboration with {targetName}, you need to be friends first. 
            {suggestedAction === 'Send a message first' && ' Start by sending them a message.'}
            {suggestedAction === 'Wait for a reply' && ' Wait for them to reply to your message.'}
            {suggestedAction === 'Send friend request' && ' Send them a friend request.'}
          </p>
          <div className="flex gap-3">
            {suggestedAction === 'Send a message first' && (
              <Link to={createPageUrl('Messages')}>
                <CCButton variant="outline" size="sm" icon={MessageCircle}>
                  Send Message
                </CCButton>
              </Link>
            )}
            {suggestedAction === 'Send friend request' && eligibility?.eligible && (
              <Link to={createPageUrl(`ViewProfile?id=${targetUserId}`)}>
                <CCButton variant="outline" size="sm" icon={UserPlus}>
                  Send Friend Request
                </CCButton>
              </Link>
            )}
          </div>
        </div>
      </div>
    </CCCard>
  );
}