// api/admin.js against an in-memory stand-in for the Upstash store and a mocked Sleeper: password checks and lockout,
// the pull rate limit, the private draft, publishing data and weights, and that a publish reaches visitors through a
// new snapshot revision without any extra Sleeper call.
import admin from '../api/admin.js';
import league from '../api/league.js';
import { pack } from '../lib/snapstore.js';
import ros from '../api/ros.js';
import { leagueKey, morningKey } from '../lib/newsclock.js';

const db = new Map();
const redisCmd = ([cmd, k, ...a]) => {
  switch (cmd) {
    case 'GET': return db.has(k) ? db.get(k) : null;
    case 'SET': { if (a.includes('NX') && db.has(k)) return null; db.set(k, a[0]); return 'OK'; }
    case 'DEL': return db.delete(k) ? 1 : 0;
    case 'INCR': { const v = (Number(db.get(k)) || 0) + 1; db.set(k, String(v)); return v; }
    case 'EXPIRE': return 1;
    case 'TTL': return db.has(k) ? 97 : -2;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
let sleeperCalls = 0;
globalThis.fetch = async (u, opts = {}) => {
  const ok = (json) => ({ ok: true, status: 200, json: async () => json });
  if (u.endsWith('/pipeline')) return ok(JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })));
  if (u.includes('api.sleeper.app')) {
    sleeperCalls++;
    if (u.endsWith('/state/nfl')) return ok({ week: 7, leg: 7 });
    if (/\/league\/\d+$/.test(u)) return ok({ settings: { playoff_week_start: 15 } });
    return ok([]);
  }
  // the ranking sites: FantasyPros answers with two players, the other two are down
  if (u.includes('fantasypros')) { siteCalls++; return { ok: !fpDown, status: fpDown ? 503 : 200, statusText: 'x', text: async () => `<script>var ecrData = ${JSON.stringify({ players: [{ player_name: 'Ja\'Marr Chase', player_position_id: 'WR', player_team_id: 'CIN', rank_ecr: 1, player_bye_week: 10 }, { player_name: 'Bijan Robinson', player_position_id: 'RB', player_team_id: 'ATL', rank_ecr: 2, player_bye_week: 5 }] })};\n</script>` }; }
  if (u.includes('draftsharks') || u.includes('leaguelogs')) { siteCalls++; return { ok: false, status: 404, statusText: 'Not Found' }; }
  throw new Error('unexpected ' + u);
};
let siteCalls = 0, fpDown = false;

const call = async (handler, { method = 'POST', body, url, ip = '1.1.1.1' } = {}) => {
  const out = { headers: {} };
  const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, send(b) { out.body = JSON.parse(b); }, end() {} };
  const q = url ? Object.fromEntries(new URL(url, 'http://x').searchParams) : {};
  await handler({ method, body, url, query: q, headers: { 'x-forwarded-for': ip, host: 'localhost' } }, res);
  return out;
};
const check = (label, cond, detail = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };
const A = (body, ip) => call(admin, { body, ip });

let r = await A({ password: '6906', action: 'status' });
check('without the store connected: 503, nothing else', r.code === 503, r);

process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';

r = await call(admin, { method: 'GET' });
check('GET is refused', r.code === 405);
r = await A({ password: '1234', action: 'status' });
check('a wrong password gets 401 and nothing else', r.code === 401 && !r.body.key, r);
for (let i = 0; i < 4; i++) await A({ password: '0000', action: 'status' });
r = await A({ password: '6906', action: 'status' });
check('five wrong tries lock that network out, even with the right password', r.code === 429, r);
r = await A({ password: '6906', action: 'status' }, '2.2.2.2');
check('...another network still gets in', r.code === 200 && r.body.key === leagueKey() && r.body.rev === 0 && r.body.config === null, r);
r = await A({ password: '6906', action: 'nope' }, '2.2.2.2');
check('an unknown action is refused', r.code === 400);

const before = sleeperCalls;
r = await A({ password: '6906', action: 'pull' }, '2.2.2.2');
check('pull: one fresh Sleeper snapshot into the draft', r.code === 200 && r.body.snapshot?.state?.week === 7 && sleeperCalls > before && r.body.draft?.key === leagueKey(), r.code);
const afterPull = sleeperCalls;
r = await A({ password: '6906', action: 'pull' }, '2.2.2.2');
check('a second pull within two minutes is refused, no Sleeper call', r.code === 429 && sleeperCalls === afterPull && r.body.nextPullIn > 0, r);
r = await A({ password: '6906', action: 'draft' }, '2.2.2.2');
check('the draft can be read back', r.code === 200 && r.body.snapshot?.state?.week === 7);

r = await A({ password: '6906', action: 'publish', weights: { rosProj: 2 } }, '2.2.2.2');
check('weights above 1 are refused', r.code === 400, r);
r = await A({ password: '6906', action: 'publish', weights: { madeUp: 0.5 } }, '2.2.2.2');
check('unknown weights are refused', r.code === 400, r);
r = await A({ password: '6906', action: 'publish' }, '2.2.2.2');
check('publishing nothing is refused', r.code === 400, r);

// what visitors get before and after a publish
const plain = `/api/league?d=${leagueKey()}`;
let v = await call(league, { method: 'GET', url: plain });
check('visitors: the plain key redirects to revision 0', v.code === 307 && v.headers.Location === `${plain}.r0`, v);
v = await call(league, { method: 'GET', url: `${plain}.r0` });
check('...which serves the snapshot with the default weights', v.code === 200 && v.body.config === null, v.code);

const W = { rosProj: 0.22, depth: 0.05, sos: 0.06, allPlay: 0.17, pfPerGame: 0.1, winPct: 0.1, standing: 0.12, form: 0.12, lastWeek: 0.06 };
const calls = sleeperCalls;
r = await A({ password: '6906', action: 'publish', weights: W, data: true }, '2.2.2.2');
check('publish weights and the draft: revision 1, weights staged not live', r.code === 200 && r.body.rev === 1 && r.body.published.join() === 'data,weights' && r.body.staged?.weights?.standing === 0.12 && r.body.config === null, r);
v = await call(league, { method: 'GET', url: plain });
check('visitors: the plain key now redirects to revision 1', v.code === 307 && v.headers.Location === `${plain}.r1`, v);
v = await call(league, { method: 'GET', url: `${plain}.r1` });
check('...which still carries the default weights', v.code === 200 && v.body.config === null, v.body?.config);
v = await call(league, { method: 'GET', url: `${plain}.r0` });
check('the old revision URL redirects to the new one', v.code === 307 && v.headers.Location === `${plain}.r1`, v);

r = await A({ password: '6906', action: 'publish', weights: W }, '2.2.2.2');
check('publishing weights alone: no new revision', r.code === 200 && r.body.rev === 1 && r.body.config === null, r);
r = await A({ password: '6906', action: 'golive' }, '2.2.2.2');
check('go live: revision 2, staged weights now live, staging cleared', r.code === 200 && r.body.rev === 2 && r.body.config?.weights?.standing === 0.12 && r.body.staged === null, r);
v = await call(league, { method: 'GET', url: `${plain}.r2` });
check('...visitors get the weights', v.code === 200 && v.body.config?.weights?.standing === 0.12, v.body?.config);
check('...and no Sleeper call for any of it', sleeperCalls === calls, `${sleeperCalls - calls} calls`);
r = await A({ password: '6906', action: 'golive' }, '2.2.2.2');
check('go live with nothing staged is refused', r.code === 400, r);

r = await A({ password: '6906', action: 'publish', weights: null }, '2.2.2.2');
check('staging the default weights leaves the live ones alone', r.code === 200 && r.body.rev === 2 && r.body.config?.weights && r.body.staged?.weights === null, r);
r = await A({ password: '6906', action: 'unstage' }, '2.2.2.2');
check('discard: staging cleared, live unchanged', r.code === 200 && r.body.staged === null && r.body.config?.weights, r);
await A({ password: '6906', action: 'publish', weights: null }, '2.2.2.2');
r = await A({ password: '6906', action: 'golive' }, '2.2.2.2');
check('back to default weights: revision 3, config cleared', r.code === 200 && r.body.rev === 3 && r.body.config === null, r);

db.set('ph:admin:draft-meta', JSON.stringify({ key: '1999-01-01' }));
r = await A({ password: '6906', action: 'publish', data: true }, '2.2.2.2');
check('a draft from an earlier window cannot overwrite today\'s snapshot', r.code === 400, r);

// refreshing the ROS rankings mid-day: re-scrapes the sites, never Sleeper
const day = morningKey(), plainRos = `/api/ros?d=${day}`;
let sc = sleeperCalls;
r = await A({ password: '6906', action: 'ros' }, '2.2.2.2');
check('ros refresh without a stored player map is refused, no Sleeper call', r.code === 400 && sleeperCalls === sc && siteCalls === 0, r);
db.set(`ph:snap:players:${day}`, pack({ 7564: { full_name: "Ja'Marr Chase", first_name: "Ja'Marr", last_name: 'Chase', position: 'WR', team: 'CIN', active: true }, 4866: { full_name: 'Bijan Robinson', first_name: 'Bijan', last_name: 'Robinson', position: 'RB', team: 'ATL', active: true } }));
v = await call(ros, { method: 'GET', url: plainRos });
check('visitors: the plain ros key redirects to revision 0', v.code === 307 && v.headers.Location === `${plainRos}.r0`, v);
fpDown = true;
r = await A({ password: '6906', action: 'ros' }, '2.2.2.2');
check('FantasyPros down: refused, the morning copy is kept', r.code === 502 && !db.has(`ph:snap:ros:${day}`), r);
db.delete('ph:admin:ros-gap'); fpDown = false;
r = await A({ password: '6906', action: 'ros' }, '2.2.2.2');
check('ros refresh: rebuilt from the sites with the stored players, revision 1, no Sleeper call', r.code === 200 && r.body.rosRev === 1 && r.body.sources.fp.ok && r.body.sources.fp.matched === 2 && sleeperCalls === sc, r.body);
v = await call(ros, { method: 'GET', url: plainRos });
check('visitors: the plain ros key now redirects to revision 1', v.code === 307 && v.headers.Location === `${plainRos}.r1`, v);
v = await call(ros, { method: 'GET', url: `${plainRos}.r1` });
check('...which serves the refreshed values', v.code === 200 && v.body.values['7564'] && sleeperCalls === sc, v.code);
r = await A({ password: '6906', action: 'ros' }, '2.2.2.2');
check('a second refresh within five minutes is refused', r.code === 429, r);

process.env.ADMIN_PASSWORD = 'a much longer passphrase';
r = await A({ password: '6906', action: 'status' }, '3.3.3.3');
check('with ADMIN_PASSWORD set, the default PIN stops working', r.code === 401);
r = await A({ password: 'a much longer passphrase', action: 'status' }, '3.3.3.3');
check('...and ADMIN_PASSWORD works', r.code === 200);
