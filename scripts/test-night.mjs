// The night desk against a simulated Sunday night: the Week 7 fixture with every NFL team played except the two
// with the most rostered starters, who become the Monday night game. Scores are seeded draws around projections.
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { nightBoard, nightEdition } from '../lib/nightdesk.js';

const fx = buildFixture();
const input = (matchups) => ({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups, transactions: fx.transactions,
  players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week, byes: fx.ros.byes || {},
});
const pre = computeLeague(input(fx.matchups));
const wk = pre.previews[0].week;
const teamOf = (id) => fx.ros.players[id]?.t || (/^[A-Z]{2,3}$/.test(id) ? id : null);

// the Monday night game: the two NFL teams with the most starters in this league
const count = {};
fx.rosters.forEach((r) => r.starters.forEach((id) => { const t = teamOf(id); if (t) count[t] = (count[t] || 0) + 1; }));
const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([t]) => t);
const mnf = ranked.slice(0, 2);

let s = 11;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const playWeek = (mnf) => fx.matchups[wk].map((m) => {
  const r = fx.rosters.find((x) => x.roster_id === m.roster_id);
  const pp = {};
  r.players.forEach((id) => {
    if (mnf.includes(teamOf(id))) return;
    const proj = pre.helpers.thisWeekProj(id) || 2;
    pp[id] = Math.max(0, Math.round(proj * (0.35 + 1.3 * rnd()) * 10) / 10);
  });
  const sp = r.starters.map((id) => pp[id] || 0);
  return { ...m, starters: r.starters, players: r.players, players_points: pp, starters_points: sp, points: sp.reduce((a, b) => a + b, 0) };
});
const D = computeLeague(input({ ...fx.matchups, [wk]: playWeek(mnf) }));
const people = Object.fromEntries(D.teams.map((t) => [t.rid, t.owner]));

console.log(`Monday night: ${mnf.join(' at ')}. Played: ${D.live.teams.length} NFL teams\n`);
for (const g of nightBoard(D)) {
  console.log(`${g.locked ? 'LOCKED ' : 'MONDAY '} ${g.lead.t.name.padEnd(24).slice(0, 24)} ${g.lead.banked.toFixed(1).padStart(6)} vs ${g.trail.banked.toFixed(1).padStart(6)} ${g.trail.t.name.padEnd(24).slice(0, 24)} gap ${g.gap.toFixed(1).padStart(5)}  trail left ${g.trail.left.map((x) => x.name).join(', ') || '-'} (ceil ${g.trail.ceil.toFixed(1)})  trail wins ${(g.trail.win * 100).toFixed(0)}%`);
}
const ed = nightEdition(D, { dateKey: '2026-10-25', editor: { user: 'manager2' }, people });
if (!ed || ed.length !== 3) throw new Error('expected three night headlines');
console.log('\nNight edition:');
ed.forEach((st) => console.log(`\n[${st.type}/${st.stamp}] ${st.headline}\n  ${st.deck}`));
const board = nightBoard(D);
for (const g of board) if (g.locked && g.trail.left.length && g.gap <= g.trail.ceil && g.lead.win <= 0.985) throw new Error('locked game the trailing side can still win');
// mid-Sunday (ten NFL teams still to play): the night desk must stay quiet
const mid = computeLeague(input({ ...fx.matchups, [wk]: playWeek(ranked.slice(0, 10)) }));
if (nightEdition(mid, {}) !== null) throw new Error('wrote a night edition from a mid-Sunday snapshot');
if (nightEdition(pre, {}) !== null) throw new Error('wrote a night edition before any games');
console.log('\nguards ok: quiet before games and mid-Sunday');
