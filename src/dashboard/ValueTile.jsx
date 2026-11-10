// 9. Team value, as a stock: what the roster is worth in dollars (lib/teamvalue.js), the last three weeks as a line you
// can run a finger along, and the players holding the price up. A full-width tile in flow layout, like the face off.
import { useCallback, useMemo, useRef, useState } from 'react';
import { money, teamValues } from '../../lib/teamvalue.js';
import { StockLine } from '../value/StockLine.jsx';
import { useFrame } from './clock.js';
import { TL, out, seg } from './motion.js';
import { Label, Tile } from './parts.jsx';

const Arrow = ({ up }) => <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d={up ? 'M6 1.5 11 10H1z' : 'M6 10.5 1 2h10z'} fill="currentColor" /></svg>;

export function ValueTile({ D, raw, rid, h }) {
  const V = useMemo(() => (D._worth ||= teamValues(D, { raw })), [D, raw]);
  const v = V.teams[rid];
  const [range, setRange] = useState('recent'); // the last three weeks, or the season
  const [at, setAt] = useState(null); // the point under the finger
  const big = useRef(null), line = useRef(null), shownAt = useRef(null);
  const pts = v ? (range === 'recent' ? v.recent : v.series) : [];
  shownAt.current = at;
  useFrame(useCallback((t) => {
    if (!v) return;
    const k = seg(t, TL.steps[0], TL.steps[1], out);
    if (big.current && shownAt.current == null) big.current.textContent = money(v.value * k);
    if (line.current) line.current.style.strokeDashoffset = String(1 - seg(t, TL.bars[0], TL.steps[1], out));
  }, [v]));
  if (!v || pts.length < 2) return null;
  const p = at != null ? pts[at] : null, base = pts[0].value;
  const shown = p ? p.value : v.value, diff = shown - base, pct = base > 0 ? diff / base : 0, up = diff >= 0;
  const span = range === 'recent' ? 'past 3 weeks' : 'this season';
  const flat = Math.abs(diff) < 0.05;
  return (
    <Tile index={0} className="pp-val">
      <Label>Team value</Label>
      <div className="pv-side">
        <div className="pv-big" ref={big}>{money(shown)}</div>
        <div className={`pv-move ${flat ? 'flat' : up ? 'up' : 'down'}`}>
          {flat ? null : <Arrow up={up} />}
          {`${flat ? 'Level' : `${up ? 'Up' : 'Down'} ${money(Math.abs(diff))} (${(Math.abs(pct) * 100).toFixed(1)}%)`} ${p ? `at ${p.now ? 'today\'s price' : p.label.toLowerCase()}` : span}`}
        </div>
        <p className="pv-note">{`${h.ordinal(v.rank)} most valuable of ${V.order.length}. The league's average roster is worth ${money(V.avg)}.`}</p>
        <div className="pv-range" role="group" aria-label="How far back">
          {[['recent', '3 weeks'], ['season', 'Season']].map(([k, word]) => (
            <button type="button" key={k} aria-pressed={range === k} onClick={() => { setAt(null); setRange(k); }}>{word}</button>
          ))}
        </div>
      </div>
      <div className="pv-chart">
        <StockLine key={range} points={pts} height={210} onScrub={setAt} lineRef={line} short={range === 'season'}
          label={`${D.byRid[rid].name} value, ${span}: ${pts.map((x) => `${x.now ? 'now' : x.label} ${money(x.value)}`).join(', ')}`} />
      </div>
      <ol className="pv-hold" aria-label="Most valuable players">
        {v.holdings.slice(0, 5).map((x) => {
          const mv = Math.abs(x.change) < 0.05 ? 'flat' : x.change > 0 ? 'up' : 'down';
          return (
            <li key={x.id} data-tip={`${x.name}: ${money(x.price)}. Rest-of-season value ${h.f1(x.ros)}${x.posRank ? `, ${x.pos} #${x.posRank} in points (${h.f1(x.total)}), ${h.f1(x.ppg)} a game lately` : ', no points on record yet'}${x.bye ? ', on a bye this week (a 6% hit)' : ''}. ${mv === 'flat' ? 'Level' : `${mv === 'up' ? 'Up' : 'Down'} ${money(Math.abs(x.change))}`} over three weeks.`}>
              <span className="pv-tk">{x.pos}</span>
              <span className="pv-name"><b>{x.name}</b><small>{`${x.posRank ? `${x.pos} #${x.posRank} in points` : 'No points yet'}${x.bye ? ', bye' : ''}`}</small></span>
              <span className={`pv-px ${mv}`}><b>{money(x.price)}</b><small>{mv === 'flat' ? 'Level' : <><Arrow up={mv === 'up'} />{money(Math.abs(x.change))}</>}</small></span>
            </li>
          );
        })}
      </ol>
    </Tile>
  );
}
