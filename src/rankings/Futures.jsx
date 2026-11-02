// Championship futures: fair odds to win the title, from the simulated playoff bracket.
import { ChampTag, TeamAvatar } from '../shared.jsx';

export function Futures({ D, me, h }) {
  if (!D.meta.futures) return null;
  const board = [...D.teams].sort((a, b) => b.champPct - a.champPct || b.finalPct - a.finalPct);
  return (
    <section className="panel glass futures">
      <h2>Championship futures</h2>
      <p className="sub">{`Fair odds to win the title, from 10,000 simulations of the rest of the season and the ${D.meta.playoffTeams}-team playoff bracket, bye weeks included. No house cut, so they're better than any book would give you.`}</p>
      <ol className="fut-list">{board.map((t, i) => (
        <li key={t.rid} className={`fut ${t.rid === me ? 'mine' : ''} ${i === 0 ? 'fav' : ''}`} data-tip={`${t.name}: wins the title in ${(t.champPct * 100).toFixed(1)}% of simulations, reaches the final in ${(t.finalPct * 100).toFixed(1)}%, makes the playoffs in ${h.pct(t.playoffPct)}`}>
          <TeamAvatar t={t} /><span className="fn"><b>{t.name}<ChampTag t={t} h={h} label={false} /></b><small>{`${(t.champPct * 100).toFixed(1)}% title, ${h.pct(t.finalPct)} final`}</small></span><span className="odds-tag">{h.american(t.champPct)}</span>
        </li>
      ))}</ol>
    </section>
  );
}
