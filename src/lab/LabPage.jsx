// The Nerd lab's first page (#lab): everything under the hood of the rankings, a panel each. The charts come from
// lib/charts.js as strings (Chart); the tables and the two model panels are React.
import { bumpChart, scatter, heatTable, divergingBars } from '../../lib/charts.js';
import { Chart, LabHead, PosTag, TeamAvatar } from './parts.jsx';
import { WhatItTakes } from './WhatItTakes.jsx';
import { FlukeOrReal } from './FlukeOrReal.jsx';

const POS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export function LabPage({ D, me, h }) {
  const { f1, pct, ordinal, short } = h;
  const teams = D.teams, n = teams.length, team = (rid) => D.byRid[rid];
  const weeks = D.history.map((x) => x.week);
  const focus = me || null;
  const mineAt = (list) => list.findIndex((t) => t.rid === me);

  const bump = bumpChart({
    series: teams.map((t) => ({ id: t.rid, label: t.name, short: short(t.name, 21), color: D.color[t.rid], values: t.rankHistory, img: t.rid === focus ? h.faceSrc(t) : null })),
    weeks, n, focus,
  });
  const luckRows = [...teams].sort((a, b) => b.luck - a.luck).map((t) => ({
    label: short(t.name, 20), value: t.luck, mine: t.rid === me,
    tip: `${t.name}: ${h.record(t)} actual vs ${f1(t.expectedWins)} expected wins from a ${t.allPlayW.toFixed(0)}-${t.allPlayL.toFixed(0)} all-play record`,
  }));
  const avgPf = teams.reduce((a, t) => a + t.pfPerGame, 0) / n;
  const sc = scatter({
    points: teams.map((t) => ({ id: t.rid, x: t.pfPerGame, y: t.pa / Math.max(1, t.games), color: D.color[t.rid], img: h.faceSrc(t), label: t.name, short: short(t.name, 12), tip: `${t.name}: ${f1(t.pfPerGame)} for, ${f1(t.pa / Math.max(1, t.games))} against per game` })),
    xLabel: 'Points for per game', yLabel: 'Points against per game', refX: avgPf, refY: avgPf,
    quadrants: ['Snakebitten', 'Good but unlucky', 'Struggling', 'Cruising'], focus,
  });
  const weeklyHeat = heatTable({
    caption: 'Weekly scoring finish',
    rows: teams.map((t) => short(t.name, 22)),
    mine: mineAt(teams),
    cols: D.weekly.map((w) => `W${w.week}`),
    n,
    cells: teams.map((t) => D.weekly.map((w) => {
      const wk = t.weeks.find((x) => x.week === w.week);
      return wk ? { rank: wk.rank, label: f1(wk.pts), tip: `${t.name}, week ${w.week}: ${f1(wk.pts)} pts, ${ordinal(wk.rank)} of ${n}${wk.result ? ` (${wk.result})` : ''}` } : null;
    })),
  });
  const posHeat = D.meta.hasRos ? heatTable({
    caption: 'Position group rank',
    rows: teams.map((t) => short(t.name, 22)),
    mine: mineAt(teams),
    cols: POS,
    n,
    cells: teams.map((t) => POS.map((p) => ({ rank: t.posRanks[p], label: t.posRanks[p], tip: `${t.name} ${p}: ${ordinal(t.posRanks[p])} (${h.groupSaid(t, p)})` }))),
  }) : '';
  const schedTeams = [...teams].sort((a, b) => a.schedWins - b.schedWins);
  const schedHeat = schedTeams[0]?.schedule.length ? heatTable({
    caption: 'Remaining schedule',
    mine: mineAt(schedTeams),
    rows: schedTeams.map((t) => `${short(t.name, 22)} (${t.schedWins >= 0 ? '+' : ''}${t.schedWins.toFixed(2)})`),
    cols: schedTeams[0].schedule.map((g) => `W${g.week}`),
    n,
    cells: schedTeams.map((t) => t.schedule.map((g) => {
      const o = team(g.rid);
      return { rank: n + 1 - o.powerRank, label: o.powerRank, tip: `${t.name}, week ${g.week}: vs ${o.name} (No. ${o.powerRank} power, ${f1(g.proj)} proj pts/wk), ${pct(g.pWin)} win chance` };
    })),
  }) : '';
  const oddsRows = [...teams].sort((a, b) => b.playoffPct - a.playoffPct || b.projWins - a.projWins);
  const eff = [...teams].filter((t) => t.efficiency != null).sort((a, b) => b.efficiency - a.efficiency);
  const effAvg = eff.reduce((a, t) => a + t.efficiency, 0) / (eff.length || 1);
  const effRows = eff.map((t) => ({ label: short(t.name, 20), mine: t.rid === me, value: (t.efficiency - effAvg) * 100, tip: `${t.name}: started ${(t.efficiency * 100).toFixed(1)}% of their best possible lineup, ${f1(t.leftOnBench)} pts/wk left on the bench` }));
  const roiRows = Object.values(D.managerMoves).sort((a, b) => b.net - a.net).map((m) => ({ label: short(team(m.rid).name, 20), mine: m.rid === me, value: m.net, tip: `${team(m.rid).name}: ${f1(m.waiverNet)} from adds and drops, ${f1(m.tradeNet)} from trades over ${m.moves} moves` }));

  return <>
    <LabHead>{`Everything under the hood of the rankings, plus a few things that are just fun to argue about. Hover or tap any mark for the numbers${me ? '; your team is highlighted' : ''}.`}</LabHead>
    <div className="lab-grid">
      <section className="panel glass span-12"><h2>Rank flow</h2><p className="sub">Power rank after each week. The roster half uses today's ROS values throughout, so the movement comes from results.</p><Chart html={bump} /></section>
      <WhatItTakes D={D} me={me} h={h} />
      <section className="panel glass span-6"><h2>Luck index</h2><p className="sub">Actual wins minus all-play expected wins. Orange teams are winning more than their scores deserve, blue teams less.</p><Chart html={divergingBars({ rows: luckRows })} /></section>
      <section className="panel glass span-6"><h2>Points for vs against</h2><p className="sub">Dashed lines are the league average. Bottom right is where you want to live.</p><Chart html={sc} /></section>
      <FlukeOrReal D={D} me={me} h={h} />
      {schedHeat ? <section className="panel glass span-12"><h2>Schedule strength</h2><p className="sub">{`Each cell is that week's opponent by current power rank; amber is a top team, blue a bottom one. Teams run toughest to easiest, with the schedule's effect in expected wins next to the name. This counts for ${h.pctW('schedule')}% of the power score.`}</p><Chart html={schedHeat} /></section> : null}
      <section className="panel glass span-12"><h2>Weekly finishes</h2><p className="sub">Each cell is that week's score; blue finished near the top of the league, amber near the bottom.</p><Chart html={weeklyHeat} /></section>
      {posHeat ? <section className="panel glass span-7"><h2>Position group ranks</h2><p className="sub">League rank of each team's projected rest-of-season starters by position, flex spots included.</p><Chart html={posHeat} /></section> : null}
      <section className={`panel glass ${posHeat ? 'span-5' : 'span-12'}`}><h2>Playoff odds</h2><p className="sub">{`From 10,000 simulated finishes to the regular season, top ${D.meta.playoffTeams} get in.`}</p>
        <table className="table"><thead><tr><th>Team</th><th className="num">Playoffs</th><th className="num">Bye</th><th className="num">Proj W</th><th className="num">Last</th></tr></thead><tbody>
          {oddsRows.map((t) => (
            <tr key={t.rid} className={t.rid === me ? 'mine' : undefined}>
              <td className="tm"><TeamAvatar t={t} cls="avatar xs" />{short(t.name, 20)}</td>
              <td className="num"><span className="pbar" style={{ '--v': `${(t.playoffPct * 100).toFixed(1)}%` }}><b>{pct(t.playoffPct)}</b></span></td>
              <td className="num">{pct(t.byePct)}</td><td className="num">{f1(t.projWins)}</td><td className="num">{pct(t.lastPct)}</td>
            </tr>
          ))}
        </tbody></table></section>
      <section className="panel glass span-6"><h2>Lineup efficiency</h2><p className="sub">{`Share of their best possible lineup each manager actually started, compared with the league average of ${(effAvg * 100).toFixed(1)}%.`}</p><Chart html={divergingBars({ rows: effRows, unit: ' pts' }).replace(/ pts</g, '%<')} /></section>
      <section className="panel glass span-6"><h2>Biggest single games</h2><p className="sub">Top individual starter performances this season.</p>
        <table className="table"><thead><tr><th>Player</th><th>Team</th><th className="num">Wk</th><th className="num">Pts</th></tr></thead><tbody>
          {D.topPerformances.map((p, i) => (
            <tr key={i}><td><PosTag pos={h.posOf(p.id)} />{h.nameOf(p.id)}</td><td>{short(team(p.rid).name, 18)}</td><td className="num">{p.week}</td><td className="num"><b>{f1(p.pts)}</b></td></tr>
          ))}
        </tbody></table></section>
      {D.meta.hasRos && D.divisive.length ? <section className="panel glass span-6"><h2>Experts can't agree</h2><p className="sub">Rostered players where the ranking sources disagree the most. Overall rank by source.</p>
        <table className="table"><thead><tr><th>Player</th><th className="num">FP</th><th className="num">DS</th><th className="num">LL</th></tr></thead><tbody>
          {D.divisive.map((d) => (
            <tr key={d.id}><td><PosTag pos={h.posOf(d.id)} />{h.nameOf(d.id)}<br /><small className="when">{team(d.rid)?.name || ''}</small></td><td className="num">{d.r.fp ?? '–'}</td><td className="num">{d.r.ds ?? '–'}</td><td className="num">{d.r.ll ?? '–'}</td></tr>
          ))}
        </tbody></table></section> : null}
      {D.meta.hasRos ? <section className="panel glass span-6"><h2>Waiver and trade ROI</h2><p className="sub">Consensus ROS value added through moves, valued at today's rankings. Uneven trades credit each freed roster spot as one top free agent.</p>
        <Chart html={divergingBars({ rows: roiRows })} /></section> : null}
    </div>
  </>;
}
