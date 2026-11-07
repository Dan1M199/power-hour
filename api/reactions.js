// /api/reactions — emoji reactions under the headlines, shared by everyone. A headline is known by its desk key
// (`w{week}:{type}`, storyKeys in src/hero/storyKeys.js), so a rewritten
// headline keeps its reactions and a new week starts clean.
//
//   GET  /api/reactions?keys=w8:smash,w8:wallahi   -> { enabled, set, counts: { key: { emoji: n } }, mine: { key: [emoji] } }
//   POST /api/reactions { key, emoji, on }        -> the same, for that one key
//
// A device is one voice per emoji per headline: each (key, emoji) is a set of device hashes, so reacting twice is the
// same as reacting once and the count can't be pumped. The device is an anonymous id (HttpOnly cookie
// ph_anon, made on first visit; only its hash is stored), and each network is held to MAX_PER_HOUR changes. Storage is
// the Upstash store; without it GET answers { enabled: false } and the page leaves the bar out. Never touches Sleeper.
import { createHash, randomBytes } from 'node:crypto';
import { redis, storeEnabled } from '../lib/snapstore.js';

// the league's set, in the picker's order: the emoji and what the picker's label calls it
export const SET = [
  { e: '🔥', label: 'Fire' }, { e: '😂', label: 'Haha' }, { e: '💀', label: 'Dead' },
  { e: '🤡', label: 'Clown' }, { e: '🐐', label: 'GOAT' }, { e: '👀', label: 'Looking' },
];
const OK = new Set(SET.map((x) => x.e));
const TTL = 60 * 60 * 24 * 300;
const MAX_KEYS = 12;
const MAX_PER_HOUR = 300; // changes per network
const KEY = /^w\d{1,2}:[a-z0-9-]{1,40}$/;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const k = (key, e) => `ph:rx:${key}:${e}`;
const addCookie = (res, c) => { const was = res.headers?.['Set-Cookie'] ?? res.getHeader?.('Set-Cookie'); res.setHeader('Set-Cookie', [...[was ?? []].flat(), c]); };
// the device id used for headline reactions
const deviceOf = (req, res) => {
  const have = (/(?:^|;\s*)ph_anon=([A-Za-z0-9_-]{20,80})/.exec(req.headers.cookie || '') || [])[1];
  if (have) return have;
  const id = randomBytes(24).toString('base64url');
  addCookie(res, `ph_anon=${id}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax; Secure; HttpOnly`);
  return id;
};
const netOf = (req) => sha(`net:${String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '').split(',')[0].trim()}`);

// every key's counts and this device's own, in one round trip
async function read(keys, dev) {
  const cmds = keys.flatMap((key) => SET.flatMap(({ e }) => [['SCARD', k(key, e)], ['SISMEMBER', k(key, e), dev]]));
  const out = await redis(cmds);
  const counts = {}, mine = {};
  let i = 0;
  for (const key of keys) {
    counts[key] = {}; mine[key] = [];
    for (const { e } of SET) {
      const n = Number(out[i++]) || 0, me = Number(out[i++]) === 1;
      if (n) counts[key][e] = n;
      if (me) mine[key].push(e);
    }
  }
  return { enabled: true, set: SET, counts, mine };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!storeEnabled()) return req.method === 'GET' ? res.status(200).json({ enabled: false }) : res.status(503).json({ error: 'Reactions are not set up yet' });
  try {
    const dev = sha(deviceOf(req, res));
    if (req.method === 'GET') {
      const raw = String(req.query?.keys ?? new URL(req.url || '/', 'http://x').searchParams.get('keys') ?? '');
      const keys = [...new Set(raw.split(',').filter((x) => KEY.test(x)))].slice(0, MAX_KEYS);
      return res.status(200).json(await read(keys, dev));
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const key = String(body.key || ''), e = String(body.emoji || '');
    if (!KEY.test(key) || !OK.has(e)) return res.status(400).json({ error: 'Not a reaction' });
    const net = netOf(req);
    const [hour] = await redis([['INCR', `ph:rx:hour:${net}`]]);
    if (hour === 1) await redis([['EXPIRE', `ph:rx:hour:${net}`, '3600']]);
    if (hour > MAX_PER_HOUR) return res.status(429).json({ error: 'Easy on the reactions. Try again later.' });
    await redis([[body.on === false ? 'SREM' : 'SADD', k(key, e), dev], ['EXPIRE', k(key, e), String(TTL)]]);
    return res.status(200).json(await read([key], dev));
  } catch (x) {
    return res.status(502).json({ error: String(x.message || x) });
  }
}
