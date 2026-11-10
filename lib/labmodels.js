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

// "What needs to happen": play out the rest of the regular season (20k seeded seasons, the same model as the playoff
// odds) and keep every game's result and every team's final place, so any team's path can be read off afterwards,
// and conditioned on results the viewer picks, without simulating again.
export function restOfSeason(D, { sims = 20000, seed = 20 } = {}) {
  const teams = D.teams, n = teams.length, P = D.meta.playoffTeams;
  const at = new Map(teams.map((t, i) => [t.rid, i]));
  const weeks = [...new Set(teams.flatMap((t) => (t.schedule || []).map((g) => g.week)))].sort((a, b) => a - b);
  if (!weeks.length) return null;
  const games = [];
  weeks.forEach((w) => teams.forEach((t, i) => {
    const g = (t.schedule || []).find((x) => x.week === w), j = g ? at.get(g.rid) : undefined;
    if (j != null && i < j) games.push({ week: w, a: i, b: j, mu: [t.muWeek?.[w] ?? t.projMean, teams[j].muWeek?.[w] ?? teams[j].projMean], sd: [t.sdWeek?.[w] ?? t.projSd, teams[j].sdWeek?.[w] ?? teams[j].projSd] });
  }));
  const G = games.length;
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // Box-Muller gives two normals per draw; keep the second for the next call (about half the cost on a phone)
  let spare = 0, has = false;
  const gauss = () => {
    if (has) { has = false; return spare; }
    let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand();
    const r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * v;
    spare = r * Math.sin(th); has = true;
    return r * Math.cos(th);
  };
  const baseW = Float64Array.from(teams, (t) => t.wins + 0.5 * (t.ties || 0)), basePf = Float64Array.from(teams, (t) => t.pf);
  const w = new Float64Array(n), pf = new Float64Array(n), order = new Int32Array(n);
  const res = new Uint8Array(sims * G), rank = new Uint8Array(sims * n), wins = new Uint8Array(sims * n);
  for (let s = 0; s < sims; s++) {
    w.set(baseW); pf.set(basePf);
    for (let g = 0; g < G; g++) {
      const { a: x, b: y, mu, sd } = games[g];
      const px = mu[0] + sd[0] * gauss(), py = mu[1] + sd[1] * gauss();
      pf[x] += px; pf[y] += py;
      if (px >= py) { w[x]++; wins[s * n + x]++; res[s * G + g] = 1; } else { w[y]++; wins[s * n + y]++; }
    }
    for (let i = 0; i < n; i++) {
      let j = i;
      while (j > 0 && (w[i] - w[order[j - 1]] || pf[i] - pf[order[j - 1]]) > 0) { order[j] = order[j - 1]; j--; }
      order[j] = i;
    }
    for (let r = 0; r < n; r++) rank[s * n + order[r]] = r;
  }
  return { sims, n, P, weeks, games: games.map(({ week, a, b }) => ({ week, a, b, ra: teams[a].rid, rb: teams[b].rid })), res, rank, wins, rids: teams.map((t) => t.rid) };
}

// One team's path, read off restOfSeason's seasons. picks: { gameIndex: 1 (first team wins) or 0 } keeps only the
// seasons where those results happened, so every number below follows the viewer's scenario.
// Returns the odds, next week's floor and ceiling, which of your games matter most, which other games to watch (and who
// to root for), who needs to lose and when, the wins you need, the most realistic way in, a long shot, and the most
// common ending (record and seed).
export function playoffPath(S, D, rid, { picks = {} } = {}) {
  if (!S) return null;
  const { sims, n, P, games, res, rank, wins } = S, G = games.length;
  const me = S.rids.indexOf(rid);
  if (me < 0) return null;
  const t = D.teams[me];
  const picked = Object.entries(picks).map(([g, v]) => [Number(g), v ? 1 : 0]).filter(([g]) => g >= 0 && g < G);
  const pool = [];
  for (let s = 0; s < sims; s++) if (picked.every(([g, v]) => res[s * G + g] === v)) pool.push(s);
  const N = pool.length;
  const made = (s) => rank[s * n + me] < P;
  const odds = (list) => (list.length ? list.reduce((c, s) => c + made(s), 0) / list.length : null);
  const MIN = 40;
  // every game's swing on your odds: P(in | first team wins) - P(in | second team wins)
  const cnt = new Float64Array(G * 4); // [a won, a won & in, b won, b won & in]
  for (const s of pool) {
    const m = made(s) ? 1 : 0;
    for (let g = 0; g < G; g++) { const k = g * 4 + (res[s * G + g] ? 0 : 2); cnt[k]++; cnt[k + 1] += m; }
  }
  const mine = games.map((g, i) => ({ ...g, i })).filter((g) => g.a === me || g.b === me);
  const info = games.map((g, i) => {
    const nA = cnt[i * 4], nB = cnt[i * 4 + 2];
    const oA = nA >= MIN ? cnt[i * 4 + 1] / nA : null, oB = nB >= MIN ? cnt[i * 4 + 3] / nB : null;
    const swing = oA != null && oB != null ? oA - oB : 0;
    // the side that helps you: the one with the higher odds (for your own games, always you)
    const good = g.a === me ? 'a' : g.b === me ? 'b' : swing >= 0 ? 'a' : 'b';
    const ifGood = good === 'a' ? oA : oB, ifBad = good === 'a' ? oB : oA;
    return { i, week: g.week, ra: g.ra, rb: g.rb, pA: N ? nA / N : 0, oA, oB, swing: Math.abs(swing), root: good === 'a' ? g.ra : g.rb, against: good === 'a' ? g.rb : g.ra, pGood: N ? (good === 'a' ? nA : nB) / N : 0, ifGood, ifBad, picked: i in picks };
  });
  const yours = mine.map((g) => info[g.i]).map((x) => ({ ...x, opp: x.against }));
  const others = info.filter((x) => x.ra !== rid && x.rb !== rid);
  const watch = others.filter((x) => !x.picked && x.swing >= 0.005).sort((p, q) => q.swing - p.swing).slice(0, 8);
  // who needs to lose: rivals whose losses help you, with the weeks they help most
  const byRival = new Map();
  for (const x of others) {
    if (x.picked || x.swing < 0.01) continue;
    const r = byRival.get(x.against) || { rid: x.against, weeks: [], total: 0 };
    r.weeks.push({ week: x.week, swing: x.swing, vs: x.root, i: x.i }); r.total += x.swing; byRival.set(x.against, r);
  }
  const rivals = [...byRival.values()].sort((p, q) => q.total - p.total).slice(0, 5).map((r) => ({ ...r, weeks: r.weeks.sort((p, q) => p.week - q.week) }));

  // wins from here: how often each total happens and how often it gets you in
  const left = mine.length;
  const wc = new Float64Array(left + 1), wm = new Float64Array(left + 1);
  const seed = new Float64Array(n);
  const ends = new Map();
  for (const s of pool) {
    const k = wins[s * n + me], r = rank[s * n + me];
    wc[k]++; wm[k] += r < P ? 1 : 0; seed[r]++;
    const key = k * 100 + r; ends.set(key, (ends.get(key) || 0) + 1);
  }
  const byWins = Array.from({ length: left + 1 }, (_, k) => ({ k, share: N ? wc[k] / N : 0, odds: wc[k] >= MIN ? wm[k] / wc[k] : null }));
  const need = byWins.find((c) => c.odds != null && c.odds >= 0.9)?.k ?? null;
  const seeds = Array.from(seed, (c, r) => ({ seed: r + 1, share: N ? c / N : 0 }));
  const recordAfter = (k) => `${t.wins + k}-${t.losses + left - k}${t.ties ? `-${t.ties}` : ''}`;
  let common = null;
  for (const [key, c] of ends) if (!common || c > common.c) common = { c, k: Math.floor(key / 100), r: key % 100 };
  const ending = common && { record: recordAfter(common.k), wins: common.k, seed: common.r + 1, share: common.c / N, inPlayoffs: common.r < P };

  // next week's floor and ceiling: your odds by Tuesday if this week goes as badly (or as well) as it can. Condition on
  // your own game and then the other games by size of swing, as long as enough seasons are left to say anything
  const firstWeek = S.weeks.find((w) => info.some((x) => x.week === w && !x.picked));
  const bound = (best) => {
    if (firstWeek == null) return null;
    const conds = info.filter((x) => x.week === firstWeek && !x.picked).sort((p, q) => (q.ra === rid || q.rb === rid) - (p.ra === rid || p.rb === rid) || q.swing - p.swing);
    let list = pool, used = [], edge = odds(pool);
    for (const x of conds) {
      if (!x.swing && !(x.ra === rid || x.rb === rid)) continue;
      const want = (x.root === x.ra) === best ? 1 : 0;
      const next = list.filter((s) => res[s * G + x.i] === want);
      if (next.length < MIN) break;
      list = next; used.push({ i: x.i, winner: want ? x.ra : x.rb });
      // the worst (or best) point reached on the way, so a thin last step can't push the floor above the odds
      const o = odds(list); edge = best ? Math.max(edge, o) : Math.min(edge, o);
    }
    return used.length ? { odds: edge, week: firstWeek, results: used } : null;
  };

  // a path: a number of wins from here, the weeks you most likely take them in, and the other results it leans on.
  // Read off the seasons where you get in with exactly that many wins
  const isWin = (s, g) => (res[s * G + g.i] === 1) === (g.a === me);
  const open = others.filter((x) => !x.picked && x.swing >= 0.005);
  const leans = (list, minShare, minLift) => open.map((x) => {
    const good = x.root === x.ra ? 1 : 0;
    const share = list.reduce((c, s) => c + (res[s * G + x.i] === good), 0) / list.length;
    return { ...x, share, lift: share - x.pGood };
  }).filter((x) => x.share >= minShare && x.lift >= minLift).sort((p, q) => q.lift - p.lift).slice(0, 3);
  const pathOf = (k, minShare, minLift) => {
    const list = pool.filter((s) => made(s) && wins[s * n + me] === k);
    const results = mine.map((g) => ({ week: g.week, opp: g.a === me ? g.rb : g.ra, share: list.reduce((c, s) => c + isWin(s, g), 0) / list.length }));
    const top = new Set([...results].sort((p, q) => q.share - p.share).slice(0, k).map((r) => r.week));
    return {
      wins: k, record: recordAfter(k), results: results.map((r) => ({ ...r, win: top.has(r.week) })),
      chance: N ? list.length / N : 0, // how often you get in this way
      oddsIf: byWins[k].odds, // your odds if you win exactly this many
      helps: leans(list, minShare, minLift),
    };
  };
  const madeAt = byWins.map((c, k) => wm[k]);
  let realistic = null, longshot = null;
  if (madeAt.some((c) => c > 0)) {
    const best = madeAt.reduce((b, c, k) => (c > madeAt[b] ? k : b), 0);
    realistic = pathOf(best, 0.55, 0.04);
    // the long shot: the fewest wins that still get you in a handful of seasons
    const fewest = madeAt.findIndex((c) => c >= 8);
    if (fewest >= 0 && fewest < best) longshot = pathOf(fewest, 0.6, 0.08);
  }
  return {
    rid, sims, matches: N, odds: odds(pool), weeks: S.weeks, left, picks,
    floor: bound(false), ceiling: bound(true),
    yours, watch, rivals, byWins, need, seeds, ending, realistic, longshot, games: info,
  };
}
