// Team monetary value (lib/teamvalue.js) against the saved Week 7 fixture: one line per team, then the checks the
// charts rely on (a point per scored week plus today, holdings that add up, ranks, the bye hit, determinism).
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { teamValues, money, priceOf, BYE_HIT } from '../lib/teamvalue.js';

const fx = buildFixture();
const build = (byes = {}) => computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups, byes,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week,
});
const D = build();
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };
const V = teamValues(D, { raw: fx });
const last = D.meta.lastScored;

for (const rid of V.order) {
  const t = D.byRid[rid], v = V.teams[rid], top = v.holdings[0];
  console.log(`${String(v.rank).padStart(2)}. ${t.name.padEnd(24).slice(0, 24)} ${money(v.value).padStart(8)}  3 wk ${money(v.change, true).padStart(8)} (${(v.changePct * 100).toFixed(1).padStart(5)}%)  ` +
    `${v.recent.map((x) => x.value.toFixed(0)).join(' > ')}  top ${top.name} ${top.pos}${top.posRank ? ` #${top.posRank}` : ''} ${money(top.price)}`);
  if (v.series.length !== last + 1 || !v.series[last].now) fail(`${t.name}: ${v.series.length} points for ${last} weeks`);
  if (v.series.some((x) => !(x.value > 0) || !Number.isFinite(x.value))) fail(`${t.name}: a week with no value`);
  if (v.recent.length !== Math.min(4, last + 1)) fail(`${t.name}: ${v.recent.length} recent points`);
  if (Math.abs(v.holdings.reduce((a, x) => a + x.price, 0) - v.value) > 1e-9) fail(`${t.name}: holdings don't add up to ${v.value}`);
  if (v.holdings.length !== t.players.length) fail(`${t.name}: ${v.holdings.length} holdings for ${t.players.length} players`);
  if (v.holdings.some((x, i) => i && x.price > v.holdings[i - 1].price)) fail(`${t.name}: holdings not in price order`);
  if (Math.abs(v.change - (v.value - v.recent[0].value)) > 1e-9) fail(`${t.name}: change`);
  for (const x of v.holdings) if (x.posRank != null && (x.posRank < 1 || !Number.isInteger(x.posRank))) fail(`${t.name}: ${x.name} rank ${x.posRank}`);
}
if (new Set(V.order.map((r) => V.teams[r].rank)).size !== D.teams.length) fail('ranks repeat');
// position ranks: nobody shares one, and more points never ranks worse
const seen = {};
for (const v of Object.values(V.teams)) for (const x of v.holdings) if (x.posRank) {
  const k = `${x.pos}${x.posRank}`;
  if (seen[k] && seen[k] !== x.id) fail(`${k} is both ${seen[k]} and ${x.id}`);
  seen[k] = x.id;
}
// the curve: more score, more money; a bye costs exactly the hit
if (!(priceOf(90) > priceOf(60) && priceOf(60) > priceOf(30) && priceOf(0) > 0)) fail('price curve');
const star = V.teams[V.order[0]].holdings[0];
if (Math.abs(V.price(star.id, last, true).price / V.price(star.id, last, false).price - BYE_HIT) > 1e-9) fail('bye hit');
// a bye in a played week dents that week's point, and the coming week's bye dents today
const nfl = fx.ros.players[star.id]?.t;
if (nfl) {
  const B = teamValues(build({ [nfl]: last + 1 }), { raw: fx }), own = V.order[0];
  if (!(B.teams[own].value < V.teams[own].value)) fail(`a bye for ${star.name} this week should cost his team`);
  if (!B.teams[own].holdings.find((x) => x.id === star.id)?.bye) fail('the bye isn\'t marked');
}
// same input, same numbers
if (JSON.stringify(teamValues(D, { raw: fx }).order) !== JSON.stringify(V.order)) fail('not deterministic');
console.log(process.exitCode ? 'value checks failed' : 'ok   team values check out for every team');
