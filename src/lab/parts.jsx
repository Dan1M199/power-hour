// Small pieces the Lab pages share.
import { useState } from 'react';

// A chart from lib/charts.js, which still builds SVG and HTML as strings (the pages not yet in React use the same
// builders). The wrapper is display: contents, so the chart lays out exactly as if it sat in the panel itself.
export const Chart = ({ html }) => <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />;

// A team's Sleeper picture, or its initials when it has none or it fails to load. React handles the error itself: the
// page's own fallback (initAvatarFallback) swaps the node out, which React can't follow.
export function TeamAvatar({ t, cls = 'avatar' }) {
  const [failed, setFailed] = useState(false);
  const initials = t.name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  if (!t.avatar || failed) return <span className={`${cls} ph`} aria-hidden="true">{initials}</span>;
  return <img className={cls} src={`https://sleepercdn.com/avatars/thumbs/${t.avatar}`} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

// a player's position as a coloured tag
export const PosTag = ({ pos }) => (pos ? <span className={`pos ${pos}`}>{pos}</span> : null);

// the Lab's two pages, as pills under its heading
export const LabNav = ({ sub }) => (
  <nav className="filters lab-nav" aria-label="Nerd lab pages">
    <a href="#lab" aria-current={sub ? undefined : 'page'}>The lab</a>
    <a href="#lab/team" aria-current={sub === 'team' ? 'page' : undefined}>Team dashboard</a>
  </nav>
);

export function LabHead({ sub, children }) {
  return (
    <section className="view-head"><div>
      <h1><span className="wk">For the spreadsheet people</span>Nerd Lab</h1>
      <p>{children}</p>
      <LabNav sub={sub} />
    </div></section>
  );
}
