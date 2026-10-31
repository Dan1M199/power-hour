// "What it takes": P(playoffs | win k more), from simulated rest-of-seasons (whatItTakes in lib/labmodels.js). One row
// per team, one column per number of remaining wins; the ring marks the win total the sims land on most.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { whatItTakes } from '../../lib/labmodels.js';

const p0 = (x) => `${Math.round(x * 100)}%`;

export function WhatItTakes({ D, me: mine, h }) {
  const W = useMemo(() => (D._wit ||= whatItTakes(D)), [D]);
  const wrap = useRef(null);
  // wider than a phone: open it scrolled to your expected win total (or the bubble's), not to 0
  useLayoutEffect(() => {
    const w = wrap.current, cell = w && (w.querySelector('tr.mine td.likely') || w.querySelectorAll('td.likely')[5]);
    if (!cell || w.scrollWidth <= w.clientWidth) return;
    const head = w.querySelector('tbody th')?.offsetWidth || 0;
    w.scrollLeft = Math.max(0, cell.offsetLeft - head - (w.clientWidth - head - cell.offsetWidth) / 2);
  }, []);
  if (!W) return null;
  const team = (rid) => D.byRid[rid];
  const R = Math.max(...W.rows.map((r) => r.left));
  const rows = [...W.rows].sort((a, b) => b.overall - a.overall || b.likely - a.likely);
  const odds = (r, k) => r.cells[k]?.odds;
  const me = rows.find((r) => r.rid === mine);

  let lede;
  if (me) {
    const N = h.first(team(me.rid)), L = me.left;
    if (me.magic === 0) lede = `${N}, you're in ${p0(odds(me, 0) ?? me.overall)} of the time even if you lose out. Relax, but not too much.`;
    else if (me.magic == null) { const best = me.cells.filter((c) => c.odds != null).at(-1); lede = `${N}, even winning ${best ? best.k : L} of your last ${L} only gets you in ${best ? p0(best.odds) : '–'} of the time. You need help.`; }
    else {
      const below = odds(me, me.magic - 1);
      lede = `${N}: win ${me.magic} of your last ${L} and you're in ${p0(odds(me, me.magic))} of the time${below != null ? `; win ${me.magic - 1} and it's ${p0(below)}` : ''}. The sims have you winning ${me.likely}${odds(me, me.likely) != null ? `, which gets you in ${p0(odds(me, me.likely))} of the time` : ''}.`;
    }
  } else {
    const need = rows.filter((r) => r.magic != null && r.magic > 0).map((r) => r.magic);
    const typical = need.length ? need.sort((a, b) => a - b)[Math.floor(need.length / 2)] : null;
    lede = typical != null ? `The bubble in one number: most teams need ${typical} more wins to be 90% safe. Pick your team up top to see your own path.` : '';
  }

  const cols = Array.from({ length: R + 1 }, (_, k) => k);
  return (
    <section className="panel glass span-12 wit-panel"><h2>What it takes</h2>
      <p className="sub">{`We played out the rest of the regular season ${W.sims.toLocaleString('en-US')} times, then grouped the seasons by how many of their last ${R} games each team won. Each cell is how often that many wins got them into the top ${D.meta.playoffTeams}. The ringed cell is the win total the sims land on most; the last column is the fewest wins that get a team in 9 times out of 10.`}</p>
      {lede ? <p className="lab-lede">{lede}</p> : null}
      <div className="heat-wrap" ref={wrap}><table className="heat wit"><caption className="sr-only">Playoff odds by wins in the remaining games</caption>
        <thead><tr><th scope="col" className="wit-corner">Wins from here</th>{cols.map((k) => <th key={k} scope="col">{k}</th>)}<th scope="col">For 90%</th></tr></thead>
        <tbody>{rows.map((r) => {
          const t = team(r.rid);
          return (
            <tr key={r.rid} className={r.rid === mine ? 'mine' : undefined}>
              <th scope="row"><span className="wit-name">{h.short(t.name, 22)}</span><small>{`${h.record(t)}, ${p0(r.overall)} now`}</small></th>
              {cols.map((k) => {
                const c = r.cells[k];
                if (!c) return <td key={k} className="na" />;
                const tip = `${t.name}, ${k} more ${k === 1 ? 'win' : 'wins'} (${(c.share * 100).toFixed(c.share < 0.01 ? 1 : 0)}% of simulated seasons end here): ${c.odds == null ? 'too rare to call' : `in the playoffs ${p0(c.odds)} of the time`}`;
                if (c.odds == null) return <td key={k} className={`thin${k === r.likely ? ' likely' : ''}`} data-tip={tip}>·</td>;
                return <td key={k} className={k === r.likely ? 'likely' : ''} style={{ '--a': (0.04 + c.odds * 0.86).toFixed(2) }} data-tip={tip}>{`${Math.round(c.odds * 100)}%`}</td>;
              })}
              <td className="need">{r.magic == null ? <span className="magic-chip no">Needs help</span> : r.magic === 0 ? <span className="magic-chip in">Safe</span> : <span className="magic-chip">{`${r.magic} of ${r.left}`}</span>}</td>
            </tr>
          );
        })}</tbody></table></div>
    </section>
  );
}
