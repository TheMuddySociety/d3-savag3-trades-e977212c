import { useState, useRef, useCallback, useEffect } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
}

export function usePullToRefresh({ onRefresh, threshold = 80, maxPull = 120 }: PullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || container.scrollTop > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
    setPulling(true);
  }, [refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling || refreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      setPulling(false);
      setPullDistance(0);
      return;
    }
    const dy = Math.max(0, e.touches[0].clientY - startY.current);
    // Dampened pull
    const dampened = Math.min(dy * 0.5, maxPull);
    if (dampened > 5) {
      e.preventDefault();
    }
    setPullDistance(dampened);
  }, [pulling, refreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    setPulling(false);
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold * 0.6);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, threshold, refreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd);
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return { containerRef, pullDistance, refreshing, progress };
}
