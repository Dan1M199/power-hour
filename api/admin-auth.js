// Private sign-in for the headline editor.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { redis, storeEnabled } from '../lib/snapstore.js';

export const ADMIN = '964343481231593472';
export const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_TTL = 60 * 60 * 24 * 365;
const PASSWORD_HASH = 'scrypt$YX8rSnWzsAaIkAJcbOFaIQ$opAZz_WizEq3InFQNoz1meJD8oZLsXbT7Tdeed6RdKQ';
const MAX_FAILS = 8;
const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const k = (...parts) => `ph:admin:${parts.join(':')}`;
const cookieOf = (req) => (/(?:^|;\s*)ph_admin=([A-Za-z0-9_-]{20,80})/.exec(req.headers.cookie || '') || [])[1] || null;
const addCookie = (res, c) => { const was = res.headers?.['Set-Cookie'] ?? res.getHeader?.('Set-Cookie'); res.setHeader('Set-Cookie', [...[was ?? []].flat(), c]); };
const setSession = (res, sid, age = SESSION_TTL) => addCookie(res, `ph_admin=${sid}; Path=/; Max-Age=${age}; SameSite=Lax; Secure; HttpOnly`);
const netOf = (req) => sha(`net:${String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '').split(',')[0].trim()}`);
const same = (a, b) => timingSafeEqual(Buffer.from(sha(a)), Buffer.from(sha(b)));

function passwordOk(pw) {
  const [kind, salt, hash] = String(process.env.ADMIN_PASSWORD_HASH || PASSWORD_HASH).split('$');
  if (kind !== 'scrypt' || !salt || !hash || !pw) return false;
  const want = Buffer.from(hash, 'base64url'), got = scryptSync(String(pw), salt, want.length, SCRYPT);
  return timingSafeEqual(want, got);
}

export async function whoAmI(req) {
  const sid = cookieOf(req);
  if (!sid) return null;
  const [v] = await redis([['GET', k('sess', sha(sid))]]);
  if (!v) return null;
  const [uid, gen] = String(v).split(':');
  if (uid !== ADMIN) return null;
  const [cur] = await redis([['GET', k('gen', uid)]]);
  return String(cur || 0) === gen ? uid : null;
}

async function signIn(res) {
  const [gen] = await redis([['GET', k('gen', ADMIN)]]);
  const sid = randomBytes(24).toString('base64url');
  await redis([['SET', k('sess', sha(sid)), `${ADMIN}:${gen || 0}`, 'EX', String(SESSION_TTL)]]);
  setSession(res, sid);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!storeEnabled()) return res.status(503).json({ error: 'The headline desk is not set up' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const value = String(body.password || body.key || '').slice(0, 200);
    const fails = k('fail', netOf(req));
    const [n] = await redis([['GET', fails]]);
    if (Number(n) >= MAX_FAILS) return res.status(429).json({ error: 'Too many wrong passwords from this network. Try again in an hour.' });
    const key = process.env.ADMIN_KEY || process.env.TALK_ADMIN_KEY;
    let ok = passwordOk(value);
    if (!ok && key && key.length >= 16) ok = same(value, key);
    if (!ok) {
      await redis([['INCR', fails], ['EXPIRE', fails, '3600']]);
      return res.status(403).json({ error: "That's not the password." });
    }
    await redis([['DEL', fails]]);
    await signIn(res);
    return res.status(200).json({ admin: true });
  } catch (e) { return res.status(502).json({ error: String(e.message || e) }); }
}
