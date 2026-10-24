// Money week bullseye against the saved Week 7 fixture: upcoming (projections), final (pretend week 6 was it), soon.
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { bullseye } from '../lib/bullseye.js';

const fx = buildFixture();
const D = computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week,
});
const show = (b) => {
  console.log(`\nweek ${b.week} ${b.state}`);
  b.rows.forEach((r, i) => console.log(`${String(i + 1).padStart(2)} ${D.byRid[r.rid].name.padEnd(24).slice(0, 24)} ${r.score.toFixed(1).padStart(6)} ${(r.side === 'over' ? '+' : '-') + r.dist.toFixed(1).padStart(5)}  ${(r.pWin * 100).toFixed(1).padStart(5)}%`));
};
const t0 = Date.now();
const up = bullseye(D, { week: 7, target: 120 });
console.log(`simulated in ${Date.now() - t0}ms`);
show(up);
const sum = up.rows.reduce((a, r) => a + r.pWin, 0);
if (Math.abs(sum - 1) > 1e-9) throw new Error(`win shares add to ${sum}`);
if (up.rows.some((r, i) => i && r.dist < up.rows[i - 1].dist)) throw new Error('rows not sorted by distance');
show(bullseye(D, { week: 6, target: 120 }));
console.log('\nweek 9:', bullseye(D, { week: 9, target: 120 }).state, ' week 3:', bullseye(D, { week: 3, target: 120 }));
