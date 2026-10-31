// Pieces every React page shares.
import { useState } from 'react';

// A chart from lib/charts.js, which still builds SVG and HTML as strings (the pages not yet in React use the same
// builders). The wrapper is display: contents, so the chart lays out exactly as if it sat in the panel itself.
export const Chart = ({ html }) => <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;

// React pictures handle their own load errors: the page's fallback (initAvatarFallback in app.js) swaps the node out,
// which React can't follow, so never give them data-initials.

/** A team's Sleeper picture, or its initials when it has none or it fails to load. */
export function TeamAvatar({ t, cls = 'avatar' }) {
  const [failed, setFailed] = useState(false);
  const initials = t.name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  if (!t.avatar || failed) return <span className={`${cls} ph`} aria-hidden="true">{initials}</span>;
  return <img className={cls} src={`https://sleepercdn.com/avatars/thumbs/${t.avatar}`} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

/** The manager's photo (lib/members.js), or the team picture for an account without one. */
export function Headshot({ t, cls, h }) {
  const [failed, setFailed] = useState(false);
  const src = h.faceSrc(t);
  if (!src) return <TeamAvatar t={t} cls={cls} />;
  const first = h.first(t);
  if (failed) return <span className={`${cls} ph`} aria-hidden="true">{first[0]}</span>;
  return <img className={cls} src={src} alt={first} decoding="async" onError={() => setFailed(true)} />;
}

/** A player's position as a coloured tag. */
export const PosTag = ({ pos }) => (pos ? <span className={`pos ${pos}`}>{pos}</span> : null);
