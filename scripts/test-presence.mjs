// Runs api/presence.js against an in-memory stand-in for Upstash Redis: heartbeats count devices and teams, your own
// device isn't in the teams it gets back, cities are counted (never named), leaving and going quiet both drop you,
// bad teams are ignored, the network cap, and the store being off.
process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';
const { default: handler, WINDOW_MS } = await import('../api/presence.js');

const db = new Map();
const zset = (k) => { if (!db.has(k)) db.set(k, new Map()); return db.get(k); };
const redisCmd = ([cmd, k, ...a]) => {
  switch (cmd) {
    case 'ZADD': zset(k).set(a[1], Number(a[0])); return 1;
    case 'ZREM': return zset(k).delete(a[0]) ? 1 : 0;
    case 'ZREMRANGEBYSCORE': { let n = 0; for (const [m, s] of zset(k)) if (s >= Number(a[0]) && s <= Number(a[1])) { zset(k).delete(m); n++; } return n; }
    case 'ZRANGEBYSCORE': return [...zset(k)].filter(([, s]) => s >= Number(a[0])).sort((x, y) => x[1] - y[1]).map(([m]) => m);
    case 'HSET': { if (!db.has(k)) db.set(k, new Map()); db.get(k).set(a[0], a[1]); return 1; }
    case 'HMGET': return a.map((f) => db.get(k)?.get(f) ?? null);
    case 'INCR': { const n = Number(db.get(k) || 0) + 1; db.set(k, n); return n; }
    case 'EXPIRE': return 1;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
globalThis.fetch = async (u, opts = {}) => {
  if (u.endsWith('/pipeline')) return { ok: true, status: 200, json: async () => JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })) };
  throw new Error('unexpected ' + u);
};
const realNow = Date.now;
let skew = 0;
Date.now = () => realNow() + skew;
const device = (ip, city) => {
  let cookie = null;
  return async (payload, method = 'POST') => {
    const out = {};
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
    await handler({ method, body: JSON.stringify(payload), headers: { 'x-forwarded-for': ip, ...(city ? { 'x-vercel-ip-city': encodeURIComponent(city) } : {}), ...(cookie ? { cookie: `ph_anon=${cookie}` } : {}) } }, res);
    for (const c of [res.headers['Set-Cookie'] || []].flat()) { const m = /^ph_anon=([^;]*)/.exec(c); if (m) cookie = m[1]; }
    return out;
  };
};
const check = (label, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };

const a = device('10.0.0.1', 'Houston'), b = device('10.0.0.2', 'Houston'), c = device('10.0.0.3', 'San Antonio');
let r = await a({ team: 3 });
check('a first heartbeat sees just you', r.code === 200 && r.body.enabled && r.body.here === 1 && r.body.others === 0 && r.body.teams.length === 0, r.body);
await b({ team: 7 });
await c({});
r = await a({ team: 3 });
check('three devices here, two cities, the others\' teams only', r.body.here === 3 && r.body.others === 2 && r.body.teams.join() === '7' && r.body.cities === 2, r.body);
r = await b({ team: 7 });
check('each device gets the others\' teams', r.body.teams.join() === '3', r.body);
await c({ leave: true });
r = await a({ team: 3 });
check('leaving drops the device at once', r.body.here === 2, r.body);
r = await b({ team: 'DROP TABLE' });
check('a bad team is stored as none', r.code === 200, r);
r = await a({ team: 3 });
check('...so no team shows for it', r.body.teams.length === 0 && r.body.here === 2, r.body);
skew = WINDOW_MS + 5000;
r = await a({ team: 3 });
check('a device that goes quiet ages out', r.body.here === 1, r.body);
const flood = device('10.9.9.9');
const codes = [];
for (let i = 0; i < 405; i++) codes.push((await flood({ team: 1 })).code);
check('one network is capped at 400 beats an hour', codes.filter((x) => x === 200).length === 400 && codes.at(-1) === 429, codes.slice(-3));
r = await a({}, 'GET');
check('only POST', r.code === 405, r);

delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
const { default: off } = await import('../api/presence.js?off');
const out = {};
await off({ method: 'POST', body: '{}', headers: {} }, { setHeader() {}, status(x) { out.code = x; return this; }, json(x) { out.body = x; return this; } });
check('without the store presence stays off', out.code === 200 && out.body.enabled === false, out);
