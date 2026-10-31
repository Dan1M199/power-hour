// The league desk's state, kept outside React so it outlives a page change: the thread on screen (from api/talk.js),
// which week is being read, the last message to show, Dan's invite links. Talk.jsx draws it; app.js sets the week.
import { useSyncExternalStore } from 'react';

export const talk = { data: null, flash: '', view: null, week: 1, invites: false, links: {}, join: null };
const subs = new Set();
let version = 0;
export const setTalk = (x) => { Object.assign(talk, x); version++; subs.forEach((f) => f()); };
export const useTalk = () => { useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version); return talk; };

// the thread on screen: this week's, or an earlier one picked to read back through
export const viewWeek = () => talk.view ?? talk.week;
export const talkNow = () => Date.now() + (talk.data?.skew || 0);

export async function talkCall(body) {
  const r = await fetch(body ? '/api/talk' : `/api/talk?week=${viewWeek()}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Something went wrong (${r.status})`);
  return j;
}
// what the server sent back, with the clock difference so "just now" and the edit minute read right
export const keepTalk = (d) => { if (d && 'comments' in d) setTalk({ data: { ...d, skew: d.now ? d.now - Date.now() : 0 } }); };

export async function loadTalk() {
  try { keepTalk(await talkCall()); } catch { /* keep what's on screen */ }
}

// a headline's thread key: the week and its story type (a second story of the same type gets a number)
export const storyKeys = (stories) => { const seen = {}; return stories.map((st) => { const n = (seen[st.type] = (seen[st.type] || 0) + 1); return `w${talk.week}:${st.type}${n > 1 ? `-${n}` : ''}`; }); };
