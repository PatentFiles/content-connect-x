import React from 'react';
import { cn } from '@/lib/utils';
import CCButton from './CCButton';

export default function CCEmpty({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  className,
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center py-12 px-6',
      className
    )}>
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-[#263248]/50 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-[#6B7A94]" />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-medium text-[#E8EEF9] mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-[#9AA6BC] max-w-sm mb-6">{description}</p>
      )}
      {action && actionLabel && (
        <CCButton onClick={action} variant="primary">
          {actionLabel}
        </CCButton>
      )}
    </div>
  );
}