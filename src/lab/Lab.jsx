// The Nerd lab (#lab and #lab/team), all in React: the heading with its two pills, then the lab itself (LabPage) or
// the team dashboard (src/dashboard).
import { LabHead } from './parts.jsx';
import { LabPage } from './LabPage.jsx';
import { TeamDashboard } from '../dashboard/TeamDashboard.jsx';

/**
 * sub: 'team' for the dashboard, else the lab. D: the computed league; raw: the Sleeper snapshot; ros: consensus
 * values by player id; me: your team's rid (or null); team: the team the dashboard opens on; onTeam(rid): told when
 * the dashboard picks another; calm: reduced motion; h: the page's helpers (formatting and names, from app.js).
 */
export function Lab({ sub, D, raw, ros, me, team, onTeam, calm, h }) {
  if (sub !== 'team') return <LabPage D={D} me={me} h={h} />;
  return <>
    <LabHead sub="team">One team at a time: playoff odds, the players carrying it, how well it's managed, how it scores, where it's strong and what's left on the schedule. Tap the buttons, the games and the switch.</LabHead>
    <div className="paper-slot" id="paper-root">
      <TeamDashboard D={D} raw={raw} ros={ros} rid={team} h={h} calm={calm} onTeam={onTeam} />
    </div>
  </>;
}
