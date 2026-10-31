// A value app.js keeps and React pages read: set() re-renders every component that use()s it.
import { useSyncExternalStore } from 'react';

export function createStore(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set: (v) => { value = v; subs.forEach((f) => f()); },
    use: () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => value),
  };
}
