// The trade retrospective (lib/retro.js) against the saved Week 7 fixture: the trades are read the right way round,
// undoing nothing changes nothing, a swapped starter's slot scores exactly the other player's points, wins still balance
// across the league, a later deal paid with a traded player is undone with it, each side's weekly points add up to its
// total, the winner is the side the trade gave the most, a team's trades undone together, and determinism.
import { buildFixture } from './fixture.mjs';
import { computeLeague } from '../lib/engine.js';
import { seasonBook } from '../lib/whatif.js';
import { tradeList, undo, judge, retrospective, withFlips, tradesOf, undoTeam, MIN_WEEKS } from '../lib/retro.js';

const fx = buildFixture();
const D = computeLeague({
  league: fx.league, users: fx.users, rosters: fx.rosters, matchups: fx.matchups,
  transactions: fx.transactions, players: fx.ros.players, ros: fx.ros.values, currentWeek: fx.state.week, sims: 200,
});
const book = seasonBook(D, fx, null);
const fail = (msg) => { console.error(`FAIL ${msg}`); process.exitCode = 1; };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
const name = book.nameOf, team = (rid) => D.byRid[rid].name;
const winsBalance = (table) => {
  const w = table.reduce((a, x) => a + x.w, 0), l = table.reduce((a, x) => a + x.l, 0);
  return w === l;
};

// the trades, read the right way round
const all = tradeList(book, fx);
const raw = fx.transactions.filter((t) => t.type === 'trade' && t.status === 'complete');
if (all.length !== raw.length) fail(`tradeList: ${all.length} trades, the snapshot has ${raw.length}`);
for (const t of all) {
  const tx = raw.find((x) => String(x.transaction_id) === t.id);
  for (const m of t.moves) {
    if (m.to != null && (tx.adds[m.id] !== m.to || tx.drops[m.id] !== m.from)) fail(`trade ${t.id}: ${m.id} goes ${m.from}->${m.to}`);
  }
  if (t.start != null) {
    if (t.start < t.leg) fail(`trade ${t.id} starts in week ${t.start}, before its week ${t.leg}`);
    if (!t.moves.some((m) => m.to != null && book.owner[t.start][m.id] === m.to)) fail(`trade ${t.id}: nobody in it played week ${t.start} for his new team`);
    if (t.weeks[0] !== t.start || t.weeks.some((w) => w < t.start)) fail(`trade ${t.id}: weeks ${t.weeks}`);
  }
}
for (let i = 1; i < all.length; i++) if (all[i].ts < all[i - 1].ts) fail('tradeList is not oldest first');

// undoing nothing changes nothing
const none = undo(book, []);
if (Object.keys(none.delta).length) fail('undo([]) moved points');
for (const x of none.after) {
  const b = none.before.find((y) => y.rid === x.rid);
  if (x.w !== b.w || x.l !== b.l || x.seed !== b.seed || !near(x.pf, b.pf)) fail(`undo([]) changed ${team(x.rid)}`);
}

// a made-up 1-for-1 between two starters at the same position: in a week both started, each team's slot scores the
// other player's points, to the decimal
{
  const w = book.weeks[book.weeks.length - 1];
  const [A, B] = book.pairs[w][0];
  const slotOf = (rid, pos) => book.rows[w][rid].starters.find((id, i) => book.slots[i] === pos && !!id && id !== '0');
  const a = slotOf(A, 'QB'), b = slotOf(B, 'QB');
  if (!a || !b) fail('no two starting QBs to swap');
  else {
    // "a went B->A and b went A->B in week w", so undoing it gives b to A and a to B
    const t = { id: 'fake', ts: 0, leg: w, start: w, weeks: [w], moves: [{ id: a, from: B, to: A }, { id: b, from: A, to: B }], sides: [{ rid: A, gets: [a], gave: [b], cut: [] }, { rid: B, gets: [b], gave: [a], cut: [] }] };
    const r = undo(book, [t]);
    const dA = book.pts(w, b) - book.pts(w, a), dB = book.pts(w, a) - book.pts(w, b);
    if (!near(r.delta[w]?.[A] || 0, dA) || !near(r.delta[w]?.[B] || 0, dB)) fail(`made-up swap: A moved ${r.delta[w]?.[A]} (want ${dA}), B ${r.delta[w]?.[B]} (want ${dB})`);
    if (!winsBalance(r.after)) fail('made-up swap: wins and losses no longer balance');
    const j = judge(book, t);
    const top = j.sides[0];
    if (!near(top.net, Math.max(-dA, -dB))) fail(`made-up swap: winner's net ${top.net}`);
    if (!near(j.margin, Math.abs(dA - dB))) fail(`made-up swap: margin ${j.margin}`);
    console.log(`Made-up swap, week ${w}: ${name(a)} for ${name(b)}. ${team(j.winner)} wins it by ${j.margin}.`);
  }
}

// a later deal paid with a player from this one is undone with it
const byId = Object.fromEntries(all.map((t) => [t.id, t]));
for (const t of all) {
  const { trades, forced } = withFlips(all, [t]);
  for (const x of trades) {
    if (x.id === t.id) continue;
    const via = forced[x.id];
    const m = x.moves.find((y) => y.id === via);
    if (!m) fail(`trade ${t.id} drags ${x.id} through ${via}, who isn't in it`);
    if (x.ts < t.ts) fail(`trade ${t.id} drags in an older trade, ${x.id}`);
  }
}
const loveland = all.find((t) => t.moves.some((m) => name(m.id) === 'Colston Loveland' && m.to != null) && withFlips(all, [t]).trades.length > 1);
if (!loveland) fail('Colston Loveland was traded twice the same week; the first trade should drag the second');

// every judged trade: weeks add up, the winner got the most, the league's wins still balance
const R = retrospective(book, fx);
for (const t of R.judged) {
  if (t.weeks.length < MIN_WEEKS) fail(`trade ${t.id} judged on ${t.weeks.length} weeks`);
  for (const s of t.sides) {
    if (!near(s.added.reduce((a, x) => a + x.pts, 0), s.net, 0.05)) fail(`trade ${t.id}: ${team(s.rid)}'s weeks don't add up to ${s.net}`);
    if (s.real.w + s.real.l + s.real.t !== s.without.w + s.without.l + s.without.t) fail(`trade ${t.id}: games played changed`);
    if (!near(s.diff.withPts - s.diff.withoutPts, s.net, 0.05)) fail(`trade ${t.id}: ${team(s.rid)}'s lineup difference ${s.diff.withPts} - ${s.diff.withoutPts} isn't its ${s.net}`);
  }
  for (let i = 1; i < t.sides.length; i++) if (t.sides[i].net > t.sides[i - 1].net) fail(`trade ${t.id}: sides out of order`);
  if (t.winner !== t.sides[0].rid || t.loser !== t.sides[t.sides.length - 1].rid) fail(`trade ${t.id}: winner or loser`);
  if (!winsBalance(t.table)) fail(`trade ${t.id}: wins and losses no longer balance`);
}
for (const t of R.waiting) if (t.weeks.length >= MIN_WEEKS) fail(`trade ${t.id} waits with ${t.weeks.length} weeks`);
const cards = R.teams.reduce((a, c) => a + c.trades, 0), sides = R.judged.reduce((a, t) => a + t.sides.length, 0);
if (cards !== sides) fail(`report cards count ${cards} trade sides, the trades have ${sides}`);

// a team's trades, undone together
for (const c of D.teams) {
  const mine = tradesOf(all, c.rid);
  if (mine.length < 2) continue;
  const u = undoTeam(book, c.rid, mine, all);
  if (!winsBalance(u.table)) fail(`${c.name}: wins and losses no longer balance`);
  if (u.real.w + u.real.l + u.real.t !== u.without.w + u.without.l + u.without.t) fail(`${c.name}: games played changed`);
  for (const id of u.roster.back) if (u.roster.ids.indexOf(id) < 0) fail(`${c.name}: ${name(id)} comes back but isn't on the roster`);
  for (const id of u.roster.gone) if (u.roster.ids.includes(id)) fail(`${c.name}: ${name(id)} is gone but still on the roster`);
}

// an empty slot gets the best free agent: give the league a tight end nobody rostered, 9 points every week, and the
// team that loses its only tight end in the undo picks him up (from his second week, once he has an average)
{
  const kittle = all.find((t) => t.moves.some((m) => name(m.id) === 'George Kittle') && t.sides.length === 2 && t.start != null && t.weeks.length >= MIN_WEEKS);
  const rostered = new Set(Object.values(fx.matchups).flat().flatMap((m) => m.players || []));
  const ghost = Object.keys(fx.ros.players).find((id) => fx.ros.players[id].p === 'TE' && !rostered.has(id));
  const pts = Object.fromEntries(book.weeks.map((w) => [w, { [ghost]: 9 }]));
  const book2 = seasonBook(D, fx, { pts });
  const plain = judge(book, kittle, all), withFa = judge(book2, kittle, all);
  const s0 = plain.sides.find((s) => s.diff.without.length === 0 && s.diff.with.length), s1 = s0 && withFa.sides.find((s) => s.rid === s0.rid);
  if (!s0) fail('the Kittle trade no longer leaves an empty tight end slot to test with');
  else {
    const pick = s1.diff.without.find((x) => x.id === ghost);
    if (!pick?.pickup) fail(`${team(s0.rid)} didn't pick up the free agent tight end`);
    else if (!near(s1.net, s0.net - pick.pts)) fail(`with the pickup ${team(s0.rid)}'s net is ${s1.net}, want ${s0.net} - ${pick.pts}`);
    else console.log(`Free agent fill: ${team(s0.rid)} picks up a tight end ${pick.starts} times; its net goes ${s0.net} -> ${s1.net}.`);
  }
}

// determinism
if (JSON.stringify(retrospective(book, fx).judged) !== JSON.stringify(R.judged)) fail('two runs differ');

console.log(`${all.length} trades, ${R.judged.length} judged (${MIN_WEEKS}+ weeks), ${R.waiting.length} waiting.`);
for (const t of R.judged) {
  const [w, , ...rest] = t.sides, l = t.sides[t.sides.length - 1];
  console.log(`  Week ${t.start}: ${team(w.rid)} beat ${team(l.rid)} by ${t.margin} (${w.net > 0 ? '+' : ''}${w.net} vs ${l.net > 0 ? '+' : ''}${l.net})${rest.length ? ` with ${rest.length} more` : ''}, ${t.weeks.length} weeks.`);
}
if (!process.exitCode) console.log('All retrospective checks passed.');
