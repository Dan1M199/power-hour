// /api/presence — who's on the site right now (Dan's request Nov 14: "active now", the way Instagram shows a green dot).
//
//   POST /api/presence { team }          -> { enabled, here, teams, cities }   a heartbeat, every 45 s while the tab shows
//   POST /api/presence { leave: true }   -> { ok }                             the tab went away (sendBeacon)
//
// A device is the same anonymous id the reactions use (HttpOnly cookie ph_anon; only its hash is stored). Each
// heartbeat puts the device in a sorted set by time, with the team it picked (if any) and the city Vercel's edge read
// from its IP (x-vercel-ip-city). The answer counts the devices seen in the last WINDOW_MS, lists the teams they picked
// (the page puts a green dot on those faces) and counts the distinct cities; a city is never sent back by name. Each
// network is held to MAX_PER_HOUR beats. Storage is the Upstash store; without it the answer is { enabled: false } and
// the page shows nothing. Never touches Sleeper.
import { createHash, randomBytes } from 'node:crypto';
import { redis, storeEnabled } from '../lib/snapstore.js';

export const WINDOW_MS = 100 * 1000; // a missed beat or two still counts as here
const MAX_PER_HOUR = 400;
const DAY = String(60 * 60 * 24);
const Z = 'ph:here', TEAM = 'ph:here:team', CITY = 'ph:here:city';

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const addCookie = (res, c) => { const was = res.headers?.['Set-Cookie'] ?? res.getHeader?.('Set-Cookie'); res.setHeader('Set-Cookie', [...[was ?? []].flat(), c]); };
const deviceOf = (req, res) => {
  const have = (/(?:^|;\s*)ph_anon=([A-Za-z0-9_-]{20,80})/.exec(req.headers.cookie || '') || [])[1];
  if (have) return have;
  const id = randomBytes(24).toString('base64url');
  addCookie(res, `ph_anon=${id}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure; HttpOnly`);
  return id;
};
const netOf = (req) => sha(`net:${String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '').split(',')[0].trim()}`);
// Vercel sends the city URI-encoded; only a hash of it is kept, since all the page ever gets is how many
const cityOf = (req) => { const c = req.headers['x-vercel-ip-city']; if (!c) return ''; try { return sha(`city:${decodeURIComponent(c)}`).slice(0, 16); } catch { return ''; } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!storeEnabled()) return res.status(200).json({ enabled: false });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const dev = sha(deviceOf(req, res));
    if (body.leave) {
      await redis([['ZREM', Z, dev]]);
      return res.status(200).json({ ok: true });
    }
    const net = netOf(req);
    const [hour] = await redis([['INCR', `ph:here:hour:${net}`]]);
    if (hour === 1) await redis([['EXPIRE', `ph:here:hour:${net}`, '3600']]);
    if (hour > MAX_PER_HOUR) return res.status(429).json({ error: 'Too many check-ins' });
    const team = Number.isInteger(body.team) && body.team > 0 && body.team < 100 ? body.team : 0;
    const now = Date.now(), city = cityOf(req);
    const out = await redis([
      ['ZADD', Z, String(now), dev],
      ['HSET', TEAM, dev, String(team)],
      ...(city ? [['HSET', CITY, dev, city]] : []),
      ['ZREMRANGEBYSCORE', Z, '0', String(now - WINDOW_MS)],
      ['ZRANGEBYSCORE', Z, String(now - WINDOW_MS), '+inf'],
      ['EXPIRE', Z, DAY], ['EXPIRE', TEAM, DAY], ['EXPIRE', CITY, DAY],
    ]);
    const devs = out[city ? 4 : 3] || [];
    const others = devs.filter((d) => d !== dev);
    let teams = [], cities = 0;
    if (devs.length) {
      const [ts, cs] = await redis([['HMGET', TEAM, ...devs], ['HMGET', CITY, ...devs]]);
      // the teams other devices picked (your own device is left out, so your own face doesn't light up for you)
      teams = [...new Set(devs.map((d, i) => (d === dev ? 0 : Number(ts[i]) || 0)).filter(Boolean))];
      cities = new Set((cs || []).filter(Boolean)).size;
    }
    return res.status(200).json({ enabled: true, here: devs.length, others: others.length, teams, cities });
  } catch (x) {
    return res.status(502).json({ error: String(x.message || x) });
  }
}
