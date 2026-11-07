// The headline reactions' state, outside React so it outlives a page change: whether
// the store is on, the emoji set, and each headline's counts and this device's own (api/reactions.js). Changes are
// shown at once and the server's answer replaces them; a failed change goes back to what the server last said.
import { useSyncExternalStore } from 'react';

export const rx = { enabled: null, set: [], counts: {}, mine: {} };
const subs = new Set();
let version = 0;
const bump = () => { version++; subs.forEach((f) => f()); };
export const useReactions = () => { useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version); return rx; };

const keep = (d) => {
  if (!d || d.enabled === false) { rx.enabled = false; bump(); return; }
  Object.assign(rx, { enabled: true, set: d.set || rx.set, counts: { ...rx.counts, ...d.counts }, mine: { ...rx.mine, ...d.mine } });
  bump();
};

const asked = new Set();
export async function loadReactions(keys) {
  const fresh = keys.filter((k) => !asked.has(k));
  if (!fresh.length) return;
  fresh.forEach((k) => asked.add(k));
  try {
    const r = await fetch(`/api/reactions?keys=${encodeURIComponent(fresh.join(','))}`);
    keep(r.ok ? await r.json() : { enabled: false });
  } catch { if (rx.enabled == null) keep({ enabled: false }); }
}

export async function react(key, e, on) {
  const before = { counts: rx.counts[key] || {}, mine: rx.mine[key] || [] };
  const counts = { ...before.counts, [e]: Math.max(0, (before.counts[e] || 0) + (on ? 1 : -1)) };
  if (!counts[e]) delete counts[e];
  rx.counts = { ...rx.counts, [key]: counts };
  rx.mine = { ...rx.mine, [key]: on ? [...new Set([...before.mine, e])] : before.mine.filter((x) => x !== e) };
  bump();
  try {
    const r = await fetch('/api/reactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, emoji: e, on }) });
    if (!r.ok) throw new Error(String(r.status));
    keep(await r.json());
  } catch {
    rx.counts = { ...rx.counts, [key]: before.counts };
    rx.mine = { ...rx.mine, [key]: before.mine };
    bump();
  }
}
