import { useRef, useCallback } from 'react';

export function usePullToRefresh(onRefresh: () => void, threshold = 80) {
  const startY = useRef(0);
  const pulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return;
    const delta = e.changedTouches[0].clientY - startY.current;
    if (delta > threshold) {
      onRefresh();
    }
    pulling.current = false;
  }, [onRefresh, threshold]);

  return { onTouchStart, onTouchEnd };
}
