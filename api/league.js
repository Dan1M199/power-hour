// GET /api/league — one snapshot of everything the site reads from Sleeper for the league.
//
// The front end asks for /api/league?d=<morning key> (the Central date, rolling over at 6am so last night's games
// are final). Vercel's CDN caches each key for a day, so Sleeper is hit once per morning no matter how many people
// open the page; every visitor that day shares the cached copy.

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

export default async function handler(req, res) {
  try {
    const body = await snapshot();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    res.status(200).send(JSON.stringify(body));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(e.message || e) });
  }
}
