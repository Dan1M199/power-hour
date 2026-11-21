// What would have happened (Dan's request Nov 20; the Lab's What if section, #lab/whatif): take one player off a team
// for the whole season, put another in his place, and replay every scored week to get the record that would have
// followed. Pure, like the engine: no DOM, runs in the browser and in Node (scripts/test-whatif.mjs).
//
// The rules, week by week (they only use what a manager knew before kickoff, apart from who played):
//  - Your side. In a week the player you swapped out started for you, the new player takes his slot (or, when he
//    doesn't fit that slot, trades places with a starter who does, e.g. an RB in the flex so the flex WR moves over).
//    If the new player didn't play that week (bye, injury) or can't fit, your best benched player who fits fills the
//    slot. In every other week (your player benched, or not on your roster yet or any more) the new player sits on
//    your bench and starts over your weakest starter he fits when his average so far beats that starter's.
//  - His old team. Any week he started for someone else, that team plays without him: their best benched player who
//    fits takes the slot. So when you'd have faced them, they're weaker too.
//  - The player you gave up stays out of it: the rest of the league's rosters are as they were.
//  - "Best benched player" and "average so far" use only the weeks before (points per game played); in week 1 the
//    consensus value breaks the tie.
// Points come from the league's own scoring (players_points, starters_points) and, for weeks a player sat on waivers,
// Sleeper's half-PPR stats from /api/history.
import { fits } from './matchup.js';

const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const empty = (id) => !id || id === '0';

// ---------- the API's two parsers (api/history.js) ----------

// Sleeper's weekly stats -> {id: half-PPR points} for everyone who played. Accepts the stats endpoint's array
// ([{player_id, stats}]) or v1's map ({id: stats}).
export function parseWeekStats(rows) {
  const out = {};
  const each = Array.isArray(rows) ? rows.map((r) => [r?.player_id, r?.stats]) : Object.entries(rows || {});
  for (const [id, s] of each) {
    if (!id || !s) continue;
    const pts = s.pts_half_ppr;
    if (pts == null) continue;
    // a row for someone who didn't play: games played zero, or no games figure and nothing scored
    if (s.gp != null ? !(s.gp > 0) : !pts) continue;
    out[id] = round(pts);
  }
  return out;
}

// a Sleeper draft and its picks -> {id, type, rounds, teams, picks: [[pick_no, round, roster_id, player_id, keeper,
// picked_by]], names: {id: [name, pos, team]}}
export function slimDraft(d, picks) {
  const names = {};
  const rows = (picks || [])
    .filter((p) => p && p.player_id)
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((p) => {
      const m = p.metadata || {};
      names[p.player_id] = [`${m.first_name || ''} ${m.last_name || ''}`.trim() || null, m.position || null, m.team || null];
      return [p.pick_no, p.round, p.roster_id ?? null, String(p.player_id), p.is_keeper ? 1 : 0, p.picked_by || null];
    });
  return { id: d.draft_id, type: d.type || null, rounds: d.settings?.rounds ?? null, teams: d.settings?.teams ?? null, picks: rows, names };
}

// ---------- the season, indexed ----------

/**
 * Everything the replays read, built once per league: each scored week's rows by team, who rostered whom, the
 * pairings, every player's points and whether he played. D: computeLeague output; raw: the Sleeper snapshot; hist: the
 * /api/history body (or null: then waiver weeks score nothing and there's no draft board).
 */
export function seasonBook(D, raw, hist = null) {
  const slots = D.meta.slots;
  const P = hist?.pts || {};
  const dnames = hist?.draft?.names || {};
  const posOf = (id) => D.helpers.posOf(id) || dnames[id]?.[1] || null;
  const nameOf = (id) => {
    const n = D.helpers.nameOf(id);
    return /^Player \d/.test(n) && dnames[id]?.[0] ? dnames[id][0] : n;
  };
  const weeks = [], rows = {}, owner = {}, pairs = {};
  for (let w = 1; w <= D.meta.lastScored; w++) {
    const wk = raw.matchups?.[w] || [];
    if (!wk.some((m) => m.starters?.length)) continue;
    weeks.push(w);
    rows[w] = {}; owner[w] = {}; pairs[w] = [];
    const byMatch = {};
    for (const m of wk) {
      const starters = (m.starters || []).slice();
      const players = new Set([...(m.players || []), ...starters].filter((id) => !empty(id)));
      rows[w][m.roster_id] = { rid: m.roster_id, pts: m.custom_points ?? m.points ?? 0, starters, spts: m.starters_points || [], pp: m.players_points || {}, players };
      for (const id of players) owner[w][id] = m.roster_id;
      if (m.matchup_id != null) (byMatch[m.matchup_id] ||= []).push(m.roster_id);
    }
    for (const g of Object.values(byMatch)) if (g.length === 2) pairs[w].push(g);
  }

  // a player's points in a week: his team's numbers if someone rostered him, else Sleeper's stats, else nothing
  const pts = (w, id) => {
    if (empty(id)) return 0;
    const r = rows[w]?.[owner[w]?.[id]];
    if (r) {
      if (r.pp[id] != null) return r.pp[id];
      const i = r.starters.indexOf(id);
      if (i >= 0 && r.spts[i] != null) return r.spts[i];
    }
    return P[w]?.[id] ?? 0;
  };
  // did he play: in Sleeper's stats for the week, or (without them) scored anything
  const played = (w, id) => !empty(id) && ((P[w] && id in P[w]) || pts(w, id) !== 0);
  // points per game played over the weeks before w (null before his first game)
  const memo = new Map();
  const avg = (w, id) => {
    let a = memo.get(id);
    if (!a) {
      a = {};
      let s = 0, g = 0;
      for (const x of weeks) {
        a[x] = g ? s / g : null;
        if (played(x, id)) { s += pts(x, id); g++; }
      }
      memo.set(id, a);
    }
    return a[w] ?? null;
  };
  const total = (id) => weeks.reduce((s, w) => s + pts(w, id), 0);
  const games = (id) => weeks.filter((w) => played(w, id)).length;
  const valueOf = (id) => D.helpers.valueOf(id) || 0;
  return { D, slots, weeks, rows, owner, pairs, pts, played, avg, total, games, posOf, nameOf, valueOf, hist };
}

// ---------- the draft ----------

/** The draft board with roster ids filled in, or null. byId: player id -> pick. */
export function draftBoard(book, raw) {
  const d = book.hist?.draft;
  if (!d?.picks?.length) return null;
  const ridOfUser = Object.fromEntries((raw.rosters || []).map((r) => [r.owner_id, r.roster_id]));
  const picks = d.picks.map(([no, rd, rid, id, keeper, by]) => ({ no, round: rd, rid: rid ?? ridOfUser[by] ?? null, id, keeper: !!keeper }));
  const per = d.teams || Math.max(1, ...picks.map((p) => p.no)) / Math.max(1, d.rounds || 1);
  picks.forEach((p) => (p.inRound = ((p.no - 1) % per) + 1));
  return { picks, per, byId: Object.fromEntries(picks.map((p) => [p.id, p])) };
}

// ---------- one replay ----------

// the best benched player (row's roster, not in lineup S, not excluded) who fits slot i and played that week
function benchFill(book, w, row, i, S, exclude) {
  const { slots, posOf, played, avg, valueOf } = book;
  let best = null, key = null;
  for (const b of row.players) {
    if (S.includes(b) || exclude.has(b) || !fits(slots[i], posOf(b)) || !played(w, b)) continue;
    const k = [avg(w, b) ?? -1, valueOf(b), b];
    if (!best || k[0] > key[0] || (k[0] === key[0] && (k[1] > key[1] || (k[1] === key[1] && k[2] < key[2])))) { best = b; key = k; }
  }
  return best;
}

// put player p into lineup S at slot i, or swap with a starter who can move to slot i; true when it worked
function place(book, S, i, p) {
  const { slots, posOf } = book, pos = posOf(p);
  if (fits(slots[i], pos)) { S[i] = p; return true; }
  for (let j = 0; j < S.length; j++) {
    if (j === i || empty(S[j]) || !fits(slots[j], pos) || !fits(slots[i], posOf(S[j]))) continue;
    S[i] = S[j]; S[j] = p;
    return true;
  }
  return false;
}

// on the bench: starts over the weakest starter he fits when his average so far is higher (an empty slot always).
// keep: starters who can't be sat this way (the other swapped-in players: each one's call is his own)
function upgrade(book, w, S, p, keep = null) {
  const { slots, posOf, avg } = book, a = avg(w, p), pos = posOf(p);
  let at = -1, low = Infinity;
  for (let j = 0; j < S.length; j++) {
    if (!fits(slots[j], pos) || keep?.has(S[j])) continue;
    const v = empty(S[j]) ? -Infinity : avg(w, S[j]);
    if (v == null) continue; // a starter with no games yet is the manager's call: keep him
    if (v < low) { low = v; at = j; }
  }
  if (at < 0 || (low !== -Infinity && (a == null || a <= low))) return -1;
  const out = S[at];
  S[at] = p;
  return out;
}

const sumPts = (book, w, S) => S.reduce((s, id) => s + book.pts(w, id), 0);

function standings(book, delta) {
  const T = {};
  const at = (rid) => (T[rid] ||= { rid, w: 0, l: 0, t: 0, pf: 0, pa: 0 });
  for (const w of book.weeks) {
    for (const [a, b] of book.pairs[w]) {
      const sa = book.rows[w][a].pts + (delta?.[w]?.[a] || 0), sb = book.rows[w][b].pts + (delta?.[w]?.[b] || 0);
      const A = at(a), B = at(b);
      A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
      if (sa > sb + 1e-9) { A.w++; B.l++; } else if (sb > sa + 1e-9) { B.w++; A.l++; } else { A.t++; B.t++; }
    }
  }
  // wins (ties half), then points for: the league's tiebreaker
  const table = Object.values(T).sort((x, y) => y.w + y.t / 2 - (x.w + x.t / 2) || y.pf - x.pf || x.rid - y.rid);
  table.forEach((x, i) => { x.seed = i + 1; x.pf = round(x.pf); x.pa = round(x.pa); });
  return table;
}

const BASE = new WeakMap(); // the real standings, once per book
const baseline = (book) => {
  if (!BASE.has(book)) BASE.set(book, standings(book, null));
  return BASE.get(book);
};

/**
 * Replay the season for team rid with each swap's `out` replaced by its `inn` (any number at once: `swaps`, or a single
 * `out` and `inn`). detail: false skips the week-by-week rows (for ranking many candidates). Returns the record, points
 * and seed before and after, every team's standings after, and for each week: the game before and after and, per swap,
 * what it did (`steps`, in the order of `swaps`).
 */
export function whatIf(book, { rid, swaps = null, out, inn, detail = true }) {
  const { weeks, rows, owner, pts, played, slots } = book;
  const list = (swaps || [{ out, inn }]).filter((x) => x && x.out && x.inn);
  const outs = new Set(list.map((x) => x.out)), inns = new Set(list.map((x) => x.inn));
  const delta = {}, log = [];
  for (const w of weeks) {
    const me = rows[w][rid];
    if (!me) continue;
    const d = (delta[w] = {}), L = {};
    const lineup = (r) => (L[r] ||= rows[w][r].starters.slice());
    const S = lineup(rid), steps = [];
    for (const { out: o, inn: n } of list) {
      const step = { out: o, inn: n, how: 'same', inPts: played(w, n) ? pts(w, n) : null, outPts: null, filler: null, benched: null, slot: null, lost: null };
      steps.push(step);
      if (me.players.has(n)) { step.how = 'had'; continue; } // already yours that week: nothing changes
      // his old team that week plays without him
      const T = owner[w][n];
      if (T != null && T !== rid) {
        const ST = lineup(T), i = ST.indexOf(n);
        if (i >= 0) {
          const f = benchFill(book, w, rows[w][T], i, ST, inns);
          ST[i] = f || '0';
          step.lost = { rid: T, filler: f, pts: f ? pts(w, f) : 0 };
        }
      }
      const i = S.indexOf(o), plays = played(w, n);
      let inLineup = false;
      if (i >= 0) {
        step.outPts = pts(w, o);
        step.slot = slots[i];
        if (plays && place(book, S, i, n)) { inLineup = true; step.how = 'swap'; }
        else {
          const f = benchFill(book, w, me, i, S, new Set([...outs, ...inns]));
          S[i] = f || '0';
          step.filler = f;
          step.how = plays ? 'nofit' : 'off';
        }
      }
      if (!inLineup && plays) {
        const sat = upgrade(book, w, S, n, inns);
        if (sat !== -1) { step.how = i >= 0 ? 'nofit-start' : 'start'; step.benched = empty(sat) ? null : sat; }
        else if (i < 0) step.how = 'bench';
      } else if (i < 0 && !plays) step.how = 'idle';
    }
    for (const r of Object.keys(L)) {
      const dd = sumPts(book, w, L[r]) - sumPts(book, w, rows[w][r].starters);
      if (dd) d[r] = (d[r] || 0) + dd;
    }
    if (detail) log.push({ w, steps });
  }
  const before = baseline(book), after = standings(book, delta);
  const mine = (tb) => tb.find((x) => x.rid === rid) || { w: 0, l: 0, t: 0, pf: 0, seed: null };
  const res = { rid, swaps: list, out: list[0]?.out, inn: list[0]?.inn, before: mine(before), after: mine(after) };
  if (!detail) return res;
  const opp = (w) => book.pairs[w].find((g) => g.includes(rid))?.find((x) => x !== rid) ?? null;
  res.table = after.map((x) => ({ ...x, was: before.find((y) => y.rid === x.rid) }));
  res.weeks = log.map((s) => {
    const o = opp(s.w), r = rows[s.w];
    const mb = r[rid].pts, ob = o != null ? r[o].pts : null;
    const ma = round(mb + (delta[s.w]?.[rid] || 0)), oa = o != null ? round(ob + (delta[s.w]?.[o] || 0)) : null;
    const result = (a, b) => (b == null ? null : a > b + 1e-9 ? 'W' : b > a + 1e-9 ? 'L' : 'T');
    const steps = s.steps.map((x) => ({ ...x, hitOpp: x.lost?.rid === o && o != null }));
    return { w: s.w, steps, opp: o, was: [mb, ob], now: [ma, oa], res: [result(mb, ob), result(ma, oa)], hitOpp: steps.some((x) => x.hitOpp) };
  });
  res.flips = res.weeks.filter((x) => x.res[0] !== x.res[1]);
  res.inStarted = res.weeks.reduce((a, x) => a + x.steps.filter((y) => ['swap', 'start', 'nofit-start'].includes(y.how)).length, 0);
  return res;
}

/** Everyone who was ever on team rid's roster in a scored week, plus today's roster. */
export function everRostered(book, rid) {
  const s = new Set(book.D.byRid[rid]?.players || []);
  for (const w of book.weeks) for (const id of book.rows[w][rid]?.players || []) s.add(id);
  return s;
}

/**
 * The players team rid could have had in place of a player: everyone who scored this season (or was rostered), minus
 * anyone who was ever yours; with `beforePick`, minus everyone drafted ahead of that pick (the board at your pick).
 * Returns [{id, tot}] by season points, most first.
 */
export function candidatePool(book, { rid, out = null, board = null, beforePick = null, taken = [] }) {
  // never yours: anyone who was on your roster, the player you're swapping out, your own draft picks, and anyone
  // already swapped in for another of your players (`taken`)
  const mine = everRostered(book, rid);
  if (out) mine.add(out);
  for (const id of taken) mine.add(id);
  for (const p of board?.picks || []) if (p.rid === rid) mine.add(p.id);
  const gone = new Set(beforePick && board ? board.picks.filter((p) => p.no < beforePick).map((p) => p.id) : []);
  const pool = new Set();
  for (const w of book.weeks) {
    for (const id of Object.keys(book.hist?.pts?.[w] || {})) pool.add(id);
    for (const id of Object.keys(book.owner[w])) pool.add(id);
  }
  for (const p of board?.picks || []) pool.add(p.id);
  const list = [];
  for (const id of pool) {
    if (mine.has(id) || gone.has(id) || !book.posOf(id)) continue;
    list.push({ id, tot: round(book.total(id)) });
  }
  return list.sort((a, b) => b.tot - a.tot || (a.id < b.id ? -1 : 1));
}

/** The record with `others` swaps already made (the real one when there are none). */
export function recordWith(book, { rid, others = [] }) {
  return others.length ? whatIf(book, { rid, swaps: others, detail: false }).after : baseline(book).find((x) => x.rid === rid);
}

/** One candidate's replay on top of the `others` swaps, summed up against the record they give (`base`). */
export function swapRow(book, { rid, out, inn, others = [], base = recordWith(book, { rid, others }) }) {
  const r = whatIf(book, { rid, swaps: [...others, { out, inn }], detail: false });
  return { id: inn, tot: round(book.total(inn)), games: book.games(inn), after: r.after, dw: r.after.w + r.after.t / 2 - (base.w + base.t / 2), dpf: round(r.after.pf - base.pf), dseed: base.seed - r.after.seed };
}

/**
 * The best players to have had in place of `out`, best first (wins, then points for), on top of any `others` swaps
 * already made: candidatePool's players with real points (the top 160 by season points, plus the top 12 per position),
 * each replayed.
 */
export function bestSwaps(book, { rid, out, board = null, beforePick = null, limit = 10, others = [] }) {
  const list = candidatePool(book, { rid, out, board, beforePick, taken: others.map((x) => x.inn) }).filter((x) => x.tot > 0);
  const keep = new Set(list.slice(0, 160).map((x) => x.id));
  const perPos = {};
  for (const x of list) { const p = book.posOf(x.id); if ((perPos[p] = (perPos[p] || 0) + 1) <= 12) keep.add(x.id); }
  const base = recordWith(book, { rid, others });
  const rows = [...keep].map((id) => swapRow(book, { rid, out, inn: id, others, base }));
  rows.sort((a, b) => b.dw - a.dw || b.dpf - a.dpf || (a.id < b.id ? -1 : 1));
  return { base, list: rows.slice(0, limit), pool: keep.size };
}
