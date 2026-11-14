// Who's here now, on the page's side (api/presence.js): a heartbeat as the page opens and every 45 s while the tab is
// showing, nothing while it's hidden (Page Visibility), and a goodbye by sendBeacon when it's hidden or closed, so a
// phone in a pocket stops counting at once. The answer (how many devices, the teams the others picked, how many
// cities) is kept here for React (useHere). Off in the demo and wherever the store isn't set up.
import { useSyncExternalStore } from 'react';

export const here = { enabled: false, here: 0, others: 0, teams: [], cities: 0 };
const subs = new Set();
let version = 0;
const bump = () => { version++; subs.forEach((f) => f()); };
export const useHere = () => { useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version); return here; };

const BEAT_MS = 45000;
let timer = 0, teamOf = () => null, off = false;

async function beat() {
  if (off || document.hidden) return;
  try {
    const team = Number(teamOf()) || null;
    const r = await fetch('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team }), keepalive: true });
    const d = r.ok ? await r.json() : { enabled: false };
    if (d.enabled === false) { off = true; stop(); if (here.enabled) { here.enabled = false; bump(); } return; }
    Object.assign(here, { enabled: true, here: d.here, others: d.others, teams: d.teams || [], cities: d.cities || 0 });
    bump();
  } catch { /* offline for a moment: the next beat tries again */ }
}
function start() { clearInterval(timer); beat(); timer = setInterval(beat, BEAT_MS); }
function stop() { clearInterval(timer); timer = 0; }
function leave() {
  if (off || !here.enabled) return;
  try { navigator.sendBeacon?.('/api/presence', new Blob([JSON.stringify({ leave: true })], { type: 'application/json' })); } catch { /* fine */ }
}

/** Starts the heartbeat; team() says which team this device has picked, read fresh on every beat. */
export function startPresence({ team }) {
  teamOf = team;
  start();
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); leave(); } else if (!off) start(); });
  addEventListener('pagehide', leave);
}
/** A beat now, after the team changes, so the others see the new face without waiting. */
export const presenceNow = () => { if (!off) beat(); };
