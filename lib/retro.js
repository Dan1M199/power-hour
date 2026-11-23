// The trade retrospective (Dan's request Nov 23; the Lab's Trades section, #lab/retro): who really won each trade,
// judged only on the points it put into (or took out of) each team's starting lineups since it went through. Rest of
// season rankings play no part. Pure, like the engine: no DOM, runs in the browser and in Node (scripts/test-retro.mjs).
//
// Undoing a trade, week by week from its first week on (the same lineup rules as What if, lib/whatif.js):
//  - Every player in the deal goes back to the team that gave him up, for good: if the trade never happened they'd
//    still have him. A player a team cut to make room in the deal goes back too.
//  - A team that loses a player who started for it: a player it gets back takes his slot (one who fits it first,
//    best average so far first; else one who can trade places with a starter), or else its best benched player who
//    fits, or else (nobody fits) the best free agent at that spot by average so far: they'd have picked one up. A
//    player it gets back who didn't take a slot sits on the bench and starts over its weakest starter he fits when his
//    average so far is higher.
//  - Whoever really had a player later (the receiver, or someone he was flipped or dropped to) plays without him.
//  - Everything else is as it happened, including the other moves the teams made.
// The trade's points for a team are its real lineup totals minus the undone ones over those weeks; the winner is the
// team the trade gave the most points. Records are recomputed for the whole league (wins, ties half, then points for).
import { fits } from './matchup.js';
import { bestLineup } from './engine.js';
import { benchFill, place, upgrade, standings, baseline } from './whatif.js';

export const MIN_WEEKS = 4; // weeks of games a trade needs before it gets a verdict
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const empty = (id) => !id || id === '0';
const sumPts = (book, w, S) => S.reduce((s, id) => s + book.pts(w, id), 0);
const winsOf = (x) => x.w + x.t / 2;
const resultOf = (a, b) => (b == null ? null : a > b + 1e-9 ? 'W' : b > a + 1e-9 ? 'L' : 'T');

// ---------- the trades ----------

/**
 * Every completed trade, oldest first: who sent whom where (`moves`: {id, from, to}, `to` null for a player cut to make
 * room), each side's players and draft picks, and its first week of games (`start`: the first scored week a player in
 * it played for his new team) with the scored weeks since (`weeks`). Trades with no scored week yet get `start` null.
 */
export function tradeList(book, raw) {
  const txs = (raw.transactions || []).filter((t) => t && t.type === 'trade' && t.status === 'complete');
  const seen = new Set(), out = [];
  for (const t of txs) {
    if (seen.has(t.transaction_id)) continue;
    seen.add(t.transaction_id);
    const sides = {};
    const side = (rid) => (sides[rid] ||= { rid, gets: [], gave: [], cut: [], picksIn: [], picksOut: [], faabIn: 0, faabOut: 0 });
    const adds = t.adds || {}, drops = t.drops || {}, moves = [];
    for (const [id, to] of Object.entries(adds)) {
      const from = drops[id];
      if (from == null || from === to) continue;
      moves.push({ id, from, to });
      side(to).gets.push(id);
      side(from).gave.push(id);
    }
    for (const [id, from] of Object.entries(drops)) {
      if (adds[id] != null) continue;
      moves.push({ id, from, to: null });
      side(from).cut.push(id);
    }
    for (const p of t.draft_picks || []) {
      side(p.owner_id).picksIn.push(p);
      side(p.previous_owner_id).picksOut.push(p);
    }
    for (const b of t.waiver_budget || []) { side(b.receiver).faabIn += b.amount; side(b.sender).faabOut += b.amount; }
    (t.roster_ids || []).forEach((rid) => side(rid));
    const list = Object.values(sides).filter((s) => book.D.byRid[s.rid]).sort((a, b) => a.rid - b.rid);
    if (list.length < 2 || !moves.length) continue;
    const leg = t.leg || 1;
    // the first scored week one of them played for his new team (a trade that went through mid-week can count in its
    // own week); none yet, then the trade hasn't had a game
    const start = book.weeks.find((w) => w >= leg && moves.some((m) => m.to != null && book.owner[w]?.[m.id] === m.to)) ?? null;
    const weeks = start == null ? [] : book.weeks.filter((w) => w >= start);
    out.push({ id: String(t.transaction_id), ts: t.status_updated || t.created || 0, leg, start, weeks, moves, sides: list });
  }
  return out.sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
}

/**
 * The trades `picked` drag along with them (oldest first): if a trade never happened, any later trade that paid with a
 * player it brought in couldn't have happened either, so that one is undone too, and so on down the line. Returns
 * every trade to undo and, for each one dragged in, the player that tied it to the rest (`forced[tid] = player id`).
 */
export function withFlips(all, picked) {
  const ids = new Set(picked.map((t) => t.id)), held = new Map(), trades = [], forced = {};
  for (const t of all) {
    if (!ids.has(t.id)) {
      const m = t.moves.find((x) => held.get(x.id)?.has(x.from));
      if (!m) continue;
      forced[t.id] = m.id;
    }
    trades.push(t);
    for (const m of t.moves) if (m.to != null) (held.get(m.id) || held.set(m.id, new Set()).get(m.id)).add(m.to);
  }
  return { trades, forced };
}

// ---------- one replay ----------

// the free agents a team could have picked up for week w: everyone who played that week (Sleeper's stats, from
// /api/history) and was on nobody's roster, best average so far first (players with no games yet left out: nobody
// picks up a player on nothing). Without the history there are none.
const FA = new WeakMap();
function freeAgents(book, w) {
  let byWeek = FA.get(book);
  if (!byWeek) FA.set(book, (byWeek = {}));
  if (byWeek[w]) return byWeek[w];
  const ids = Object.keys(book.hist?.pts?.[w] || {}).filter((id) => book.owner[w]?.[id] == null && book.posOf(id) && book.avg(w, id) != null);
  ids.sort((a, b) => book.avg(w, b) - book.avg(w, a) || book.valueOf(b) - book.valueOf(a) || (a < b ? -1 : 1));
  return (byWeek[w] = ids);
}

/**
 * Replay the season with `trades` undone (any number at once; a player in more than one goes back to where the
 * earliest of them took him from). Returns the points each team's lineup changes by each week (`delta`, undone minus
 * real), every week's lineups for the teams it touches (`lineups[w][rid] = {real, cf, ins, outs}`), the standings
 * without the trades (`after`) and with them (`before`), and `back`: each player's team without them.
 */
export function undo(book, trades) {
  const { weeks, rows, owner, slots, posOf, played, avg, valueOf } = book;
  const back = new Map();
  for (const t of [...trades].sort((a, b) => a.ts - b.ts)) {
    for (const m of t.moves) if (!back.has(m.id)) back.set(m.id, { from: m.from, start: t.start ?? Infinity, tid: t.id });
  }
  const delta = {}, lineups = {};
  for (const w of weeks) {
    const ins = {}, outs = {};
    for (const [id, b] of back) {
      if (w < b.start) continue;
      const real = owner[w]?.[id] ?? null;
      if (real === b.from) continue;
      (ins[b.from] ||= []).push(id);
      if (real != null) (outs[real] ||= new Set()).add(id);
    }
    const touched = new Set([...Object.keys(ins), ...Object.keys(outs)].map(Number));
    if (!touched.size) continue;
    const taken = new Set(); // free agents picked up this week, one team each
    const d = (delta[w] = {}), L = (lineups[w] = {});
    for (const rid of touched) {
      const row = rows[w][rid];
      if (!row) continue;
      const gone = outs[rid] || new Set();
      const got = (ins[rid] || []).slice();
      // best first: average so far, then consensus value, then id
      const key = (id) => [avg(w, id) ?? -1, valueOf(id)];
      got.sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1] || (a < b ? -1 : 1));
      const playing = got.filter((id) => played(w, id));
      const S = row.starters.slice(), holes = [];
      S.forEach((id, i) => { if (gone.has(id)) { S[i] = '0'; holes.push(i); } });
      const placed = new Set(), exclude = new Set([...gone, ...got]), pickups = [];
      for (const i of holes) {
        let p = playing.find((id) => !placed.has(id) && fits(slots[i], posOf(id)));
        if (p) { S[i] = p; placed.add(p); continue; }
        p = playing.find((id) => !placed.has(id) && place(book, S, i, id));
        if (p) { placed.add(p); continue; }
        const f = benchFill(book, w, row, i, S, exclude);
        if (f) { S[i] = f; continue; }
        // nobody on the bench fits: they'd have picked one up (the best free agent at the slot, by average so far)
        const fa = freeAgents(book, w).find((id) => !taken.has(id) && !back.has(id) && fits(slots[i], posOf(id)));
        S[i] = fa || '0';
        if (fa) { taken.add(fa); pickups.push(fa); }
      }
      for (const p of playing) {
        if (placed.has(p)) continue;
        if (upgrade(book, w, S, p, placed) !== -1) placed.add(p);
      }
      const dd = round(sumPts(book, w, S) - sumPts(book, w, row.starters));
      if (dd) d[rid] = dd;
      L[rid] = { real: row.starters, cf: S, ins: got, outs: [...gone], pickups };
    }
  }
  return { delta, lineups, after: standings(book, delta), before: baseline(book), back };
}

// each week's game for team rid, real and undone
function gamesOf(book, rid, delta, ws = book.weeks) {
  const out = [];
  for (const w of ws) {
    const g = book.pairs[w]?.find((x) => x.includes(rid));
    if (!g) continue;
    const o = g[0] === rid ? g[1] : g[0];
    const was = [book.rows[w][rid].pts, book.rows[w][o].pts];
    const now = [round(was[0] + (delta[w]?.[rid] || 0)), round(was[1] + (delta[w]?.[o] || 0))];
    out.push({ w, opp: o, was, now, res: [resultOf(...was), resultOf(...now)] });
  }
  return out;
}

// ---------- one trade, judged ----------

// what a player did since week `from`: points and starts in rid's lineup (rid null: anyone's), points overall
function lineFor(book, id, from, rid = null) {
  let pts = 0, starts = 0, all = 0, games = 0, on = 0;
  const teams = new Set();
  for (const w of book.weeks) {
    if (w < from) continue;
    const p = book.pts(w, id);
    if (book.played(w, id)) { all += p; games++; }
    const o = book.owner[w]?.[id];
    if (o == null || (rid != null && o !== rid)) continue;
    on++;
    if (rid == null) teams.add(o);
    if (book.rows[w][o].starters.includes(id)) { pts += p; starts++; }
  }
  return { id, pts: round(pts), starts, all: round(all), games, weeks: on, teams: [...teams] };
}

/**
 * One trade, judged: each side's points from it week by week (`added`, real lineup minus undone lineup) and in all
 * (`net`), its record and seed with and without it, the games it turned (`swung`), and what every player in it did
 * since: for the team that got him (`gets`) and wherever he went from the team that gave him up (`gave`). A later deal
 * paid with a player from this one is undone with it (`withFlips`), and listed on the side that made it (`onward`:
 * what it sent and what it got, and how those did). Sides come best first, so sides[0] is the winner and the last one
 * the loser; `margin` is the gap between them.
 */
export function judge(book, t, all = [t]) {
  const chain = withFlips(all, [t]);
  const { delta, after, before, lineups } = undo(book, chain.trades);
  const later = chain.trades.filter((x) => x.id !== t.id);
  const sides = t.sides.map((s) => {
    const added = t.weeks.map((w) => ({ w, pts: round(-(delta[w]?.[s.rid] || 0)) }));
    const net = round(added.reduce((a, x) => a + x.pts, 0));
    const was = before.find((x) => x.rid === s.rid), now = after.find((x) => x.rid === s.rid);
    const games = gamesOf(book, s.rid, delta, t.weeks);
    const swung = games.filter((g) => g.res[0] !== g.res[1]);
    const gets = s.gets.map((id) => lineFor(book, id, t.start, s.rid));
    const gave = [...s.gave, ...s.cut].map((id) => ({ ...lineFor(book, id, t.start), cut: s.cut.includes(id) }));
    const onward = later.map((x) => {
      const me = x.sides.find((y) => y.rid === s.rid);
      if (!me) return null;
      const via = chain.forced[x.id];
      return { id: x.id, leg: x.leg, start: x.start, via, partners: x.sides.filter((y) => y.rid !== s.rid).map((y) => y.rid),
        sent: [...me.gave, ...me.cut], got: me.gets.map((id) => lineFor(book, id, x.start ?? Infinity, s.rid)) };
    }).filter(Boolean);
    // who the difference was: the players in its real lineups that the undone lineups don't have (`withIds`, what the
    // trade brought), and the ones the undone lineups play instead (`withoutIds`); net = with - without
    const tally = (into, w, id) => { if (empty(id)) return; const x = (into[id] ||= { id, pts: 0, starts: 0 }); x.pts = round(x.pts + book.pts(w, id)); x.starts++; };
    const withIds = {}, withoutIds = {};
    for (const w of t.weeks) {
      const L = lineups[w]?.[s.rid];
      if (!L) continue;
      for (const id of L.real) if (!L.cf.includes(id)) tally(withIds, w, id);
      for (const id of L.cf) if (!L.real.includes(id)) { tally(withoutIds, w, id); if (L.pickups?.includes(id)) withoutIds[id].pickup = true; }
    }
    const by = (o) => Object.values(o).sort((a, b) => b.pts - a.pts || (a.id < b.id ? -1 : 1));
    const diff = { with: by(withIds), without: by(withoutIds) };
    diff.withPts = round(diff.with.reduce((a, x) => a + x.pts, 0));
    diff.withoutPts = round(diff.without.reduce((a, x) => a + x.pts, 0));
    // the weeks the trade mattered most to this side, either way
    const best = added.reduce((m, x) => (!m || x.pts > m.pts ? x : m), null);
    const worst = added.reduce((m, x) => (!m || x.pts < m.pts ? x : m), null);
    return {
      ...s, added, net, games, swung, gets, gave, onward, diff, best, worst,
      real: was, without: now,
      dw: winsOf(was) - winsOf(now), // wins the trade is worth (real minus without)
      dseed: (now.seed || 0) - (was.seed || 0), // places the trade is worth (positive: it lifted them)
      dpf: round(was.pf - now.pf),
      lineup: t.weeks.map((w) => ({ w, ...(lineups[w]?.[s.rid] || { real: book.rows[w][s.rid]?.starters || [], cf: null }) })),
    };
  });
  sides.sort((a, b) => b.net - a.net || b.dw - a.dw || a.rid - b.rid);
  const margin = round(sides[0].net - sides[sides.length - 1].net);
  const size = round(sides.reduce((a, s) => a + Math.abs(s.net), 0));
  // the other teams whose records come out differently
  const ripple = after.filter((x) => !t.sides.some((s) => s.rid === x.rid))
    .filter((x) => { const b = before.find((y) => y.rid === x.rid); return winsOf(b) !== winsOf(x); }).map((x) => x.rid);
  return { ...t, judged: t.weeks.length >= MIN_WEEKS, sides, later: later.map((x) => x.id), winner: sides[0].rid, loser: sides[sides.length - 1].rid, margin, size, ripple, table: after.map((x) => ({ ...x, was: before.find((y) => y.rid === x.rid) })) };
}

/**
 * The whole retrospective: every trade with MIN_WEEKS weeks of games or more, judged, biggest swing first (`judged`);
 * the younger ones with the week each will be judged after (`waiting`); and each team's report card over the judged
 * trades (`teams`: points from trades, trades won and lost), most points first.
 */
export function retrospective(book, raw) {
  const all = tradeList(book, raw);
  const last = book.weeks[book.weeks.length - 1] || 0;
  const judged = [], waiting = [];
  for (const t of all) {
    if (t.weeks.length >= MIN_WEEKS) judged.push(judge(book, t, all));
    else waiting.push({ ...t, after: (t.start ?? Math.max(t.leg, last + 1)) + MIN_WEEKS - 1 });
  }
  judged.sort((a, b) => b.size - a.size || b.ts - a.ts);
  const card = {};
  for (const t of judged) {
    for (const s of t.sides) {
      const c = (card[s.rid] ||= { rid: s.rid, net: 0, won: 0, lost: 0, trades: 0, dw: 0 });
      c.net = round(c.net + s.net);
      c.dw += s.dw;
      c.trades++;
      if (s.rid === t.winner) c.won++;
      else if (s.rid === t.loser) c.lost++;
    }
  }
  const teams = Object.values(card).sort((a, b) => b.net - a.net || b.won - a.won || a.rid - b.rid);
  return { all, judged, waiting, teams, last };
}

// ---------- a team's trades, undone ----------

/** The trades team rid was part of, oldest first. */
export const tradesOf = (all, rid) => all.filter((t) => t.sides.some((s) => s.rid === rid));

/**
 * Team rid with some of its trades undone (`picked`, out of `all`; later deals paid with a player from one of them go
 * too, `forced`, see withFlips): its record, points for and seed with and without them, every
 * week's game, the standings without them, the lineup of each scored week since the first one undone (real and
 * undone), and its roster today with them undone (`roster`: who it would have back and who it would lose, and the best
 * lineup from that roster by points per game this season).
 */
export function undoTeam(book, rid, picked, all = picked) {
  const { trades, forced } = withFlips(all, picked);
  const res = undo(book, trades);
  const was = res.before.find((x) => x.rid === rid), now = res.after.find((x) => x.rid === rid);
  const games = gamesOf(book, rid, res.delta);
  const first = Math.min(...trades.map((t) => t.start ?? Infinity));
  const lineups = book.weeks.filter((w) => w >= first).map((w) => ({ w, ...(res.lineups[w]?.[rid] || { real: book.rows[w][rid]?.starters || [], cf: null }) }));
  // today's roster without them
  const today = new Set(book.D.byRid[rid]?.players || []);
  const backIn = [], goneOut = [];
  for (const [id, b] of res.back) {
    if (b.from === rid && !today.has(id)) { backIn.push(id); }
    else if (b.from !== rid && today.has(id)) { goneOut.push(id); }
  }
  const roster = [...today].filter((id) => !goneOut.includes(id)).concat(backIn);
  const ppg = (id) => { const g = book.games(id); return g ? book.total(id) / g : 0; };
  const lineupOf = (ids) => bestLineup(ids, book.slots, ppg, book.posOf);
  return {
    rid, trades: trades.map((t) => t.id), forced, real: was, without: now,
    dw: winsOf(was) - winsOf(now), dpf: round(was.pf - now.pf), dseed: (now.seed || 0) - (was.seed || 0),
    added: round(Object.values(res.delta).reduce((a, d) => a - (d[rid] || 0), 0)),
    games, swung: games.filter((g) => g.res[0] !== g.res[1]), table: res.after.map((x) => ({ ...x, was: res.before.find((y) => y.rid === x.rid) })),
    lineups,
    roster: { back: backIn, gone: goneOut, ids: roster, now: lineupOf([...today]), without: lineupOf(roster), ppg },
  };
}
