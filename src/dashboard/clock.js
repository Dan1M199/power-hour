// The intro's clock. Each widget subscribes a writer with useFrame; the sheet draws time t (seconds) on every frame
// of the intro and each writer sets its own elements from t through refs (styles, text, SVG attributes). React renders
// the tiles once and never re-renders them per frame.
import { createContext, useContext, useLayoutEffect } from 'react';

export function createClock() {
  const writers = new Set();
  let last = null;
  return {
    draw(t) { last = t; for (const w of writers) w(t); },
    // a writer gets the latest time as soon as it subscribes, so nothing paints half set
    add(w) { writers.add(w); if (last !== null) w(last); return () => { writers.delete(w); }; },
  };
}

export const ClockContext = createContext(null);

/** Subscribes a writer (keep it stable with useCallback) for as long as the component is mounted. */
export function useFrame(write) {
  const clock = useContext(ClockContext);
  useLayoutEffect(() => clock.add(write), [clock, write]);
}
