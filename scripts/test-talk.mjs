// Runs api/talk.js against an in-memory stand-in for Upstash Redis: personal links, posting, the one-minute edit window,
// Dan-only deletes, a new link signing the old devices out, and the admin key.
process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';
process.env.TALK_ADMIN_KEY = 'dan-only-secret-key-123';
const { default: handler, ADMIN, threadKey, seasonOf } = await import('../api/talk.js');

const db = new Map();
const redisCmd = ([cmd, k, ...a]) => {
  const v = db.get(k);
  switch (cmd) {
    case 'GET': return v ?? null;
    case 'SET': { if (a.includes('NX') && db.has(k)) return null; db.set(k, a[0]); return 'OK'; }
    case 'DEL': return db.delete(k) ? 1 : 0;
    case 'INCR': { const n = Number(v || 0) + 1; db.set(k, String(n)); return n; }
    case 'HSET': { const h = v || new Map(); h.set(a[0], a[1]); db.set(k, h); return 1; }
    case 'HGET': return v?.get(a[0]) ?? null;
    case 'HDEL': return v?.delete(a[0]) ? 1 : 0;
    case 'HLEN': return v ? v.size : 0;
    case 'HGETALL': return v ? [...v].flat() : [];
    case 'EXPIRE': return 1;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
globalThis.fetch = async (u, opts = {}) => {
  if (u.endsWith('/pipeline')) return { ok: true, status: 200, json: async () => JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })) };
  throw new Error('unexpected ' + u);
};
let clock = Date.parse('2026-10-28T12:00:00-05:00');
const tick = (ms) => { clock += ms; process.env.TALK_NOW = String(clock); };
tick(0);
const gap = () => [...db.keys()].filter((x) => x.startsWith('ph:talk:gap:')).forEach((x) => db.delete(x)); // the post gap expiring

// a device: keeps whatever session cookie the API hands it
const device = () => {
  let cookie = null;
  return async (method, payload) => {
    const out = {};
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
    await handler({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined, headers: cookie ? { cookie: `ph_who=${cookie}` } : {} }, res);
    const set = /ph_who=([^;]*);.*Max-Age=(\d+)/.exec(res.headers['Set-Cookie'] || '');
    if (set) cookie = set[2] === '0' ? null : set[1];
    return out;
  };
};
const check = (label, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };

const AKRM = '1004101289912926208', MO = '1004163936612089856';
const dan = device(), akrm = device(), akrm2 = device(), stranger = device();

let r = await stranger('GET', { week: 8 });
check('anyone can read', r.code === 200 && r.body.enabled && r.body.me === null && Array.isArray(r.body.comments), r);
r = await stranger('POST', { action: 'post', week: 8, text: 'hi' });
check('a stranger cannot post', r.code === 401, r);
r = await stranger('POST', { action: 'claim', token: 'not-a-real-token-at-all' });
check('a made-up link is refused', r.code === 403, r);

r = await dan('POST', { action: 'claim', token: 'dan-only-secret-key-123' });
check('the admin key signs Dan in', r.code === 200 && r.body.me === ADMIN && r.body.admin, r);
r = await akrm('POST', { action: 'invite', uid: MO });
check('only Dan can make links', r.code === 401, r);
r = await dan('POST', { action: 'invite', uid: AKRM });
const link1 = r.body.token;
check('Dan makes a link for Akrm', r.code === 200 && link1, r);
r = await dan('POST', { action: 'invite', uid: 'nobody' });
check('...not for someone outside the league', r.code === 400, r);

r = await akrm('POST', { action: 'claim', token: link1 });
await akrm2('POST', { action: 'claim', token: link1 });
check('Akrm signs in with his link', r.code === 200 && r.body.me === AKRM && !r.body.admin, r);
r = await akrm('POST', { action: 'post', week: 8, text: '  Judkins for Kittle is robbery\n\n\n\nfor Chubbs  ', ref: { key: 'w8:leak', title: 'Quinshon Judkins to WarreningU is in the works' }, uid: ADMIN });
const c1 = r.body.comments?.[0];
check('a post is filed under the signed-in manager, whatever the page claims', r.code === 200 && c1.uid === AKRM, r.body);
check('...tidied, with its headline', c1.text === 'Judkins for Kittle is robbery\n\nfor Chubbs' && c1.ref.key === 'w8:leak', c1);
r = await akrm('POST', { action: 'post', week: 8, text: 'again' });
check('two posts within seconds are held back', r.code === 429, r);
gap();
r = await akrm('POST', { action: 'post', week: 8, text: 'x'.repeat(501) });
check('a post over 500 characters is refused', r.code === 400, r);
r = await akrm('POST', { action: 'post', week: 8, text: '<script>alert(1)</script>', ref: { key: 'BAD KEY!', title: 't' } });
check('markup is stored as text and a bad headline key is dropped', r.code === 200 && r.body.comments.at(-1).text === '<script>alert(1)</script>' && r.body.comments.at(-1).ref === null, r.body.comments.at(-1));

tick(30 * 1000);
r = await akrm('POST', { action: 'edit', week: 8, id: c1.id, text: 'Judkins for Kittle is fair, actually' });
check('the author can edit in the first minute', r.code === 200 && r.body.comments[0].text.endsWith('actually') && r.body.comments[0].edited, r.body);
r = await dan('POST', { action: 'edit', week: 8, id: c1.id, text: 'hacked' });
check('nobody else can edit it, not even Dan', r.code === 403, r);
tick(31 * 1000);
r = await akrm('POST', { action: 'edit', week: 8, id: c1.id, text: 'too late' });
check('...and after a minute nobody can', r.code === 403, r);

r = await akrm('POST', { action: 'delete', week: 8, id: c1.id });
check('Akrm cannot delete, even his own', r.code === 403, r);
r = await dan('POST', { action: 'delete', week: 8, id: c1.id });
check('Dan can delete', r.code === 200 && !r.body.comments.some((c) => c.id === c1.id), r.body);

r = await dan('POST', { action: 'invite', uid: AKRM });
const link2 = r.body.token;
r = await akrm('GET', { week: 8 });
check('a new link signs out every device on the old one', r.body.me === null, r.body.me);
r = await akrm2('POST', { action: 'claim', token: link1 });
check('...and the old link stops working', r.code === 403, r);
r = await akrm2('POST', { action: 'claim', token: link2 });
check('...while the new one works', r.code === 200 && r.body.me === AKRM, r);
r = await dan('GET', { week: 8 });
check('Dan stays signed in through it all', r.body.me === ADMIN && r.body.admin, r.body);
r = await akrm2('POST', { action: 'signout' });
r = await akrm2('GET', { week: 8 });
check('signing out ends the session', r.body.me === null, r.body);
r = await stranger('GET', { week: 9 });
check('each week is its own thread', r.body.comments.length === 0, r.body);

// what keeps comments around: this season's threads stay where they were first stored, and next season gets its own
check('2026 threads keep the key they were first stored under', threadKey(8, Date.parse('2026-10-28T12:00:00-05:00')) === 'ph:talk:8' && threadKey(17, Date.parse('2027-01-05T12:00:00-06:00')) === 'ph:talk:17', threadKey(8));
check('...and the season runs from September into the next year', seasonOf(Date.parse('2027-02-08T12:00:00Z')) === 2026 && seasonOf(Date.parse('2027-09-10T12:00:00Z')) === 2027);
check("next season's week 8 is a thread of its own", threadKey(8, Date.parse('2027-10-27T12:00:00-05:00')) === 'ph:talk:2027:8');
gap();
r = await dan('POST', { action: 'post', week: 8, text: 'still here next week?' });
const kept = r.body.comments.length;
tick(7 * 864e5); // the next week: the page shows week 9, but week 8 stays readable
r = await stranger('GET', { week: 8 });
check('a week later, the earlier thread is all still there', r.body.comments.length === kept && r.body.comments.some((c) => c.text === 'still here next week?'), r.body.comments.length);
tick(365 * 864e5);
r = await stranger('GET', { week: 8 });
check("a year on, week 8 opens empty instead of on last season's thread", r.body.comments.length === 0, r.body.comments.length);
