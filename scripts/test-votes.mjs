// Runs api/votes.js against an in-memory stand-in for Upstash Redis and a mocked /api/league snapshot.
process.env.VOTES_NOW = String(Date.parse('2026-10-20T15:00:00Z')); // a Tuesday: before kickoff
import handler from '../api/votes.js';

const db = new Map();
let started = false;
const redisCmd = ([cmd, k, ...a]) => {
  const v = db.get(k);
  switch (cmd) {
    case 'HGETALL': return v ? [...v].flat() : [];
    case 'HSET': { const h = v || new Map(); const fresh = !h.has(a[0]); h.set(a[0], a[1]); db.set(k, h); return fresh ? 1 : 0; }
    case 'SADD': { const s = v || new Set(); const fresh = !s.has(a[0]); s.add(a[0]); db.set(k, s); return fresh ? 1 : 0; }
    case 'SISMEMBER': return v?.has(a[0]) ? 1 : 0;
    case 'SCARD': return v ? v.size : 0;
    case 'EXPIRE': return 1;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
globalThis.fetch = async (u, opts = {}) => {
  const ok = (json) => ({ ok: true, status: 200, json: async () => json });
  if (u.endsWith('/pipeline')) return ok(JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })));
  if (u.includes('/api/league?d=')) return ok({ state: { week: 7 }, matchups: { 7: [[1, 1], [2, 1], [3, 2], [8, 2]].map(([roster_id, matchup_id]) => ({ roster_id, matchup_id, points: started ? 4.2 : 0 })) } });
  throw new Error('unexpected ' + u);
};

const call = async (method, { query, body, ip = '1.1.1.1' } = {}) => {
  let out = {};
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
  await handler({ method, query, body, headers: { 'x-forwarded-for': ip, host: 'localhost:3000' } }, res);
  return out;
};
const check = (label, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };

let r = await call('GET', { query: { week: '7' } });
check('GET says voting is off (quietly) until the store is connected', r.code === 200 && r.body.enabled === false, r);
r = await call('POST', { body: { week: 7, pair: '3-8', pick: '8', voter: 'device-aaaaaaaa' } });
check('...and refuses votes', r.code === 503, r);

process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';
r = await call('GET', { query: { week: '7', voter: 'device-aaaaaaaa' } });
check('GET lists both matchups, open, no votes yet', r.code === 200 && r.body.open && Object.keys(r.body.counts).join() === '1-2,3-8', r.body);
r = await call('POST', { body: { week: 7, pair: '3-8', pick: '8', voter: 'device-aaaaaaaa' } });
check('vote recorded', r.code === 200 && r.body.counts['3-8']['8'] === 1 && r.body.mine['3-8'] === '8', r.body);
r = await call('POST', { body: { week: 7, pair: '3-8', pick: '3', voter: 'device-aaaaaaaa' } });
check('re-voting replaces the pick instead of adding one', r.body.counts['3-8']['3'] === 1 && !r.body.counts['3-8']['8'], r.body);
for (const v of ['device-bbbbbbbb', 'device-cccccccc']) await call('POST', { body: { week: 7, pair: '3-8', pick: '8', voter: v } });
r = await call('POST', { body: { week: 7, pair: '3-8', pick: '8', voter: 'device-dddddddd' } });
check('a 4th device on the same network is turned away', r.code === 429, r);
r = await call('POST', { body: { week: 7, pair: '3-8', pick: '8', voter: 'device-dddddddd' }, ip: '2.2.2.2' });
check('...but votes fine from another network', r.code === 200 && r.body.counts['3-8']['8'] === 3, r.body);
r = await call('POST', { body: { week: 7, pair: '3-8', pick: '8', voter: 'device-aaaaaaaa' } });
check('a device already counted on its network can still change its pick', r.code === 200 && r.body.mine['3-8'] === '8', r.body);
r = await call('POST', { body: { week: 7, pair: '1-8', pick: '8', voter: 'device-eeeeeeee' } });
check('matchup not on this week is rejected', r.code === 400, r);
r = await call('POST', { body: { week: 7, pair: '1-2', pick: '8', voter: 'device-eeeeeeee' } });
check('picking a team not in the matchup is rejected', r.code === 400, r);
r = await call('POST', { body: { week: 7, pair: '1-2', pick: '1', voter: 'x' } });
check('malformed voter id is rejected', r.code === 400, r);
started = true;
r = await call('POST', { body: { week: 7, pair: '1-2', pick: '1', voter: 'device-ffffffff' } });
check('voting closes once points are on the board', r.code === 409, r);
r = await call('GET', { query: { week: '7' } });
check('tallies stay visible after kickoff', r.code === 200 && !r.body.open && r.body.counts['3-8']['8'] === 4, r.body);
started = false;
process.env.VOTES_NOW = String(Date.parse('2026-10-23T00:30:00Z')); // Thursday 7:30pm Central, before the morning snapshot shows points
r = await call('POST', { body: { week: 7, pair: '1-2', pick: '1', voter: 'device-gggggggg' } });
check('voting closes at Thursday kickoff even before the snapshot has points', r.code === 409, r);
