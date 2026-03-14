import { ReactNode } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

export function PullToRefresh({ onRefresh, children }: { onRefresh: () => void; children: ReactNode }) {
  const { onTouchStart, onTouchEnd } = usePullToRefresh(onRefresh);

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  );
}
