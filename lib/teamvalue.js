// What a team is worth, in dollars (Dan's request Nov 10): every player gets a price, a team is the sum of its roster,
// and the price moves week to week like a stock. Pure and deterministic, like the engine; scripts/test-value.mjs
// checks it. Three things set a player's price, each on a 0..100 scale:
// - his rest-of-season consensus value (the same `v` the trade ledger uses), 55%;
// - his form: the points he has scored each week, recent weeks counting more (each week back weighs 0.75 of the one
//   after it; his bye week is skipped), against the best at his position, 25%;
// - where he ranks at his position in total fantasy points so far (WR #10, RB #5), 20%. The ranks cover every player
//   who has been on a roster in this league, which is everyone who matters: free agents' points aren't in the snapshot.
// A player with no points on record yet is priced on his rest-of-season value alone, at a discount. The blend becomes
// dollars on a curve (stars cost more than twice what two middling players do), kickers and defenses trade at a
// discount, and a player on his bye takes a slight hit for that week.
// The history: a team's price after week w is the roster it had that week, priced on the points through week w. The
// rest-of-season values are today's for every week (there is no history of them), the way the rank history holds its
// roster terms, so the line moves with what players did, who was on a bye and who was on the roster. "Now" is today's
// roster with the coming week's byes.

export const VALUE_W = { ros: 0.55, form: 0.25, rank: 0.2 };
const DECAY = 0.75; // a week further back counts this much of the week after it
const UNPROVEN = 0.85; // no points on record: rest-of-season value alone, marked down
export const BYE_HIT = 0.94; // a week off costs 6% for that week
// how fast a position rank loses worth: twelve quarterbacks start in this league, twenty-four backs and receivers
const RANK_K = { QB: 0.12, RB: 0.05, WR: 0.045, TE: 0.12, K: 0.14, DEF: 0.14 };
const POS_FACTOR = { K: 0.4, DEF: 0.4 };
const FLOOR = 0.4, TOP = 58, CURVE = 1.5; // $0.4M for a roster spot, about $58M for a perfect score

/** a 0..100 score as millions of dollars */
export const priceOf = (score) => FLOOR + TOP * Math.pow(Math.max(0, Math.min(100, score)) / 100, CURVE);
/** $412.6M; with `signed`, +$3.2M / -$3.2M */
export const money = (v, signed = false) => `${signed ? (v < 0 ? '-' : '+') : v < 0 ? '-' : ''}$${Math.abs(v).toFixed(1)}M`;

const rowPts = (r) => (r.players_points && Object.keys(r.players_points).length
  ? r.players_points
  : Object.fromEntries((r.starters || []).map((id, i) => [id, r.starters_points?.[i] ?? 0])));
// a snapshot that kept each week's whole roster (Sleeper's does; the saved fixtures keep the starters only)
const hasBench = (r) => !!r && Array.isArray(r.players) && r.players.length > (r.starters || []).length;

export function teamValues(D, { raw = D.raw } = {}) {
  const H = D.helpers, last = D.meta.lastScored || 0, hasRos = !!D.meta.hasRos;
  const matchups = raw?.matchups || {};
  const byeOf = H.byeOf || (() => null);
  const rows = (w) => (matchups[w] || []).filter((r) => r && r.roster_id != null);

  // every player's points by week, wherever he was rostered
  const pts = {}; // id -> { week: pts }
  for (let w = 1; w <= last; w++) for (const r of rows(w)) for (const [id, p] of Object.entries(rowPts(r))) if (id && id !== '0') (pts[id] ||= {})[w] = Number(p) || 0;
  const ids = Object.keys(pts), posOf = H.posOf;

  // as of each week: total points, weighted points a game, games, the rank at his position and the form score
  const at = []; // at[w] = { id: { total, ppg, games, rank, form } }
  for (let w = 0; w <= last; w++) {
    const snap = {}, byPos = {};
    for (const id of ids) {
      let total = 0, num = 0, den = 0, games = 0;
      for (let v = 1; v <= w; v++) {
        const p = pts[id][v];
        if (p == null) continue;
        total += p;
        if (byeOf(id) === v) continue; // a week off isn't form
        const k = Math.pow(DECAY, w - v);
        num += k * p; den += k; games++;
      }
      if (!games && !total) continue;
      snap[id] = { total, ppg: den ? num / den : 0, games };
      (byPos[posOf(id)] ||= []).push(id);
    }
    for (const list of Object.values(byPos)) {
      list.sort((a, b) => snap[b].total - snap[a].total || (a < b ? -1 : 1));
      list.forEach((id, i) => (snap[id].rank = i + 1));
      // the bar for form: the three best weighted averages at the position (two games or more, once there are any)
      const proven = list.filter((id) => snap[id].games >= Math.min(2, w)), pool = (proven.length >= 3 ? proven : list).map((id) => snap[id].ppg).sort((a, b) => b - a).slice(0, 3);
      const bar = pool.reduce((a, b) => a + b, 0) / (pool.length || 1);
      for (const id of list) snap[id].form = bar > 0 ? Math.max(0, Math.min(1, snap[id].ppg / bar)) * 100 : 0;
    }
    at[w] = snap;
  }

  // one player's price as of week w (w = last for today); `bye` marks the week he sits out
  const price = (id, w, bye = false) => {
    const s = at[Math.min(w, last)]?.[id], pos = posOf(id), ros = H.valueOf(id);
    const rank = s?.games ? 100 * Math.exp(-(RANK_K[pos] ?? 0.08) * (s.rank - 1)) : 0;
    const score = s?.games
      ? (hasRos ? VALUE_W.ros * ros + VALUE_W.form * s.form + VALUE_W.rank * rank : (VALUE_W.form * s.form + VALUE_W.rank * rank) / (VALUE_W.form + VALUE_W.rank))
      : hasRos ? UNPROVEN * ros : 0;
    return { id, pos, score, ros, form: s?.games ? s.form : null, posRank: s?.games ? s.rank : null, ppg: s?.games ? s.ppg : null, total: s?.total ?? 0, games: s?.games ?? 0, bye,
      price: priceOf(score) * (POS_FACTOR[pos] ?? 1) * (bye ? BYE_HIT : 1) };
  };

  const teams = {};
  for (const t of D.teams) {
    const today = (t.players || []).filter(Boolean);
    const series = [];
    for (let w = 1; w <= last; w++) {
      const r = rows(w).find((x) => x.roster_id === t.rid);
      const roster = hasBench(r) ? r.players.filter(Boolean) : today;
      const held = roster.map((id) => price(id, w, byeOf(id) === w));
      series.push({ week: w, label: `Week ${w}`, value: sum(held), byes: held.filter((x) => x.bye).length, n: held.length });
    }
    const holdings = today.map((id) => price(id, last, byeOf(id) === last + 1)).sort((a, b) => b.price - a.price || (a.id < b.id ? -1 : 1));
    const now = sum(holdings);
    series.push({ week: last + 1, label: 'Now', now: true, value: now, byes: holdings.filter((x) => x.bye).length, n: holdings.length });
    // the last three weeks: the three weekly closes before today, and today
    const recent = series.slice(-4), base = recent[0].value, back = Math.max(0, last - 3);
    for (const x of holdings) { const was = price(x.id, back, false).price; x.name = H.nameOf(x.id); x.change = x.price / (x.bye ? BYE_HIT : 1) - was; }
    teams[t.rid] = { rid: t.rid, series, recent, value: now, change: now - base, changePct: base > 0 ? (now - base) / base : 0, holdings };
  }
  const order = D.teams.map((t) => t.rid).sort((a, b) => teams[b].value - teams[a].value || a - b);
  order.forEach((rid, i) => (teams[rid].rank = i + 1));
  const vals = order.map((rid) => teams[rid].value);
  return { last, hasRos, teams, order, avg: sum(vals.map((value) => ({ price: value }))) / (vals.length || 1), price };
}

const sum = (list) => list.reduce((a, x) => a + x.price, 0);
