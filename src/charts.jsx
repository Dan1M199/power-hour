// Hand-written SVG and HTML charts (bump, scatter, radar, weekly bars, diverging bars, heat table). Deliberately no
// chart library. Marks carry data-tip for the shared tooltip in app.js.
import { useId } from 'react';

const fmt = (x, d = 1) => (x == null ? '–' : Number(x).toFixed(d));

// one colour per team, for marks on white cards. Checked with the dataviz palette validator (light mode, white surface):
// every adjacent pair clears the colour-blind and normal-vision separation floors. Three slots sit under 3:1 contrast on
// white, so every chart that uses them also labels the marks directly.
export const TEAM_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300',
  '#6250d6', '#e34948', '#ad1457', '#7a8b00', '#0097a7', '#a0522d',
];

// Cartoon glass, like the cards: marks wear an ink outline, bars stand on a hard ledge with a gloss over their top
// half, dots carry a white glint, and each plot sits on its own plate with chalk gridlines.

// a dot with an ink ring and a glint in its upper left
const Dot = ({ cx, cy, r, color, tip }) => <>
  <circle cx={cx} cy={cy} r={r} fill={color} className="dot" data-tip={tip} />
  <circle cx={(cx - r * 0.35).toFixed(1)} cy={(cy - r * 0.35).toFixed(1)} r={Math.max(1.2, r * 0.3).toFixed(1)} className="glint" />
</>;
// a bar: ledge underneath, ink-edged body, gloss over the top half (skipped when the bar is too small to hold it)
function Bar({ x, y, w, h, cls, tip, rx = 5 }) {
  w = Math.max(w, 2);
  return <>
    <rect x={x.toFixed(1)} y={(y + 3).toFixed(1)} width={w.toFixed(1)} height={h.toFixed(1)} rx={rx} className="bar-ledge" />
    <rect x={x.toFixed(1)} y={y.toFixed(1)} width={w.toFixed(1)} height={h.toFixed(1)} rx={rx} className={`bar ${cls}`} data-tip={tip} />
    {w > 10 && h > 10 ? <rect x={(x + 3).toFixed(1)} y={(y + 3).toFixed(1)} width={(w - 6).toFixed(1)} height={Math.min((h - 6) * 0.45, 12).toFixed(1)} rx={Math.max(2, rx - 2)} className="bar-gloss" /> : null}
  </>;
}
// the plate a plot sits on: a tray on a card, or white inside a tray (light)
const Plate = ({ x, y, w, h, light = false }) => <rect x={x} y={y} width={w} height={h} rx="12" className={`plate${light ? ' light' : ''}`} />;

// a manager photo as a chart mark: clipped to a circle on a ring of the team colour, inked like every other mark
function FaceDot({ cx, cy, r, img, color, tip }) {
  const id = useId(), t = tip || undefined;
  return <>
    <clipPath id={id}><circle cx={cx} cy={cy} r={r} /></clipPath>
    <circle cx={cx} cy={cy} r={r + 4.5} className="face-ring" data-tip={t} />
    <circle cx={cx} cy={cy} r={r + 2.5} fill={color} data-tip={t} />
    <image href={img} x={cx - r} y={cy - r} width={2 * r} height={2 * r} clipPath={`url(#${id})`} preserveAspectRatio="xMidYMid slice" data-tip={t} />
  </>;
}

/** Rank flow / bump chart: series values are ranks (1 = top). */
export function BumpChart({ series, weeks, n, width = 720, height = 340, focus }) {
  const padL = 34, padR = 164, padT = 16, padB = 28;
  const w = width - padL - padR, h = height - padT - padB;
  const x = (i) => padL + (weeks.length === 1 ? w / 2 : (i / (weeks.length - 1)) * w);
  const y = (r) => padT + ((r - 1) / Math.max(1, n - 1)) * h;
  const ordered = [...series].sort((a, b) => (a.id === focus) - (b.id === focus));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart bump" role="img" aria-label="Power rank by week">
      <Plate x={padL - 12} y={padT - 10} w={w + 24} h={h + 20} />
      {Array.from({ length: n }, (_, k) => k + 1).map((r) => <g key={r}><line x1={padL} x2={padL + w} y1={y(r)} y2={y(r)} className="grid" /><text x={padL - 10} y={y(r) + 4} className="axis" textAnchor="end">{r}</text></g>)}
      {weeks.map((wk, i) => <text key={wk} x={x(i)} y={height - 6} className="axis" textAnchor="middle">{`W${wk}`}</text>)}
      {ordered.map((se) => {
        const dim = focus && se.id !== focus ? ' dim' : se.id === focus ? ' focus' : '';
        const d = se.values.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r).toFixed(1)}`).join('');
        const k = se.values.length - 1, last = se.values[k];
        // an ink casing under the team colour, and a thin gloss along its top; with a photo, the line ends on the face
        return (
          <g key={se.id} className={`series${dim}`} data-team={se.id}>
            <path d={d} className="line case" pathLength="1" /><path d={d} stroke={se.color} className="line" pathLength="1" /><path d={d} className="line shine" pathLength="1" transform="translate(0 -1)" />
            {se.values.map((r, i) => (se.img && i === k
              ? <g key={i} className="face-end"><FaceDot cx={x(i)} cy={y(r)} r={10} img={se.img} color={se.color} tip={`${se.label}: #${r} after week ${weeks[i]}`} /></g>
              : <Dot key={i} cx={x(i)} cy={y(r)} r={se.id === focus ? 6 : 5} color={se.color} tip={`${se.label} — #${r} after week ${weeks[i]}`} />))}
            <text x={padL + w + (se.img ? 18 : 10)} y={y(last) + 4} className="label" fill={se.color}>{se.short || se.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

/** Scatter with optional reference lines (league averages). */
export function Scatter({ points, xLabel, yLabel, refX, refY, width = 560, height = 380, quadrants, focus }) {
  const padL = 52, padR = 18, padT = 18, padB = 44;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const pad = (a, b) => [(a - (b - a) * 0.08), (b + (b - a) * 0.08)];
  const [x0, x1] = pad(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = pad(Math.min(...ys), Math.max(...ys));
  const X = (v) => padL + ((v - x0) / (x1 - x0)) * (width - padL - padR);
  const Y = (v) => height - padB - ((v - y0) / (y1 - y0)) * (height - padT - padB);
  const pw = width - padL - padR, ph = height - padT - padB, cid = useId();
  const ticks = (a, b) => { const st = niceStep((b - a) / 4); const out = []; for (let v = Math.ceil(a / st) * st; v <= b; v += st) out.push(v); return out; };
  const qx = refX != null ? X(refX) : 0, qy = refY != null ? Y(refY) : 0;
  const [tl, tr, bl, br] = quadrants || [];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart scatter" role="img" aria-label={`${yLabel} vs ${xLabel}`}>
      <Plate x={padL} y={padT} w={pw} h={ph} />
      {quadrants && refX != null && refY != null ? <>
        {/* each quadrant of the league-average cross gets its own tint */}
        <clipPath id={cid}><rect x={padL} y={padT} width={pw} height={ph} rx="12" /></clipPath>
        <g clipPath={`url(#${cid})`}>
          <rect x={padL} y={padT} width={qx - padL} height={qy - padT} className="q q-tl" />
          <rect x={qx} y={padT} width={width - padR - qx} height={qy - padT} className="q q-tr" />
          <rect x={padL} y={qy} width={qx - padL} height={height - padB - qy} className="q q-bl" />
          <rect x={qx} y={qy} width={width - padR - qx} height={height - padB - qy} className="q q-br" />
        </g>
      </> : null}
      {ticks(x0, x1).map((v) => <g key={`x${v}`}><line x1={X(v)} x2={X(v)} y1={padT} y2={height - padB} className="grid" /><text x={X(v)} y={height - padB + 16} className="axis" textAnchor="middle">{fmt(v, 0)}</text></g>)}
      {ticks(y0, y1).map((v) => <g key={`y${v}`}><line x1={padL} x2={width - padR} y1={Y(v)} y2={Y(v)} className="grid" /><text x={padL - 8} y={Y(v) + 4} className="axis" textAnchor="end">{fmt(v, 0)}</text></g>)}
      {refX != null ? <line x1={X(refX)} x2={X(refX)} y1={padT} y2={height - padB} className="ref" /> : null}
      {refY != null ? <line x1={padL} x2={width - padR} y1={Y(refY)} y2={Y(refY)} className="ref" /> : null}
      {quadrants ? <>
        <text x={padL + 8} y={padT + 14} className="quad">{tl}</text><text x={width - padR - 8} y={padT + 14} className="quad" textAnchor="end">{tr}</text>
        <text x={padL + 8} y={height - padB - 8} className="quad">{bl}</text><text x={width - padR - 8} y={height - padB - 8} className="quad" textAnchor="end">{br}</text>
      </> : null}
      <text x={padL + (width - padL - padR) / 2} y={height - 6} className="axis-title" textAnchor="middle">{xLabel}</text>
      <text transform={`translate(14 ${padT + (height - padT - padB) / 2}) rotate(-90)`} className="axis-title" textAnchor="middle">{yLabel}</text>
      {[...points].sort((a, b) => (a.id === focus) - (b.id === focus)).map((p) => {
        const dim = focus && p.id !== focus ? ' dim' : '';
        const r = p.img ? (p.id === focus ? 15 : 12) : p.id === focus ? 9 : 7;
        return (
          <g key={p.id} className={`pt${dim}`}>
            {p.img ? <FaceDot cx={X(p.x)} cy={Y(p.y)} r={r} img={p.img} color={p.color} tip={p.tip || p.label} /> : <Dot cx={X(p.x)} cy={Y(p.y)} r={r} color={p.color} tip={p.tip || p.label} />}
            <text x={X(p.x) + r + (p.img ? 6 : 4)} y={Y(p.y) + 4} className="pt-label">{p.short || p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Radar for position-group percentiles (values 0..1). */
export function Radar({ axes, values, color = '#2a78d6', size = 220, tips = [] }) {
  const c = size / 2, R = size / 2 - 30;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i / axes.length) * Math.PI * 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const ring = (f) => axes.map((_, i) => pt(i, R * f).map((v) => v.toFixed(1)).join(',')).join(' ');
  const shape = values.map((v, i) => pt(i, R * Math.max(0.04, v)).map((n) => n.toFixed(1)).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="chart radar" role="img" aria-label="Position group strength">
      {/* the plate: a white target on a hard ledge, bands alternating out from the middle like a dartboard */}
      <polygon points={ring(1)} className="radar-ledge" transform="translate(0 3)" /><polygon points={ring(1)} className="radar-plate" />
      <polygon points={ring(0.75)} className="radar-band" /><polygon points={ring(0.5)} className="radar-band alt" /><polygon points={ring(0.25)} className="radar-band" />
      {axes.map((ax, i) => {
        const [lx, ly] = pt(i, R + 16), [ex, ey] = pt(i, R);
        return <g key={ax}><line x1={c} y1={c} x2={ex} y2={ey} className="grid" /><text x={lx} y={ly + 4} className="axis" textAnchor="middle">{ax}</text></g>;
      })}
      <polygon points={shape} className="radar-case" /><polygon points={shape} fill={color} fillOpacity=".35" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      {values.map((v, i) => { const [x, y] = pt(i, R * Math.max(0.04, v)); return <Dot key={i} cx={x} cy={y} r={5} color={color} tip={tips[i] || ''} />; })}
    </svg>
  );
}

/** Weekly points columns with the league-average line. */
export function WeeklyBars({ weeks, avg, width = 320, height = 120 }) {
  const padB = 18, padT = 8;
  const max = Math.max(...weeks.map((w) => w.pts), ...avg, 1) * 1.08;
  const bw = width / Math.max(1, weeks.length);
  const Y = (v) => height - padB - (v / max) * (height - padB - padT);
  const d = avg.map((v, i) => `${i ? 'L' : 'M'}${(i * bw + bw / 2).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart weekly" role="img" aria-label="Weekly points">
      <Plate x={0} y={0} w={width} h={height - padB + 4} light />
      {weeks.map((w, i) => {
        const x = i * bw + bw * 0.18, bwid = bw * 0.64;
        const cls = w.result === 'W' ? 'win' : w.result === 'L' ? 'loss' : '';
        return <g key={w.week}>
          <Bar x={x} y={Y(w.pts)} w={bwid} h={height - padB - 3 - Y(w.pts)} cls={cls} tip={`Week ${w.week}: ${fmt(w.pts)} pts ${w.result ? `(${w.result} ${fmt(w.pts)}–${fmt(w.oppPts)})` : ''}`} />
          <text x={x + bwid / 2} y={height - 4} className="axis" textAnchor="middle">{w.week}</text>
        </g>;
      })}
      <path d={d} className="avg-line" />
    </svg>
  );
}

/** Diverging horizontal bars (luck, efficiency, ROI). */
export function DivergingBars({ rows, width = 520, rowH = 30, unit = '' }) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.5);
  const labelW = 170, mid = labelW + (width - labelW) / 2, half = (width - labelW) / 2 - 58;
  return (
    <svg viewBox={`0 0 ${width} ${rows.length * rowH + 8}`} className="chart diverging" role="img" aria-label="Diverging bars">
      <Plate x={labelW} y={0} w={width - labelW} h={rows.length * rowH + 8} />
      <line x1={mid} x2={mid} y1="4" y2={rows.length * rowH + 4} className="mid" />
      {rows.map((r, i) => {
        const y = i * rowH + 6, len = (Math.abs(r.value) / max) * half;
        const x = r.value >= 0 ? mid : mid - len;
        return <g key={i}>
          {r.mine ? <rect x="0" y={y - 1} width={width} height={rowH - 4} rx="9" className="mine-band" /> : null}
          <text x={labelW - 10} y={y + rowH / 2} className={`row-label${r.mine ? ' mine' : ''}`} textAnchor="end">{r.label}</text>
          <Bar x={x} y={y + 2} w={len} h={rowH - 12} cls={r.value >= 0 ? 'pos' : 'neg'} tip={r.tip || ''} />
          <text x={r.value >= 0 ? mid + len + 6 : mid - len - 6} y={y + rowH / 2} className="val" textAnchor={r.value >= 0 ? 'start' : 'end'}>{`${r.value > 0 ? '+' : ''}${fmt(r.value)}${unit}`}</text>
        </g>;
      })}
    </svg>
  );
}

/** Week-by-week finish heatmap (an HTML table). cells[rowIdx][colIdx] = {rank, label?, tip}; mine marks your row. */
export function HeatTable({ rows, cols, cells, n, invert = true, caption, mine = -1 }) {
  return (
    <div className="heat-wrap">
      <table className="heat">
        <caption className="sr-only">{caption || ''}</caption>
        <thead><tr><th />{cols.map((c, j) => <th key={j} scope="col">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === mine ? 'mine' : undefined}>
              <th scope="row">{r}</th>
              {cols.map((_, j) => {
                const c = cells[i][j];
                if (!c) return <td key={j} />;
                const t = (c.rank - 1) / Math.max(1, n - 1); // 0 best
                const v = invert ? t : 1 - t;
                const hue = v < 0.5 ? 205 : 36; // sky blue for the good end, amber for the bad, fading to white in the middle
                return <td key={j} style={{ '--h': hue.toFixed(0), '--a': (0.06 + Math.abs(v - 0.5) * 1.3).toFixed(2) }} data-tip={c.tip}>{c.label ?? c.rank}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
