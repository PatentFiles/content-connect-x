import React from 'react';
import { cn } from '@/lib/utils';
import { User, ShieldCheck, Star } from 'lucide-react';

const sizes = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
  '2xl': 'w-28 h-28',
};

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
  xl: 'w-10 h-10',
  '2xl': 'w-14 h-14',
};

export default function CCAvatar({
  src,
  alt,
  size = 'md',
  verified = false,
  online = false,
  badge,
  className,
}) {
  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full bg-[#263248] flex items-center justify-center overflow-hidden',
          'ring-2 ring-[#263248]',
          sizes[size]
        )}
      >
        {src ? (
          <img
            src={src}
            alt={alt || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className={cn('text-[#6B7A94]', iconSizes[size])} />
        )}
      </div>
      
      {/* Online indicator */}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#22C55E] border-2 border-[#151D2B] rounded-full" />
      )}
      
      {/* Verified badge */}
      {verified && (
        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-[#4F8CFF] rounded-full flex items-center justify-center">
          <ShieldCheck className="w-3 h-3 text-white" />
        </span>
      )}
      
      {/* Custom badge */}
      {badge && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF2DAA] rounded-full flex items-center justify-center text-xs text-white font-bold">
          {badge}
        </span>
      )}
    </div>
  );
}

export function CCAvatarGroup({ avatars, max = 4, size = 'sm' }) {
  const shown = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="flex -space-x-2">
      {shown.map((avatar, i) => (
        <CCAvatar
          key={i}
          src={avatar.src}
          alt={avatar.alt}
          size={size}
          className="ring-2 ring-[#151D2B]"
        />
      ))}
      {remaining > 0 && (
        <div
          className={cn(
            'rounded-full bg-[#263248] flex items-center justify-center',
            'ring-2 ring-[#151D2B] text-xs font-medium text-[#9AA6BC]',
            sizes[size]
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}