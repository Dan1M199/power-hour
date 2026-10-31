// Fan picks (api/votes.js): who wins each game, by device. Loaded once when the site opens (app.js calls loadVotes);
// the Games page reads it through useVotes and re-renders on every change. Without the store connected (or in the demo)
// it stays null and voting stays hidden.
import { useSyncExternalStore } from 'react';

let VOTES = null; // { week, open, counts: { "3-8": { "3": n } }, mine: { "3-8": "3" } } once /api/votes answers
let ERROR = null; // { pair, msg } after a pick that didn't save, until the next change
const subs = new Set();
const set = (votes, error = null) => { VOTES = votes; ERROR = error; subs.forEach((f) => f()); };
const snapshot = () => [VOTES, ERROR];
let last = snapshot();
const read = () => (last[0] === VOTES && last[1] === ERROR ? last : (last = snapshot()));

/** [votes, error] for a React component, kept current */
export const useVotes = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read);

// a random id kept on this device; re-voting from the same device replaces its pick
let VOTER = null;
const voterId = () => {
  if (VOTER) return VOTER;
  try { VOTER = localStorage.getItem('ph-voter'); } catch { /* storage blocked: an id for this visit */ }
  if (!VOTER) {
    VOTER = crypto.randomUUID?.() || `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    try { localStorage.setItem('ph-voter', VOTER); } catch { /* fine */ }
  }
  return VOTER;
};
export const pairKey = (p) => [p.a, p.b].sort((x, y) => x - y).join('-');

export async function loadVotes({ week, demo }) {
  if (!week || demo) return; // the demo snapshot and the single-file preview never call the vote store
  try {
    const r = await fetch(`/api/votes?week=${week}&voter=${encodeURIComponent(voterId())}`);
    if (!r.ok) return; // unavailable: voting stays hidden
    const body = await r.json();
    if (body.enabled) set(body); // else the store isn't connected yet
  } catch { /* offline or no API: voting stays hidden */ }
}

/** Shows the pick at once, then confirms it with the server; a refusal or an outage puts the old counts back. */
export async function castVote(pair, pick) {
  if (!VOTES?.open) return;
  const prev = VOTES.mine[pair];
  if (prev === pick) return;
  const before = VOTES, next = structuredClone(VOTES), c = (next.counts[pair] ||= {});
  if (prev) c[prev] = Math.max(0, (c[prev] || 1) - 1);
  c[pick] = (c[pick] || 0) + 1;
  next.mine[pair] = pick;
  set(next);
  try {
    const r = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week: next.week, pair, pick, voter: voterId() }) });
    const body = await r.json().catch(() => ({}));
    // the server's own reasons (closed, already voted from this network) are final; outages are worth a retry
    if (!r.ok) throw new Error(r.status >= 500 || !body.error ? 'Vote not saved. Try again in a moment.' : `${body.error}.`);
    set(body);
  } catch (e) {
    set(before, { pair, msg: e instanceof TypeError ? 'Vote not saved: no connection. Try again in a moment.' : e.message });
  }
}
