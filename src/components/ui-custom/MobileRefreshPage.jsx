/**
 * MobileRefreshPage — now a passthrough.
 *
 * Pull-to-refresh is handled globally by GlobalPullToRefresh in layout.jsx.
 * This component is kept for backwards compatibility (pages still import it)
 * but renders children directly without adding any PTR layer.
 *
 * The `onRefresh` prop is accepted but ignored — GlobalPullToRefresh calls
 * queryClient.invalidateQueries({ queryKey: [] }) which invalidates everything.
 */
import React from 'react';

export default function MobileRefreshPage({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}