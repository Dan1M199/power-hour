// The "come back" layer (Dan's request Nov 14: the pull of an app like Instagram, done tastefully). Everything here
// is this device's own memory in localStorage, so nothing new is asked of the server or of Sleeper:
//  - the daily streak: how many mornings in a row this device has opened the site (the site's day turns at 6am Central,
//    morningKey), with the best run kept;
//  - the wire's "new since you last looked": the time this device last opened the Wire, for the tab's count badge and
//    the New marks on the page;
//  - the stories: which team's story this device has watched, by a signature of what's in it, so a ring lights up
//    again only when that team's story changes.
// Storage can be off (private windows, full disks): every read and write is wrapped, and a failure means "nothing seen".
import { morningKey } from '../../lib/newsclock.js';

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* fine */ } };
const json = (k, d) => { try { return JSON.parse(get(k)) ?? d; } catch { return d; } };

// ---------- the streak ----------
const dayNo = (key) => Math.round(Date.parse(`${key}T12:00:00Z`) / 864e5);
const MILESTONES = [3, 7, 14, 30, 50, 100];
let streakNow = null;
/** Counts today's visit once (a second call the same day changes nothing) and says where the run stands. */
export function streak() {
  if (streakNow) return streakNow;
  const today = morningKey(), s = json('ph-streak', null);
  let n = 1, best = 1, fresh = true;
  if (s && s.day === today) ({ n, best } = s), (fresh = false);
  else if (s && dayNo(today) - dayNo(s.day) === 1) n = s.n + 1, best = Math.max(s.best || 0, n);
  else best = Math.max(s?.best || 0, 1);
  if (fresh) put('ph-streak', JSON.stringify({ day: today, n, best }));
  // a run that just broke (a gap of more than a day) remembers the old one for the note
  const lost = fresh && s && s.day !== today && n === 1 && s.n >= 2 ? s.n : 0;
  streakNow = { n, best, fresh, lost, milestone: fresh && MILESTONES.includes(n) ? n : 0 };
  return streakNow;
}

// ---------- the wire ----------
// A device's first visit counts the last day as new, so the badge has something to say from the start.
const FIRST_LOOK = 864e5;
let wireSeenAt = null, pageSince = null;
/** When this device last opened the Wire (ms). */
export const wireSince = (now = Date.now()) => (wireSeenAt ??= Number(get('ph-wire-seen')) || now - FIRST_LOOK);
/** Moves in the feed since then, not counting your own. */
export const wireNew = (D, me, now) => D.feed.filter((f) => f.ts > wireSince(now) && !f.sides.every((x) => x.rid === me)).length;
/** Opening the Wire: the badge clears, and what was new when you first opened it this visit stays marked New. */
export function wireSeen(now = Date.now()) {
  pageSince ??= wireSince(now);
  wireSeenAt = now;
  put('ph-wire-seen', String(now));
  return pageSince;
}

// ---------- the stories ----------
let watched = null;
const load = () => (watched ??= json('ph-stories-seen', {}));
export const storySeen = (rid, sig) => load()[rid] === sig;
export function markStory(rid, sig) { load()[rid] = sig; put('ph-stories-seen', JSON.stringify(watched)); }
