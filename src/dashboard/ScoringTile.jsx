// 4. Scoring, as a week of steps: points a game against the league, and the last seven weeks as bars (losses faded,
// the latest in the accent, the result under each).
import { useCallback, useRef } from 'react';
import { useFrame } from './clock.js';
import { TL, back, out, seg } from './motion.js';
import { Label, Tile } from './parts.jsx';

export function ScoringTile({ m, h }) {
  const s = m.scoring, diff = s.avg ? (s.ppg - s.avg) / s.avg : 0, last = s.weeks.length - 1;
  const count = useRef(null), bars = useRef([]);
  useFrame(useCallback((t) => {
    if (count.current) count.current.textContent = h.f1(s.ppg * seg(t, TL.steps[0], TL.steps[1], out));
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      const g = seg(t, TL.bars[0] + i * TL.barStagger, TL.bars[1] + i * TL.barStagger, back);
      bar.style.transform = `scaleY(${(s.weeks[i].pts / s.max) * g})`;
    });
  }, [s, h]));

  const tip = (w) => `Week ${w.week}: ${h.f1(w.pts)} pts, ${h.ordinal(w.rank)} of ${m.n}${w.opp ? `, ${w.result === 'W' ? 'beat' : w.result === 'L' ? 'lost to' : 'tied'} ${w.opp.name} (${h.f1(w.oppPts)})` : ''}`;
  return (
    <Tile index={3} className="pp-steps">
      <Label>Scoring</Label>
      {s.best != null ? <div className="pp-range">{`Best ${h.f1(s.best)}`}</div> : null}
      <div className="pp-count-big" ref={count} />
      <div className="pp-goal">{`a game, ${Math.abs(diff) < 0.005 ? 'level with' : `${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? 'over' : 'under'}`} the league`}</div>
      {s.weeks.map((w, i) => (
        <div key={w.week} className="pp-day" style={{ '--i': i }} data-tip={tip(w)}>
          <div className="empty" />
          <div ref={(b) => { bars.current[i] = b; }} className={`bar${i === last ? ' today' : ''}${w.result === 'L' ? ' loss' : ''}`} />
          <div className={`letter${i === last ? ' today' : ''}`}>{w.result || '–'}</div>
        </div>
      ))}
    </Tile>
  );
}
