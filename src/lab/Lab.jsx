// The Lab (#lab/team, #lab/trades, #lab/league), all in React: one heading with the section switcher, then the
// section itself: the team dashboard (src/dashboard), the trade ideas (src/trades) or the league's charts (LabPage).
import { LabHead } from './parts.jsx';
import { LabPage } from './LabPage.jsx';
import { TeamDashboard } from '../dashboard/TeamDashboard.jsx';
import { TradesPage, TradePicker } from '../trades/TradesPage.jsx';

/**
 * sub: 'team', 'trades' or 'league'. D: the computed league; raw: the Sleeper snapshot; ros: consensus values by
 * player id; me: your team's rid (or null); team: the team the dashboard opens on; onTeam(rid): told when the dashboard
 * picks another; trade: the Trades section's { state, onState, onTeam } (onTeam sets your team for the whole site);
 * calm: reduced motion; h: the page's helpers (formatting and names, from app.js).
 */
export function Lab({ sub, D, raw, ros, me, team, onTeam, trade, calm, h }) {
  const head = (aside, line) => <LabHead sub={sub} D={D} me={me} aside={aside}>{line}</LabHead>;
  if (sub === 'trades') return <>
    {head(<TradePicker D={D} me={me} onTeam={trade.onTeam} />,
      'Find fair trades that improve both starting lineups. Pick your team to explore the possibilities.')}
    <TradesPage D={D} me={me} h={h} state={trade.state} onState={trade.onState} />
  </>;
  if (sub === 'league') return <>
    {head(null, `Everything under the hood of the rankings, plus a few things that are just fun to argue about. Hover or tap any mark for the numbers${me ? '; your team is highlighted' : ''}.`)}
    <LabPage D={D} me={me} h={h} />
  </>;
  return <>
    {head(null, 'Your roster, playoff odds and season in one place. Pick a team to explore.')}
    <div className="paper-slot" id="paper-root">
      <TeamDashboard me={me} D={D} raw={raw} ros={ros} rid={team} h={h} calm={calm} onTeam={onTeam} />
    </div>
  </>;
}
