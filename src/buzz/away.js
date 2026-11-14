// Away and back (Dan's request Nov 14), from what the browser tells us about the tab (the Page Visibility API, which
// iPhone Safari fires when you switch apps, lock the phone or change tab):
//  - while the tab is hidden its title says what's waiting, an unread count from the Wire or that the week is live, so
//    it catches your eye in the tab strip or the app switcher; it goes back the moment you return;
//  - coming back after a while, if the site's data clock has turned over since the page loaded (the Sunday late pull,
//    Monday's final call, an extra pull, a new morning), the island offers the fresh numbers with one tap;
//  - and a new visit opens on "since you last looked" for your team: where you were ranked and your playoff odds then
//    and now, kept on this device (ph-last-look).
import { island } from './island.js';

const get = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fine */ } };
const ARROW = (up) => `<svg class="bz-arrow ${up ? 'up' : 'down'}" viewBox="0 0 24 24" aria-hidden="true"><path d="${up ? 'M12 19V5M5.5 11.5 12 5l6.5 6.5' : 'M12 5v14M5.5 12.5 12 19l6.5-6.5'}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BOLT = '<svg class="bz-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6l-1 8.5 9-11.5h-6z" fill="currentColor"/></svg>';

/**
 * title(): what the tab should say while hidden (null keeps it); key(): the data clock's key now; when it differs from
 * the key the page loaded with, coming back offers a reload.
 */
export function initAway({ title, key }) {
  const base = document.title, loadedKey = key();
  let hiddenAt = 0, offered = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      const t = title();
      if (t) document.title = t;
      return;
    }
    document.title = base;
    if (offered || Date.now() - hiddenAt < 30000) return;
    if (key() !== loadedKey) {
      offered = true;
      island({ icon: BOLT, big: 'Fresh numbers are in', small: 'The scores moved while you were away.', action: { label: 'Load', run: () => location.reload() } });
    }
  });
}

/**
 * The recap for your team: compares what this device saw last time with now, says it if something moved, and
 * remembers now for next time. t: your team (from the engine); pct: the site's percent formatter.
 */
export function recapNote(t, { week, pct, delay = 900 }) {
  if (!t) return;
  const was = get('ph-last-look'), now = { rid: t.rid, week, rank: t.powerRank, odds: t.playoffPct, at: Date.now() };
  put('ph-last-look', now);
  if (!was || was.rid !== t.rid || Date.now() - was.at < 2 * 36e5) return;
  const dRank = was.rank - now.rank, dOdds = now.odds - was.odds;
  if (!dRank && Math.abs(dOdds) < 0.03) return;
  const bits = [];
  if (dRank) bits.push(`${dRank > 0 ? 'up' : 'down'} to No. ${now.rank} (from ${was.rank})`);
  if (Math.abs(dOdds) >= 0.03) bits.push(`playoff odds ${pct(was.odds)} to ${pct(now.odds)}`);
  const up = dRank ? dRank > 0 : dOdds > 0;
  const said = bits.join(', ');
  setTimeout(() => island({
    icon: ARROW(up), big: 'Since you last looked', small: `${t.name}: ${said}.`, gold: up && dRank > 0, ms: 5600,
  }), delay);
}
