// Bragging rights (lib/rivalry.js) against the saved Week 7 fixture: the crowns per week and on the shelves, the bounties
// and skids, and the tale of the tape for every pair of teams.
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { CROWNS, crowns, bounties, tape, defaultPair } from '../lib/rivalry.js';

const fx = buildFixture();
const D = computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week,
});
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };
const name = (rid) => D.byRid[rid].name;

const C = crowns(D);
console.log(`crowns over ${C.weeks.length} weeks; last week (${C.latest?.week}):`);
for (const c of CROWNS) { const x = C.latest?.crowns[c.key]; console.log(`  ${c.label.padEnd(11)} ${x ? `${name(x.rid)} (${x.value})` : '–'}`); }
if (C.weeks.length !== D.meta.lastScored) fail(`${C.weeks.length} weeks of crowns, ${D.meta.lastScored} scored`);
// every crown on a shelf was handed out in some week, and each week hands out each crown at most once
for (const c of CROWNS) {
  const given = C.weeks.filter((w) => w.crowns[c.key]).length;
  const shelved = Object.values(C.shelf).reduce((n, s) => n + s[c.key], 0);
  if (given !== shelved) fail(`${c.key}: ${given} handed out, ${shelved} on shelves`);
}
for (const w of C.weeks) {
  const pts = (rid) => D.byRid[rid].weeks.find((x) => x.week === w.week).pts;
  const all = D.teams.map((t) => t.weeks.find((x) => x.week === w.week)?.pts).filter((x) => x != null);
  if (w.crowns.high && pts(w.crowns.high.rid) !== Math.max(...all)) fail(`week ${w.week}: high score isn't the top`);
  if (w.crowns.low && pts(w.crowns.low.rid) !== Math.min(...all)) fail(`week ${w.week}: basement isn't the bottom`);
  if (w.crowns.robbed && D.byRid[w.crowns.robbed.rid].weeks.find((x) => x.week === w.week).result !== 'L') fail(`week ${w.week}: robbed in a win`);
  if (w.crowns.stole && D.byRid[w.crowns.stole.rid].weeks.find((x) => x.week === w.week).result !== 'W') fail(`week ${w.week}: stole one in a loss`);
  if (w.crowns.blowout && !(w.crowns.blowout.value > 0)) fail(`week ${w.week}: blowout margin ${w.crowns.blowout.value}`);
}
console.log('shelf (glory, luck, shame):', C.table.slice(0, 4).map((r) => `${name(r.rid)} ${r.glory}/${r.luck}/${r.shame}`).join(', '));

const B = bounties(D);
console.log('bounties:', B.hot.map((h) => `${name(h.rid)} W${h.n} bounty ${h.bounty}${h.next ? `, ${name(h.next.rid)} ${(h.collect * 100).toFixed(0)}% to collect` : ''}`).join('; ') || 'none');
console.log('skids:', B.cold.map((c) => `${name(c.rid)} L${c.n}`).join('; ') || 'none');
console.log('giant killers:', B.killers.map((k) => `${name(k.rid)} ${k.scalps.length}`).join('; ') || 'none');
for (const h of B.hot) {
  if (h.n < 2 || D.byRid[h.rid].streak !== `W${h.n}`) fail(`${name(h.rid)}: streak ${D.byRid[h.rid].streak} vs ${h.n}`);
  if (h.collect != null && !(h.collect >= 0 && h.collect <= 1)) fail(`${name(h.rid)}: collect ${h.collect}`);
}
for (const k of B.killers) for (const s of k.scalps) if (s.rank >= D.byRid[k.rid].powerRank) fail(`${name(k.rid)}: scalp ranked ${s.rank}`);

// the tape: every ordered pair, the lines mirror when the sides swap, the every-week record covers the shared weeks
let pairs = 0;
for (const x of D.teams) for (const y of D.teams) {
  if (x.rid === y.rid) { if (tape(D, x.rid, y.rid) !== null) fail('a team against itself'); continue; }
  const T = tape(D, x.rid, y.rid), R = tape(D, y.rid, x.rid);
  pairs++;
  T.lines.forEach((l, i) => {
    const r = R.lines[i];
    const flip = l.lead === 'a' ? 'b' : l.lead === 'b' ? 'a' : null;
    if (r.lead !== flip) fail(`${x.name} v ${y.name}: ${l.key} doesn't mirror`);
  });
  if (T.every.a !== R.every.b || T.every.b !== R.every.a) fail(`${x.name} v ${y.name}: every-week record doesn't mirror`);
  if (T.every.a + T.every.b > T.every.weeks.length) fail(`${x.name} v ${y.name}: every-week record too long`);
  if (T.meetings.some((m) => !m.real)) fail(`${x.name} v ${y.name}: a meeting that wasn't`);
  if (T.nextMeet && !(T.nextMeet.pA >= 0 && T.nextMeet.pA <= 1)) fail(`${x.name} v ${y.name}: next meeting odds`);
  if (T.edge && R.edge && T.edge === R.edge) fail(`${x.name} v ${y.name}: both sides have the edge`);
}
const [a, b] = defaultPair(D, D.teams[4].rid), S = tape(D, a, b);
console.log(`tape, ${pairs} pairs; default for ${name(D.teams[4].rid)}: ${name(a)} v ${name(b)}, every-week ${S.every.a}-${S.every.b}, met ${S.meetings.length}x, edge ${S.edge}`);
if (process.exitCode) console.error('rivalry: FAILED'); else console.log('rivalry: ok');
