// 3. Lineup efficiency, as the focus timer: a dial of 60 ticks, lit for the share of the best possible lineup started.
import { useCallback, useRef } from 'react';
import { useFrame } from './clock.js';
import { TL, clamp, out, seg } from './motion.js';
import { Label, Tile } from './parts.jsx';

const C = 100, TICK_IN = 86, TICK_OUT = 96, TICK_OUT_MAJOR = 99;
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2 - Math.PI / 2, r2 = i % 5 ? TICK_OUT : TICK_OUT_MAJOR;
  return { x1: C + Math.cos(a) * TICK_IN, y1: C + Math.sin(a) * TICK_IN, x2: C + Math.cos(a) * r2, y2: C + Math.sin(a) * r2, w: i % 5 ? 1.4 : 2 };
});

export function EfficiencyTile({ m, h }) {
  const e = m.efficiency, lit = e ? Math.round(e.eff * 60) : 0;
  const ticks = useRef([]), digits = useRef(null);
  useFrame(useCallback((t) => {
    const intro = seg(t, TL.ticksIn[0], TL.ticksIn[1]), on = Math.round(lit * seg(t, TL.lit[0], TL.lit[1], out));
    ticks.current.forEach((line, i) => {
      if (!line) return;
      line.setAttribute('opacity', String(clamp(intro * TL.tickFade - i * TL.tickLag)));
      line.classList.toggle('lit', i < on);
    });
    if (e && digits.current) digits.current.textContent = `${(e.eff * 100 * seg(t, TL.lit[0], TL.lit[1], out)).toFixed(1)}%`;
  }, [e, lit]));

  return (
    <Tile index={2} className="pp-eff">
      <Label>Lineup efficiency</Label>
      {e ? <div className="pp-range">{`${h.ordinal(e.rank)} of ${e.of}`}</div> : null}
      <svg className="pp-dial" width="200" height="200" viewBox="0 0 200 200"
        {...(e ? { 'data-tip': `Started ${(e.eff * 100).toFixed(1)}% of the best possible lineup, ${h.f1(e.left)} pts a week left on the bench` } : { 'aria-hidden': 'true' })}>
        {TICKS.map((k, i) => <line key={i} ref={(l) => { ticks.current[i] = l; }} className="tick" x1={k.x1.toFixed(2)} y1={k.y1.toFixed(2)} x2={k.x2.toFixed(2)} y2={k.y2.toFixed(2)} strokeWidth={k.w} opacity="0" />)}
      </svg>
      <div className="pp-digits" ref={digits}>{e ? null : '–'}</div>
      <div className="pp-caption">{e ? 'of the best lineup' : 'No games scored yet'}</div>
    </Tile>
  );
}
