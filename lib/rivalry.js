// Bragging rights (5.0, Nov 12): the competition between teams, pure like the engine, read off computeLeague's output.
// - crowns(D): every scored week hands out six crowns (high score, blowout, stole one, robbed, basement, benched it);
//   each team's shelf counts them by kind, and `latest` is the last scored week's.
// - bounties(D): win streaks of two or more carry a bounty (one per straight win, double while unbeaten), with the next
//   opponent and their odds to collect; skids of three or more are flagged with the game that can end them; giant
//   killers count wins over teams ranked above them today.
// - tape(D, a, b): two teams side by side: the stat lines with a winner per line, the real meetings, the every-week
//   record (who outscored whom in the same weeks), the crowns, and the next scheduled meeting with its odds.
// Never touches the DOM; scripts/test-rivalry.mjs checks it against the fixture.

export const CROWNS = [
  { key: 'high', label: 'High score', kind: 'glory', says: 'Top score of the week' },
  { key: 'blowout', label: 'Blowout', kind: 'glory', says: 'Biggest winning margin of the week' },
  { key: 'stole', label: 'Stole one', kind: 'luck', says: 'Fewest points in a win' },
  { key: 'robbed', label: 'Robbed', kind: 'luck', says: 'Most points in a loss' },
  { key: 'low', label: 'Basement', kind: 'shame', says: 'Lowest score of the week' },
  { key: 'bench', label: 'Benched it', kind: 'shame', says: 'Most points left on the bench' },
];

const by = (list, f, dir = 1) => list.reduce((best, x) => (f(x) == null ? best : !best || dir * (f(x) - f(best)) > 0 ? x : best), null);

/** Every scored week's crowns, and each team's shelf. */
export function crowns(D) {
  if (D._crowns) return D._crowns;
  const weeks = [...new Set(D.teams.flatMap((t) => t.weeks.map((w) => w.week)))].sort((a, b) => a - b);
  const shelf = Object.fromEntries(D.teams.map((t) => [t.rid, Object.fromEntries(CROWNS.map((c) => [c.key, 0]))]));
  const byWeek = weeks.map((week) => {
    const rows = D.teams.map((t) => ({ t, w: t.weeks.find((x) => x.week === week) })).filter((r) => r.w);
    const played = rows.filter((r) => r.w.result);
    const wins = played.filter((r) => r.w.result === 'W'), losses = played.filter((r) => r.w.result === 'L');
    const pick = {
      high: by(rows, (r) => r.w.pts),
      blowout: by(wins, (r) => r.w.pts - r.w.oppPts),
      stole: by(wins, (r) => r.w.pts, -1),
      robbed: by(losses, (r) => r.w.pts),
      low: by(rows, (r) => r.w.pts, -1),
      bench: by(rows.filter((r) => r.w.optimal != null), (r) => r.w.optimal - r.w.pts),
    };
    const out = {};
    for (const c of CROWNS) {
      const r = pick[c.key];
      if (!r) continue;
      const value = c.key === 'blowout' ? r.w.pts - r.w.oppPts : c.key === 'bench' ? r.w.optimal - r.w.pts : r.w.pts;
      if (c.key === 'bench' && value < 0.05) continue;
      shelf[r.t.rid][c.key]++;
      out[c.key] = { rid: r.t.rid, value: Math.round(value * 10) / 10, opp: r.w.opp, oppPts: r.w.oppPts };
    }
    return { week, crowns: out };
  });
  const score = (s) => ({ glory: s.high + s.blowout, luck: s.stole - s.robbed, shame: s.low + s.bench });
  const table = D.teams.map((t) => ({ rid: t.rid, counts: shelf[t.rid], ...score(shelf[t.rid]) }))
    .sort((a, b) => b.glory - a.glory || a.shame - b.shame || (D.byRid[a.rid].powerRank - D.byRid[b.rid].powerRank));
  const res = { weeks: byWeek, latest: byWeek[byWeek.length - 1] || null, table, shelf };
  Object.defineProperty(D, '_crowns', { value: res, enumerable: false, configurable: true });
  return res;
}

const streakOf = (t) => {
  const m = /^([WLT])(\d+)$/.exec(t.streak || '');
  return m ? { kind: m[1], n: Number(m[2]) } : null;
};

/** Win streaks with a price on them, skids that might end, and the giant killers. */
export function bounties(D) {
  const next = (t) => {
    const g = t.schedule?.[0];
    if (!g) return null;
    const o = D.byRid[g.rid];
    return o ? { week: g.week, rid: o.rid, pWin: g.pWin } : null;
  };
  const hot = [], cold = [];
  for (const t of D.teams) {
    const s = streakOf(t);
    if (!s || s.n < 2) continue;
    const n = next(t);
    if (s.kind === 'W') {
      const unbeaten = t.losses === 0 && t.ties === 0;
      hot.push({ rid: t.rid, n: s.n, unbeaten, bounty: s.n * (unbeaten ? 2 : 1), next: n, collect: n ? 1 - n.pWin : null });
    } else if (s.kind === 'L' && s.n >= 3) {
      const winless = t.wins === 0 && t.ties === 0;
      cold.push({ rid: t.rid, n: s.n, winless, next: n, snap: n ? n.pWin : null });
    }
  }
  hot.sort((a, b) => b.bounty - a.bounty || (a.collect ?? 1) - (b.collect ?? 1));
  cold.sort((a, b) => b.n - a.n);
  const killers = D.teams.map((t) => {
    const scalps = t.weeks.filter((w) => w.result === 'W' && D.byRid[w.opp] && D.byRid[w.opp].powerRank < t.powerRank)
      .map((w) => ({ week: w.week, rid: w.opp, rank: D.byRid[w.opp].powerRank }));
    return { rid: t.rid, scalps };
  }).filter((k) => k.scalps.length).sort((a, b) => b.scalps.length - a.scalps.length || D.byRid[b.rid].powerRank - D.byRid[a.rid].powerRank);
  return { hot, cold, killers: killers.slice(0, 4) };
}

/** Two teams, line by line. Each line names the side it favours ('a', 'b' or null for level). */
export function tape(D, a, b) {
  const A = D.byRid[a], B = D.byRid[b];
  if (!A || !B || a === b) return null;
  const { shelf } = crowns(D);
  const glory = (rid) => shelf[rid].high + shelf[rid].blowout;
  const best = (t) => (t.best ? t.best.pts : null);
  const line = (key, label, va, vb, { low = false, fmt = 'num' } = {}) => {
    const lead = va == null || vb == null || Math.abs(va - vb) < 1e-9 ? null : (va > vb) !== low ? 'a' : 'b';
    return { key, label, a: va, b: vb, lead, fmt };
  };
  const lines = [
    line('rank', 'Power rank', A.powerRank, B.powerRank, { low: true, fmt: 'rank' }),
    line('wins', 'Wins', A.wins + 0.5 * A.ties, B.wins + 0.5 * B.ties, { fmt: 'record' }),
    line('ppg', 'Points a game', A.pfPerGame, B.pfPerGame, { fmt: 'f1' }),
    line('allplay', 'All-play', A.allPlayPct, B.allPlayPct, { fmt: 'pct' }),
    line('best', 'Best week', best(A), best(B), { fmt: 'f1' }),
    line('playoffs', 'Playoff odds', A.playoffPct, B.playoffPct, { fmt: 'pct' }),
    line('glory', 'Crowns won', glory(a), glory(b), { fmt: 'int' }),
  ];
  // the real meetings, and the every-week record: the weeks both played, who scored more
  const theirs = new Map(B.weeks.map((w) => [w.week, w]));
  const same = A.weeks.filter((w) => theirs.has(w.week)).map((w) => ({ week: w.week, a: w.pts, b: theirs.get(w.week).pts, real: w.opp === b }));
  const meetings = same.filter((x) => x.real);
  const every = { a: same.filter((x) => x.a > x.b).length, b: same.filter((x) => x.a < x.b).length, weeks: same };
  // the next time they meet on the schedule, with A's odds from the engine's projection
  const g = (A.schedule || []).find((s) => s.rid === b);
  const nextMeet = g ? { week: g.week, pA: g.pWin } : null;
  const edges = lines.reduce((n, l) => n + (l.lead === 'a' ? 1 : l.lead === 'b' ? -1 : 0), 0) + Math.sign(every.a - every.b);
  return { a: A, b: B, lines, meetings, every, nextMeet, edge: edges > 0 ? 'a' : edges < 0 ? 'b' : null };
}

/** The pairing to open on: you against this week's opponent (else your closest rival in the ranks), or No. 1 vs No. 2. */
export function defaultPair(D, me) {
  const t = me != null ? D.byRid[me] : null;
  if (t) {
    const g = t.schedule?.[0];
    if (g && D.byRid[g.rid]) return [t.rid, g.rid];
    const near = D.teams.filter((o) => o.rid !== t.rid).sort((x, y) => Math.abs(x.powerRank - t.powerRank) - Math.abs(y.powerRank - t.powerRank))[0];
    return [t.rid, near.rid];
  }
  return [D.teams[0].rid, D.teams[1].rid];
}
