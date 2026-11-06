// Runs api/headlines.js against an in-memory stand-in for Upstash Redis: only Dan's desk session (claimed through
// api/talk.js with the admin key) can post, edit, take down, restore and reorder; everyone reads what's up; bad stories
// are cleaned or refused; posts run out at `until`; the store being off.
process.env.KV_REST_API_URL = 'https://example.upstash.io';
process.env.KV_REST_API_TOKEN = 'test';
process.env.TALK_ADMIN_KEY = 'dan-only-secret-key-123';
// a stand-in admin password for the test, hashed the same way as the real one
process.env.ADMIN_TEST_PASSWORD = 'test-password-1';
{
  const { scryptSync } = await import('node:crypto');
  process.env.ADMIN_PASSWORD_HASH = `scrypt$testsalt$${scryptSync('test-password-1', 'testsalt', 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64url')}`;
}
const { default: talk } = await import('../api/talk.js');
const { default: headlines, cleanStory } = await import('../api/headlines.js');

const db = new Map();
const redisCmd = ([cmd, k, ...a]) => {
  const v = db.get(k);
  switch (cmd) {
    case 'GET': return v ?? null;
    case 'SET': { if (a.includes('NX') && db.has(k)) return null; db.set(k, a[0]); return 'OK'; }
    case 'DEL': return db.delete(k) ? 1 : 0;
    case 'INCR': { const n = Number(v || 0) + 1; db.set(k, String(n)); return n; }
    case 'HSET': { const h = v || new Map(); h.set(a[0], a[1]); db.set(k, h); return 1; }
    case 'HDEL': { let n = 0; for (const f of a) n += v?.delete(f) ? 1 : 0; return n; }
    case 'HGETALL': return v ? [...v].flat() : [];
    case 'EXPIRE': return 1;
    default: throw new Error(`unmocked ${cmd}`);
  }
};
globalThis.fetch = async (u, opts = {}) => {
  if (u.endsWith('/pipeline')) return { ok: true, status: 200, json: async () => JSON.parse(opts.body).map((c) => ({ result: redisCmd(c) })) };
  throw new Error('unexpected ' + u);
};
let clock = Date.parse('2026-11-06T12:00:00-06:00');
const tick = (ms) => { clock += ms; process.env.HEADLINES_NOW = process.env.TALK_NOW = String(clock); };
tick(0);

const device = (ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`) => {
  const jar = {};
  const call = (handler) => async (method, payload) => {
    const out = {};
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; } };
    const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    await handler({ method, query: {}, body: method === 'POST' ? payload : undefined, headers: { 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) } }, res);
    for (const c of [res.headers['Set-Cookie'] || []].flat()) { const m = /^(ph_\w+)=([^;]*)/.exec(c); if (m) jar[m[1]] = m[2]; }
    return out;
  };
  return { hl: call(headlines), talk: call(talk) };
};
const check = (label, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}${cond ? '' : ` -> ${JSON.stringify(detail)}`}`); if (!cond) process.exitCode = 1; };

const story = (headline, extra = {}) => ({
  kicker: 'Trade desk', stamp: 'Done deal', tone: 'trade', breaking: true, headline,
  deck: 'Ja\'Marr Chase heads to Mo. By consensus value it is close to even.', tick: { hook: 'Done deal', line: 'Chase to Mo.' },
  rids: [3, 7], player: { id: '7564', name: "Ja'Marr Chase", short: 'J. Chase', line: 'WR, CIN', pin: { rid: 3, label: 'To Mo' } },
  mark: ["Ja'Marr Chase", 'Nobody'], tx: ['1234567890'], week: 10, until: null, ...extra,
});

const dan = device(), fan = device();
let r = await fan.hl('GET');
check('anyone reads, nothing is up yet', r.code === 200 && r.body.enabled && r.body.posts.length === 0 && r.body.admin === false && !r.body.old, r.body);
r = await fan.hl('POST', { action: 'post', story: story('Not Dan') });
check('a stranger cannot post', r.code === 403, r);
r = await fan.talk('POST', { action: 'claim', token: 'wrong-key-wrong-key-1' });
r = await fan.hl('POST', { action: 'post', story: story('Still not Dan') });
check('a wrong key does not sign anyone in', r.code === 403, r);

// the #admin password: the right one signs a device in as Dan, wrong ones are capped per network
const pwDevice = device();
r = await pwDevice.talk('POST', { action: 'password', password: 'wrong' });
check('a wrong password is refused', r.code === 403, r);
r = await pwDevice.hl('POST', { action: 'post', story: story('Not yet') });
check('and that device still cannot post', r.code === 403, r);
r = await pwDevice.talk('POST', { action: 'password', password: process.env.ADMIN_TEST_PASSWORD });
check('the admin password signs in as Dan', r.code === 200 && r.body.admin, r.body);
r = await pwDevice.hl('GET');
check('the headline desk knows it is Dan', r.body.admin === true, r.body);
const guesser = device();
const codes = [];
for (let i = 0; i < 9; i++) codes.push((await guesser.talk('POST', { action: 'password', password: `guess${i}` })).code);
r = await guesser.talk('POST', { action: 'password', password: process.env.ADMIN_TEST_PASSWORD });
check('after 8 wrong guesses a network is locked out for the hour, right password or not', codes.slice(0, 8).every((c) => c === 403) && codes[8] === 429 && r.code === 429, { codes, last: r.code });

r = await dan.talk('POST', { action: 'claim', token: 'dan-only-secret-key-123' });
check('Dan signs in with the admin key', r.code === 200 && r.body.admin, r.body);
r = await dan.hl('GET');
check('Dan is the admin', r.body.admin === true && Array.isArray(r.body.old), r.body);
r = await dan.hl('POST', { action: 'post', story: story("Mo lands Ja'Marr Chase") });
const first = r.body.id;
check('Dan posts a headline', r.code === 200 && r.body.posts.length === 1 && r.body.posts[0].id === first, r.body);
const p = r.body.posts[0];
check('the mark keeps only names that are in the text', p.mark.length === 1 && p.mark[0] === "Ja'Marr Chase", p.mark);
check('the story keeps its player card, pin and transactions', p.player.pin.rid === 3 && p.tx[0] === '1234567890' && p.rids.join() === '3,7', p);
tick(1000);
r = await dan.hl('POST', { action: 'post', story: story('Second one', { until: clock + 3600e3 }) });
const second = r.body.id;
check('a new post goes on top', r.body.posts.map((x) => x.id).join() === `${second},${first}`, r.body.posts.map((x) => x.id));
r = await fan.hl('GET');
check('everyone sees both, without the old list', r.body.posts.length === 2 && !r.body.old, r.body);

r = await dan.hl('POST', { action: 'order', ids: [first, second] });
check('Dan reorders them', r.body.posts.map((x) => x.id).join() === `${first},${second}`, r.body.posts.map((x) => x.id));
r = await dan.hl('POST', { action: 'edit', id: first, story: story('Rewritten') });
check('Dan rewrites one in place', r.body.posts[0].headline === 'Rewritten' && r.body.posts[0].id === first && r.body.posts[0].edited, r.body.posts[0]);
r = await fan.hl('POST', { action: 'edit', id: first, story: story('Hijack') });
check('a stranger cannot edit', r.code === 403, r);

r = await dan.hl('POST', { action: 'remove', id: first });
check('taking one down hides it and keeps it in the old list', r.body.posts.length === 1 && r.body.old.some((x) => x.id === first), r.body);
r = await dan.hl('POST', { action: 'restore', id: first });
check('and it can go back up', r.body.posts.some((x) => x.id === first) && !r.body.old.some((x) => x.id === first), r.body);
tick(3601e3);
r = await fan.hl('GET');
check('a post runs out at its time', r.body.posts.length === 1 && r.body.posts[0].id === first, r.body.posts.map((x) => x.id));

// the site's own headlines: edit one, hide another, put it back
r = await fan.hl('POST', { action: 'site-hide', key: 'w10:upset' });
check("a stranger cannot touch the site's headlines", r.code === 403, r);
r = await dan.hl('POST', { action: 'site-edit', key: 'w10:upset', story: story('Upset city, rewritten') });
check("Dan rewrites a site headline", r.code === 200 && r.body.site['w10:upset'].story.headline === 'Upset city, rewritten' && !('until' in r.body.site['w10:upset'].story), r.body.site);
r = await dan.hl('POST', { action: 'site-hide', key: 'w10:dud' });
r = await fan.hl('GET');
check('everyone gets the overrides', r.body.site['w10:dud'].hide === true && r.body.site['w10:upset'].story, r.body.site);
r = await dan.hl('POST', { action: 'site-reset', key: 'w10:dud' });
check('a hidden site headline comes back', !r.body.site['w10:dud'] && r.body.site['w10:upset'], r.body.site);
r = await dan.hl('POST', { action: 'site-hide', key: 'not a key' });
check('a bad key is refused', r.code === 400, r);
tick(31 * 864e5);
r = await fan.hl('GET');
check('overrides run out after 30 days', !Object.keys(r.body.site).length, r.body.site);

r = await dan.hl('POST', { action: 'post', story: story('   ') });
check('an empty headline is refused', r.code === 400, r);
const c = cleanStory({ headline: 'Hi\u0007 there\nfriend', tone: 'pink', rids: [1, 1, 'x', 99], player: { id: 'bad id' }, kicker: '' });
check('stories are cleaned', c.headline === 'Hi there friend' && c.tone === 'neutral' && c.rids.join() === '1' && c.player === null && c.kicker === 'From the desk', c);

delete process.env.KV_REST_API_URL; delete process.env.KV_REST_API_TOKEN;
const { default: off } = await import('../api/headlines.js?off');
const res = { headers: {}, setHeader() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
await off({ method: 'GET', headers: {} }, res);
check('without the store, GET says it is off', res.code === 200 && res.body.enabled === false, res.body);
