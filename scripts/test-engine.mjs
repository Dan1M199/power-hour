import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';

const fx = buildFixture();
const t0 = Date.now();
const res = computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week,
});
console.log(`computed in ${Date.now() - t0}ms`, JSON.stringify(res.meta));
const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
console.log('Rk  Mv  Team                     Rec   Score ROS  Res  ProjPPW  PF/g  AllPlay  Luck  Playoff  Tier');
for (const t of res.teams) {
  console.log(
    `${String(t.powerRank).padStart(2)}  ${(t.movement > 0 ? '+' + t.movement : String(t.movement)).padStart(3)}  ${t.name.padEnd(24).slice(0, 24)} ${t.wins}-${t.losses}  ${t.score.toFixed(1).padStart(5)} ${t.rosScore.toFixed(0).padStart(3)} ${t.resultsScore.toFixed(0).padStart(4)}  ${t.rosProj.toFixed(1).padStart(7)} ${t.pfPerGame.toFixed(1).padStart(6)}  ${t.allPlayW.toFixed(0).padStart(3)}-${t.allPlayL.toFixed(0).padEnd(3)} ${t.luck.toFixed(1).padStart(5)}  ${pct(t.playoffPct)}  ${t.tier.label}`
  );
}
const me = res.teams.find((t) => t.owner === 'manager2');
console.log('\nWHY for', me.name);
me.why.forEach((w) => console.log(` [${w.tone}] ${w.title} — ${w.text}`));
console.log('lineup', me.rosLineup.map((l) => l && `${l.slot}:${res.helpers.nameOf(l.id)} ${l.pts}`).join(' | '));
console.log('\npreviews', res.previews.map((p) => `${res.byRid[p.a].name} ${p.projA} vs ${res.byRid[p.b].name} ${p.projB} (${pct(p.winA)})`).join('\n '));
console.log('\nfeed (latest 6):');
for (const f of res.feed.slice(0, 6)) {
  console.log(` wk${f.week} ${f.type} ` + f.sides.map((s) => `${res.byRid[s.rid].name}: +[${s.adds.map((a) => res.helpers.nameOf(a.id)).join(', ')}] -[${s.drops.map((a) => res.helpers.nameOf(a.id)).join(', ')}] net ${s.net}`).join(' || '));
}
console.log('\nfree agents', res.freeAgents.slice(0, 8).map((f) => `${res.helpers.nameOf(f.id)} ${f.pos} v${f.v}`).join(', '));
console.log('divisive', res.divisive.slice(0, 5).map((d) => `${res.helpers.nameOf(d.id)} ${JSON.stringify(d.r)}`).join(', '));
console.log('top perf', res.topPerformances.slice(0, 3).map((p) => `${res.helpers.nameOf(p.id)} ${p.pts} wk${p.week}`).join(', '));

// The simulation is written for speed (typed arrays, team indexes), but it must draw the same random numbers in the
// same order as the plain version it replaced, so every probability on the site stays exactly what it was. This is the
// fingerprint of the fixture's odds from that plain version. If you change the simulation on purpose, print the new
// fingerprint and paste it here.
const { createHash } = await import('node:crypto');
const odds = JSON.stringify(res.teams.map((t) => [t.rid, t.playoffPct, t.byePct, t.firstPct, t.lastPct, t.projWins, t.champPct, t.finalPct, t.playoffIfWin, t.playoffIfLoss, t.seedDist]));
const print = createHash('sha256').update(odds).digest('hex').slice(0, 16);
console.log(print === 'efeaf898f7d793cb' ? '\nok   simulation odds match the reference fingerprint' : `\nFAIL simulation odds changed: fingerprint ${print}`);
if (print !== 'efeaf898f7d793cb') process.exitCode = 1;
