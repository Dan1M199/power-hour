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

/** The circled down-arrow that marks anything tappable to expand; CSS flips it when its parent is open. */
export const Xp = () => (
  <span className="xp" aria-hidden="true"><svg width="12" height="8" viewBox="0 0 12 8"><path d="M1 1.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
);

// the defending champion: a trophy by the team name (with the season when labelled), and pinned to the photo
const Trophy = () => (
  <svg className="trophy" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d={TROPHY_D} fill="#FFC107" stroke="#12301A" strokeWidth="1.3" strokeLinejoin="round" /></svg>
);
const TROPHY_D = 'M7 2.5h10v2h3.2v3.2a4.2 4.2 0 0 1-4.3 4.2 5.2 5.2 0 0 1-2.9 3.1v2.6h3.3v3.9H7.7v-3.9H11v-2.6a5.2 5.2 0 0 1-2.9-3.1 4.2 4.2 0 0 1-4.3-4.2V4.5H7zm0 4H5.8v1.2A2.2 2.2 0 0 0 7 9.6zm10 0v3.1a2.2 2.2 0 0 0 1.2-2V6.5z';
export const ChampTag = ({ t, h, label = true }) => (h.isChamp(t)
  ? <span className={`champ${label ? '' : ' bare'}`} title={`${h.champSeason} league champion`}><Trophy />{label ? `${h.champSeason} champ` : null}</span> : null);
export const ChampBadge = ({ t, h }) => (h.isChamp(t) ? <span className="champ-badge" title={`${h.champSeason} league champion`}><Trophy /></span> : null);
