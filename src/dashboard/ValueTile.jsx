// 9. Team value, as a brokerage card: what the roster is worth in dollars (lib/teamvalue.js) on a dark sheet with a
// bright line, the way a trading app shows a stock. The ticker and price, the move in green or orange, the line you can
// run a finger along (3 weeks or the season), the range's high and low, and the dearest players as a watchlist, each
// with his own little line and a price pill. A full-width tile in flow layout, like the face off.
// The corner button opens it full screen (Focus): the card alone over everything, the tab dock included, scaled to fit
// the screen whole, so a screenshot is just the card.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ClockContext, createClock } from './clock.js';
import { money, teamValues } from '../../lib/teamvalue.js';
import { StockLine } from '../value/StockLine.jsx';
import { useFrame } from './clock.js';
import { TL, out, seg } from './motion.js';
import { Label, Tile } from './parts.jsx';

const Arrow = ({ up }) => <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d={up ? 'M6 1.5 11 10H1z' : 'M6 10.5 1 2h10z'} fill="currentColor" /></svg>;
// a team's ticker: the first four letters of its name, "The" aside
const ticker = (name) => (name.replace(/^the\s+/i, '').replace(/[^a-z0-9]/gi, '').slice(0, 4) || 'TEAM').toUpperCase();
const dirOf = (v) => (Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down');

// a holding's own price over the same weeks, small
function Spark({ trail, dir }) {
  const lo = Math.min(...trail), hi = Math.max(...trail), span = hi - lo || 1, n = trail.length;
  const d = trail.map((v, i) => `${i ? 'L' : 'M'}${(2 + (i / (n - 1)) * 60).toFixed(1)},${(3 + (1 - (v - lo) / span) * 18).toFixed(1)}`).join('');
  return <svg className={`pv-spark ${dir}`} viewBox="0 0 64 24" width="64" height="24" aria-hidden="true"><path d={d} /></svg>;
}

/** focus: this is the full-screen copy (onClose closes it); start: the range it opens on. */
export function ValueTile({ D, raw, rid, h, focus = false, onClose, start = 'recent' }) {
  const V = useMemo(() => (D._worth ||= teamValues(D, { raw })), [D, raw]);
  const v = V.teams[rid];
  const [range, setRange] = useState(start); // the last three weeks, or the season
  const [open, setOpen] = useState(false); // full screen
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
  const shown = p ? p.value : v.value, diff = shown - base, pct = base > 0 ? diff / base : 0, dir = dirOf(diff);
  const span = range === 'recent' ? 'Past 3 weeks' : 'This season';
  const vals = pts.map((x) => x.value), name = D.byRid[rid].name;
  return (
    <Tile index={0} className={`pp-val ${dirOf(v.value - base)}${focus ? ' focus' : ''}`}>
      <Label>Team value</Label>
      {focus
        ? <button type="button" className="pv-expand" aria-label="Close full screen" onClick={onClose}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        : <button type="button" className="pv-expand" aria-label="Show team value full screen" data-tip="Full screen, for a screenshot" onClick={() => setOpen(true)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg></button>}
      <div className="pv-side">
        <div className="pv-tick"><b>{`$${ticker(name)}`}</b><span>{name}</span></div>
        <div className="pv-big" ref={big}>{money(shown)}</div>
        <div className={`pv-move ${dir}`}>
          {dir === 'flat' ? null : <Arrow up={dir === 'up'} />}
          <b>{dir === 'flat' ? 'Level' : `${money(Math.abs(diff))} (${(Math.abs(pct) * 100).toFixed(1)}%)`}</b>
          <span>{p ? (p.now ? 'Today' : p.label) : span}</span>
        </div>
        <div className="pv-range" role="group" aria-label="How far back">
          {[['recent', '3W', 'The last three weeks'], ['season', 'ALL', 'The whole season']].map(([k, word, say]) => (
            <button type="button" key={k} aria-pressed={range === k} aria-label={say} onClick={() => { setAt(null); setRange(k); }}>{word}</button>
          ))}
        </div>
      </div>
      <div className="pv-chart">
        <StockLine key={range} points={pts} height={220} onScrub={setAt} lineRef={line} short={range === 'season'} area
          label={`${name} value, ${span.toLowerCase()}: ${pts.map((x) => `${x.now ? 'now' : x.label} ${money(x.value)}`).join(', ')}`} />
      </div>
      <dl className="pv-stats">
        <div><dt>High</dt><dd>{money(Math.max(...vals))}</dd></div>
        <div><dt>Low</dt><dd>{money(Math.min(...vals))}</dd></div>
        <div><dt>League average</dt><dd>{money(V.avg)}</dd></div>
        <div><dt>League rank</dt><dd>{`${h.ordinal(v.rank)} of ${V.order.length}`}</dd></div>
      </dl>
      <div className="pv-list">
        <p>Top holdings</p>
        <ol aria-label="Most valuable players">
          {v.holdings.slice(0, 5).map((x) => {
            const mv = dirOf(x.change);
            return (
              <li key={x.id} data-tip={`${x.name}: ${money(x.price)}. Rest-of-season value ${h.f1(x.ros)}${x.posRank ? `, ${x.pos} #${x.posRank} in points (${h.f1(x.total)}), ${h.f1(x.ppg)} a game lately` : ', no points on record yet'}${x.bye ? ', on a bye this week (a 6% hit)' : ''}. ${mv === 'flat' ? 'Level' : `${mv === 'up' ? 'Up' : 'Down'} ${money(Math.abs(x.change))}`} over three weeks.`}>
                <span className="pv-name"><b>{x.name}</b><small>{`${x.posRank ? `${x.pos} #${x.posRank} in points` : `${x.pos}, no points yet`}${x.bye ? ', bye' : ''}`}</small></span>
                <Spark trail={x.trail} dir={mv} />
                <span className={`pv-px ${mv}`}><b>{money(x.price)}</b><small>{mv === 'flat' ? 'Level' : <><Arrow up={mv === 'up'} />{money(Math.abs(x.change))}</>}</small></span>
              </li>
            );
          })}
        </ol>
      </div>
      {open ? createPortal(<Focus D={D} raw={raw} rid={rid} h={h} start={range} onClose={() => setOpen(false)} />, document.body) : null}
    </Tile>
  );
}

// The card full screen: on the dark of the card itself, over the page and the dock, with no scroll. If the card is
// taller than the screen it's laid out wider and scaled down until the whole of it fits (a few passes, since a wider
// card is a shorter one), so one screenshot holds all of it. Escape or the corner button closes it.
function Focus({ D, raw, rid, h, start, onClose }) {
  // the intro is over: every number at its end
  const clock = useMemo(() => { const c = createClock(); c.draw(TL.end + 1); return c; }, []);
  const box = useRef(null), close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const el = box.current;
    const fit = () => {
      const W = innerWidth, H = innerHeight;
      let s = 1;
      el.style.transform = 'none';
      for (let k = 0; k < 4; k++) {
        el.style.width = `${W / s}px`;
        const next = Math.min(1, H / el.offsetHeight);
        if (Math.abs(next - s) < 0.004) break;
        s = next;
      }
      el.style.width = `${W / s}px`;
      const top = Math.max(0, (H - el.offsetHeight * s) / 2);
      el.style.transform = `translate(0, ${top.toFixed(1)}px) scale(${s.toFixed(4)})`;
    };
    fit();
    document.fonts?.ready.then(fit);
    let width = innerWidth, height = innerHeight;
    const onResize = () => { if (innerWidth !== width || Math.abs(innerHeight - height) > 60) { width = innerWidth; height = innerHeight; fit(); } };
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    const root = document.documentElement, was = root.classList.contains('locked');
    root.classList.add('locked', 'focusing');
    const key = (e) => { if (e.key === 'Escape') close.current(); };
    addEventListener('keydown', key);
    box.current?.querySelector('.pv-expand')?.focus({ preventScroll: true });
    return () => { removeEventListener('keydown', key); root.classList.remove('focusing'); if (!was) root.classList.remove('locked'); };
  }, []);
  return (
    <div className="paper vf" role="dialog" aria-modal="true" aria-label="Team value, full screen">
      <div className="vf-fit" ref={box}>
        <ClockContext.Provider value={clock}>
          <ValueTile D={D} raw={raw} rid={rid} h={h} focus start={start} onClose={onClose} />
        </ClockContext.Provider>
      </div>
    </div>
  );
}
