import { useRef } from 'react';

// Intentionally bounded: a diagonal scroll, long hold, or tiny movement is never a swipe.
export function swipeStep(dx, dy, ms) {
  return ms <= 750 && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.6 ? (dx < 0 ? 1 : -1) : 0;
}

// No preventDefault or pointer capture: native vertical scrolling and pinch zoom remain available.
export function useSwipe(step) {
  const start = useRef(null);
  return {
    onTouchStart(e) {
      const t = e.touches[0];
      start.current = null;
      if (e.touches.length !== 1 || t.clientX < 24 || t.clientX > innerWidth - 24 ||
        e.target.closest('button, a, input, select, textarea, [role="slider"]')) return;
      start.current = { x: t.clientX, y: t.clientY, at: performance.now() };
    },
    onTouchMove(e) {
      const s = start.current, t = e.touches[0];
      if (!s) return;
      if (e.touches.length !== 1 || (Math.abs(t.clientY - s.y) > 12 && Math.abs(t.clientY - s.y) > Math.abs(t.clientX - s.x))) start.current = null;
    },
    onTouchEnd(e) {
      const s = start.current;
      start.current = null;
      if (!s || e.touches.length || !e.changedTouches.length) return;
      const t = e.changedTouches[0], d = swipeStep(t.clientX - s.x, t.clientY - s.y, performance.now() - s.at);
      if (d) step(d);
    },
    onTouchCancel() { start.current = null; },
  };
}
