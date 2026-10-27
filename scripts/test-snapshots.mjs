// Sleeper is read on schedule only: counts Sleeper calls through api/league.js and api/ros.js against an in-memory
// stand-in for the Upstash store, across a "deploy" (fresh CDN, same store), odd keys, simultaneous first visitors
// and a ranking-site outage.
import league from '../api/league.js';
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
    case 'TTL': return db.has(k) ? 60 : -2;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
let sleeperCalls = 0, playersCalls = 0, scrapes = 0, dsDown = false;
globalThis.fetch = async (u, opts = {}) => {
  const ok = (json, text = '') => ({ ok: true, status: 200, json: async () => json, text: async () => text });
  if (u.endsWith('/pipeline')) return ok(JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })));
  if (u.includes('api.sleeper.app')) {
    sleeperCalls++;
    await new Promise((r) => setTimeout(r, 30)); // a slow upstream, so simultaneous visitors overlap
    if (u.endsWith('/players/nfl')) { playersCalls++; return ok({ 4046: { full_name: 'Patrick Mahomes', first_name: 'Patrick', last_name: 'Mahomes', position: 'QB', team: 'KC', active: true, age: 31 } }); }
    if (u.endsWith('/state/nfl')) return ok({ week: 7, leg: 7 });
    if (/\/league\/\d+$/.test(u)) return ok({ settings: { playoff_week_start: 15 } });
    return ok([]);
  }
  scrapes++;
  if (u.includes('draftsharks') && dsDown) return { ok: false, status: 403, statusText: 'Forbidden' };
  return ok(null, '<html></html>');
};

const call = async (handler, path) => {
  const out = { headers: {} };
  const res = { setHeader(k, v) { out.headers[k] = v; }, status(c) { out.code = c; return this; }, send(b) { out.body = b; }, json(b) { out.body = b; }, end() {} };
  const u = new URL(path, 'http://localhost');
  await handler({ url: path, query: Object.fromEntries(u.searchParams), headers: { host: 'localhost' } }, res);
  return out;
};
const check = (label, cond, detail = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${detail}`}`); if (!cond) process.exitCode = 1; };

const L = `/api/league?d=${leagueKey()}.r0`, R = `/api/ros?d=${morningKey()}.r0`; // both URLs carry a revision (lib/published.js)

// no store connected: behaves as before (a CDN miss reads Sleeper), but odd keys still never do
let r = await call(league, '/api/league?d=1999-01-01');
check('an odd league key is redirected, no Sleeper call', r.code === 307 && r.headers.Location === L && sleeperCalls === 0, JSON.stringify(r));
r = await call(league, '/api/league?d=2026-10-25T99');
check('...any odd key', r.code === 307 && sleeperCalls === 0);
r = await call(ros, '/api/ros?d=nope');
check('an odd ros key is redirected, no Sleeper call', r.code === 307 && r.headers.Location === R && sleeperCalls === 0);

process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';

// two visitors at once on an empty store: one pull between them
const [a, b] = await Promise.all([call(league, L), call(league, L)]);
const perPull = sleeperCalls;
check('first visitors of the morning: one Sleeper pull between them', a.code === 200 && b.code === 200 && perPull === 4 + 14 + 7, `${perPull} calls (one pull is 4 + 14 matchup weeks + 7 transaction weeks = 25)`);
check('...and both got the same snapshot', a.body === b.body);
// a deploy empties the CDN; the function is called again with the same key
for (let i = 0; i < 5; i++) await call(league, L);
check('after a deploy (CDN emptied), five more visits: zero Sleeper calls', sleeperCalls === perPull, `${sleeperCalls - perPull} extra calls`);
r = await call(league, L);
check('served from the store', /store$/.test(r.headers['X-Snapshot']), r.headers['X-Snapshot']);

// /api/ros: the 5 MB players file once per morning, whatever happens to the ranking sites
sleeperCalls = 0;
dsDown = true;
r = await call(ros, R);
check('ros with DraftSharks down: one players pull, an hour on the CDN', r.code === 200 && playersCalls === 1 && /s-maxage=3600/.test(r.headers['Cache-Control']), `${playersCalls} players pulls, ${r.code} ${r.body}`);
dsDown = false;
db.delete(`ph:snap:ros:${morningKey()}`); // the hour is up: the outage copy expires and the next visitor rebuilds
r = await call(ros, R);
check('...the hourly retry re-scrapes the rankings but reuses the players file', r.code === 200 && playersCalls === 1, `${playersCalls} players pulls`);
for (let i = 0; i < 5; i++) await call(ros, R);
check('...and after a deploy, zero more players pulls', playersCalls === 1 && sleeperCalls === 1, `${sleeperCalls} Sleeper calls`);
