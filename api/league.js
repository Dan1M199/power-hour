// GET /api/league — one snapshot of everything the site reads from Sleeper for the league.
//
// The front end asks for /api/league?d=<key>. The key is set by the news clock (lib/newsclock.js): the Central date,
// rolling over at 6am so last night's games are final, plus a "-late" copy after Sunday night football. That is the
// whole Sleeper schedule. Any other key is redirected to the current one, and each snapshot is kept in the store
// (lib/snapstore.js), so the CDN purge on every deploy, odd query strings or many visitors never cause another pull.
import { leagueKey } from '../lib/newsclock.js';
import { once } from '../lib/snapstore.js';

const LEAGUE_ID = '1312001652454088704';
const SLEEPER = 'https://api.sleeper.app/v1';

async function getJSON(path) {
  const r = await fetch(`${SLEEPER}${path}`);
  if (!r.ok) throw new Error(`Sleeper ${r.status} on ${path}`);
  return r.json();
}

export async function snapshot() {
  const [state, league, users, rosters] = await Promise.all([
    getJSON('/state/nfl'),
    getJSON(`/league/${LEAGUE_ID}`),
    getJSON(`/league/${LEAGUE_ID}/users`),
    getJSON(`/league/${LEAGUE_ID}/rosters`),
  ]);
  const regEnd = (league.settings?.playoff_week_start || 15) - 1;
  const weeks = Array.from({ length: regEnd }, (_, i) => i + 1);
  const txWeeks = Array.from({ length: Math.max(1, Math.min(18, state.leg || state.week || 1)) }, (_, i) => i + 1);
  const [mus, txs] = await Promise.all([
    Promise.all(weeks.map((w) => getJSON(`/league/${LEAGUE_ID}/matchups/${w}`).catch(() => []))),
    Promise.all(txWeeks.map((w) => getJSON(`/league/${LEAGUE_ID}/transactions/${w}`).catch(() => []))),
  ]);
  return {
    fetched: new Date().toISOString(),
    state, league, users, rosters,
    matchups: Object.fromEntries(weeks.map((w, i) => [w, mus[i]])),
    transactions: txs.flat(),
  };
}

const askedKey = (req) => req.query?.d ?? (req.url ? new URL(req.url, 'http://x').searchParams.get('d') : null);

export default async function handler(req, res) {
  try {
    const key = leagueKey();
    if (req.url && askedKey(req) !== key) {
      res.setHeader('Cache-Control', 'public, s-maxage=60');
      res.setHeader('Location', `/api/league?d=${encodeURIComponent(key)}`);
      return res.status(307).end();
    }
    // three days in the store: long enough to outlive any deploy, short enough to clean itself up
    const { body, from } = await once('league', key, async () => ({ body: await snapshot(), ttl: 3 * 86400 }));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Snapshot', `${key} ${from}`);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    res.status(200).send(JSON.stringify(body));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(e.message || e) });
  }
}
