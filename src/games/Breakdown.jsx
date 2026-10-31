// A matchup's lineup breakdown, opened from its card: both lineups slot by slot (breakdown in lib/matchup.js), where
// the game is won by position group, and the things to watch.
import { useMemo } from 'react';
import { breakdown, shortName } from '../../lib/matchup.js';
import { TeamAvatar } from '../shared.jsx';

// a player's status chip: final, bye, out or injury letter
function Flag({ p }) {
  if (p.played) return <em className="st fin" title="Game over: these points are final">FINAL</em>;
  if (p.bye) return <em className="st out" title="On a bye this week">BYE</em>;
  if (!p.status) return null;
  const label = p.out ? (p.status === 'IR' ? 'IR' : 'OUT') : p.status[0];
  return <em className={`st ${p.out ? 'out' : p.status === 'Questionable' ? 'q' : 'd'}`} title={p.status}>{label}</em>;
}
const Who = ({ p, side }) => (p
  ? <div className={`h2h-p ${side}`}><b><span className="full">{p.name}</span><span className="short">{shortName(p)}</span></b><small>{[p.team, p.pos].filter(Boolean).join(' ')}<Flag p={p} /></small></div>
  : <div className={`h2h-p ${side} empty`}><b>Empty</b><small>nobody set</small></div>);

// one "things to watch" line: an urgent one (a sure zero, an empty slot, points left on the bench) leads with its first
// sentence in bold on a flag pip; player names are bold so the list scans
function Watch({ w }) {
  const names = [...new Set(w.names || [])].sort((x, y) => y.length - x.length);
  const bold = (text) => {
    if (!names.length) return text;
    const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
    return text.split(re).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part)).filter((x) => x !== '');
  };
  if (!w.urgent) return <li className={w.tone}>{bold(w.text)}</li>;
  const cut = w.text.search(/\.(\s|$)/) + 1 || w.text.length;
  return <li className={`${w.tone} urgent`}><strong>{w.text.slice(0, cut)}</strong>{bold(w.text.slice(cut))}</li>;
}

export function Breakdown({ D, pv, h }) {
  const bd = useMemo(() => breakdown(D, pv), [D, pv]);
  const { f1, short } = h, A = D.byRid[pv.a], B = D.byRid[pv.b];
  const max = Math.max(1, ...bd.rows.flatMap((r) => [r.a?.proj || 0, r.b?.proj || 0]));
  const tip = (p) => !p ? 'Empty slot'
    : p.played ? `${p.name}: scored ${f1(p.proj)} (game over), ${f1(p.pre)} projected`
    : `${p.name}: ${p.bye ? 'on a bye, ' : p.out ? `${p.status}, ` : ''}${f1(p.proj)} projected${p.proj > 0 && (p.fp != null || p.sl != null) ? ` (${[p.fp != null && `FantasyPros ${f1(p.fp)}`, p.sl != null && `Sleeper ${f1(p.sl)}`].filter(Boolean).join(', ')})` : ''}${p.floor != null && p.proj > 0 ? `, floor ${f1(p.floor)} to ceiling ${f1(p.ceil)}` : ''}`;
  // where each lineup comes from: the one set in Sleeper, or the best projected one standing in until it's set
  const src = (k) => (bd.source[k] === 'set'
    ? <small className="chip lu-src" data-tip="The starters set in Sleeper for this week"><span className="dot" />Set in Sleeper</small>
    : <small className="chip lu-src off" data-tip={`${(k === 'a' ? A : B).name} hasn't set a lineup, so this is their best projected one`}><span className="dot" />Not set, best lineup</small>);
  const gmax = Math.max(1, ...bd.groups.map((g) => Math.abs(g.edge)));
  return <>
    <div className="bd">
      <div className="bd-main">
        <div className="bd-head">
          <div className="a"><TeamAvatar t={A} /><b>{f1(bd.totals.a)}</b><span>{A.name}</span>{src('a')}</div>
          <div className="b"><TeamAvatar t={B} /><b>{f1(bd.totals.b)}</b><span>{B.name}</span>{src('b')}</div>
        </div>
        <div className="h2h">{bd.rows.map((r, i) => {
          const pa = r.a?.proj || 0, pb = r.b?.proj || 0;
          return (
            <div key={i} className={`h2h-row ${r.edge > 0.5 ? 'win-a' : r.edge < -0.5 ? 'win-b' : 'even'}`} data-tip={`${tip(r.a)}. ${tip(r.b)}.`}>
              <Who p={r.a} side="a" /><b className="pts a">{f1(pa)}</b><span className="slot">{r.slot === 'FLEX' ? 'FLX' : r.slot}</span><b className="pts b">{f1(pb)}</b><Who p={r.b} side="b" />
              <div className="h2h-bar"><span className="a"><i style={{ width: `${(pa / max) * 100}%` }} /></span><span className="b"><i style={{ width: `${(pb / max) * 100}%` }} /></span></div>
            </div>
          );
        })}</div>
      </div>
      <div className="bd-side">
        <h4>Where it's won</h4>
        <div className="grp-legend"><span className="a">{short(A.name, 16)}</span><span className="b">{short(B.name, 16)}</span></div>
        {bd.groups.map((g) => {
          const side = g.edge > 0.25 ? 'a' : g.edge < -0.25 ? 'b' : 'n';
          const sum = (k) => g.rows.reduce((a, r) => a + (r[k]?.proj || 0), 0);
          return <div key={g.key} className={`grp ${side}`} data-tip={`${g.key}: ${A.name} ${f1(sum('a'))}, ${B.name} ${f1(sum('b'))}`}><span className="g">{g.key}</span><span className="gtrack"><i style={{ width: `${(Math.abs(g.edge) / gmax) * 50}%` }} /></span><b>{side === 'n' ? 'Even' : `+${f1(Math.abs(g.edge))}`}</b></div>;
        })}
        <h4>Things to watch</h4>
        <ul className="watch">{bd.watch.length ? bd.watch.map((w, i) => <Watch key={i} w={w} />) : <li className="n">Nothing unusual: both lineups are set and healthy.</li>}</ul>
      </div>
    </div>
    <p className="bd-note">{`${D.live ? 'Players marked final show their actual points, locked in for the week. ' : ''}${D.meta.hasWeekly ? "Player projections are this week's, the average of FantasyPros and Sleeper (whichever has the player), and the team totals add up the lineup shown." : "Player projections are DraftSharks rest-of-season weekly averages, since this week's projections are unavailable; the card's total also blends in how each team has been scoring."} Players on a bye or ruled out count as zero. Win odds allow for a typical swing of about ${Math.round(D.meta.sd)} points a week. Hover or tap a row for each source and the floor to ceiling.`}</p>
  </>;
}
