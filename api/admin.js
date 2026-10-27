// POST /api/admin — Dan's admin page (#admin): manual Sleeper pulls into a private draft, and publishing.
//
// Body: { password, action, ... }. Every action checks the password here on the server; the page never decides
// access on its own. The password is ADMIN_PASSWORD from the environment if set, otherwise the default PIN, kept
// only as a SHA-256 hash. Five wrong tries from one network lock it for 15 minutes.
//
// Actions:
//   status  → what's live (snapshot key and revision, published weights) and the draft, if any
//   pull    → one fresh Sleeper snapshot into the draft (private; at most one pull every 2 minutes)
//   draft   → the draft snapshot, for the page to preview rankings from
//   publish → { data: true } makes the draft today's snapshot and bumps the revision so visitors see it within a
//             minute; { weights } (or weights: null for the defaults) only stages the power-score weights: nobody
//             sees them until golive
//   golive  → the staged weights become the live ones and the revision is bumped
//   unstage → drops the staged weights
//
// Needs the Upstash store (same env vars as the fan picks); without it every action answers 503.
import { createHash, timingSafeEqual } from 'node:crypto';
import { snapshot } from './league.js';
import { redis, storeEnabled, pack, unpack } from '../lib/snapstore.js';
import { leagueKey } from '../lib/newsclock.js';
import { revision, bumpRevision, publishedConfig, setConfig, stagedConfig, setStaged } from '../lib/published.js';
import { WEIGHTS } from '../lib/engine.js';

const DEFAULT_HASH = '3dab31dab247d9ae12c994a19393e6f3ef14d2e9a45f2bbbaf307386b1b98dc3'; // sha256 of the default PIN
const MAX_FAILS = 5, LOCK_S = 15 * 60, PULL_GAP_S = 120, DRAFT_TTL = 3 * 86400;
const WEIGHT_KEYS = ['rosProj', 'depth', 'sos', 'allPlay', 'pfPerGame', 'winPct', 'standing', 'form', 'lastWeek'];

const sha = (s) => createHash('sha256').update(String(s)).digest();
const expected = () => (process.env.ADMIN_PASSWORD ? sha(process.env.ADMIN_PASSWORD) : Buffer.from(DEFAULT_HASH, 'hex'));
const ipHash = (req) => sha(String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()).toString('hex').slice(0, 16);

function validWeights(w) {
  if (w === null) return null;
  if (!w || typeof w !== 'object') throw new Error('weights must be an object');
  const out = {};
  for (const [k, v] of Object.entries(w)) {
    if (!WEIGHT_KEYS.includes(k)) throw new Error(`unknown weight ${k}`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`weight ${k} must be between 0 and 1`);
    if (n > 0) out[k] = Math.round(n * 1000) / 1000;
  }
  if (!Object.keys(out).length) throw new Error('at least one weight must be above zero');
  return out;
}

async function status(key) {
  const [draftMeta, lastPull] = await redis([['GET', 'ph:admin:draft-meta'], ['TTL', 'ph:admin:pull-gap']]);
  return {
    key, rev: await revision(key),
    config: await publishedConfig(), staged: await stagedConfig(), defaults: WEIGHTS,
    draft: draftMeta ? JSON.parse(draftMeta) : null,
    nextPullIn: lastPull > 0 ? lastPull : 0,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!storeEnabled()) return res.status(503).json({ error: 'The admin page needs the Upstash store connected (Vercel, Storage)' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const failKey = `ph:admin:fail:${ipHash(req)}`;
  try {
    const [fails] = await redis([['GET', failKey]]);
    if (Number(fails) >= MAX_FAILS) return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes' });
    const given = sha(body.password ?? '');
    if (!timingSafeEqual(given, expected())) {
      await redis([['INCR', failKey], ['EXPIRE', failKey, String(LOCK_S)]]);
      return res.status(401).json({ error: 'Wrong password' });
    }
    await redis([['DEL', failKey]]);

    const key = leagueKey();
    switch (body.action) {
      case 'status':
        return res.status(200).json(await status(key));

      case 'pull': {
        // one pull every two minutes at most, however many times the button is pressed
        const [ok] = await redis([['SET', 'ph:admin:pull-gap', '1', 'NX', 'EX', String(PULL_GAP_S)]]);
        if (ok !== 'OK') return res.status(429).json({ error: 'Pulled less than two minutes ago. Use the draft you have', ...(await status(key)) });
        const snap = await snapshot();
        const meta = { key, fetched: snap.fetched, week: snap.state?.week };
        await redis([['SET', 'ph:admin:draft', pack(snap), 'EX', String(DRAFT_TTL)], ['SET', 'ph:admin:draft-meta', JSON.stringify(meta), 'EX', String(DRAFT_TTL)]]);
        return res.status(200).json({ ...(await status(key)), snapshot: snap });
      }

      case 'draft': {
        const [v] = await redis([['GET', 'ph:admin:draft']]);
        return res.status(200).json({ ...(await status(key)), snapshot: v ? unpack(v) : null });
      }

      case 'publish': {
        const did = [];
        if (body.data) {
          const [v] = await redis([['GET', 'ph:admin:draft']]);
          if (!v) return res.status(400).json({ error: 'No draft to publish. Pull from Sleeper first' });
          // a draft from an earlier window (say, yesterday morning) would roll today's snapshot backwards
          const [m] = await redis([['GET', 'ph:admin:draft-meta']]);
          if (JSON.parse(m || '{}').key !== key) return res.status(400).json({ error: "The draft is older than today's snapshot. Pull again before publishing" });
          await redis([['SET', `ph:snap:league:${key}`, v, 'EX', String(3 * 86400)]]);
          did.push('data');
        }
        if ('weights' in body) {
          // weights wait in the staging slot until Dan sends them live
          const w = validWeights(body.weights);
          await setStaged({ weights: w, at: new Date().toISOString() });
          did.push(w ? 'weights' : 'default weights');
        }
        if (!did.length) return res.status(400).json({ error: 'Nothing to publish' });
        // only new data needs a new revision; staged weights change nothing visitors see
        const rev = body.data ? await bumpRevision(key) : await revision(key);
        return res.status(200).json({ published: did, ...(await status(key)), rev });
      }

      case 'golive': {
        const staged = await stagedConfig();
        if (!staged) return res.status(400).json({ error: 'No staged weights. Publish some first' });
        await setConfig(staged.weights ? { weights: staged.weights, at: new Date().toISOString() } : null);
        await setStaged(null);
        const rev = await bumpRevision(key);
        return res.status(200).json({ live: staged.weights ? 'weights' : 'default weights', ...(await status(key)), rev });
      }

      case 'unstage':
        await setStaged(null);
        return res.status(200).json(await status(key));

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
}
