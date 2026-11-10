import { TeamHub } from '../TeamHub.jsx';
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
      'Every 1-for-1, 2-for-1 and 1-for-2 swap with the rest of the league, kept only when both starting lineups get better and the consensus values line up. Ranked by how much the deal helps you, with a bonus for deals the other side should like too.')}
    <TeamHub D={D} me={me} h={h} view="lab/trades" />
    <TradesPage D={D} me={me} h={h} state={trade.state} onState={trade.onState} />
  </>;
  if (sub === 'league') return <>
    {head(null, `Everything under the hood of the rankings, plus a few things that are just fun to argue about. Hover or tap any mark for the numbers${me ? '; your team is highlighted' : ''}.`)}
    <TeamHub D={D} me={me} h={h} view="lab/league" />
    <LabPage D={D} me={me} h={h} />
  </>;
  return <>
    {head(null, me ? 'Your season at a glance. Explore your strengths, playoff path and next opponent.' : 'Explore a team’s season, strengths and playoff path. Choose your team to make this yours.')}
    <TeamHub D={D} me={me} h={h} view="lab/team" />
    <div className="paper-slot" id="paper-root">
      <TeamDashboard me={me} D={D} raw={raw} ros={ros} rid={team} h={h} calm={calm} onTeam={onTeam} />
    </div>
  </>;
}
