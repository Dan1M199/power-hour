// Runs api/talk.js against an in-memory stand-in for Upstash Redis: anonymous posting, the one-minute edit window for the
// device that posted, Dan-only deletes, the post limits, links (a new one signing the old devices out) and the admin key.
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

// a device: keeps whatever cookies the API hands it (the session, ph_who, and its anonymous id, ph_anon), on a network
const device = (ip = `10.0.0.${Math.floor(Math.random() * 250)}`) => {
  const jar = {};
  return async (method, payload) => {
    const out = {};
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    await handler({ method, query: method === 'GET' ? payload : {}, body: method === 'POST' ? payload : undefined, headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) } }, res);
    for (const c of [res.headers['Set-Cookie'] || []].flat()) {
      const m = /^(ph_\w+)=([^;]*);.*Max-Age=(\d+)/.exec(c);
      if (m) { if (m[3] === '0') delete jar[m[1]]; else jar[m[1]] = m[2]; }
    }
    return out;
  };
};
const check = (label, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };

const AKRM = '1004101289912926208', MO = '1004163936612089856';
const dan = device(), akrm = device(), akrm2 = device(), stranger = device();

let r = await stranger('GET', { week: 8 });
check('anyone can read', r.code === 200 && r.body.enabled && r.body.me === null && Array.isArray(r.body.comments), r);
r = await stranger('POST', { action: 'post', week: 8, text: 'hi', uid: ADMIN });
const anon1 = r.body.comments?.at(-1);
check('anyone can post, no link needed, and it goes up anonymous whatever the page claims', r.code === 200 && anon1.uid === 'anon' && anon1.text === 'hi', r.body);
check('...without the device hash going out, but marked as theirs', !('by' in anon1) && anon1.mine === true, anon1);
r = await device()('GET', { week: 8 });
check('another device sees it as not theirs', r.body.comments.at(-1).mine === false, r.body.comments.at(-1));
r = await device()('POST', { action: 'edit', week: 8, id: anon1.id, text: 'hijacked' });
check('...and cannot edit it', r.code === 403, r);
r = await stranger('POST', { action: 'edit', week: 8, id: anon1.id, text: 'hi all' });
check('the device that posted it can edit it in the first minute', r.code === 200 && r.body.comments.at(-1).text === 'hi all', r.body);
gap();
r = await stranger('POST', { action: 'delete', week: 8, id: anon1.id });
check('a stranger cannot delete', r.code === 403, r);
const flood = device('10.9.9.9');
let codes = [];
for (let i = 0; i < 45; i++) { gap(); codes.push((await flood('POST', { action: 'post', week: 7, text: `spam ${i}` })).code); }
check('one network is capped at 40 posts an hour', codes.filter((c) => c === 200).length === 40 && codes.at(-1) === 429, codes);
const sib = device('10.9.9.8'), sib2 = device('10.9.9.8');
r = await sib('POST', { action: 'post', week: 7, text: 'first' });
const r2 = await sib2('POST', { action: 'post', week: 7, text: 'second' });
check('two devices on one network still wait a few seconds between posts', r.code === 200 && r2.code === 429, [r.code, r2.code]);
gap();
r = await stranger('POST', { action: 'claim', token: 'not-a-real-token-at-all' });
check('a made-up link is refused', r.code === 403, r);

r = await dan('POST', { action: 'claim', token: 'dan-only-secret-key-123' });
check('the admin key signs Dan in', r.code === 200 && r.body.me === ADMIN && r.body.admin, r);
r = await akrm('POST', { action: 'invite', uid: MO });
check('only Dan can make links', r.code === 403, r);
r = await dan('POST', { action: 'invite', uid: AKRM });
const link1 = r.body.token;
check('Dan makes a link for Akrm', r.code === 200 && link1, r);
r = await dan('POST', { action: 'invite', uid: 'guest-saad' });
const saad = device();
const sr = await saad('POST', { action: 'claim', token: r.body.token || '' });
check('a guest Dan lists gets a link and signs in as that guest', r.code === 200 && sr.code === 200 && sr.body.me === 'guest-saad' && !sr.body.admin, [r, sr]);
r = await dan('POST', { action: 'invite', uid: 'nobody' });
check('...not for someone outside the league', r.code === 400, r);

r = await akrm('POST', { action: 'claim', token: link1 });
await akrm2('POST', { action: 'claim', token: link1 });
check('Akrm signs in with his link', r.code === 200 && r.body.me === AKRM && !r.body.admin, r);
r = await akrm('POST', { action: 'post', week: 8, text: '  Judkins for Kittle is robbery\n\n\n\nfor Chubbs  ', ref: { key: 'w8:leak', title: 'Quinshon Judkins to WarreningU is in the works' }, uid: ADMIN });
const c1 = r.body.comments?.find((c) => c.text.startsWith('Judkins'));
check('a signed-in manager posts anonymously too', r.code === 200 && c1.uid === 'anon' && c1.mine, r.body);
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
const e1 = r.body.comments?.find((c) => c.id === c1.id);
check('the author can edit in the first minute', r.code === 200 && e1.text.endsWith('actually') && e1.edited, r.body);
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
