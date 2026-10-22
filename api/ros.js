// GET /api/ros — consensus rest-of-season values keyed by Sleeper player ID.
//
// Pulls FantasyPros, DraftSharks and LeagueLogs half-PPR ROS rankings plus Sleeper's player map,
// matches every ranked player to a Sleeper ID and blends the sources (lib/consensus.js).
// The response is cached on Vercel's CDN; the front end asks for /api/ros?d=<today's date>,
// so the first visit each day triggers a fresh pull and everyone else that day gets the cached copy.

import {
  FANTASYPROS_URL, DRAFTSHARKS_URL, LEAGUELOGS_URL,
  parseFantasyPros, parseDraftSharks, parseLeagueLogs,
} from '../lib/sources.js';
import { buildIndex, buildConsensus } from '../lib/consensus.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const POS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);

async function getText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*', 'accept-language': 'en-US,en;q=0.9' },
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadSource(key, url, parse) {
  const t0 = Date.now();
  try {
    const parsed = parse(await getText(url));
    if (!parsed.players.length) throw new Error('parsed 0 players');
    return [key, { ok: true, ms: Date.now() - t0, updated: parsed.updated, players: parsed.players }];
  } catch (e) {
    return [key, { ok: false, ms: Date.now() - t0, error: String(e.message || e) }];
  }
}

export default async function handler(req, res) {
  try {
    const [sources, sleeper] = await Promise.all([
      Promise.all([
        loadSource('fp', FANTASYPROS_URL, parseFantasyPros),
        loadSource('ds', DRAFTSHARKS_URL, parseDraftSharks),
        loadSource('ll', LEAGUELOGS_URL, parseLeagueLogs),
      ]).then(Object.fromEntries),
      fetch('https://api.sleeper.app/v1/players/nfl').then((r) => {
        if (!r.ok) throw new Error(`Sleeper players ${r.status}`);
        return r.json();
      }),
    ]);

    const idx = buildIndex(sleeper);
    const okSources = Object.fromEntries(Object.entries(sources).filter(([, s]) => s.ok));
    const { values, stats } = buildConsensus(okSources, idx);

    // Compact name map for every fantasy-relevant player (rostered, ranked, or recently active).
    const players = {};
    for (const [id, p] of Object.entries(sleeper)) {
      if (!POS.has(p.position)) continue;
      if (!p.active && !p.team && !values[id]) continue;
      players[id] = {
        n: p.position === 'DEF' ? `${p.first_name} ${p.last_name}` : p.full_name || `${p.first_name} ${p.last_name}`,
        p: p.position,
        t: p.team || null,
        i: p.injury_status || null,
        a: p.age || null,
      };
    }

    const body = {
      updated: new Date().toISOString(),
      sources: Object.fromEntries(
        Object.entries(sources).map(([k, s]) => [
          k,
          s.ok ? { ok: true, rows: stats[k]?.rows, matched: stats[k]?.matched, updated: s.updated || null, ms: s.ms } : { ok: false, error: s.error },
        ])
      ),
      weights: { fp: 1, ds: 1, ll: 0.5 },
      players,
      values,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // A day at the edge, then serve stale for another day while a fresh copy is fetched in the background.
    // If a source failed, only cache for an hour so the next visitor retries.
    const allOk = Object.values(sources).every((s) => s.ok);
    res.setHeader('Cache-Control', allOk ? 'public, s-maxage=86400, stale-while-revalidate=86400' : 'public, s-maxage=3600');
    res.status(200).send(JSON.stringify(body));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: String(e.message || e) });
  }
}
