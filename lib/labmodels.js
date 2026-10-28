// Two Nerd lab models, pure like the engine (no DOM, runs in the browser and in Node). Both are deterministic: the
// simulation is seeded, so every device shows the same numbers from the same snapshot.

// "What it takes": play out the rest of the regular season many times and, in each simulated season, note how many
// of its remaining games every team won and whether it made the playoffs. Grouping the seasons by that win count
// gives P(playoffs | win k more), the chart a manager actually wants: how many of these do I need?
// Same model as the playoff odds (each team's week-specific mean and spread, standings by wins then points for),
// with its own seed.
export function whatItTakes(D, { sims = 16000, seed = 14 } = {}) {
  const teams = D.teams, n = teams.length, P = D.meta.playoffTeams;
  const at = new Map(teams.map((t, i) => [t.rid, i]));
  const weeks = [...new Set(teams.flatMap((t) => (t.schedule || []).map((g) => g.week)))].sort((a, b) => a - b);
  if (!weeks.length) return null;
  // each week's games as index pairs, every game once
  const games = weeks.map((w) => {
    const out = [];
    teams.forEach((t, i) => { const g = (t.schedule || []).find((x) => x.week === w); const j = g ? at.get(g.rid) : undefined; if (j != null && i < j) out.push(i, j); });
    return Int32Array.from(out);
  });
  const MU = weeks.map((w) => Float64Array.from(teams, (t) => (t.muWeek || {})[w] ?? t.projMean));
  const SD = weeks.map((w) => Float64Array.from(teams, (t) => (t.sdWeek || {})[w] ?? t.projSd));
  const left = Int32Array.from(teams, (t) => (t.schedule || []).length);
  const R = Math.max(...left);
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const baseW = Float64Array.from(teams, (t) => t.wins + 0.5 * (t.ties || 0)), basePf = Float64Array.from(teams, (t) => t.pf);
  const w = new Float64Array(n), pf = new Float64Array(n), extra = new Int32Array(n), order = new Int32Array(n);
  const seen = new Float64Array(n * (R + 1)), made = new Float64Array(n * (R + 1));
  for (let s = 0; s < sims; s++) {
    w.set(baseW); pf.set(basePf); extra.fill(0);
    for (let k = 0; k < games.length; k++) {
      const g = games[k], mu = MU[k], sd = SD[k];
      for (let j = 0; j < g.length; j += 2) {
        const x = g[j], y = g[j + 1], px = mu[x] + sd[x] * gauss(), py = mu[y] + sd[y] * gauss();
        pf[x] += px; pf[y] += py;
        if (px >= py) { w[x]++; extra[x]++; } else { w[y]++; extra[y]++; }
      }
    }
    // standings: wins, then points for
    for (let i = 0; i < n; i++) {
      let j = i;
      while (j > 0 && (w[i] - w[order[j - 1]] || pf[i] - pf[order[j - 1]]) > 0) { order[j] = order[j - 1]; j--; }
      order[j] = i;
    }
    for (let r = 0; r < n; r++) {
      const i = order[r], cell = i * (R + 1) + extra[i];
      seen[cell]++;
      if (r < P) made[cell]++;
    }
  }
  // a conditional share needs enough seasons behind it to mean anything; thinner cells come back null
  const MIN = Math.max(30, sims * 0.002);
  const rows = teams.map((t, i) => {
    const cells = [];
    for (let k = 0; k <= left[i]; k++) {
      const c = seen[i * (R + 1) + k];
      cells.push({ k, share: c / sims, odds: c >= MIN ? made[i * (R + 1) + k] / c : null });
    }
    const overall = cells.reduce((acc, c) => acc + (c.odds ?? 0) * c.share, 0);
    const likely = cells.reduce((b, c) => (c.share > b.share ? c : b), cells[0]).k;
    // the magic number: fewest further wins that get them in at least 90% of the time
    const magic = cells.find((c) => c.odds != null && c.odds >= 0.9)?.k ?? null;
    const coin = cells.find((c) => c.odds != null && c.odds >= 0.5)?.k ?? null;
    return { rid: t.rid, left: left[i], cells, overall, likely, magic, coin };
  });
  return { sims, weeks, rows };
}

// "Fluke or for real?": empirical-Bayes shrinkage. Six or seven games is a small sample, so each team's scoring so far
// is blended with what its current roster projects (the prior). How much the scores count comes from the data
// itself: the league's week-to-week noise within teams (sigma) against how far teams' real averages have strayed
// from their projections beyond that noise (tau). Out comes each team's best guess of its true weekly scoring from
// here, with an 80% range, and how far a hot or cold start should come back.
export function trueTalent(D) {
  const teams = D.teams.filter((t) => t.weeks?.length);
  if (teams.length < 4) return null;
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
  const obs = teams.map((t) => mean(t.weeks.map((w) => w.pts)));
  const ns = teams.map((t) => t.weeks.length);
  // sigma^2: pooled within-team variance of weekly scores
  let ss = 0, dof = 0;
  teams.forEach((t, i) => { t.weeks.forEach((w) => (ss += (w.pts - obs[i]) ** 2)); dof += t.weeks.length - 1; });
  const sigma2 = dof > 0 ? ss / dof : 22 ** 2;
  // the prior: the roster's projected weekly points, put on the league's actual scoring scale
  const avgObs = mean(obs);
  const hasRos = D.meta.hasRos && teams.every((t) => t.rosProj > 0);
  const avgProj = hasRos ? mean(teams.map((t) => t.rosProj)) : 1;
  const prior = teams.map((t) => (hasRos ? t.rosProj * (avgObs / avgProj) : avgObs));
  // tau^2 by the method of moments: spread of (scoring - prior) beyond what sampling noise explains. Floored at 6 pts a
  // week, about how far good projections miss a team's season average: the projections already lean on this season's
  // results, so with a dozen teams the raw estimate tends to land near zero and would let the scores count for nothing
  const excess = mean(obs.map((m, i) => (m - prior[i]) ** 2)) - mean(ns.map((k) => sigma2 / k));
  const tau2 = Math.min(30 ** 2, Math.max(6 ** 2, excess));
  const z80 = 1.2816;
  const rows = teams.map((t, i) => {
    const precision = 1 / tau2 + ns[i] / sigma2;
    const est = (prior[i] / tau2 + (ns[i] * obs[i]) / sigma2) / precision;
    const sd = Math.sqrt(1 / precision);
    const shift = est - obs[i];
    return {
      rid: t.rid, games: ns[i], obs: obs[i], prior: prior[i], est, lo: est - z80 * sd, hi: est + z80 * sd, shift,
      weight: ns[i] / sigma2 / precision, // how much of the guess the team's own scores carry
      verdict: shift <= -4 ? 'hot' : shift >= 4 ? 'under' : 'real',
    };
  }).sort((a, b) => b.est - a.est);
  return { sigma: Math.sqrt(sigma2), tau: Math.sqrt(tau2), avg: avgObs, hasRos, rows };
}
