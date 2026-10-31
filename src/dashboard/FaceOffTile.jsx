// 8. Face off: this team against any other, one rival at a time (this week's opponent first, then the closest odds).
// The front is a tug of war: the big number is the odds of beating them on an average week; the rope's knot is the
// odds when this team's week lands where the slider says (a dud on the left, a monster on the right), and the tick on
// the slider is the break-even week. Beside it, the ghost record: every week so far, as if they'd met each time.
// Flip it for the heist: the one player of theirs who'd add the most to this lineup and the one of ours they'd take;
// pulling the heist moves every number on the card. The numbers are faceOff in lib/dashboard.js.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { phi, scoreAt, winAt } from '../../lib/dashboard.js';
import { useFrame } from './clock.js';
import { TL, out, seg } from './motion.js';
import { Label, Tile } from './parts.jsx';

const POS_WORD = { QB: 'Quarterback', RB: 'Running back', WR: 'Receiver', TE: 'Tight end', K: 'Kicker', DEF: 'Defense' };
const TWEEN_MS = 450;

export function FaceOffTile({ m, h, calm }) {
  const F = m.faceoff;
  if (!F?.rivals.length) return null;
  return <FaceOff F={F} me={m.t} h={h} calm={calm} />;
}

function FaceOff({ F, me, h, calm }) {
  const { f1, pct, ordinal } = h;
  const [i, setI] = useState(0); // the rival
  const [q, setQ] = useState(0.5); // this team's week, as a percentile of its own scoring
  const [heist, setHeist] = useState(false);
  const [side, setSide] = useState('front');
  const [dip, setDip] = useState(false);
  const tile = useRef(null), big = useRef(null), flipBtn = useRef({}), timer = useRef(0), flipped = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const r = F.rivals[i], H = r.heist, on = heist && !!H;
  const dA = on ? H.k * H.take.gain : 0, dB = on ? H.k * H.take.loss : 0;
  const odds = on ? H.steal : r.odds;
  const at = winAt(r, q, dA, dB), score = scoreAt(r, q, dA);
  const be = phi((r.muB + dB - r.muA - dA) / r.sdA);
  const A = h.first(me), B = h.first(r.opp);

  // the big number: counts up with the intro, then glides to each new value
  const shown = useRef(0), target = useRef(odds), settled = useRef(false);
  target.current = odds;
  const paint = (v) => { if (big.current) big.current.textContent = `${Math.round(v * 100)}%`; };
  useFrame(useCallback((t) => {
    const k = seg(t, TL.duel[0], TL.duel[1], out);
    tile.current?.style.setProperty('--intro', String(k));
    if (!settled.current) { shown.current = target.current * k; paint(shown.current); }
    if (k >= 1) settled.current = true;
  }, []));
  useLayoutEffect(() => {
    if (!settled.current) return undefined;
    const from = shown.current, to = odds;
    if (calm || Math.abs(from - to) < 1e-4) { shown.current = to; paint(to); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const x = Math.min(1, (now - t0) / TWEEN_MS);
      shown.current = from + (to - from) * out(x);
      paint(shown.current);
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [odds, calm]);

  // another rival: the words dip out, change and come back; the heist starts unpulled
  const step = (d) => {
    setDip(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setI((x) => (x + d + F.rivals.length) % F.rivals.length); setHeist(false); setDip(false); }, calm ? 0 : 140);
  };

  // the card turns edge-on, changes sides and turns back
  const flip = () => {
    const next = side === 'front' ? 'back' : 'front', el = tile.current;
    flipped.current = true;
    if (calm || !el?.animate) { setSide(next); return; }
    el.animate([{ rotate: 'y 0deg' }, { rotate: 'y 90deg' }], { duration: 190, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' }).onfinish = () => {
      setSide(next);
      el.animate([{ rotate: 'y -90deg' }, { rotate: 'y 0deg' }], { duration: 260, easing: 'cubic-bezier(0, 0.55, 0.45, 1)' });
    };
  };
  useEffect(() => { if (flipped.current) flipBtn.current[side]?.focus({ preventScroll: true }); }, [side]);

  const Q = Math.round(q * 100);
  const beWord = be < 0.05 ? `${A} is the favourite even on a dud`
    : be > 0.95 ? `${A} needs a career week to be the favourite`
      : `Break-even: ${A}'s ${ordinal(Math.round(be * 100))}-percentile week, ${f1(scoreAt(r, be, dA))}`;
  const g = r.ghost;
  const rec = `${g.w}-${g.l}${g.t ? `-${g.t}` : ''}`;

  return (
    <Tile index={7} className={`pp-fo${dip ? ' dip' : ''}${on ? ' pulled' : ''}`} tileRef={tile} style={{ '--i': 7, '--at': at.toFixed(4), '--q': q, '--be': Math.min(0.95, Math.max(0.05, be)).toFixed(4) }}>
      <Label>{side === 'front' ? 'Face off' : 'The heist'}</Label>
      <div className="fo-step">
        <button type="button" className="fo-arrow" aria-label="Previous rival" onClick={() => step(-1)}><Chevron d="M15 5l-7 7 7 7" /></button>
        <span className="fo-rival" aria-live="polite">
          <Face t={r.opp} h={h} cls="fo-rface" />
          <span className="fo-rname"><b>{`vs ${r.opp.name}`}</b><small>{r.rid === F.thisWeek ? `This week, ${i + 1} of ${F.rivals.length}` : `${i + 1} of ${F.rivals.length}`}</small></span>
        </span>
        <button type="button" className="fo-arrow" aria-label="Next rival" onClick={() => step(1)}><Chevron d="M9 5l7 7-7 7" /></button>
      </div>

      <div className="fo-side front" hidden={side !== 'front'}>
        <div className="fo-left">
          <div className="fo-big" ref={big} />
          <p className="fo-cap">{on ? `${A} beats ${B} on an average week, with ${H.take.name} stolen` : `${A} beats ${B} on an average week`}</p>
          <div className="fo-ghost">
            <div className="fo-ghost-head"><b>{rec}</b><span>{`Ghost record: ${A}'s score against ${B}'s, every week so far`}</span></div>
            <div className="fo-dots">
              {g.weeks.map((w) => (
                <i key={w.week} className={`${w.a > w.b ? 'won' : w.a < w.b ? 'lost' : 'tied'}${w.real ? ' real' : ''}`}
                  data-tip={`Week ${w.week}: ${f1(w.a)} to ${f1(w.b)}${w.real ? ', the week they really met' : ''}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="fo-right">
          <div className="fo-tug">
            <Face t={me} h={h} cls="fo-end" />
            <div className="fo-rope" data-tip={`${A} wins ${pct(at)} of the time when scoring ${f1(score)}`}>
              <i className="fo-mine" /><span className="fo-knot"><b>{pct(at)}</b></span>
            </div>
            <Face t={r.opp} h={h} cls="fo-end" />
          </div>
          <label className="fo-slide">
            <span className="fo-slide-ends"><span>Dud</span><span className="fo-whose">{`${A}'s week`}</span><span>Monster</span></span>
            <span className="fo-track">
              <i className="fo-be" data-tip={beWord} />
              <input type="range" min="5" max="95" step="1" value={Q} onChange={(e) => setQ(Number(e.target.value) / 100)}
                aria-valuetext={`${ordinal(Q)} percentile, ${f1(score)} points, wins ${pct(at)}`} />
            </span>
          </label>
          <p className="fo-read"><b>{`${A}'s ${ordinal(Q)}-percentile week, ${f1(score)}: wins ${pct(at)}.`}</b><span><i className="fo-be-key" />{`${beWord}.`}</span></p>
          {H ? <button type="button" className="fo-flip" ref={(b) => { flipBtn.current.front = b; }} onClick={flip}><FlipIcon />The heist</button> : null}
        </div>
      </div>

      {H ? (
        <div className="fo-side back" hidden={side !== 'back'}>
          <div className="fo-loot">
            <Loot kicker={`${A} steals from ${B}`} p={H.take} h={h} line={`+${f1(H.take.gain)} a week for ${A}'s lineup, ${f1(H.take.loss)} for ${B}'s`} />
            {H.give ? <Loot kicker={`${B} would steal`} p={H.give} h={h} line={`+${f1(H.give.gain)} a week for ${B}'s lineup, ${f1(H.give.loss)} for ${A}'s`} /> : null}
          </div>
          <div className="fo-pull">
            <div className="fo-odds"><span>{pct(r.odds)}</span><Chevron d="M5 12h14M13 6l6 6-6 6" /><b>{pct(H.steal)}</b></div>
            <p className="fo-cap">{`One player moves ${A}'s odds against ${B} by ${Math.round(Math.abs(H.steal - r.odds) * 100)} points.${H.swap != null ? ` A straight swap, ${H.give.name} for ${H.take.name}, lands at ${pct(H.swap)}.` : ''}`}</p>
            <div className="fo-switch">
              <button type="button" className="toggle" role="switch" aria-checked={on} onClick={() => setHeist((x) => !x)}><span className="knob" /></button>
              <span>{on ? 'Heist pulled: the face off counts him' : 'Pull the heist'}</span>
            </div>
            <button type="button" className="fo-flip" ref={(b) => { flipBtn.current.back = b; }} onClick={flip}><FlipIcon />Back to the face off</button>
          </div>
        </div>
      ) : null}
    </Tile>
  );
}

function Loot({ kicker, p, h, line }) {
  return (
    <div className="fo-card">
      <small>{kicker}</small>
      <b>{p.name}</b>
      <span>{`${POS_WORD[p.pos] || p.pos}${p.nfl ? `, ${h.nfl(p.nfl)}` : ''}`}</span>
      <em>{line}</em>
    </div>
  );
}

// the manager's photo, or their initial when there's no photo or it fails to load
function Face({ t, h, cls }) {
  const src = h.faceSrc(t), [failed, setFailed] = useState(false), first = h.first(t);
  useLayoutEffect(() => setFailed(false), [src]);
  return src && !failed
    ? <img className={cls} src={src} alt={first} decoding="async" onError={() => setFailed(true)} />
    : <span className={`${cls} ph`} aria-label={first}>{(first || '?')[0]}</span>;
}

const Chevron = ({ d }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const FlipIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7" /><path d="M20 3.5v5.2h-5.2" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.3" /><path d="M4 20.5v-5.2h5.2" />
  </svg>
);
