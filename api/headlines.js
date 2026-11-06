// /api/headlines — Dan's own headlines, written in the admin portal (#admin, src/admin) and posted straight onto the
// carousel ahead of the generated ones. Only Dan's league desk session (api/talk.js: his #join= link or TALK_ADMIN_KEY)
// can write; everyone reads.
//
//   GET  /api/headlines                                  -> { enabled, admin, now, posts: [post] } (Dan also gets the
//                                                           ones that have run out or were taken down, as `old`)
//   POST /api/headlines { action: 'post', story }        -> a new headline
//   POST /api/headlines { action: 'edit', id, story }    -> rewrite one
//   POST /api/headlines { action: 'remove', id }         -> take one down (kept in `old` for a while)
//   POST /api/headlines { action: 'restore', id }        -> put one back up
//   POST /api/headlines { action: 'order', ids }         -> the carousel order, first to last
//   POST /api/headlines { action: 'site-edit', key, story } -> rewrite one of the site's own headlines
//   POST /api/headlines { action: 'site-hide', key }     -> take one of the site's own headlines off the carousel
//   POST /api/headlines { action: 'site-reset', key }    -> the site's own headline back as the site wrote it
//   POST /api/headlines { action: 'arrange', week, keys } -> Dan's own running order for a week: every headline on the
//                                                           carousel (his and the site's) by desk key, first to last,
//                                                           whatever section each is in (Dan's request Nov 6)
//   POST /api/headlines { action: 'arrange-reset', week } -> back to the automatic order (sections together)
//
// The site's own headlines are known by their desk key (`w{week}:{type}`, storyKeys in src/hero/talk.js), so an edit or
// a hide covers that headline for that week only. Overrides live in ph:hl:site (key -> { hide, story, ts }) and come
// back to everyone with GET as `site`, since every visitor's carousel applies them. They're dropped after SITE_DAYS.
//
// A post is plain story data, the same shape app.js writes its headlines in (kicker, stamp, tone, breaking, headline,
// deck, tick, rids, player, mark) plus id, ts, until (null: until taken down), order, week and tx (the Sleeper
// transaction ids it was written about). The text is kept as written: the numbers in it never update. Stored in one
// Upstash hash (ph:hl:posts), outside the code and the CDN, so deploys leave it alone. Never touches Sleeper.
import { randomBytes } from 'node:crypto';
import { redis, storeEnabled } from '../lib/snapstore.js';
import { whoAmI, ADMIN } from './talk.js';

const KEY = 'ph:hl:posts';
const SITE = 'ph:hl:site';
const SITE_DAYS = 30;
const STORY_KEY = /^w\d{1,2}:[a-z0-9-]{1,40}$/;
const ARRANGE = 'ph:hl:arrange';
const WEEK = /^w\d{1,2}$/;
const MAX_KEYS = 40;
const TTL = 60 * 60 * 24 * 300;
const KEEP_OLD_MS = 14 * 864e5; // taken-down and run-out posts stay in Dan's list this long
const MAX_POSTS = 60;
const TONES = new Set(['trade', 'good', 'bad', 'neutral']);
const GROUPS = new Set(['trades', 'rumors', 'wire', 'week', 'players', 'league']);
const now = () => Number(process.env.HEADLINES_NOW) || Date.now(); // overridable for tests

const clean = (t, max) => String(t ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
const rid = (x) => (Number.isInteger(Number(x)) && Number(x) >= 1 && Number(x) <= 40 ? Number(x) : null);

// a story as the portal sent it, checked and trimmed; null when there's no headline to post
export function cleanStory(s) {
  if (!s || typeof s !== 'object') return null;
  const headline = clean(s.headline, 220);
  if (!headline) return null;
  const deck = clean(s.deck, 1200);
  const hook = clean(s.tick?.hook, 24), line = clean(s.tick?.line, 160);
  const p = s.player && /^[A-Z0-9]{1,8}$/.test(String(s.player.id)) ? s.player : null;
  const text = `${headline} ${deck}`;
  return {
    kicker: clean(s.kicker, 40) || 'From the desk',
    stamp: clean(s.stamp, 24) || null,
    tone: TONES.has(s.tone) ? s.tone : 'neutral',
    group: GROUPS.has(s.group) ? s.group : null,
    breaking: !!s.breaking,
    headline, deck,
    tick: hook && line ? { hook, line } : null,
    rids: [...new Set((Array.isArray(s.rids) ? s.rids : []).map(rid).filter(Boolean))].slice(0, 4),
    player: p ? {
      id: String(p.id), name: clean(p.name, 60), short: clean(p.short, 40) || clean(p.name, 40), line: clean(p.line, 40),
      pin: rid(p.pin?.rid) ? { rid: rid(p.pin.rid), label: clean(p.pin.label, 28) } : null,
    } : null,
    // names in yellow: only ones that are really in the text
    mark: [...new Set((Array.isArray(s.mark) ? s.mark : []).map((m) => clean(m, 60)).filter((m) => m && text.includes(m)))].slice(0, 4),
    tx: (Array.isArray(s.tx) ? s.tx : []).map(String).filter((x) => /^[0-9]{1,24}$/.test(x)).slice(0, 8),
    week: Number.isInteger(s.week) && s.week >= 1 && s.week <= 22 ? s.week : null,
    until: Number.isFinite(s.until) && s.until > 0 ? s.until : null,
  };
}

async function rows(key) {
  const [h] = await redis([['HGETALL', key]]);
  const out = [];
  for (let i = 0; i + 1 < (h || []).length; i += 2) { try { out.push(JSON.parse(h[i + 1])); } catch { /* skip a bad row */ } }
  return out;
}
const all = () => rows(KEY);
// the site headline overrides still in force, by key
// Dan's running orders, by week (w9 -> [keys]); dropped with the overrides, after SITE_DAYS
async function arranged() {
  const out = {};
  for (const o of await rows(ARRANGE)) if (now() - o.ts <= SITE_DAYS * 864e5) out[o.week] = o.keys;
  return out;
}
async function siteMap() {
  const t = now(), out = {}, stale = [];
  for (const o of await rows(SITE)) {
    if (t - o.ts > SITE_DAYS * 864e5) stale.push(o.key);
    else out[o.key] = o;
  }
  if (stale.length) await redis([['HDEL', SITE, ...stale]]);
  return out;
}
const live = (p, t) => !p.down && (!p.until || p.until > t);
const byOrder = (a, b) => a.order - b.order || b.ts - a.ts;
async function state(admin) {
  const t = now(), posts = await all();
  const out = { enabled: true, admin, now: t, posts: posts.filter((p) => live(p, t)).sort(byOrder), site: await siteMap(), arrange: await arranged() };
  if (admin) out.old = posts.filter((p) => !live(p, t) && t - (p.down || p.until || p.ts) < KEEP_OLD_MS).sort((a, b) => b.ts - a.ts);
  return out;
}
const save = (p) => [['HSET', KEY, p.id, JSON.stringify(p)], ['EXPIRE', KEY, String(TTL)]];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!storeEnabled()) return req.method === 'GET' ? res.status(200).json({ enabled: false, posts: [] }) : res.status(503).json({ error: 'The store is not set up' });
  try {
    const admin = (await whoAmI(req)) === ADMIN;
    if (req.method === 'GET') return res.status(200).json(await state(admin));
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    if (!admin) return res.status(403).json({ error: 'Only Dan can post headlines. Sign in first.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const posts = await all(), find = (id) => posts.find((p) => p.id === String(id));
    if (body.action === 'post') {
      const s = cleanStory(body.story);
      if (!s) return res.status(400).json({ error: 'A headline needs some words' });
      if (posts.length >= MAX_POSTS) {
        // make room: the oldest posts that are no longer up go first
        const gone = posts.filter((p) => !live(p, now())).sort((a, b) => a.ts - b.ts).slice(0, posts.length - MAX_POSTS + 1);
        if (gone.length) await redis([['HDEL', KEY, ...gone.map((p) => p.id)]]);
        else return res.status(409).json({ error: `${MAX_POSTS} headlines are up already. Take some down first.` });
      }
      // new posts go on top
      const top = Math.min(0, ...posts.filter((p) => live(p, now())).map((p) => p.order));
      const p = { ...s, id: randomBytes(5).toString('hex'), ts: now(), order: top - 1 };
      await redis(save(p));
      return res.status(200).json({ ...(await state(true)), id: p.id });
    }
    if (body.action === 'edit') {
      const p = find(body.id), s = cleanStory(body.story);
      if (!p) return res.status(404).json({ error: 'That headline is gone' });
      if (!s) return res.status(400).json({ error: 'A headline needs some words' });
      await redis(save({ ...p, ...s, edited: now() }));
      return res.status(200).json(await state(true));
    }
    if (body.action === 'remove' || body.action === 'restore') {
      const p = find(body.id);
      if (!p) return res.status(404).json({ error: 'That headline is gone' });
      const back = body.action === 'restore';
      const { down, ...rest } = p;
      // a run-out post put back up runs until taken down
      await redis(save(back ? { ...rest, until: p.until && p.until <= now() ? null : p.until } : { ...p, down: now() }));
      return res.status(200).json(await state(true));
    }
    if (body.action === 'order') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String);
      const cmds = ids.map((id, i) => [id, i]).filter(([id]) => find(id)).flatMap(([id, i]) => save({ ...find(id), order: i }));
      if (cmds.length) await redis(cmds);
      return res.status(200).json(await state(true));
    }
    if (['site-edit', 'site-hide', 'site-reset'].includes(body.action)) {
      const key = String(body.key || '');
      if (!STORY_KEY.test(key)) return res.status(400).json({ error: 'Not a headline key' });
      if (body.action === 'site-reset') await redis([['HDEL', SITE, key]]);
      else if (body.action === 'site-hide') await redis([['HSET', SITE, key, JSON.stringify({ key, hide: true, ts: now() })], ['EXPIRE', SITE, String(SITE_DAYS * 86400)]]);
      else {
        const st = cleanStory(body.story);
        if (!st) return res.status(400).json({ error: 'A headline needs some words' });
        const { until, tx, week, ...story } = st;
        await redis([['HSET', SITE, key, JSON.stringify({ key, story, ts: now() })], ['EXPIRE', SITE, String(SITE_DAYS * 86400)]]);
      }
      return res.status(200).json(await state(true));
    }
    if (body.action === 'arrange' || body.action === 'arrange-reset') {
      const week = String(body.week || '');
      if (!WEEK.test(week)) return res.status(400).json({ error: 'Not a week' });
      if (body.action === 'arrange-reset') await redis([['HDEL', ARRANGE, week]]);
      else {
        const keys = [...new Set((Array.isArray(body.keys) ? body.keys : []).map(String))];
        if (!keys.length || keys.length > MAX_KEYS || !keys.every((k) => STORY_KEY.test(k) && k.startsWith(`${week}:`))) return res.status(400).json({ error: 'Not a running order' });
        await redis([['HSET', ARRANGE, week, JSON.stringify({ week, keys, ts: now() })], ['EXPIRE', ARRANGE, String(SITE_DAYS * 86400)]]);
      }
      return res.status(200).json(await state(true));
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (x) {
    return res.status(502).json({ error: String(x.message || x) });
  }
}
