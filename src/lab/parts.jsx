// The Lab's heading: the title, the section switcher and the section's own line, with an optional control on the
// right (the Trades section's team picker).
import { tradeIdeas } from '../../lib/trades.js';

// the three sections, personal to league-wide; the route is #lab/<key>
export const SECTIONS = ['team', 'trades', 'league'];

// the switcher: one segment per section, each with a line saying what's behind it (phones show the labels only)
function LabTabs({ sub, D, me }) {
  const ideas = me && D.meta.hasRos ? ((D._ideas ||= {})[me] ||= tradeIdeas(D, me)) : null;
  const items = [
    ['team', 'Your team', 'Nine cards, any team'],
    ['trades', 'Trades', !D.meta.hasRos ? 'Needs the rankings' : !me ? 'Pick your team' : `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'} for ${D.byRid[me].name}`],
    ['league', 'League', 'Playoff race, form, roster moves'],
  ];
  return (
    <nav className="lab-tabs" aria-label="Lab sections">
      {items.map(([k, label, line]) => (
        <a key={k} href={`#lab/${k}`} aria-current={sub === k ? 'page' : undefined}>
          <b>{label}</b><small>{line}</small>
        </a>
      ))}
    </nav>
  );
}

/** sub: the section; D, me: the league and your team; aside: a control on the right */
export function LabHead({ sub, D, me, aside, children }) {
  return (
    <section className="view-head lab-head">
      <div>
        <h1>The Lab</h1>
        <LabTabs sub={sub} D={D} me={me} />
        <p>{children}</p>
      </div>
      {aside ? <div className="lab-aside">{aside}</div> : null}
    </section>
  );
}
