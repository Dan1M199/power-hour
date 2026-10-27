// Runs api/poll.js against an in-memory stand-in for Upstash Redis: one vote per device, no changing it, a cap per
// network, frozen choices.
import handler from '../api/poll.js';

const db = new Map();
const redisCmd = ([cmd, k, ...a]) => {
  const v = db.get(k);
  switch (cmd) {
    case 'GET': return v ?? null;
    case 'SET': { if (a.includes('NX') && db.has(k)) return null; db.set(k, a[0]); return 'OK'; }
    case 'HGETALL': return v ? [...v].flat() : [];
    case 'HINCRBY': { const h = v || new Map(); h.set(a[0], String(Number(h.get(a[0]) || 0) + Number(a[1]))); db.set(k, h); return Number(h.get(a[0])); }
    case 'SADD': { const t = v || new Set(); const fresh = !t.has(a[0]); t.add(a[0]); db.set(k, t); return fresh ? 1 : 0; }
    case 'SCARD': return v ? v.size : 0;
    case 'EXPIRE': return 1;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
globalThis.fetch = async (u, opts = {}) => {
  if (u.endsWith('/pipeline')) return { ok: true, status: 200, json: async () => JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })) };
  throw new Error('unexpected ' + u);
};
const call = async (method, { query, body, ip = '1.1.1.1', cookie } = {}) => {
  const out = {};
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
  await handler({ method, query, body, headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie: `ph_dev=${cookie}` } : {}) } }, res);
  out.setCookie = res.headers['Set-Cookie'];
  return out;
};
const check = (label, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };
const ID = 'w7-bottom6', OPTS = [7, 2, 11, 4, 9, 12];

let r = await call('GET', { query: { id: ID } });
check('without the store: GET quietly says off', r.code === 200 && r.body.enabled === false, r);
r = await call('POST', { body: { id: ID, pick: 7, options: OPTS } });
check('...and POST is refused', r.code === 503, r);

process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';
r = await call('GET', { query: { id: 'made-up' } });
check('unknown poll is refused', r.code === 404, r);
r = await call('GET', { query: { id: ID } });
const A = r.body.device;
check('first visit: a new device id, handed out as a cookie too, nothing counted', r.code === 200 && /^[0-9a-f-]{36}$/.test(A) && r.setCookie?.includes(`ph_dev=${A}`) && r.body.options === null && r.body.total === 0 && r.body.mine === null, r);
r = await call('POST', { body: { id: ID, pick: 7, options: [1, 2, 3], device: A }, cookie: A });
check('bad choice list is refused', r.code === 400, r);
r = await call('POST', { body: { id: ID, pick: 5, options: OPTS, device: A }, cookie: A });
check('a team outside the six is refused', r.code === 400, r);
r = await call('POST', { body: { id: ID, pick: 7, options: OPTS, device: A }, cookie: A });
check('first vote counts and freezes the choices', r.code === 200 && r.body.counts[7] === 1 && r.body.mine === 7 && r.body.options.join() === OPTS.join() && !r.setCookie, r.body);
r = await call('POST', { body: { id: ID, pick: 2, options: OPTS, device: A }, cookie: A });
check('the same device cannot switch its answer', r.code === 409 && r.body.mine === 7 && r.body.counts[7] === 1 && !r.body.counts[2], r.body);
r = await call('POST', { body: { id: ID, pick: 2, options: OPTS, device: A } });
check('...nor with its cookie cleared (the page still has the id)', r.code === 409 && r.body.total === 1, r.body);
r = await call('POST', { body: { id: ID, pick: 2, options: OPTS }, cookie: A });
check('...nor with its storage cleared (the cookie still has it)', r.code === 409 && r.body.total === 1, r.body);
r = await call('GET', { query: { id: ID, device: A } });
check('GET from that device shows its pick', r.body.mine === 7, r.body);
const B = 'device-bbbbbbbbbbbbbbbb';
r = await call('POST', { body: { id: ID, pick: 2, options: [1, 3, 5, 6, 8, 10], device: B }, cookie: B });
check('a second device on the same Wi-Fi gets its own vote; its list cannot replace the frozen choices', r.code === 200 && r.body.counts[2] === 1 && r.body.total === 2 && r.body.options.join() === OPTS.join(), r.body);
for (const d of ['device-cccccccccccccccc', 'device-dddddddddddddddd']) await call('POST', { body: { id: ID, pick: 11, device: d }, cookie: d });
r = await call('POST', { body: { id: ID, pick: 11, device: 'device-eeeeeeeeeeeeeeee' }, cookie: 'device-eeeeeeeeeeeeeeee' });
check('a fifth device on the same network is turned away', r.code === 429 && r.body.total === 4, r.body);
r = await call('POST', { body: { id: ID, pick: 11, device: 'device-eeeeeeeeeeeeeeee' }, cookie: 'device-eeeeeeeeeeeeeeee', ip: '2.2.2.2' });
check('...but votes fine from another network', r.code === 200 && r.body.total === 5 && r.body.counts[11] === 3, r.body);
r = await call('GET', { query: { id: ID, device: 'device-ffffffffffffffff' }, ip: '3.3.3.3' });
check('a device that has not voted sees mine null', r.body.mine === null && r.body.total === 5, r.body);
