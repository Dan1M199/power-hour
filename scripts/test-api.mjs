import { readFileSync } from 'node:fs';
import handler from '../api/ros.js';
const load = (f) => JSON.parse(readFileSync(new URL(`../fixtures/${f}`, import.meta.url)));
const fp = load('fp.json').p, ds = load('ds.json').p, P = load('players.json');
const fpHtml = `<script>var ecrData = ${JSON.stringify({ last_updated: '10/22', players: fp.map(([n, pos, t, r]) => ({ player_name: n, player_position_id: pos === 'DEF' ? 'DST' : pos, player_team_id: t, rank_ecr: r, rank_min: r, rank_max: r, rank_std: 0, player_bye_week: 5 + (t.length % 9) })) })};\n</script>`;
const dsHtml = ds.map(([n, pos, t, r, wk, fl, cl, ir, sos, g]) => { const [f, ...l] = n.split(' '); return `<tr class="player-row"><td><div class="column-title rank-index"><span>${r}</span></div></td><td><player-name first-name="${f}" last-name="${l.join(' ')}" player-id="1"></player-name><span class="player-details-group__team-name">${t}</span><pos-roster-spot pill="false" pos-roster-spot="${pos}"></pos-roster-spot></td><td data-value="${g}" data-attribute="games_played"></td><td data-value="${sos}%" data-attribute="strength_of_schedule"></td><td data-value="${ir}%" data-attribute="player.sipPlayerProfile.injury_prob"></td><td data-value="${fl}" data-attribute="rosWeeklyFloorPts"></td><td data-value="${wk}" data-attribute="rosWeeklyPts"></td><td data-value="${cl}" data-attribute="rosWeeklyCeilingPts"></td><td data-value="10" data-attribute="dsValue"></td></tr>`; }).join('\n');
const llHtml = `<table><tbody>${fp.slice(0, 200).map(([n, pos, t, r]) => `<tr class="x"><td>${r}</td><td><a href="/p">${n.replace("'", '&#x27;')}</a><a href="/s">start/sit</a></td><td>${pos === 'DEF' ? 'DST' : pos}</td><td>${t}</td><td>6</td><td>${r}.0</td><td>${r}</td><td>${r}</td><td>x</td><td>9%</td></tr>`).join('')}</tbody></table>`;
const sleeper = Object.fromEntries(Object.entries(P).map(([id, [n, pos, t, i]]) => { const [f, ...l] = n.split(' '); return [id, { full_name: pos === 'DEF' ? undefined : n, first_name: f, last_name: l.join(' '), position: pos, team: t, injury_status: i, active: true }]; }));
async function run(failDs) {
  globalThis.fetch = async (url) => {
    const ok = (body, json) => ({ ok: true, status: 200, text: async () => body, json: async () => json });
    if (url.includes('fantasypros')) return ok(fpHtml);
    if (url.includes('draftsharks')) return failDs ? { ok: false, status: 403, statusText: 'Forbidden' } : ok(dsHtml);
    if (url.includes('leaguelogs')) return ok(llHtml);
    if (url.includes('sleeper')) return ok('', sleeper);
    throw new Error('unexpected ' + url);
  };
  let out = {};
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, send(b) { out.body = JSON.parse(b); }, json(b) { out.body = b; } };
  await handler({}, res);
  const b = out.body;
  console.log(failDs ? '\n[DraftSharks blocked]' : '[all sources up]', out.code, res.headers['Cache-Control']);
  console.log(' sources', JSON.stringify(b.sources));
  console.log(' players', Object.keys(b.players).length, 'values', Object.keys(b.values).length, 'bytes', JSON.stringify(b).length);
  console.log(' byes', Object.keys(b.byes || {}).length, 'teams', failDs ? '' : JSON.stringify(Object.entries(b.byes).slice(0, 3)));
  console.log(" Ja'Marr", JSON.stringify(b.values['7564']), '| DEF name', b.players.DET.n);
}
await run(false); await run(true);
