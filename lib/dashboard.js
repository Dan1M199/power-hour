// The team dashboard's numbers (Nerd lab, #lab/team): everything one team's eight paper widgets show. Pure, like the
// engine, and tested by scripts/test-dashboard.mjs; the widgets themselves are React components in src/dashboard.
import { bestLineup } from './engine.js';

const SKILL = ['QB', 'RB', 'WR', 'TE'];

// ---------- the numbers ----------
export function dashData(D, rid, { raw = D.raw, ros = {} } = {}) {
  const t = D.byRid[rid];
  if (!t) return null;
  const n = D.teams.length, H = D.helpers, last = D.meta.lastScored || 0;
  const matchups = raw?.matchups || {};
  const rowOf = (w) => (matchups[w] || []).find((m) => m.roster_id === rid);

  // a player's scored weeks on this roster (bench weeks included: it's what he did, not what was started). Sleeper
  // gives every rostered player's points; a snapshot that only kept the starters' falls back to those.
  const weeksOf = (id) => {
    const out = [];
    for (let w = 1; w <= last; w++) {
      const r = rowOf(w);
      if (r?.players?.includes(id)) out.push({ week: w, pts: weekPts(r, id) });
    }
    return out;
  };
  const stars = (t.rosLineup || []).filter((l) => l && SKILL.includes(H.posOf(l.id)))
    .map((l) => l.id).sort((a, b) => H.valueOf(b) - H.valueOf(a)).slice(0, 6)
    .map((id) => {
      const info = H.player(id) || {}, wk = weeksOf(id), season = wk.reduce((a, x) => a + x.pts, 0);
      return {
        id, name: H.nameOf(id), pos: info.pos, nfl: info.team, prk: ros[id]?.prk ?? null, value: H.valueOf(id),
        perWeek: H.effWeekly(id), season, games: wk.length, avg: wk.length ? season / wk.length : null, last5: wk.slice(-5),
        week: { pre: info.pre ?? 0, now: info.proj ?? 0, played: !!info.played, floor: info.floor, ceil: info.ceil, bye: !!info.bye, out: !!info.out },
      };
    });

  // this week's game, from the previews
  const p = (D.previews || []).find((x) => x.a === rid || x.b === rid);
  const game = p ? { opp: D.byRid[p.a === rid ? p.b : p.a], win: p.a === rid ? p.winA : 1 - p.winA, week: p.week } : null;

  const effs = D.teams.filter((x) => x.efficiency != null).map((x) => x.efficiency).sort((a, b) => b - a);
  const scores = (D.weekly || []).flatMap((w) => Object.values(w.scores));
  const avgPpg = D.teams.reduce((a, x) => a + (x.pfPerGame || 0), 0) / n;

  return {
    t, n, game,
    odds: { playoff: t.playoffPct ?? 0, bye: t.byePct ?? 0, champ: t.champPct ?? 0, ifWin: t.playoffIfWin ?? null, ifLoss: t.playoffIfLoss ?? null },
    stars,
    efficiency: t.efficiency == null ? null : { eff: t.efficiency, left: t.leftOnBench ?? 0, rank: effs.indexOf(t.efficiency) + 1, of: effs.length },
    scoring: {
      ppg: t.pfPerGame || 0, avg: avgPpg, max: scores.length ? Math.max(...scores) : 1,
      best: t.best?.pts ?? null,
      weeks: (t.weeks || []).slice(-7).map((w) => ({ week: w.week, pts: w.pts, result: w.result, rank: w.rank, opp: D.byRid[w.opp] || null, oppPts: w.oppPts })),
    },
    groups: SKILL.map((pos) => ({ pos, rank: t.posRanks?.[pos] ?? null, top: (t.rosLineup || []).find((l) => l && H.posOf(l.id) === pos)?.id ?? null })),
    schedule: (t.schedule || []).map((g) => ({ week: g.week, opp: D.byRid[g.rid], win: g.pWin, proj: g.proj })),
    luck: {
      record: { w: t.wins, l: t.losses, tie: t.ties || 0 },
      allPlay: { w: Math.round(t.allPlayW || 0), l: Math.round(t.allPlayL || 0) },
      expected: t.expectedWins ?? 0, luck: t.luck ?? 0,
    },
    faceoff: faceOff(D, rid, game?.opp?.rid),
  };
}

// ---------- face off: this team against each of the others ----------
// Four numbers per rival, all from the model the playoff odds use:
// - odds: P(beat them on an average week from here), each side's strength `projMean` (the roster's projection blended
//   with points per game) and its own weekly spread (the team's SD of scores, shrunk toward the league's pooled SD
//   since a few games say little about spread);
// - ghost: the record if they'd met every week so far, from the real scores (the week they really met is marked);
// - breakEven: the worst week (a percentile of your own scoring) that still makes you the favourite;
// - heist: the one player of theirs who adds the most to your best rest-of-season lineup (the lineup's gain, not his
//   value: a star at a position you're already set at adds nothing), what losing him costs them, the same the other
//   way, and the odds after the steal and after a straight swap of the two.
// Rivals come this week's opponent first, then the closest odds.
export function faceOff(D, rid, oppRid = null) {
  const t = D.byRid[rid];
  if (!t || D.teams.length < 2) return null;
  const H = D.helpers, slots = D.meta.slots, pooled = D.meta.sd || 22;
  const k = D.meta.hasRos ? 0.65 * (D.meta.scale || 1) : 0; // a lineup point a week, in projMean's points
  const memo = new Map(), eff = (id) => { if (!memo.has(id)) memo.set(id, H.effWeekly(id)); return memo.get(id); };
  const lineup = (ids) => bestLineup(ids, slots, eff, H.posOf).total;
  const spread = (x) => { const g = x.games || 0, c = x.consistency || pooled; return Math.sqrt((g * c * c + 4 * pooled * pooled) / (g + 4)); };
  const mu = (x) => x.projMean ?? x.pfPerGame ?? 0;
  const win = (a, b, sa, sb) => phi((a - b) / Math.sqrt(sa * sa + sb * sb));
  const base = lineup(t.players), sdA = spread(t);
  // the player whose arrival adds the most to `to`'s best lineup, taken from `from`
  const best = (to, toBase, from, fromBase) => {
    let top = null;
    for (const id of from.players) {
      if (eff(id) == null) continue;
      const gain = lineup([...to.players, id]) - toBase;
      if (!top || gain > top.gain) top = { id, gain };
    }
    if (!top || top.gain < 0.05) return null;
    return { ...top, name: H.nameOf(top.id), pos: H.posOf(top.id), nfl: H.player(top.id)?.team || null, loss: lineup(from.players.filter((x) => x !== top.id)) - fromBase };
  };

  const rivals = D.teams.filter((o) => o.rid !== rid).map((o) => {
    const muA = mu(t), muB = mu(o), sdB = spread(o), oBase = lineup(o.players);
    const odds = win(muA, muB, sdA, sdB);
    const theirs = new Map(o.weeks.map((w) => [w.week, w]));
    const weeks = t.weeks.filter((w) => theirs.has(w.week)).map((w) => ({ week: w.week, a: w.pts, b: theirs.get(w.week).pts, real: w.opp === o.rid }));
    const ghost = { w: weeks.filter((x) => x.a > x.b).length, l: weeks.filter((x) => x.a < x.b).length, t: weeks.filter((x) => x.a === x.b).length, weeks };
    let heist = null;
    if (k) {
      const take = best(t, base, o, oBase), give = best(o, oBase, t, base);
      if (take) {
        const steal = win(muA + k * take.gain, muB + k * take.loss, sdA, sdB);
        let swap = null;
        if (give && give.id !== take.id) {
          const mine = t.players.filter((x) => x !== give.id).concat(take.id), yours = o.players.filter((x) => x !== take.id).concat(give.id);
          swap = win(muA + k * (lineup(mine) - base), muB + k * (lineup(yours) - oBase), sdA, sdB);
        }
        heist = { take, give, steal, swap, k };
      }
    }
    return { rid: o.rid, opp: o, muA, muB, sdA, sdB, odds, breakEven: phi((muB - muA) / sdA), ghost, heist };
  });
  rivals.sort((a, b) => (b.rid === oppRid) - (a.rid === oppRid) || Math.abs(a.odds - 0.5) - Math.abs(b.odds - 0.5));
  return { rivals, thisWeek: oppRid };
}

// P(win) when your week lands on percentile q of your own scoring: their score against that number
export const winAt = (r, q, dA = 0, dB = 0) => phi((r.muA + dA + probit(q) * r.sdA - r.muB - dB) / r.sdB);
// your score at percentile q
export const scoreAt = (r, q, dA = 0) => r.muA + dA + probit(q) * r.sdA;

/** the standard normal CDF (Abramowitz-Stegun 26.2.17, error under 1e-7) */
export function phi(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
/** its inverse, by bisection (plenty for a slider) */
export function probit(q) {
  let lo = -6, hi = 6;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (phi(m) < q) lo = m; else hi = m; }
  return (lo + hi) / 2;
}

// a player's points in one week's matchup row
export const weekPts = (r, id) => r.players_points?.[id] ?? (r.starters || []).reduce((a, x, i) => (x === id ? r.starters_points?.[i] ?? 0 : a), 0);
