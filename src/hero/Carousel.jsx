// The headline carousel: each headline is its own scoreboard card, and the cards ride a ring (Ring.jsx, Bencho's
// carousel): the one being read at the front, the others layered behind it, peeking out over its top and sides. Swipe
// or drag to turn the ring (a flick carries it), step with the arrows, pick from the dots or tap a card behind; the
// active dot's fill is the auto-advance timer. The stories themselves are written in app.js (and lib/stories.js, lib/nightdesk.js) as plain data; this draws
// them and runs the card.
import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { storyKeys } from './storyKeys.js';
import { useReactions, loadReactions, react } from './reactions.js';
import { TeamAvatar, Headshot, ChampTag, ChampBadge, WhatIfLink } from '../shared.jsx';
import { TradeGraphic } from './TradeGraphic.jsx';
import { Card, useRing } from './Ring.jsx';
import { doubleTap, fireHeadline } from '../buzz/burst.js';

// the reaction bar under each headline (EmojiReactions.jsx), in its own chunk: framer-motion only downloads once the
// league's store says reactions are on
const Reactions = lazy(() => import('./EmojiReactions.jsx'));
const mq = (q) => matchMedia(q).matches;

// the pause button holds the headlines where they are for the rest of the visit (every page's carousel)
let pausedForVisit = false;

// the front-page photo: whoever the story is about, with a stamp on the first face saying what kind of day it was
const STAMPS = {
  trade: 'Deal', wire: 'Pickup', cut: 'Cut', flurry: 'Busy', dud: 'Benched?', star: 'Star turn', unbeaten: 'Perfect',
  winless: 'Winless', upset: 'Upset', blowout: 'Boom', nailbiter: 'Phew', explosion: 'Boom', climb: 'Rising',
  fall: 'Sliding', unlucky: 'Robbed', lucky: 'Lucky', giant: 'Giant', gotw: 'Big game',
};
// a story's stamp: its own, or its type's
export const stampOf = (st) => st.stamp || (st.type === 'streak' ? (st.tone === 'good' ? 'Heater' : 'Skid') : STAMPS[st.type]);
// a story in brief, for the ticker and the reaction bar's message: an attention catcher and one sentence. A story can
// carry its own (tick: { hook, line }); otherwise the hook is its photo stamp (or kicker) and the line is its headline's
// first sentence, kept short.
const MAX = 110;

export function tickOf(st) {
  if (st.tick) return st.tick;
  let line = st.headline.split(/(?<=[.?!])\s+/)[0];
  if (line.length < 28) line = st.headline; // "Stop everything." isn't a summary
  if (line.length > MAX) line = `${line.slice(0, line.lastIndexOf(' ', MAX - 1))}…`;
  return { hook: stampOf(st) || st.kicker, line: /[.?!…]$/.test(line) ? line : `${line}.` };
}
function Faces({ st, D, h }) {
  const ts = st.rids.map((r) => D.byRid[r]).filter((t) => t && h.faceSrc(t)).slice(0, 2);
  if (!ts.length) return null;
  const stamp = stampOf(st);
  return (
    <div className={`lead-faces n${ts.length} ${st.tone || ''}`} aria-hidden="true">
      {ts.map((t, k) => (
        <span className="lf" key={t.rid}>
          <Headshot t={t} cls={`lead-face${st.drain === t.rid ? ' drained' : ''}`} h={h} /><ChampBadge t={t} h={h} />
          <span className="cap">{h.first(t)}</span>{k === 0 && stamp ? <em className="stamp">{stamp}</em> : null}
        </span>
      ))}
    </div>
  );
}

// the player a story is about, printed like a trading card where the headline photos go: his Sleeper headshot, name and
// position, the stamp, and the face of the manager he's headed to pinned on the corner
// a player headline's picture as a trading card: a white border around a framed portrait (his Sleeper headshot on a
// two-tone field with a hard gloss stripe), his position on a badge in the corner, and a name plate along the bottom.
// The name wraps instead of stretching the card (a long one once pushed the photo out past the frame and the slide).
function PlayerPrint({ st, h }) {
  const P = st.player, to = P.pin?.team;
  const [failed, setFailed] = useState(false);
  const initials = P.name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  const [pos, team] = String(P.line || '').split(/,\s*/);
  return (
    <figure className={`player-print ${st.tone || ''}`} aria-hidden="true">
      <div className="pp-card">
        <div className="pp-photo">
          {failed ? <span className="pp-img ph">{initials}</span>
            : <img className="pp-img" src={`https://sleepercdn.com/content/nfl/players/${P.id}.jpg`} alt="" decoding="async" onError={() => setFailed(true)} />}
          {pos ? <span className="pp-pos">{pos}</span> : null}
        </div>
        <figcaption><b>{P.short}</b>{team ? <small>{team}</small> : null}</figcaption>
      </div>
      {st.stamp ? <em className="stamp">{st.stamp}</em> : null}
      {to && h.faceSrc(to) ? <span className="lf pp-who"><Headshot t={to} cls="lead-face" h={h} /><span className="cap">{P.pin.label}</span></span> : null}
    </figure>
  );
}

// a story's key name in yellow, in the headline and the deck (st.mark)
// a headline or deck with its marked names in yellow; records and scores ("2-4", "120.4-98.1") never break at the hyphen
const PAIR = /(\d+(?:\.\d+)?-\d+(?:\.\d+)?)/;
const keepPairs = (part, k) => (PAIR.test(part)
  ? part.split(PAIR).filter(Boolean).map((x, j) => (PAIR.test(x) ? <span className="nw" key={`${k}-${j}`}>{x}</span> : x))
  : part);
function Marked({ text, marks }) {
  if (!marks?.length) return keepPairs(text, 0);
  const re = new RegExp(`(${marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return text.split(re).filter(Boolean).map((part, i) => (marks.includes(part) ? <mark className="hl" key={i}>{part}</mark> : keepPairs(part, i)));
}

function RankSpark({ t, D, w = 84, h: ht = 30 }) {
  const v = t.rankHistory, n = D.teams.length;
  if (v.length < 2) return null;
  const x = (i) => 3 + (i / (v.length - 1)) * (w - 6), y = (r) => 3 + ((r - 1) / (n - 1)) * (ht - 6);
  const d = v.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r).toFixed(1)}`).join('');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${ht}`} width={w} height={ht} role="img" aria-label="Power rank by week" data-tip={`${t.name} power rank by week: ${v.join(', ')}`}>
      <path d={d} stroke={D.color[t.rid]} pathLength="1" /><circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r="3" fill={D.color[t.rid]} />
    </svg>
  );
}

function Cast({ st, D, h }) {
  return (
    <div className="cast">
      {st.rids.map((r) => D.byRid[r]).filter(Boolean).map((t) => (
        <div className="cast-team" key={t.rid}>
          <TeamAvatar t={t} />
          <div className="cast-name"><b>{t.name}<ChampTag t={t} h={h} label={false} /></b><small>{`No. ${t.powerRank} power, ${h.record(t)}`}</small></div>
          <RankSpark t={t} D={D} />
          <span className="cast-odds"><b>{h.pct(t.playoffPct)}</b><small>playoffs</small></span>
        </div>
      ))}
    </div>
  );
}

const Brk = () => <span className="brk"><i aria-hidden="true" />Breaking</span>;
const TONIGHT = new Set(['monday', 'locked']);

function Slide({ st, i, n, D, h, groups, runs, date, slideRef, hk, rx, front }) {
  const run = runs?.find((x) => x.i.includes(i));
  const breaking = !!st.breaking;
  // The top of the card: the picture floats top right, and the kicker then the headline run down the left beside it,
  // the headline wrapping under the picture once it's past it, so no band of empty board sits between them
  // (Dan's request Nov 25). One block so the float works; .slide stays a flex column for everything under it.
  const Hed = i ? 'h2' : 'h1';
  const top = (
    <div className="slide-top">
      {st.player ? <PlayerPrint st={st} h={h} /> : <Faces st={st} D={D} h={h} />}
      <p className="kicker">
        {breaking ? <Brk /> : null}
        <span>{i ? (TONIGHT.has(st.type) ? 'Tonight' : 'Also today') : date}</span>
        <span className={`k${st.group ? ` g-${st.group}` : ''}`}>{st.kicker}{run && run.i.length > 1 ? <small>{`${run.i.indexOf(i) + 1} of ${run.i.length}`}</small> : null}</span>
      </p>
      <Hed className={`lead-hed${st.mark ? ' marked' : ''}`}><Marked text={st.headline} marks={st.mark} /></Hed>
    </div>
  );
  // double tap the headline to fire it (src/buzz/burst.js); the handlers live as long as the slide, so a re-render
  // between the two taps doesn't lose the first
  const key = useRef(hk);
  key.current = hk;
  const tap = useMemo(() => doubleTap((x, y) => fireHeadline(key.current, x, y)), []);
  return (
    <article ref={slideRef} {...(front ? tap : null)} className={`slide${breaking ? ' breaking' : ''}`} id={`slide-${i}`} role="group" aria-roledescription="slide" aria-label={`Headline ${i + 1} of ${n}`} inert={!front}>
      {top}
      <p className="lead-deck"><Marked text={st.deck} marks={st.mark} /></p>
      {st.cta ? <WhatIfLink cls="on-scene" label={st.cta.label} /> : null}
      {rx.enabled ? <Suspense fallback={<div className="rxn-hold" />}><Reactions hk={hk} label={tickOf(st).hook} rx={rx} react={react} /></Suspense> : null}
      {st.trade ? <TradeGraphic trade={st.trade} D={D} h={h} /> : <Cast st={st} D={D} h={h} />}
    </article>
  );
}

const Arrow = ({ dir, label, d, onClick }) => (
  <button type="button" className="car-arrow" data-dir={dir} aria-label={label} onClick={onClick}>
    <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true"><path d={d} stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>
);
const PauseIcon = ({ paused }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">{paused
    ? <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" />
    : <path d="M4 2.5h2.6v11H4zm5.4 0H12v11H9.4z" fill="currentColor" />}</svg>
);

/**
 * stories: the headlines, in order; date: today, for the first kicker; hold: the "games in progress" note, or null;
 * night: the night edition is on; groups: section labels by story group.
 */
export function Carousel({ D, h, stories, date, hold, night, groups }) {
  const n = stories.length;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(pausedForVisit);
  const car = useRef(null), track = useRef(null), slides = useRef([]), dots = useRef([]);
  const at = useRef(0);
  // the league's reactions to these headlines, by their desk keys
  const rx = useReactions();
  const keys = storyKeys(stories, D.meta.lastScored + 1);
  useEffect(() => { loadReactions(keys); }, [keys.join()]);

  // sections: runs of slides sharing a group, when every slide has one
  const runs = stories.every((st) => groups[st.group])
    ? stories.reduce((a, st, i) => { const r = a[a.length - 1]; if (r?.g === st.group) r.i.push(i); else a.push({ g: st.group, i: [i] }); return a; }, [])
    : null;

  // The full track catches swipes. Its narrower active card exposes the adjacent stories.
  const geom = useRef({ pitch: 360, pull: 360 });
  const lite = mq('(max-width: 760px), (pointer: coarse)');
  const ring = useRing({
    n, geom,
    onAt: (k, settling) => {
      at.current = k;
      setIdx(k);
      if (settling) layout(); // a glide says where it's headed as it starts: the frame grows or shrinks along with it
    },
  });
  function layout() {
    const el = car.current, tr = track.current;
    if (!el || !tr) return;
    const phone = mq('(max-width: 760px)'), F = tr.clientWidth, many = n > 1;
    const side = many ? Math.min(phone ? 26 : 38, F * 0.08) : 0;
    const W = F - 2 * side, pitch = W + (phone ? 6 : 10);
    geom.current = { pitch, pull: pitch, phone };
    el.style.setProperty('--side', `${side}px`);
    el.style.setProperty('--card-w', `${W}px`);
    el.style.removeProperty('--card-h');
    const tall = slides.current.map((s) => (s ? s.offsetHeight : 0));
    const H = phone ? tall[at.current] : Math.max(W, ...tall);
    el.style.setProperty(phone ? '--front-h' : '--card-h', `${H}px`);
    if (phone) el.style.removeProperty('--card-h'); else el.style.removeProperty('--front-h');
    tr.style.height = `${H}px`;
    ring.slots.current.forEach((s, i) => s && s.toggleAttribute('data-fit', !phone || i === at.current));
    ring.paint();
  }
  const go = (i) => ring.to((i + n) % n);
  const goRef = useRef(go);
  goRef.current = go;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // placed before the first paint
  useLayoutEffect(() => { layoutRef.current(); }, []);

  useEffect(() => {
    const el = car.current, tr = track.current;
    const fit = () => layoutRef.current();
    // Only rotate while the card is mostly on screen. A rotation changes the card's height on phones,
    // and iPhone Safari doesn't anchor scrolling, so rotating while someone reads further down would jolt the page.
    const seen = new IntersectionObserver(([e]) => { el.classList.toggle('away', e.intersectionRatio < 0.6); }, { threshold: [0, 0.6] });
    seen.observe(el);
    document.fonts?.ready.then(fit); // headline height changes once the display font arrives
    // and whenever a slide's own height changes: the reaction bar arrives after the first paint and its chips wrap
    const grown = new ResizeObserver(fit);
    slides.current.forEach((s) => s && grown.observe(s));
    // re-fit on real width changes only: iPhone fires resize as its toolbar hides during every scroll
    let width = innerWidth;
    const onResize = () => { if (innerWidth !== width) { width = innerWidth; fit(); } };
    addEventListener('resize', onResize, { passive: true });
    // touch has no hover, so hold the timer while a finger is down
    const down = () => el.classList.add('held'), up = () => el.classList.remove('held');
    tr.addEventListener('pointerdown', down);
    tr.addEventListener('pointerup', up);
    tr.addEventListener('pointercancel', up);
    // a two-finger sideways scroll on a trackpad turns the ring a card at a time
    let sum = 0, rest = 0, quiet = 0;
    const onWheel = (e) => {
      if (n < 2 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      clearTimeout(quiet);
      quiet = setTimeout(() => { sum = 0; }, 160);
      if (performance.now() < rest) return;
      sum += e.deltaX;
      if (Math.abs(sum) > 50) { goRef.current(at.current + Math.sign(sum)); sum = 0; rest = performance.now() + 450; }
    };
    tr.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      seen.disconnect();
      grown.disconnect();
      removeEventListener('resize', onResize);
      tr.removeEventListener('pointerdown', down);
      tr.removeEventListener('pointerup', up);
      tr.removeEventListener('pointercancel', up);
      tr.removeEventListener('wheel', onWheel);
      clearTimeout(quiet);
    };
  }, []);

  useEffect(() => { car.current.classList.toggle('paused', paused); }, [paused]);
  const togglePause = () => { pausedForVisit = !paused; setPaused(!paused); };

  const dot = (i) => (
    <button type="button" key={i} ref={(b) => (dots.current[i] = b)} className="car-dot" data-i={i} aria-label={`Show headline ${i + 1}${runs ? `, ${groups[stories[i].group]}` : ''}`} aria-controls={`slide-${i}`}
      aria-current={i === idx ? 'true' : undefined} onClick={() => go(i)}>
      <i onAnimationEnd={() => go(at.current + 1)} />
    </button>
  );
  return (
    <section ref={car} className={`lead-car${n > 1 ? ' ring' : ''}`} aria-roledescription="carousel" aria-label="Today's headlines">
      {hold ? <p className="desk-note" role="status"><span className="live-dot" aria-hidden="true" />{hold}</p> : null}
      <div className="car-track" tabIndex="0" ref={track} data-held={ring.held} {...ring.bind}>
        {stories.map((st, i) => (
          /* the slot is where the card is on the ring, the floater its drift, the card its give under the pointer:
             three motions, three elements (see Ring.jsx). A card behind comes forward when tapped. */
          <div key={i} ref={(s) => (ring.slots.current[i] = s)} className={`car-slot${i === idx ? ' front' : ''}`}
            onClick={i === idx ? undefined : () => { if (!ring.dragged()) go(i); }}>
            <div className="car-float">
              <Card sink={8} off={i !== idx || ring.held || lite}>
                <Slide st={st} i={i} n={n} D={D} h={h} groups={groups} runs={runs} date={date} front={i === idx} slideRef={(s) => (slides.current[i] = s)} hk={keys[i]} rx={rx} />
              </Card>
            </div>
          </div>
        ))}
      </div>
      {n > 1 ? (
        <div className="car-nav">
          <Arrow dir={-1} label="Previous headline" d="M7.5 1.5 2 7l5.5 5.5" onClick={() => go(at.current - 1)} />
          <div className="car-mid">
            {runs
              ? <div className="car-dots grouped">{runs.map((r) => <div className={`car-group g-${r.g}`} key={r.i[0]}><div className="cg-dots">{r.i.map(dot)}</div><span className="cg-label">{groups[r.g]}</span></div>)}</div>
              : <div className="car-dots">{stories.map((_, i) => dot(i))}</div>}
            <button type="button" className="car-pause" aria-pressed={String(paused)} aria-label={`${paused ? 'Play' : 'Pause'} the headlines`} onClick={togglePause}><PauseIcon paused={paused} /></button>
          </div>
          <Arrow dir={1} label="Next headline" d="M1.5 1.5 7 7l-5.5 5.5" onClick={() => go(at.current + 1)} />
        </div>
      ) : null}
    </section>
  );
}

