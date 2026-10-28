// /api/talk — the league desk: one discussion thread per week beside the headlines. Anyone can read; only managers
// signed in with their personal link can post.
//
//   GET  /api/talk?week=8                       -> { enabled, week, now, me, admin, comments: [{ id, uid, text, ref, ts, edited }] }
//   POST /api/talk { action: 'claim', token }   -> signs this device in as the link's manager (HttpOnly cookie ph_who)
//   POST /api/talk { action: 'post', week, text, ref }    ref: { key: 'w8:leak', title: 'the headline' } or null
//   POST /api/talk { action: 'edit', week, id, text }     the author only, within EDIT_MS of posting
//   POST /api/talk { action: 'delete', week, id }         Dan only
//   POST /api/talk { action: 'invite', uid }              Dan only: a new personal link for a manager (the old one and its
//                                                         devices stop working)
//   POST /api/talk { action: 'signout' }
//
// Nothing here lives in the code or the CDN: comments, links and sessions are all in the store, so deploys, headline
// changes and cache purges leave them alone. Comments keep their own copy of the headline they're about.
//
// Who posted is always the server's call: a comment stores the Sleeper user id from the signed-in session, and the page
// turns it into a first name and the current team name. A personal link carries a random token after the # (so it never
// reaches server logs or the CDN); the page trades it for a session cookie the page's scripts can't read. Only hashes of
// tokens and sessions are stored. Dan gets in the first time with TALK_ADMIN_KEY (an env var only he knows) as his
// token, then makes everyone else's links from the panel. Storage is the Upstash store (lib/snapstore.js); without it GET
// answers { enabled: false } and the page hides the panel. Never touches Sleeper.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { redis, storeEnabled } from '../lib/snapstore.js';
import { MEMBERS } from '../lib/members.js';

export const ADMIN = '964343481231593472'; // Dan
export const EDIT_MS = 60 * 1000;
export const MAX_LEN = 500;
const TTL = 60 * 60 * 24 * 300; // a season and then some
const SESSION_TTL = 60 * 60 * 24 * 365;
const GAP_S = 6; // seconds between posts from one manager
const MAX_PER_WEEK = 3000;

const now = () => Number(process.env.TALK_NOW) || Date.now(); // overridable for tests
// The NFL season a moment belongs to: September through the following summer. Threads are kept per season so next year's
// week 8 never opens on this year's. The 2026 threads keep the key they were first stored under (ph:talk:{week}), so
// nothing posted this season moves; every season after gets ph:talk:{season}:{week}.
export const seasonOf = (ts) => { const d = new Date(ts); return d.getUTCMonth() < 6 ? d.getUTCFullYear() - 1 : d.getUTCFullYear(); };
export const threadKey = (week, ts = now()) => { const s = seasonOf(ts); return s === 2026 ? `ph:talk:${week}` : `ph:talk:${s}:${week}`; };
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const k = (...parts) => `ph:talk:${parts.join(':')}`;
const cookieOf = (req) => (/(?:^|;\s*)ph_who=([A-Za-z0-9_-]{20,80})/.exec(req.headers.cookie || '') || [])[1] || null;
const setSession = (res, sid, age = SESSION_TTL) => res.setHeader('Set-Cookie', `ph_who=${sid}; Path=/; Max-Age=${age}; SameSite=Lax; Secure; HttpOnly`);
const validWeek = (w) => Number.isInteger(w) && w >= 1 && w <= 22;
const same = (a, b) => { const x = Buffer.from(sha(a)), y = Buffer.from(sha(b)); return timingSafeEqual(x, y); };

// the signed-in manager, if the session is still current (a new link for them bumps their generation and ends it)
async function whoAmI(req) {
  const sid = cookieOf(req);
  if (!sid) return null;
  const [v] = await redis([['GET', k('sess', sha(sid))]]);
  if (!v) return null;
  const [uid, gen] = String(v).split(':');
  const [cur] = await redis([['GET', k('gen', uid)]]);
  return String(cur || 0) === gen ? uid : null;
}

// text as posted: no control characters, no runs of blank lines, trimmed
const clean = (t) => String(t ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();
const cleanRef = (r) => (r && typeof r === 'object' && /^[a-z0-9:-]{1,40}$/.test(String(r.key)) && typeof r.title === 'string' && r.title.trim()
  ? { key: String(r.key), title: clean(r.title).slice(0, 160) } : null);

async function thread(week) {
  const [h] = await redis([['HGETALL', threadKey(week)]]);
  const out = [];
  for (let i = 0; i + 1 < (h || []).length; i += 2) out.push(JSON.parse(h[i + 1]));
  return out.sort((a, b) => a.ts - b.ts);
}
const state = async (week, me) => ({ enabled: true, week, now: now(), me, admin: me === ADMIN, editMs: EDIT_MS, maxLen: MAX_LEN, comments: await thread(week) });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!storeEnabled()) return req.method === 'GET' ? res.status(200).json({ enabled: false }) : res.status(503).json({ error: 'The discussion is not set up yet' });
  try {
    if (req.method === 'GET') {
      const week = Number(req.query?.week);
      if (!validWeek(week)) return res.status(400).json({ error: 'Bad week' });
      return res.status(200).json(await state(week, await whoAmI(req)));
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const action = String(body.action || '');

    if (action === 'claim') {
      const token = String(body.token || '');
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return res.status(400).json({ error: 'That link is not valid' });
      const adminKey = process.env.TALK_ADMIN_KEY;
      let uid = adminKey && adminKey.length >= 16 && same(token, adminKey) ? ADMIN : null;
      if (!uid) [uid] = await redis([['GET', k('tok', sha(token))]]);
      if (!uid || !MEMBERS[uid]) return res.status(403).json({ error: 'That link has expired. Ask Dan for a new one.' });
      const [gen] = await redis([['GET', k('gen', uid)]]);
      const sid = randomBytes(24).toString('base64url');
      await redis([['SET', k('sess', sha(sid)), `${uid}:${gen || 0}`, 'EX', String(SESSION_TTL)]]);
      setSession(res, sid);
      return res.status(200).json({ me: uid, admin: uid === ADMIN });
    }
    if (action === 'signout') {
      const sid = cookieOf(req);
      if (sid) await redis([['DEL', k('sess', sha(sid))]]);
      setSession(res, 'x'.repeat(20), 0);
      return res.status(200).json({ me: null });
    }

    const me = await whoAmI(req);
    if (!me) return res.status(401).json({ error: 'Open your personal link from Dan to post' });

    if (action === 'invite') {
      if (me !== ADMIN) return res.status(403).json({ error: 'Only Dan can make links' });
      const uid = String(body.uid || '');
      if (!MEMBERS[uid]) return res.status(400).json({ error: 'Not a league manager' });
      const token = randomBytes(18).toString('base64url');
      const [old] = await redis([['GET', k('tokof', uid)]]);
      // the new link replaces the old one, and the bumped generation signs out every device the old one signed in
      await redis([
        ...(old ? [['DEL', k('tok', old)]] : []),
        ['SET', k('tok', sha(token)), uid, 'EX', String(TTL)],
        ['SET', k('tokof', uid), sha(token), 'EX', String(TTL)],
        ...(uid === ADMIN ? [] : [['INCR', k('gen', uid)]]),
      ]);
      return res.status(200).json({ uid, token });
    }

    const week = Number(body.week);
    if (!validWeek(week)) return res.status(400).json({ error: 'Bad week' });

    if (action === 'post') {
      const text = clean(body.text);
      if (!text) return res.status(400).json({ error: 'Write something first' });
      if (text.length > MAX_LEN) return res.status(400).json({ error: `Keep it under ${MAX_LEN} characters` });
      const [len] = await redis([['HLEN', threadKey(week)]]);
      if (len >= MAX_PER_WEEK) return res.status(429).json({ error: 'This week\'s thread is full' });
      const [slot] = await redis([['SET', k('gap', me), '1', 'NX', 'EX', String(GAP_S)]]);
      if (slot !== 'OK') return res.status(429).json({ error: 'Easy, one at a time. Try again in a few seconds.' });
      const ts = now(), id = `${ts.toString(36)}${randomBytes(3).toString('hex')}`;
      const c = { id, uid: me, text, ref: cleanRef(body.ref), ts };
      await redis([['HSET', threadKey(week), id, JSON.stringify(c)], ['EXPIRE', threadKey(week), String(TTL)]]);
      return res.status(200).json(await state(week, me));
    }

    const id = String(body.id || '');
    const [raw] = await redis([['HGET', threadKey(week), id]]);
    if (!raw) return res.status(404).json({ error: 'That comment is gone' });
    const c = JSON.parse(raw);

    if (action === 'edit') {
      if (c.uid !== me) return res.status(403).json({ error: 'You can only edit your own comments' });
      if (now() - c.ts > EDIT_MS) return res.status(403).json({ error: 'Comments can only be edited in the first minute' });
      const text = clean(body.text);
      if (!text || text.length > MAX_LEN) return res.status(400).json({ error: `Between 1 and ${MAX_LEN} characters` });
      await redis([['HSET', threadKey(week), id, JSON.stringify({ ...c, text, edited: now() })]]);
      return res.status(200).json(await state(week, me));
    }
    if (action === 'delete') {
      if (me !== ADMIN) return res.status(403).json({ error: 'Only Dan can delete comments' });
      await redis([['HDEL', threadKey(week), id]]);
      return res.status(200).json(await state(week, me));
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
}
