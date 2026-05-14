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
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: 'var(--cc-border)' }}>
          <Icon className="w-8 h-8" style={{ color: 'var(--cc-text-muted)' }} />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--cc-text-primary)' }}>{title}</h3>
      )}
      {description && (
        <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--cc-text-secondary)' }}>{description}</p>
      )}
      {action && actionLabel && (
        <CCButton onClick={action} variant="primary">
          {actionLabel}
        </CCButton>
      )}
    </div>
  );
}