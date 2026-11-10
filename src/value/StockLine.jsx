// A team's value drawn like a stock: one line, a dotted rule at where it opened, a live dot on the last price. Drag or
// hover along it to read any week (onScrub gets the point's index, or null when you let go). Used by the team
// dashboard's value tile and the scouting report; each styles it through the --stk-* variables on its own wrapper.
import { useRef, useState } from 'react';

const W = 560, PAD = { l: 10, r: 14, t: 16, b: 14 };

/**
 * points: [{ label, value, now }], oldest first; height: the drawing's height on its 560-wide grid; lineRef: gets the
 * line's path (the dashboard draws it in with its intro); short: week labels as "W5"; area: a soft fill under the line.
 */
export function StockLine({ points, height = 190, onScrub, lineRef, label, short = false, area = false }) {
  const [at, setAt] = useState(null);
  const svg = useRef(null);
  const n = points.length;
  if (n < 2) return null;
  const vals = points.map((p) => p.value), lo = Math.min(...vals), hi = Math.max(...vals);
  // a flat week still gets a line with air around it: at least 2% of the price each way
  const room = Math.max((hi - lo) * 0.18, hi * 0.01, 0.5), y0 = lo - room, y1 = hi + room;
  const x = (i) => PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - y0) / (y1 - y0)) * (height - PAD.t - PAD.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const up = points[n - 1].value >= points[0].value;
  const scrub = (e) => {
    const b = svg.current.getBoundingClientRect();
    const k = ((e.clientX - b.left) / b.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((k - PAD.l) / (W - PAD.l - PAD.r)) * (n - 1))));
    if (i !== at) { setAt(i); onScrub?.(i); }
  };
  const leave = () => { setAt(null); onScrub?.(null); };
  const tick = (p) => (p.now ? 'Now' : short ? `W${p.week}` : p.label);
  // every label when they fit, else the ends and an even spread between
  const step = Math.max(1, Math.ceil(n / 7));
  const shown = (i) => i === n - 1 || (i % step === 0 && n - 1 - i >= step);
  const cur = at ?? n - 1;
  // the week labels are HTML under the drawing, so they keep their size when the drawing shrinks on a phone
  return (
    <div className={`stk ${up ? 'up' : 'down'}${at != null ? ' scrubbing' : ''}`}>
      <svg ref={svg} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} onPointerMove={scrub} onPointerDown={scrub} onPointerLeave={leave} onPointerCancel={leave}>
        <line className="stk-base" x1={PAD.l} x2={W - PAD.r} y1={y(points[0].value)} y2={y(points[0].value)} />
        {area ? <path className="stk-area" d={`${d}L${x(n - 1).toFixed(1)},${height}L${x(0).toFixed(1)},${height}Z`} /> : null}
        <path className="stk-line" ref={lineRef} d={d} pathLength="1" />
        {at != null ? <line className="stk-cursor" x1={x(at)} x2={x(at)} y1={2} y2={height - 2} /> : null}
        {at == null ? <circle className="stk-pulse" cx={x(n - 1)} cy={y(points[n - 1].value)} r="6" /> : null}
        <circle className="stk-dot" cx={x(cur)} cy={y(points[cur].value)} r="6" />
      </svg>
      <div className="stk-ticks" aria-hidden="true">
        {points.map((p, i) => (shown(i) || i === at
          ? <span key={i} className={`${i === cur ? 'on ' : ''}${i === 0 ? 'first' : i === n - 1 ? 'last' : ''}`} style={{ left: `${(x(i) / W) * 100}%` }}>{tick(p)}</span>
          : null))}
      </div>
    </div>
  );
}
