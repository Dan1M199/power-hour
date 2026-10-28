// This week's player projections for the matchups: the average of FantasyPros' and Sleeper's half-PPR projections.
// The ROS values (lib/consensus.js) carry DraftSharks' rest-of-season weekly average, which is the right number for
// later weeks but not for this one (matchup, bye, injury news). Pure: api/ros.js fetches, this parses and blends.
//
// FantasyPros: the public API (https://api.fantasypros.com/public/v2/json/nfl/{season}/projections, header x-api-key,
// env FANTASYPROS_API_KEY). The free tier returns at most 10 players per call, so the ROS ranking's players are asked
// for by id (`players=a:b:...`) in batches of 10. Sleeper: one call to its projections endpoint for the week.
import { matchRow } from './consensus.js';
import { fixTeam } from './sources.js';
import { morningKey } from './newsclock.js';

export const FP_BATCH = 10;
// FantasyPros is asked for players who could start in a 12-team league (top by position in its ROS ranking); Sleeper
// covers everyone else. About 23 calls, paced at 5 a second (the API rate-limits bursts with 429s).
export const FP_DEPTH = { QB: 30, RB: 60, WR: 72, TE: 26, K: 20, DEF: 20 };
export const FP_GAP_MS = 200;
export function fpIdsToAsk(rows) {
  const seen = {}, ids = [];
  for (const p of [...rows].sort((a, b) => a.rank - b.rank)) {
    seen[p.pos] = (seen[p.pos] || 0) + 1;
    if (p.fpid && seen[p.pos] <= (FP_DEPTH[p.pos] || 0)) ids.push(p.fpid);
  }
  return [...new Set(ids)];
}
export const fpProjUrl = (season, week, ids) =>
  `https://api.fantasypros.com/public/v2/json/nfl/${season}/projections?position=ALL&week=${week}&players=${ids.join(':')}`;
export const sleeperProjUrl = (season, week) =>
  `https://api.sleeper.app/projections/nfl/${season}/${week}?season_type=regular${['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => `&position%5B%5D=${p}`).join('')}`;

// The NFL week being projected for a morning key: weeks turn over on Tuesday morning (the key rolls at 6am, after
// Monday night is final), so Tuesday Sep 8 2026 opens week 1. Update SEASON_TUESDAY each season.
export const SEASON = 2026;
const SEASON_TUESDAY = Date.UTC(2026, 8, 8);
export function nflWeek(key = morningKey()) {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  return Math.max(1, Math.floor((Date.UTC(y, m - 1, d) - SEASON_TUESDAY) / (7 * 864e5)) + 1);
}

// FantasyPros responses (one per batch) -> rows for matchRow: [{name, pos, team, pts}]
export function parseFpProjections(responses) {
  const rows = [];
  for (const r of responses) {
    for (const p of r?.players || []) {
      const pts = p.stats?.points_half;
      if (pts == null) continue;
      // a defense FantasyPros hasn't projected comes back as a flat 10 with every stat at zero: a placeholder, not a number
      if (Object.entries(p.stats).every(([k, v]) => k.startsWith('points') || !v)) continue;
      const pos = p.position_id === 'DST' ? 'DEF' : p.position_id;
      rows.push({ name: p.name, pos, team: fixTeam(p.team_id), pts: Number(pts) });
    }
  }
  return rows;
}

// Sleeper's projections array -> {sleeperId: half-PPR points}; rows without a points figure are left out
export function parseSleeperProjections(rows) {
  const out = {};
  for (const r of rows || []) {
    const pts = r?.stats?.pts_half_ppr;
    if (r?.player_id && pts != null) out[r.player_id] = Math.round(pts * 100) / 100;
  }
  return out;
}

// {fp: rows from parseFpProjections | null, sl: map from parseSleeperProjections | null}, the Sleeper player index
// -> {proj: {id: [blend, fp, sl]}, stats}. The blend is the plain average of whichever of the two has the player.
export function blendWeekly({ fp, sl }, idx) {
  const fpById = {};
  let matched = 0;
  for (const row of fp || []) {
    const id = matchRow(row, idx);
    if (id) { fpById[id] = Math.round(row.pts * 100) / 100; matched++; }
  }
  const proj = {};
  for (const id of new Set([...Object.keys(fpById), ...Object.keys(sl || {})])) {
    const a = fpById[id] ?? null, b = sl?.[id] ?? null;
    const both = [a, b].filter((x) => x != null);
    proj[id] = [Math.round((both.reduce((s, x) => s + x, 0) / both.length) * 10) / 10, a, b];
  }
  return { proj, stats: { fp: fp ? { rows: fp.length, matched } : null, sl: sl ? { rows: Object.keys(sl).length } : null } };
}
