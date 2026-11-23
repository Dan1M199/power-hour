// The Lab (#lab/team, #lab/trades and #lab/retro, #lab/whatif, #lab/league), all in React: one heading with the section switcher, then the
// section itself: the team dashboard (src/dashboard), the trade ideas (src/trades) or the trade retrospective (TradeRetro), the what if replay (WhatIf) or the league's charts (LabPage).
import { LabHead, TradeSwitch } from './parts.jsx';
import { LabPage } from './LabPage.jsx';
import { TeamDashboard } from '../dashboard/TeamDashboard.jsx';
import { TradesPage, TradePicker } from '../trades/TradesPage.jsx';
import { WhatIf } from './WhatIf.jsx';
import { TradeRetro } from './TradeRetro.jsx';

/**
 * sub: 'team', 'trades', 'retro', 'whatif' or 'league'. D: the computed league; raw: the Sleeper snapshot; ros: consensus values by
 * player id; me: your team's rid (or null); team: the team the dashboard opens on; onTeam(rid): told when the dashboard
 * picks another; trade: the Trades section's { state, onState, onTeam } (onTeam sets your team for the whole site);
 * calm: reduced motion; demo: the demo snapshot (no /api/history); h: the page's helpers (formatting and names, from app.js).
 */
export function Lab({ sub, D, raw, ros, me, team, onTeam, trade, calm, demo, h }) {
  const head = (aside, line) => <LabHead sub={sub} D={D} me={me} aside={aside}>{line}</LabHead>;
  if (sub === 'trades') return <>
    {head(<TradePicker D={D} me={me} onTeam={trade.onTeam} />,
      'Every 1-for-1, 2-for-1 and 1-for-2 swap with the rest of the league, kept only when both starting lineups get better and the consensus values line up. Ranked by how much the deal helps you, with a bonus for deals the other side should like too.')}
    <div className="lab-grid"><TradeSwitch sub={sub} /></div>
    <TradesPage D={D} me={me} h={h} state={trade.state} onState={trade.onState} />
  </>;
  if (sub === 'retro') return <>
    {head(<TradePicker D={D} me={me} onTeam={trade.onTeam} label="Trades for" />,
      `Every trade a team made, in order, judged on one thing: the points it put into starting lineups since it went through. The season is replayed as if it never happened, so you see who won, who lost and the record it would have without them.`)}
    <div className="lab-grid rt-grid"><TradeSwitch sub={sub} /><TradeRetro D={D} raw={raw} me={me} h={h} demo={demo} onTeam={trade.onTeam} /></div>
  </>;
  if (sub === 'whatif') return <>
    {head(<TradePicker D={D} me={me} onTeam={trade.onTeam} label="What if for" />,
      'Take one player off your roster, give yourself anyone who was still on the board when you drafted him (or anyone at all) for the whole season, and every week gets replayed. Your record, your seed and the standings follow.')}
    <div className="lab-grid wi-grid"><WhatIf D={D} raw={raw} me={me} h={h} demo={demo} /></div>
  </>;
  if (sub === 'league') return <>
    {head(null, `Everything under the hood of the rankings, plus a few things that are just fun to argue about. Hover or tap any mark for the numbers${me ? '; your team is highlighted' : ''}.`)}
    <LabPage D={D} me={me} h={h} />
  </>;
  return <>
    {head(null, 'One team at a time: playoff odds, the players carrying it, how well it\'s managed, how it scores, where it\'s strong, what\'s left on the schedule and how it stacks up against any rival. Tap the buttons, the games and the switches.')}
    <div className="paper-slot" id="paper-root">
      <TeamDashboard me={me} D={D} raw={raw} ros={ros} rid={team} h={h} calm={calm} onTeam={onTeam} />
    </div>
  </>;
}
