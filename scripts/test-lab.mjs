// Nerd lab models against the saved Week 7 fixture: "What it takes" (P(playoffs | win k more)) and "Fluke or for real?"
// (empirical-Bayes shrinkage). Prints both tables and checks the invariants.
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { whatItTakes, trueTalent, restOfSeason, playoffPath } from '../lib/labmodels.js';

const fx = buildFixture();
const D = computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week,
});
const name = (rid) => D.byRid[rid].name.padEnd(22).slice(0, 22);
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };

const t0 = Date.now();
const W = whatItTakes(D);
console.log(`what it takes: ${W.sims} seasons over weeks ${W.weeks.join(', ')} in ${Date.now() - t0}ms`);
console.log(`${''.padEnd(22)} ${W.rows[0].cells.map((c) => String(c.k).padStart(4)).join('')}   magic  engine  here`);
for (const r of W.rows) {
  const t = D.byRid[r.rid];
  console.log(`${name(r.rid)} ${r.cells.map((c) => (c.odds == null ? '   ·' : String(Math.round(c.odds * 100)).padStart(4))).join('')}   ${String(r.magic ?? '-').padStart(5)}  ${(t.playoffPct * 100).toFixed(0).padStart(5)}%  ${(r.overall * 100).toFixed(0).padStart(3)}%`);
  const share = r.cells.reduce((a, c) => a + c.share, 0);
  if (Math.abs(share - 1) > 1e-9) fail(`${t.name}: win-count shares add to ${share}`);
  // the same model as the playoff odds, so the overall number should land close to the engine's
  if (Math.abs(r.overall - t.playoffPct) > 0.04) fail(`${t.name}: ${r.overall.toFixed(3)} here vs ${t.playoffPct.toFixed(3)} in the engine`);
  // more wins never hurts (allowing a little simulation noise in thin cells)
  const known = r.cells.filter((c) => c.odds != null);
  known.forEach((c, i) => { if (i && c.odds < known[i - 1].odds - 0.06) fail(`${t.name}: odds drop from ${known[i - 1].k} to ${c.k} wins`); });
}
const again = whatItTakes(D);
if (JSON.stringify(again) !== JSON.stringify(W)) fail('whatItTakes is not deterministic');

const T = trueTalent(D);
console.log(`\nfluke or for real: sigma ${T.sigma.toFixed(1)} pts/wk, tau ${T.tau.toFixed(1)}, league avg ${T.avg.toFixed(1)}, roster prior ${T.hasRos}`);
for (const r of T.rows) {
  console.log(`${name(r.rid)} so far ${r.obs.toFixed(1).padStart(6)}  roster ${r.prior.toFixed(1).padStart(6)}  guess ${r.est.toFixed(1).padStart(6)} [${r.lo.toFixed(1)}–${r.hi.toFixed(1)}]  shift ${(r.shift >= 0 ? '+' : '') + r.shift.toFixed(1)}  scores count ${(r.weight * 100).toFixed(0)}%  ${r.verdict}`);
  const lo = Math.min(r.obs, r.prior) - 1e-9, hi = Math.max(r.obs, r.prior) + 1e-9;
  if (r.est < lo || r.est > hi) fail(`${D.byRid[r.rid].name}: estimate outside the scores-to-roster range`);
  if (!(r.lo < r.est && r.est < r.hi)) fail(`${D.byRid[r.rid].name}: estimate outside its own range`);
}
if (T.rows.some((r, i) => i && r.est > T.rows[i - 1].est)) fail('rows not sorted by estimate');

// "What needs to happen": 20k seasons, then each team's path read off them
const t1 = Date.now();
const S = restOfSeason(D);
console.log(`\nwhat needs to happen: ${S.sims} seasons, ${S.games.length} games in ${Date.now() - t1}ms`);
for (const t of D.teams) {
  const p = playoffPath(S, D, t.rid);
  const fl = p.floor?.odds, ce = p.ceiling?.odds;
  console.log(`${name(t.rid)} ${(p.odds * 100).toFixed(1).padStart(5)}%  floor ${fl == null ? '-' : (fl * 100).toFixed(0).padStart(3)}  ceiling ${ce == null ? '-' : (ce * 100).toFixed(0).padStart(3)}  need ${String(p.need ?? '-').padStart(2)}  usual ${p.ending.record} (${p.ending.seed})  realistic ${p.realistic?.record ?? '-'}  long shot ${p.longshot?.record ?? '-'}  rivals ${p.rivals.length}`);
  if (Math.abs(p.odds - t.playoffPct) > 0.04) fail(`${t.name}: path odds ${p.odds.toFixed(3)} vs engine ${t.playoffPct.toFixed(3)}`);
  if (fl != null && ce != null && !(fl <= p.odds + 1e-9 && p.odds <= ce + 1e-9)) fail(`${t.name}: odds outside floor and ceiling`);
  const seeds = p.seeds.reduce((a, x) => a + x.share, 0);
  if (Math.abs(seeds - 1) > 1e-9) fail(`${t.name}: seed shares add to ${seeds}`);
  if (p.yours.length !== p.left) fail(`${t.name}: ${p.yours.length} games listed for ${p.left} left`);
  if (p.yours.some((x) => x.ifGood != null && x.ifBad != null && x.ifGood < x.ifBad - 0.02)) fail(`${t.name}: a win hurts`);
  if (p.longshot && p.realistic && p.longshot.wins >= p.realistic.wins) fail(`${t.name}: long shot needs as many wins as the realistic path`);
  // picking your own next game reads the same number as that game's 'if you win'
  const g = p.yours[0];
  if (g && g.ifGood != null) {
    const q = playoffPath(S, D, t.rid, { picks: { [g.i]: g.ra === t.rid ? 1 : 0 } });
    if (Math.abs(q.odds - g.ifGood) > 1e-9) fail(`${t.name}: picked win reads ${q.odds} vs ${g.ifGood}`);
  }
}
const S2 = restOfSeason(D);
if (S2.res.some((v, i) => v !== S.res[i]) || S2.rank.some((v, i) => v !== S.rank[i])) fail('restOfSeason is not deterministic');
if (!process.exitCode) console.log('\nok   all three lab models hold their invariants');
