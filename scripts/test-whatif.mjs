// What if (lib/whatif.js) against the saved Week 7 fixture: the replay with nothing swapped matches the real records,
// a better player never costs you points in the weeks he takes the slot, wins and losses still add up across the league,
// the draft board's "still available" pool, the waiver-week points from /api/history, and determinism.
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { seasonBook, whatIf, bestSwaps, draftBoard, parseWeekStats, slimDraft, everRostered } from '../lib/whatif.js';

const fx = buildFixture();
const D = computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week, sims: 200,
});
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };
const rec = (x) => `${x.w}-${x.l}${x.t ? `-${x.t}` : ''}`;

// parsers
const ps = parseWeekStats([
  { player_id: 'a', stats: { pts_half_ppr: 12.345, gp: 1 } },
  { player_id: 'b', stats: { pts_half_ppr: 0, gp: 0 } },
  { player_id: 'c', stats: { pts_half_ppr: 0, gp: 1 } },
  { player_id: 'd', stats: { pts_half_ppr: 3 } },
  { player_id: 'e', stats: { pts_half_ppr: 0 } },
  { player_id: 'f', stats: { gp: 1 } },
]);
if (JSON.stringify(ps) !== JSON.stringify({ a: 12.35, c: 0, d: 3 })) fail(`parseWeekStats: ${JSON.stringify(ps)}`);
if (JSON.stringify(parseWeekStats({ x: { pts_half_ppr: 4, gp: 1 } })) !== '{"x":4}') fail('parseWeekStats map form');

// a synthetic history: a snake draft of everyone rostered today (by consensus value), and waiver-week points for a
// player nobody ever rostered
const L = D.meta.lastScored;
const rostered = new Set(fx.rosters.flatMap((r) => r.players));
const ghost = Object.keys(fx.ros.players).find((id) => !rostered.has(id) && fx.ros.players[id].p === 'WR'
  && !Object.values(fx.matchups).flat().some((m) => (m.players || []).includes(id)));
const pts = {};
for (let w = 1; w <= L; w++) pts[w] = { [ghost]: 40 }; // a waiver-wire monster: 40 a week
const byValue = [...rostered].sort((a, b) => (fx.ros.values[b]?.v || 0) - (fx.ros.values[a]?.v || 0) || (a < b ? -1 : 1));
const rids = fx.rosters.map((r) => r.roster_id), n = rids.length;
const picks = byValue.map((id, i) => {
  const rd = Math.floor(i / n) + 1, k = i % n, slot = rd % 2 ? k : n - 1 - k;
  return { pick_no: i + 1, round: rd, roster_id: rids[slot], player_id: id, metadata: { first_name: 'X', last_name: id, position: fx.ros.players[id]?.p } };
});
const hist = { pts, draft: slimDraft({ draft_id: 'd1', type: 'snake', settings: { rounds: Math.ceil(picks.length / n), teams: n } }, picks) };

const book = seasonBook(D, fx, hist);
console.log(`weeks ${book.weeks.join(', ')}; waiver ghost ${ghost} (${book.nameOf(ghost)}), ${book.total(ghost)} pts`);

// 1. nothing swapped: the replay's records are the real ones
const none = whatIf(book, { rid: D.teams[0].rid, out: '__nobody__', inn: '__nobody__' });
for (const t of D.teams) {
  const x = none.table.find((r) => r.rid === t.rid);
  if (x.w !== t.wins || x.l !== t.losses || x.t !== t.ties) fail(`${t.name}: replay ${rec(x)} vs real ${t.wins}-${t.losses}`);
  if (Math.abs(x.pf - t.pf) > 0.05) fail(`${t.name}: replay PF ${x.pf} vs real ${t.pf}`);
}

// 2. every team, its top starter swapped for the waiver ghost (40 a week, every week): never fewer points in a week
// the ghost took the slot, and the league's wins and losses still balance
const games = book.weeks.reduce((a, w) => a + book.pairs[w].length, 0);
for (const t of D.teams) {
  const last = book.rows[L][t.rid];
  const out = last.starters.find((id) => book.posOf(id) === 'WR');
  const r = whatIf(book, { rid: t.rid, out, inn: ghost });
  const W = r.table.reduce((a, x) => a + x.w + x.t / 2, 0);
  if (Math.abs(W - games) > 1e-9) fail(`${t.name}: ${W} wins for ${games} games`);
  for (const wk of r.weeks) {
    const st = wk.steps[0];
    if (st.how === 'swap' && wk.now[0] < wk.was[0] - 1e-9) fail(`${t.name} week ${wk.w}: swap lost points`);
    if (st.how === 'swap' && Math.abs(wk.now[0] - wk.was[0] - (40 - st.outPts)) > 0.011) fail(`${t.name} week ${wk.w}: swap moved ${wk.now[0] - wk.was[0]}, expected ${40 - st.outPts}`);
  }
  if (r.after.w < r.before.w) fail(`${t.name}: a 40-a-week WR cost wins`);
  console.log(`${t.name.padEnd(24).slice(0, 24)} ${book.nameOf(out).padEnd(22).slice(0, 22)} -> ghost: ${rec(r.before)} (${r.before.seed}) -> ${rec(r.after)} (${r.after.seed}), PF ${r.before.pf} -> ${r.after.pf}, ${r.flips.length} flipped, started ${r.inStarted}/${r.weeks.length}`);
}

// 3. taking a starter away from an opponent: swap in a rival's best WR and check that team scores less in those weeks
const me = D.teams[0], rival = D.teams.find((t) => t.rid !== me.rid);
const theirs = book.rows[L][rival.rid].starters.find((id) => book.posOf(id) === 'WR');
const r3 = whatIf(book, { rid: me.rid, out: book.rows[L][me.rid].starters.find((id) => book.posOf(id) === 'WR'), inn: theirs });
const rivalAfter = r3.table.find((x) => x.rid === rival.rid);
if (rivalAfter.pf > rivalAfter.was.pf + 1e-9) fail('the team that lost him scored more');
console.log(`\n${me.name} takes ${book.nameOf(theirs)} off ${rival.name}: ${rival.name} PF ${rivalAfter.was.pf} -> ${rivalAfter.pf} (no bench in the fixture, so his slot goes empty)`);

// 4. the draft board: nobody drafted ahead of your pick is offered, and the replays are best first
const board = draftBoard(book, fx);
const myPick = board.picks.find((p) => p.rid === me.rid && p.round === 3);
const best = bestSwaps(book, { rid: me.rid, out: myPick.id, board, beforePick: myPick.no });
const ahead = new Set(board.picks.filter((p) => p.no < myPick.no).map((p) => p.id));
if (best.list.some((x) => ahead.has(x.id))) fail('a player drafted ahead of the pick was offered');
if (best.list.some((x) => everRostered(book, me.rid).has(x.id))) fail('one of your own players was offered');
if (best.list.some((x, i) => i && (x.dw > best.list[i - 1].dw + 1e-9))) fail('best swaps not sorted');
if (best.list[0]?.id !== ghost) fail(`the 40-a-week ghost should top the board (top: ${best.list[0]?.id})`);
console.log(`\n${me.name}, round 3 pick ${myPick.no} (${book.nameOf(myPick.id)}), ${best.pool} replays:`);
for (const x of best.list) console.log(`  ${book.nameOf(x.id).padEnd(24).slice(0, 24)} ${book.posOf(x.id).padEnd(3)} ${String(x.tot).padStart(7)} pts  ${rec(x.after)}  ${x.dw >= 0 ? '+' : ''}${x.dw} W  ${x.dpf >= 0 ? '+' : ''}${x.dpf} PF  seed ${x.after.seed}`);

// 4b. two swaps at once: the second player never comes back as an option, each swap gets its own step, the order of
// the swaps doesn't change the record when they touch different weeks' slots, and one swap on its own matches the
// single-swap call
const wrs = book.rows[L][me.rid].starters.filter((id) => book.posOf(id) === 'WR');
const rbs = book.rows[L][me.rid].starters.filter((id) => book.posOf(id) === 'RB');
const pickA = best.list[0].id;
const second = bestSwaps(book, { rid: me.rid, out: rbs[0], board, others: [{ out: wrs[0], inn: pickA }] });
if (second.list.some((x) => x.id === pickA)) fail('a player already swapped in was offered again');
const two = whatIf(book, { rid: me.rid, swaps: [{ out: wrs[0], inn: pickA }, { out: rbs[0], inn: second.list[0].id }] });
if (two.weeks.some((x) => x.steps.length !== 2)) fail('two swaps should give two steps a week');
const one = whatIf(book, { rid: me.rid, swaps: [{ out: wrs[0], inn: pickA }] }), single = whatIf(book, { rid: me.rid, out: wrs[0], inn: pickA });
if (JSON.stringify(one.after) !== JSON.stringify(single.after)) fail('swaps: [one] differs from out/inn');
if (Math.abs(second.base.pf - one.after.pf) > 1e-9) fail('the second swap\'s base is not the first swap\'s record');
const W2 = two.table.reduce((a, x) => a + x.w + x.t / 2, 0);
if (Math.abs(W2 - games) > 1e-9) fail(`two swaps: ${W2} wins for ${games} games`);
console.log(`\ntwo swaps: ${rec(two.before)} -> ${rec(one.after)} -> ${rec(two.after)}, PF ${two.before.pf} -> ${two.after.pf}`);

// 5. deterministic
const t0 = Date.now();
const again = bestSwaps(book, { rid: me.rid, out: myPick.id, board, beforePick: myPick.no });
console.log(`\nbest swaps again in ${Date.now() - t0}ms`);
if (JSON.stringify(again) !== JSON.stringify(best)) fail('bestSwaps is not deterministic');

// 6. no history: still runs, waiver weeks score nothing
const bare = seasonBook(D, fx, null);
if (bare.total(ghost) !== 0) fail('a waiver player scored without history');
if (draftBoard(bare, fx) !== null) fail('a draft board without history');
// 7. /api/history with Sleeper mocked: one call per finished week plus two for the draft, slimmed, and the morning key
// only (no store here, so each build reads again, as on a CDN miss without the env vars)
const calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });
  if (/\/drafts$/.test(url)) return ok([{ draft_id: 'D1', season: '2026', status: 'complete', type: 'snake', settings: { rounds: 15, teams: 12 } }]);
  if (/\/draft\/D1\/picks$/.test(url)) return ok([{ pick_no: 2, round: 1, roster_id: 4, player_id: '200', picked_by: 'u4', metadata: { first_name: 'B', last_name: 'Two', position: 'WR', team: 'DET' } },
    { pick_no: 1, round: 1, roster_id: 3, player_id: '100', picked_by: 'u3', metadata: { first_name: 'A', last_name: 'One', position: 'RB', team: 'KC' } }]);
  const m = String(url).match(/stats\/nfl\/2026\/(\d+)\?/);
  if (m) return ok([{ player_id: '100', stats: { pts_half_ppr: Number(m[1]), gp: 1 } }, { player_id: '300', stats: { pts_half_ppr: 0, gp: 0 } }]);
  return { ok: false, status: 404, json: async () => ({}) };
};
const { build } = await import('../api/history.js');
const H = await build('2026-11-20');
if (H.weeks.join() !== '1,2,3,4,5,6,7,8,9,10') fail(`history weeks ${H.weeks}`);
if (calls.filter((u) => u.includes('/stats/')).length !== 10 || calls.filter((u) => u.includes('draft')).length !== 2) fail(`calls: ${calls.length}`);
if (calls.some((u) => u.includes('/players/'))) fail('history read the player map');
if (H.pts[3]['100'] !== 3 || '300' in H.pts[3]) fail('history points');
if (H.draft.picks[0][3] !== '100' || H.draft.names['200'][0] !== 'B Two') fail('history draft');
if (H.errors.length) fail(`history errors ${H.errors}`);
console.log(`\n/api/history: ${calls.length} Sleeper calls, weeks ${H.weeks.join(', ')}, ${H.draft.picks.length} picks`);
console.log(process.exitCode ? 'FAILED' : 'ok');
