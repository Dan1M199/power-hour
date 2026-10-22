// Rebuilds Sleeper-shaped objects + an /api/ros-shaped payload from the saved snapshots.
import { readFileSync } from 'node:fs';
import { buildIndex, buildConsensus } from '../lib/consensus.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url)));
const TX_TYPE = { f: 'free_agent', w: 'waiver', t: 'trade', c: 'commissioner' };

export function buildFixture() {
  const meta = load('league_meta.json');
  const { R, M } = load('league_rm.json');
  const P = load('players.json');
  const tx = load('tx.json');

  const rosters = R.map(([rid, owner, players, starters, reserve]) => ({
    roster_id: rid, owner_id: owner, players, starters, reserve, settings: meta.rosterSettings[rid],
  }));
  const matchups = {};
  M.forEach((wk, i) => {
    const w = i + 1;
    matchups[w] = wk.map((m) =>
      m.length > 2
        ? { roster_id: m[0], matchup_id: m[1], points: m[2], starters: m[3], starters_points: m[4], players_points: {}, players: m[3] }
        : { roster_id: m[0], matchup_id: m[1], points: 0, starters: [], players: [] }
    );
  });
  const transactions = tx.map((t, i) => ({
    transaction_id: String(i),
    type: TX_TYPE[t[0]], leg: t[1], status: 'complete', status_updated: t[2] * 1000, created: t[2] * 1000,
    roster_ids: t[3], adds: t[4] || null, drops: t[5] || null,
    draft_picks: (t[6] || []).map(([season, round, roster_id, owner_id, previous_owner_id]) => ({ season, round, roster_id, owner_id, previous_owner_id })),
    waiver_budget: [], settings: t[7] ? { waiver_bid: t[7] } : null,
  }));

  // consensus from saved source snapshots
  const sleeperPlayers = {};
  for (const [id, [name, pos, team, inj]] of Object.entries(P)) {
    const parts = name.split(' ');
    sleeperPlayers[id] = { full_name: name, last_name: parts.slice(1).join(' ') || name, position: pos, team, injury_status: inj, active: true };
  }
  const fp = load('fp.json').p.map(([name, pos, team, rank]) => ({ name, pos, team, rank }));
  const ds = load('ds.json').p.map(([name, pos, team, rank, weekly, floor, ceiling, injuryRisk, sos, games]) => ({ name, pos, team, rank, weekly, floor, ceiling, injuryRisk, sos, games }));
  const ll = fp.slice(0, 200);
  const { values, stats } = buildConsensus({ fp: { players: fp }, ds: { players: ds }, ll: { players: ll } }, buildIndex(sleeperPlayers));
  const players = Object.fromEntries(Object.entries(P).map(([id, [n, p, t, i]]) => [id, { n, p, t, i }]));

  return {
    league: meta.league, state: meta.state, users: meta.users, rosters, matchups, transactions,
    ros: {
      updated: new Date('2026-10-22T13:00:00Z').toISOString(),
      sources: Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, { ok: true, rows: s.rows, matched: s.matched }])),
      players,
      values,
    },
  };
}
