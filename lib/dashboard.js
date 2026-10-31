// The team dashboard's numbers (Nerd lab, #lab/team): everything one team's seven paper widgets show. Pure, like the
// engine, and tested by scripts/test-dashboard.mjs; the widgets themselves are React components in src/dashboard.

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
  };
}

// a player's points in one week's matchup row
export const weekPts = (r, id) => r.players_points?.[id] ?? (r.starters || []).reduce((a, x, i) => (x === id ? r.starters_points?.[i] ?? 0 : a), 0);
