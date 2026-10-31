// "Fluke or for real?": empirical-Bayes shrinkage of each team's scoring toward what its roster projects (trueTalent in
// lib/labmodels.js). The ring is the scoring so far, the dot the best guess from here, the pill its 80% range.
import { useMemo } from 'react';
import { trueTalent } from '../../lib/labmodels.js';

const VERDICT = { hot: 'Running hot', real: 'For real', under: 'Underrated' };

export function FlukeOrReal({ D, me: mine, h }) {
  const T = useMemo(() => (D._talent ||= trueTalent(D)), [D]);
  if (!T) return null;
  const { f1 } = h, team = (rid) => D.byRid[rid];
  const vals = T.rows.flatMap((r) => [r.obs, r.lo, r.hi]);
  const step = 5, min = Math.floor((Math.min(...vals) - 2) / step) * step, max = Math.ceil((Math.max(...vals) + 2) / step) * step;
  const X = (v) => `${(((v - min) / (max - min)) * 100).toFixed(2)}%`;
  const tickStep = max - min > 40 ? 10 : 5;
  const ticks = []; for (let v = Math.ceil(min / tickStep) * tickStep; v <= max; v += tickStep) ticks.push(v);
  const hot = T.rows.filter((r) => r.verdict === 'hot').sort((a, b) => a.shift - b.shift)[0];
  const under = T.rows.filter((r) => r.verdict === 'under').sort((a, b) => b.shift - a.shift)[0];
  const me = T.rows.find((r) => r.rid === mine);
  const nm = (r) => team(r.rid).name;
  const games = Math.round(T.rows.reduce((a, r) => a + r.games, 0) / T.rows.length);
  let lede = [hot && `Biggest fluke: ${nm(hot)}, scoring ${f1(hot.obs)} a week but really more like ${f1(hot.est)}.`,
    under && `Most underrated: ${nm(under)}, stuck at ${f1(under.obs)} with a roster built for ${f1(under.est)}.`].filter(Boolean).join(' ');
  if (me && me !== hot && me !== under) lede += ` You: ${f1(me.obs)} so far, ${f1(me.est)} from here. ${me.verdict === 'hot' ? 'Enjoy it while it lasts.' : me.verdict === 'under' ? 'Better days are coming.' : 'What you see is what you get.'}`;
  const grid = <>{ticks.map((v) => <i key={v} className="tl-tick" style={{ left: X(v) }} />)}<i className="tl-avg" style={{ left: X(T.avg) }} /></>;

  return (
    <section className="panel glass span-12 talent-panel"><h2>Fluke or for real?</h2>
      <p className="sub">{`${games} games is a small sample, so a hot start can be half luck. This blends each team's scoring so far with what its roster ${T.hasRos ? 'projects' : 'should score'}, weighted by how noisy weekly scores are in this league (a team's own scores count for about ${Math.round(T.rows[0].weight * 100)}% right now, more every week). The arrow is how far each start should come back toward earth. Teams are ordered by the best guess, so this is also a true-talent ranking.`}</p>
      {lede ? <p className="lab-lede">{lede}</p> : null}
      <div className="talent">
        <div className="tl-row tl-axis"><span /><span className="tl-scale">{ticks.map((v) => <span key={v} style={{ left: X(v) }}>{v}</span>)}</span><span /></div>
        {T.rows.map((r, i) => {
          const t = team(r.rid), lo = Math.min(r.obs, r.est), d = Math.abs(r.est - r.obs);
          const tip = `${t.name}: ${f1(r.obs)} a week over ${r.games} games; the roster projects ${f1(r.prior)}. Best guess from here ${f1(r.est)}, 80% sure it lands between ${f1(r.lo)} and ${f1(r.hi)}.`;
          return (
            <div key={r.rid} className={`tl-row${r.rid === mine ? ' mine' : ''}`} style={{ '--k': i }}>
              <span className="tl-name"><b>{t.name}</b><small>{`${f1(r.est)} from here`}</small></span>
              <span className="tl-track" data-tip={tip}>{grid}
                <i className={`tl-range ${r.verdict}`} style={{ left: X(r.lo), width: `calc(${X(r.hi)} - ${X(r.lo)})` }} />
                {d >= 0.6 ? <i className={`tl-move ${r.est < r.obs ? 'left' : 'right'}`} style={{ left: X(lo), width: `calc(${X(lo + d)} - ${X(lo)})` }} /> : null}
                <i className="tl-obs" style={{ left: X(r.obs) }} /><i className="tl-est" style={{ left: X(r.est) }} />
              </span>
              <span className={`tl-verdict ${r.verdict}`}>{VERDICT[r.verdict]}</span>
            </div>
          );
        })}
      </div>
      <p className="tl-legend"><span><i className="tl-obs" />Scoring so far</span><span><i className="tl-est" />Best guess from here</span><span><i className="tl-range real" />80% range</span><span><i className="tl-avg-key" />{`League average, ${f1(T.avg)}`}</span></p>
    </section>
  );
}
