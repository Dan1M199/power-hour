// GET /api/history — what the What if tool (Lab, #lab/whatif) needs beyond the league snapshot: the draft board and
// every player's half-PPR points for each finished week, including the weeks he sat on waivers (the league snapshot
// only carries points for rostered players).
//
// Both are Sleeper reads Dan approved on Nov 20, and both are kept in the store for good, so Sleeper is asked once:
// the draft board once for the season (`once('draft', season)`), each finished week's stats once
// (`once('wkstats', '<season>-<week>')`). About a dozen calls the first morning, then one a week. The assembled body is
// kept per morning key like /api/ros (only the current key is served; others redirect).
import { morningKey } from '../lib/newsclock.js';
import { once } from '../lib/snapstore.js';
import { SEASON, nflWeek } from '../lib/weekly.js';
import { parseWeekStats, slimDraft } from '../lib/whatif.js';

const LEAGUE_ID = '1312001652454088704';
const SLEEPER = 'https://api.sleeper.app/v1';
const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
const KEEP = 250 * 86400; // the season and then some; finished weeks and a finished draft never change
const REG_END = 14; // the league's regular season (playoffs start week 15)

export const statsUrl = (season, week) =>
  `https://api.sleeper.app/stats/nfl/${season}/${week}?season_type=regular${POSITIONS.map((p) => `&position%5B%5D=${p}`).join('')}`;

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sleeper ${r.status} on ${url.replace(/\?.*/, '')}`);
  return r.json();
}

// the league's draft for this season: its picks, slimmed. Kept for good once the draft is complete; a draft still to run
// (or a failed read) is kept for an hour.
function draft() {
  return once('draft', String(SEASON), async () => {
    try {
      const drafts = await getJSON(`${SLEEPER}/league/${LEAGUE_ID}/drafts`);
      const d = (drafts || []).find((x) => String(x.season) === String(SEASON) && x.status === 'complete') || null;
      if (!d) return { body: { ok: false, error: 'no completed draft yet' }, ttl: 3600 };
      const picks = await getJSON(`${SLEEPER}/draft/${d.draft_id}/picks`);
      return { body: { ok: true, ...slimDraft(d, picks) }, ttl: KEEP };
    } catch (e) {
      return { body: { ok: false, error: String(e.message || e) }, ttl: 3600 };
    }
  }).then((x) => x.body);
}

// one finished week's points for every player who played: {id: pts}. Kept for good; a failure for an hour.
function weekStats(week) {
  return once('wkstats', `${SEASON}-${week}`, async () => {
    try {
      const pts = parseWeekStats(await getJSON(statsUrl(SEASON, week)));
      if (!Object.keys(pts).length) throw new Error('no stats yet');
      return { body: { ok: true, pts }, ttl: KEEP };
    } catch (e) {
      return { body: { ok: false, error: String(e.message || e) }, ttl: 3600 };
    }
  }).then((x) => x.body);
}

export async function build(key) {
  // weeks turn over Tuesday morning, once Monday night is final
  const done = Math.min(REG_END, nflWeek(key) - 1);
  const weeks = Array.from({ length: Math.max(0, done) }, (_, i) => i + 1);
  // one week at a time: a dozen calls in a burst is more than Sleeper needs to see
  const stats = [];
  for (const w of weeks) stats.push(await weekStats(w));
  const d = await draft();
  const pts = {}, errors = [];
  weeks.forEach((w, i) => (stats[i].ok ? (pts[w] = stats[i].pts) : errors.push(`week ${w}: ${stats[i].error}`)));
  if (!d.ok) errors.push(`draft: ${d.error}`);
  return { season: SEASON, built: new Date().toISOString(), weeks: weeks.filter((w) => pts[w]), draft: d.ok ? d : null, pts, errors };
}

const askedKey = (req) => req.query?.d ?? (req.url ? new URL(req.url, 'http://x').searchParams.get('d') : null);

export default async function handler(req, res) {
  try {
    const key = morningKey();
    if (req.url && askedKey(req) !== key) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.setHeader('Location', `/api/history?d=${encodeURIComponent(key)}`);
      return res.status(307).end();
    }
    const { body, from } = await once('history', key, async () => {
      const body = await build(key);
      return { body, ttl: body.errors.length ? 3600 : 3 * 86400 };
    });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Snapshot', `${key} ${from}`);
    res.setHeader('Cache-Control', body.errors.length ? 'public, s-maxage=3600' : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    res.status(200).send(JSON.stringify(body));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(e.message || e) });
  }
}
