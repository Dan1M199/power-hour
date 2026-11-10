import { TeamAvatar } from './shared.jsx';

// A small, persistent way back to your team. Uses the existing snapshot only.
export function TeamHub({ D, me, h, view }) {
  const t = D.byRid[me];
  if (!t) return null;
  const game = D.previews.find((p) => p.a === me || p.b === me);
  const opp = game && D.byRid[game.a === me ? game.b : game.a];
  const win = game && (game.a === me ? game.winA : 1 - game.winA);
  const links = [['lab/team', 'Your dashboard'], ['matchups', 'Your matchup'], ['wire', 'Waiver wire'], ['lab/trades', 'Trade ideas']];
  return <section className="team-hub glass" aria-label="Your team hub">
    <div className="team-hub-id"><TeamAvatar t={t} /><div><b>{t.name}</b><span>{`${h.record(t)} record, ${h.ordinal(t.seed)} in the standings`}</span></div><span className="team-hub-you">Your team</span></div>
    {opp ? <p>{`Week ${game.week}: `}<strong>{`you vs ${opp.name}`}</strong>{` — ${h.pct(win)} to win`}</p> : <p>Your season, your roster, your next move.</p>}
    <nav aria-label="Your team shortcuts">{links.map(([key, label]) => <a key={key} href={`#${key}`} aria-current={view === key ? 'page' : undefined}>{label}</a>)}</nav>
  </section>;
}
