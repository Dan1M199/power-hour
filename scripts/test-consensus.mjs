// Checks name matching + consensus against the saved snapshots.
import { readFileSync } from 'node:fs';
import { buildIndex, buildConsensus } from '../lib/consensus.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url)));
const P = load('players.json');
const players = {};
for (const [id, [name, pos, team, inj]] of Object.entries(P)) {
  const parts = name.split(' ');
  players[id] = { full_name: name, last_name: parts.slice(1).join(' ') || name, position: pos, team, injury_status: inj, active: true };
}
const fp = load('fp.json').p.map(([name, pos, team, rank]) => ({ name, pos, team, rank }));
const ds = load('ds.json').p.map(([name, pos, team, rank, weekly, floor, ceiling, injuryRisk, sos, games]) => ({ name, pos, team, rank, weekly, floor, ceiling, injuryRisk, sos, games }));
const ll = fp.slice(0, 200).map((p) => ({ ...p })); // LeagueLogs ≈ FantasyPros top 200

const idx = buildIndex(players);
const { values, stats } = buildConsensus({ fp: { players: fp }, ds: { players: ds }, ll: { players: ll } }, idx);

const { R } = load('league_rm.json');
const rostered = R.flatMap((r) => r[2]);
const missing = rostered.filter((id) => !values[id]).map((id) => `${id} ${P[id]?.[0]} (${P[id]?.[1]}, ${P[id]?.[3] || 'healthy'})`);
console.log('stats', JSON.stringify(Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, { rows: s.rows, matched: s.matched }]))));
console.log(`rostered players: ${rostered.length}, with consensus value: ${rostered.length - missing.length}`);
console.log('rostered without a value:\n ' + missing.join('\n '));
const show = ['9221', '8138', '4983', '5846', '12481', '8210', '8122', 'DET', '11533', '4046'];
for (const id of show) console.log(id, P[id]?.[0], JSON.stringify(values[id]));
