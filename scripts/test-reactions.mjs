// Runs api/reactions.js against an in-memory stand-in for Upstash Redis: reacting and un-reacting, one voice per device
// per emoji, counts shared across devices, bad keys and emoji refused, the network cap, and the store being off.
process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';
const { default: handler, SET } = await import('../api/reactions.js');

const db = new Map();
const redisCmd = ([cmd, k, ...a]) => {
  const v = db.get(k);
  switch (cmd) {
    case 'SADD': { const s = v || new Set(); const had = s.has(a[0]); s.add(a[0]); db.set(k, s); return had ? 0 : 1; }
    case 'SREM': return v?.delete(a[0]) ? 1 : 0;
    case 'SCARD': return v ? v.size : 0;
    case 'SISMEMBER': return v?.has(a[0]) ? 1 : 0;
    case 'INCR': { const n = Number(v || 0) + 1; db.set(k, String(n)); return n; }
    case 'EXPIRE': return 1;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
globalThis.fetch = async (u, opts = {}) => {
  if (u.endsWith('/pipeline')) return { ok: true, status: 200, json: async () => JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })) };
  throw new Error('unexpected ' + u);
};
const device = (ip = `10.0.0.${Math.floor(Math.random() * 250)}`) => {
  let cookie = null;
  return async (method, payload) => {
    const out = {};
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
    await handler({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined, headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie: `ph_anon=${cookie}` } : {}) } }, res);
    for (const c of [res.headers['Set-Cookie'] || []].flat()) { const m = /^ph_anon=([^;]*)/.exec(c); if (m) cookie = m[1]; }
    return out;
  };
};
const check = (label, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };

const a = device(), b = device();
let r = await a('GET', { keys: 'w8:smash,w8:wallahi,BAD KEY' });
check('anyone reads, bad keys are dropped', r.code === 200 && r.body.enabled && Object.keys(r.body.counts).join() === 'w8:smash,w8:wallahi' && r.body.set.length === SET.length, r.body);
r = await a('POST', { key: 'w8:smash', emoji: '🔥', on: true });
check('a device reacts', r.code === 200 && r.body.counts['w8:smash']['🔥'] === 1 && r.body.mine['w8:smash'].includes('🔥'), r.body);
r = await a('POST', { key: 'w8:smash', emoji: '🔥', on: true });
check('reacting twice still counts once', r.body.counts['w8:smash']['🔥'] === 1, r.body);
r = await b('POST', { key: 'w8:smash', emoji: '🔥', on: true });
check("another device's reaction adds to the count", r.body.counts['w8:smash']['🔥'] === 2 && r.body.mine['w8:smash'].includes('🔥'), r.body);
r = await b('POST', { key: 'w8:smash', emoji: '💀', on: true });
r = await a('GET', { keys: 'w8:smash' });
check("each device sees its own, and everyone's counts", r.body.counts['w8:smash']['💀'] === 1 && !r.body.mine['w8:smash'].includes('💀') && r.body.mine['w8:smash'].includes('🔥'), r.body);
r = await a('POST', { key: 'w8:smash', emoji: '🔥', on: false });
check('taking a reaction back drops the count', r.body.counts['w8:smash']['🔥'] === 1 && !r.body.mine['w8:smash'].includes('🔥'), r.body);
r = await a('POST', { key: 'w8:smash', emoji: '🍕', on: true });
check('an emoji outside the set is refused', r.code === 400, r);
r = await a('POST', { key: 'not a key', emoji: '🔥', on: true });
check('a bad headline key is refused', r.code === 400, r);
const flood = device('10.9.9.9');
const codes = [];
for (let i = 0; i < 305; i++) codes.push((await flood('POST', { key: 'w8:smash', emoji: '👀', on: i % 2 === 0 })).code);
check('one network is capped at 300 changes an hour', codes.filter((c) => c === 200).length === 300 && codes.at(-1) === 429, codes.slice(-6));

delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
const { default: off } = await import('../api/reactions.js?off');
const out = {};
await off({ method: 'GET', query: { keys: 'w8:smash' }, headers: {} }, { setHeader() {}, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } });
check('without the store the bar stays off', out.code === 200 && out.body.enabled === false, out);
