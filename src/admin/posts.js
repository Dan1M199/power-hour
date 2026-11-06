// Dan's posted headlines (api/headlines.js), kept outside React like the league desk's state: what's up now, and for Dan
// the ones taken down or run out. app.js puts the live ones on top of the carousel (carouselProps); the admin portal
// (AdminPage.jsx) writes them. `site` is Dan's edits and hides of the site's own headlines, by desk key; `arrange` his running order by week.
import { useSyncExternalStore } from 'react';

export const posts = { enabled: null, admin: false, list: [], old: [], site: {}, arrange: {}, now: 0 };
const subs = new Set();
let version = 0;
const bump = () => { version++; subs.forEach((f) => f()); };
export const usePosts = () => { useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version); return posts; };

const keep = (d) => {
  Object.assign(posts, { enabled: !!d?.enabled, admin: !!d?.admin, list: d?.posts || [], old: d?.old || [], site: d?.site || {}, arrange: d?.arrange || {}, now: d?.now || Date.now() });
  bump();
};

export async function loadPosts() {
  try {
    const r = await fetch('/api/headlines');
    keep(r.ok ? await r.json() : { enabled: false });
  } catch { keep({ enabled: false }); }
  return posts;
}

export async function postCall(body) {
  const r = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Something went wrong (${r.status})`);
  keep(j);
  return j;
}
