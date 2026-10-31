// 1. Playoff odds, as the weather: the number counts up and the sun climbs its arc to today's odds; the rings on the
// arc are where the odds go with a win and with a loss this week.
import { useCallback, useRef } from 'react';
import { useFrame } from './clock.js';
import { TL, clamp, out, seg } from './motion.js';
import { Label, Tile } from './parts.jsx';

const ARC = 'M8 76 C 60 -14, 188 -14, 240 76';

export function OddsTile({ m, h }) {
  const { pct } = h, g = m.game, o = m.odds;
  const big = useRef(null), path = useRef(null), lit = useRef(null), sun = useRef(null), glow = useRef(null), marks = useRef([]);
  const rings = g && o.ifWin != null ? [o.ifLoss, o.ifWin] : [];
  const at = (share) => path.current.getPointAtLength(path.current.getTotalLength() * clamp(share));

  useFrame(useCallback((t) => {
    if (!big.current || !path.current) return;
    big.current.textContent = `${Math.round(100 * o.playoff * seg(t, TL.count[0], TL.count[1], out))}%`;
    const k = o.playoff * seg(t, TL.sun[0], TL.sun[1]), p = at(k), show = String(seg(t, TL.sunShow[0], TL.sunShow[1]));
    lit.current.setAttribute('stroke-dashoffset', String(1 - k));
    for (const c of [sun.current, glow.current]) { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('opacity', show); }
    marks.current.forEach((c, i) => {
      if (!c) return;
      const q = at(rings[i]);
      c.setAttribute('cx', q.x); c.setAttribute('cy', q.y);
      c.setAttribute('opacity', String(seg(t, TL.marks[0], TL.marks[1])));
    });
  }, [o.playoff, rings[0], rings[1]]));

  return (
    <Tile index={0} className="pp-odds">
      <Label>Playoff odds</Label>
      <div className="pp-range">{`Bye ${pct(o.bye)}, title ${pct(o.champ)}`}</div>
      <div className="pp-big" ref={big} />
      <div className="pp-sky">
        {rings.length ? (pct(o.ifWin) === pct(o.ifLoss) ? `${pct(o.ifWin)} win or lose this week` : `${pct(o.ifWin)} with a win, ${pct(o.ifLoss)} with a loss`) : m.t.tier?.label || ''}
      </div>
      <svg className="pp-arc" width="248" height="86" viewBox="0 0 248 86" aria-hidden="true">
        <path className="dotted" ref={path} d={ARC} strokeWidth="1.2" strokeDasharray="2 4" />
        <line className="horizon" x1="0" x2="248" y1="76" y2="76" />
        <path className="lit" ref={lit} d={ARC} strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset="1" />
        {rings.length ? <>
          <circle className="mk" r="4.5" ref={(c) => { marks.current[0] = c; }} data-tip={`Lose to ${g.opp.name} in week ${g.week}: ${pct(o.ifLoss)}`} />
          <circle className="mk" r="4.5" ref={(c) => { marks.current[1] = c; }} data-tip={`Beat ${g.opp.name} in week ${g.week}: ${pct(o.ifWin)}`} />
        </> : null}
        <circle className="glow" ref={glow} r="14" opacity="0" />
        <circle className="sun" ref={sun} r="6" opacity="0" data-tip={`Playoff odds today: ${pct(o.playoff)}, from 10,000 simulated seasons`} />
      </svg>
      <div className="pp-time left">Out</div><div className="pp-time right">In</div>
    </Tile>
  );
}
