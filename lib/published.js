// What's published: the revision of today's league snapshot and the power-score weights everyone sees. Node only.
//
// The CDN caches each snapshot URL for a day, so a publish from the admin page can't change a cached URL. Instead
// every snapshot URL carries a revision (/api/league?d=2026-10-26.r0); the plain key always redirects (cached a
// minute) to the current revision, and publishing bumps it. Visitors pick up a publish within a minute, and nothing
// calls Sleeper for it: the published copy is already in the store.
import { redis, storeEnabled } from './snapstore.js';

const REV_TTL = 3 * 86400;

export async function revision(key) {
  if (!storeEnabled()) return 0;
  try { const [v] = await redis([['GET', `ph:rev:${key}`]]); return Number(v) || 0; } catch { return 0; }
}
export const revKey = (key, rev) => `${key}.r${rev}`;
// the ROS rankings get their own revision, bumped when the admin page re-scrapes the ranking sites mid-day
export async function rosRevision(key) {
  if (!storeEnabled()) return 0;
  try { const [v] = await redis([['GET', `ph:rosrev:${key}`]]); return Number(v) || 0; } catch { return 0; }
}
export async function bumpRosRevision(key) {
  const [v] = await redis([['INCR', `ph:rosrev:${key}`], ['EXPIRE', `ph:rosrev:${key}`, String(REV_TTL)]]);
  return Number(v);
}
export async function bumpRevision(key) {
  const [v] = await redis([['INCR', `ph:rev:${key}`], ['EXPIRE', `ph:rev:${key}`, String(REV_TTL)]]);
  return Number(v);
}

// published weights ({ weights, at }) or null for the engine's defaults
export async function publishedConfig() {
  if (!storeEnabled()) return null;
  try { const [v] = await redis([['GET', 'ph:config']]); return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function setConfig(cfg) {
  await redis(cfg ? [['SET', 'ph:config', JSON.stringify(cfg)]] : [['DEL', 'ph:config']]);
}

// staged weights ({ weights, at }, weights null meaning the defaults): saved from the admin page but not live until
// Dan presses "Update rankings live", which copies them into ph:config. Null when nothing is waiting.
export async function stagedConfig() {
  if (!storeEnabled()) return null;
  try { const [v] = await redis([['GET', 'ph:config:staged']]); return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function setStaged(cfg) {
  await redis(cfg ? [['SET', 'ph:config:staged', JSON.stringify(cfg)]] : [['DEL', 'ph:config:staged']]);
}
