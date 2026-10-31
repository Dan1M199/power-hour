// The team dashboard's numbers (lib/dashboard.js) against the saved Week 7 fixture: one line per team, then the checks
// the tiles rely on (shares in 0..1, the right number of weeks and games, player points that add up to Sleeper's).
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { dashData, faceOff, weekPts, winAt } from '../lib/dashboard.js';

const fx = buildFixture();
const D = computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week,
});
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };
const share = (x, what) => { if (x != null && !(x >= 0 && x <= 1)) fail(`${what} = ${x}, not a share`); };

for (const t of D.teams) {
  const m = dashData(D, t.rid, { raw: fx, ros: fx.ros.values });
  const star = m.stars[0];
  console.log(`${t.name.padEnd(24).slice(0, 24)} playoffs ${(m.odds.playoff * 100).toFixed(0).padStart(3)}%  eff ${m.efficiency ? (m.efficiency.eff * 100).toFixed(1) : '  –'}%  ${m.scoring.ppg.toFixed(1)}/g  ` +
    `groups ${m.groups.map((g) => `${g.pos}${g.rank}`).join(' ')}  games left ${m.schedule.length}  star ${star ? `${star.name} (${star.season.toFixed(1)} in ${star.games})` : '–'}`);

  for (const k of ['playoff', 'bye', 'champ', 'ifWin', 'ifLoss']) share(m.odds[k], `${t.name} odds.${k}`);
  if (m.efficiency) { share(m.efficiency.eff, `${t.name} efficiency`); if (m.efficiency.rank < 1 || m.efficiency.rank > m.efficiency.of) fail(`${t.name}: efficiency rank ${m.efficiency.rank}`); }
  if (m.scoring.weeks.length > 7 || m.scoring.weeks.length !== Math.min(7, t.weeks.length)) fail(`${t.name}: ${m.scoring.weeks.length} scoring weeks`);
  m.scoring.weeks.forEach((w) => share(w.pts / m.scoring.max, `${t.name} week ${w.week} bar`));
  if (m.schedule.length !== t.schedule.length) fail(`${t.name}: ${m.schedule.length} games on the schedule tile vs ${t.schedule.length}`);
  m.schedule.forEach((g) => { share(g.win, `${t.name} week ${g.week} win`); if (!g.opp) fail(`${t.name}: week ${g.week} has no opponent`); });
  if (m.groups.length !== 4 || m.groups.some((g) => g.rank < 1 || g.rank > m.n)) fail(`${t.name}: position groups ${JSON.stringify(m.groups)}`);
  if (m.stars.length > 6 || m.stars.some((s, i) => i && D.helpers.valueOf(s.id) > D.helpers.valueOf(m.stars[i - 1].id))) fail(`${t.name}: stars not in value order`);
  // a player's season points are his points on this roster, week by week
  for (const s of m.stars) {
    const sum = Object.keys(fx.matchups).map(Number).filter((w) => w <= D.meta.lastScored)
      .map((w) => fx.matchups[w].find((r) => r.roster_id === t.rid))
      .filter((r) => r?.players?.includes(s.id)).reduce((a, r) => a + weekPts(r, s.id), 0);
    if (Math.abs(sum - s.season) > 1e-9) fail(`${t.name}: ${s.name} season ${s.season} vs ${sum}`);
    if (s.last5.length > 5) fail(`${t.name}: ${s.name} has ${s.last5.length} recent weeks`);
  }
  // face off: every other team once, this week's opponent first, odds and break-even as shares, the ghost record over
  // the weeks both played, and a heist that can only help the side pulling it
  const F = m.faceoff, thisOpp = m.game?.opp?.rid;
  if (!F || F.rivals.length !== m.n - 1 || new Set(F.rivals.map((x) => x.rid)).size !== m.n - 1 || F.rivals.some((x) => x.rid === t.rid)) fail(`${t.name}: face off rivals`);
  if (thisOpp != null && F.rivals[0].rid !== thisOpp) fail(`${t.name}: this week's opponent isn't the first rival`);
  for (const x of F.rivals) {
    share(x.odds, `${t.name} vs ${x.opp.name} odds`); share(x.breakEven, `${t.name} vs ${x.opp.name} break-even`);
    if (Math.abs(winAt(x, x.breakEven) - 0.5) > 1e-3) fail(`${t.name} vs ${x.opp.name}: the break-even week wins ${winAt(x, x.breakEven)}`);
    if (!(winAt(x, 0.2) < winAt(x, 0.5) && winAt(x, 0.5) < winAt(x, 0.8))) fail(`${t.name} vs ${x.opp.name}: a better week should win more often`);
    const g = x.ghost;
    if (g.w + g.l + g.t !== g.weeks.length || g.weeks.length > t.games || g.weeks.filter((w) => w.real).length > 1) fail(`${t.name} vs ${x.opp.name}: ghost record ${JSON.stringify(g)}`);
    const real = t.weeks.find((w) => w.opp === x.rid);
    if (real && !g.weeks.find((w) => w.week === real.week && w.real && w.a === real.pts && w.b === real.oppPts)) fail(`${t.name} vs ${x.opp.name}: the real meeting isn't marked`);
    const hz = x.heist;
    if (hz && (hz.take.gain < 0 || hz.take.loss > 1e-9 || hz.steal < x.odds - 1e-9 || !x.opp.players.includes(hz.take.id))) fail(`${t.name} vs ${x.opp.name}: heist ${JSON.stringify(hz.take)} ${hz.steal} vs ${x.odds}`);
    if (hz?.give && !t.players.includes(hz.give.id)) fail(`${t.name} vs ${x.opp.name}: they'd steal someone who isn't here`);
  }
  const { record: r, allPlay: a } = m.luck;
  if (r.w + r.l + r.tie !== t.games) fail(`${t.name}: record ${r.w}-${r.l}-${r.tie} over ${t.games} games`);
  if (Math.abs(a.w + a.l - (m.n - 1) * t.games) > 1) fail(`${t.name}: all-play ${a.w}-${a.l} over ${t.games} games`);
}
if (dashData(D, -1) !== null || faceOff(D, -1) !== null) fail('an unknown team should give null');
console.log(process.exitCode ? 'dashboard checks failed' : 'ok   dashboard numbers check out for every team');
