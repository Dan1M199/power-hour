/* The ring the headline cards ride on: Bencho's "Carousel" (bencho.dev, MIT licensed, bencho.dev/licence), converted
   from TypeScript to JSX with its comments kept. Dan's request Nov 10: the headlines as a swipeable layered carousel.

   What changed to carry headlines instead of photographs (Carousel.jsx is the headline card itself):
   - the cards are the stories, so SHOTS, the fixed card and stage sizes and "which one opens at the front" are gone:
     the count is the number of headlines, the first one opens at the front, and the geometry (how far out, how much
     smaller, how far back the ring leans) is handed in by the headline card, which measures its own width;
   - a card is pinned by its top edge (transform-origin 50% 0), so cards of different heights line up along the top
     and the ones behind peek out over it; the resting angles fade to zero as a card comes forward, because the front
     card is read, not looked at, and the drift does the same;
   - the cards hold buttons, so a press only becomes a drag once it has moved sideways, and the click after a drag is
     swallowed; a two-finger sideways scroll turns the ring too;
   - Bencho's --lift is --bob here: this project already has a --lift (how far a card stands off its tier). */
import { useCallback, useEffect, useRef, useState } from 'react';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const mix = (a, b, t) => a + (b - a) * t;
const mod = (v, n) => ((v % n) + n) % n;

/* ── inlined from lab/spring ──────────────────────── */
/* ── one spring, for everything that settles ───────────────
   The maths was already on this bench twice, copied by hand:
   Humidity's wheel and Brightness's column both accumulate
   velocity toward a target, damp it, and snap when both the
   delta and the velocity fall under 0.02. Two copies is a
   coincidence; five would be a policy, so it comes out here
   before the elastic blocks are written against it.

   The two shipped copies are deliberately NOT refactored onto
   this. They work, they are tuned, and rewriting the innards
   of two live components to prove a point about duplication
   is how a good afternoon becomes a bad one. This is the one
   new code uses.

   Frames, not milliseconds. `dt` is expressed in sixtieths of
   a second and the damping is RAISED to it rather than
   multiplied by it, so a dropped frame decays the same amount
   of energy as the two frames it replaced. Multiplying is the
   version that makes a spring behave differently on a busy
   page, which is the hardest kind of bug to see.

   The loop parks itself the moment the value has settled.
   CLAUDE.md is not complimentary about the one permanent
   requestAnimationFrame already on this bench and there is no
   case for five more. */

/* 0..100 into the two numbers a spring actually has.

   50 is what Humidity and Brightness were tuned at, which is
   the rule every elastic knob on this bench follows — see
   lab/motion. Turn the panel to the middle and nothing has
   changed.

   Both ends have to be usable, which is what fixes the range:
   at 0 it is slow and heavy and still arrives, at 100 it is
   quick with a visible overshoot, and nowhere in between does
   it ring for longer than it takes to read. */
/* The pair is chosen by DAMPING RATIO and then written back
   as stiffness and decay, because the ratio is the thing a
   person is actually setting and the two numbers on their own
   do not say what they add up to.

     zeta = -ln(d) / (2 * sqrt(k))

   The first version of this ran 0.06..0.26 stiffness against
   0.93..0.74 decay, which reads as a sensible spread and is
   not one: it puts zeta between 0.15 and 0.16 across the
   WHOLE range, so every setting overshot by about sixty per
   cent and the knob only changed how fast it did it. Pull's
   return went 130px past its own resting position and lifted
   the content off the top of the card.

     0   → zeta ~0.85, heavy, arrives without a ring
     50  → zeta ~0.41, near where Humidity and Brightness sit
     100 → zeta ~0.20, lively, two visible rebounds

   Both ends shippable, which is the constraint that fixed the
   numbers rather than taste. */
const springOf = (tune) => ({
  /* stiffness: how hard it is pulled toward the target */
  k: 0.08 + (tune / 100) * 0.16,
  /* decay, per frame: how much of the velocity survives */
  d: 0.62 + (tune / 100) * 0.2,
});

/* Units matter. The snap threshold is absolute, so a caller
   works in pixels or in 0..100 — a spring driven over 0..1
   would be "settled" before it had visibly moved. */
function useSpring(target, tune = 50, instant = false) {
  const [at, setAt] = useState(target);
  const cur = useRef(target);
  const vel = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (instant) {
      cur.current = target;
      vel.current = 0;
      setAt(target);
      return undefined;
    }
    const { k, d } = springOf(tune);
    let prev = 0;
    const tick = (t) => {
      const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
      prev = t;
      vel.current += (target - cur.current) * k * dt;
      vel.current *= Math.pow(d, dt);
      cur.current += vel.current * dt;
      if (Math.abs(target - cur.current) < 0.02 && Math.abs(vel.current) < 0.02) {
        cur.current = target;
        vel.current = 0;
        setAt(target);
        raf.current = 0;
        return;
      }
      setAt(cur.current);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
    /* `tune` sits here beside `target` for the reason
       Brightness spells out: the loop closes over it, so
       without it a knob turned mid-flight would do nothing
       until something else restarted the effect. Restarting
       picks up from the refs, so it continues rather than
       snapping. */
  }, [target, tune, instant]);

  return at;
}

/* Read once, the way the wheel and the pill nav do. A
   preference, not a live input. */
export const stillness = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ── inlined from lab/motion ──────────────────────── */
/* ── elastic, as numbers a person can hold ─────────────────
   Several blocks here are the same idea in different clothes:
   something travels, stretches on the way, and overshoots
   when it lands. Their character lives in a duration and in
   one control point of a bezier — which is exactly the kind
   of thing nobody should have to name in order to tune.

   So the outside of every elastic knob is 0..100 and the
   inside is real units, and **50 is always what the component
   was already tuned to**. Turn every knob on the bench to the
   middle and nothing has changed. That is what makes these
   safe to expose: the default is not a number somebody has to
   remember, it is the middle of the slider.

   Both ends have to be shippable, which is the constraint
   that actually shapes these curves. The ranges below stop
   where the effect stops being the thing it is — a bar that
   moves in 40ms still reads as a bar snapping to a slot; one
   that moves in 20ms reads as broken. */

/* How long it takes, slower to faster, as a multiplier on
   whatever the component's own tuned duration is. 0 is a
   little over half again as slow, 100 is two and a half times
   as fast, 50 is exactly 1. */
const rate = (speed) => 1.6 - (speed / 100) * 1.2;

/* ══ Carousel ═════════════════════════════════════════════
   Cards on a turntable that drift at rest, give under the
   pointer, and can be swiped round.

   NOTHING EVER LEAVES THE FRAME, and that is the whole
   arrangement. This was a row twice — cards in a line, with
   the ones at the ends either dissolving into a mask or being
   cut by the edge of a box — and both are answers to the same
   question: what happens to a card when it runs out of block?
   A ring does not ask it. The cards go ROUND: out to one
   side, back and small, round to the other side, forward
   again. The furthest a card ever gets is the radius, which
   is a number this component chose, so there is no edge to
   treat and no box to put it in.

   IT IS THEREFORE ENDLESS. A row has a first card and a last
   one and has to decide what to do at each; a ring has
   neither, so the swipe never runs out and never rubber-bands.
   Swipe once and the front card shrinks and goes to the back
   while the next one comes forward — which is the motion he
   described, and it falls out of the geometry rather than
   being animated on top of it.

   THE ANGLE IS NOT TAKEN MODULO ANYTHING. `turn` counts up
   and down without limit and the angle is `(i - turn) * step`.
   Wrapping it to 0..360 would send a card the long way round
   the moment it crossed the seam, which is the one visible bug
   this arrangement can have — the same note the Pro sheet's
   reel carries, for the same reason.

   THREE MOTIONS, THREE ELEMENTS, ONE TRANSFORM EACH. The slot
   carries where the card is on the ring, the floater carries
   the drift, the card carries the tilt. They are nested rather
   than composed into one string because they are owned by
   three different things — the drag, a CSS animation and a
   pair of springs — and a single element cannot be written by
   three authors without one of them losing. */

/* ── how much smaller the back of the ring is ──────────────
   Read as a percentage of the way to half size: 100 puts the
   card at the back at 0.5. The knob runs to 150 — 0.25 —
   because the ceiling was the default's own value and that is
   a knob with nothing above it, so every setting was a step
   DOWN from where it shipped.

   `1 - depth / 200` rather than the arithmetic it replaced,
   which said the same thing with a 0.5 buried in it.

   The headlines sit at 30 (the back card at 0.85): these cards
   are nearly as wide as their frame, and what shows of a card
   behind is its edge, which wants to stay the size of a card. */
export const DEPTH = 30;
const DEPTH_MAX = 150;

/* how far ahead of the release the throw looks, in ms of
   travel. It is what makes a short fast flick move a card:
   without it a swipe is judged on distance alone and a quick
   one that barely moved counts for nothing. */
const TOSS = 150;
/* and how many it may skip. A flick can carry two; past that
   the ring blurs and you have lost your place on it. */
const MOST = 2;

const BASE = 620;

/* a press has to travel this far sideways before it is a drag:
   the cards are full of buttons, and a tap that wobbles must
   still be a tap */
const SLOP = 8;

/* ── every card sits at its own angle ──────────────────────
   Numbers that are not a pattern: no two the same, no
   symmetry to spot, and they do not alternate. A ring where
   the angles went -4, +4, -4, +4 is an arrangement somebody
   made; numbers that are merely different are a handful of
   photographs somebody put down.

   They can be this generous again now the cards are on a
   ring. On a row an angle cost width — a turned card sweeps
   its corner sideways into its neighbour's air — and the
   spread knob's floor had to pay for it. Cards at different
   depths are allowed to overlap; that is what depth looks
   like.

   (Smaller than Bencho's, and longer: a headline card is three
   times the height of his photographs, so a degree swings its
   foot three times as far, and there can be eight headlines.) */
// (no longer used at rest: the deck sits square. Kept with its note.)
export const ANGLE = [-1.7, 1.1, -0.6, 1.5, 0.7, -1.2, 0.9, -1.5];

/* the drift's periods, deliberately awkward so no two cards
   are ever doing the same thing. See the note in styles.css. */
export const PERIOD = [4.7, 5.9, 6.7, 5.3, 7.1, 6.1];

/* ── where a card sits, given where the ring is ────────────
   ONE function, read by the first paint and by the drag both.
   The drag writes transforms straight to the nodes — a render
   per pointermove and the ring visibly trails the finger — so
   there are two callers, and if they were two pieces of code
   they would drift apart the first time the geometry changed.

   `f` is the whole of it: 1 at the front, 0 at the back, and
   it drives the size, the lean and the paint order together.
   Position from the ANGLE rather than from a table of four
   places is what makes the transitions free — the card
   leaving swings out and back, the card arriving swings in
   and forward, and the one behind crosses without any of them
   knowing about the others.

   ── how far back the ring leans ───────────────────────────
   A card at the back sits `lean` higher than one at the
   front. Scale alone says smaller, which the eye can read as
   further away OR as literally smaller; a card that also
   rides UP as it recedes is unmistakably going back, because
   that is what a ring seen from slightly above does. It costs
   one term and it is most of what makes the depth read. And
   seeing something behind is what tells you the ring goes
   round: with two headlines the other card is directly behind
   the front one, and its top edge over the front card's is
   all there is of it. */
/* ── and then the ring became a deck (Dan, Nov 10, the same day) ──
   On the ring the cards behind sat out to both sides at their
   own angles, and with headline cards nearly as wide as the
   frame that read as a jumble: slivers of three cards at three
   tilts. So the resting places are a tidy stack now. `d` is how
   many places a card is behind the front one: the next headline
   sits one `step` higher and a little smaller, squarely behind,
   the one after another step, and the rest wait under that one
   (SHOWN). No angle, no sideways offset: only the top edges show,
   evenly, like cards in a deck.

   The turn is still the ring's, and still not wrapped: only the
   DISTANCE is taken modulo, and the seam is where the motion is.
   Swipe and the front card is dealt off to the side, clear of
   the deck (`reach`, a card's width and a bit), tucks to the
   bottom's size on its way back and slides in underneath, while
   every card behind steps forward one place. It changes from the
   top of the paint order to the bottom at the far point of that
   swing, when it overlaps nothing, so nothing pops. */
const SHOWN = 2;
export const spotOf = (i, turn, n, { step, shrink, reach }) => {
  const d = mod(i - turn, n);
  const deep = Math.min(n - 1, SHOWN);
  if (n > 1 && d > n - 1) {
    /* the card being dealt: t is 0 at the front and 1 at the bottom of the deck */
    const t = n - d, swing = Math.sin(t * Math.PI), L = deep * t * t * (3 - 2 * t);
    return { x: -swing * reach, y: -L * step, s: 1 - L * shrink, rot: -swing * 5, dim: L / SHOWN, z: t < 0.5 ? 200 : 0 };
  }
  const L = Math.min(d, SHOWN);
  /* ── paint order is a z-index, by hand ──────────────
     Everything here is 2D — scale and offset, not
     translateZ — so nothing sorts itself and a card would
     otherwise paint in DOM order and sit over the one in
     front of it. `d` already knows which is nearer. */
  return { x: 0, y: -L * step, s: 1 - L * shrink, rot: 0, dim: L / SHOWN, z: 100 - Math.round(d * 10) };
};

const write = (el, sp) => {
  /* NO OPACITY IS WRITTEN HERE. The cards used to fade with
     distance, which meant dragging dimmed and lit every one of
     them — the whole block pulsed on a gesture that should
     only move things round. Size, lean and paint order say
     which is in front; none of them touch the picture.
     (The headline cards do carry a shade, --dim, on a layer of
     its own: what shows of a card behind is the top of someone
     else's story, and it should not compete with the one
     being read.) */
  el.style.transform = `translate(-50%, 0) translate(${sp.x.toFixed(2)}px, ${sp.y.toFixed(2)}px) rotate(${sp.rot.toFixed(3)}deg) scale(${sp.s.toFixed(4)})`;
  el.style.zIndex = String(sp.z);
  el.style.setProperty('--dim', sp.dim.toFixed(3));
};

const out = (t) => 1 - (1 - t) ** 4;

/**
 * The ring's hands: where it is, the drag, the throw and the settle.
 * n: how many cards; geom: a ref to { orbit, depth, lean, pull } (pull: px of drag that turn the ring one position);
 * float: how much the cards behind drift at rest, 0..100; settle: how quickly a swipe settles, 0..100;
 * onAt(k, settling): told which card is nearest the front as the ring turns, and (settling) where a glide is headed
 * the moment it starts.
 * Returns { slots, paint, go, to, held, bind }: slots is the array ref for the cards' outer elements, bind goes on
 * the track.
 */
export function useRing({ n, geom, float = 0, settle = 50, onAt }) {
  const still = stillness();
  const slots = useRef([]);
  /* ── where the ring is, and it is a REF ──────────────────
     A continuous position in card-steps: 0 puts the first
     card at the front, 1.5 is halfway between the second and
     third. It changes every frame of a drag, which is exactly
     the value that must not be state — React renders when a
     knob moves, the ring is painted.

     It is NOT clamped and NOT wrapped. See the note at the
     top: this is the number a modulo would ruin. */
  const turn = useRef(0);
  const raf = useRef(0);
  const drag = useRef(null);
  const near = useRef(0), gliding = useRef(false), swallow = useRef(false);
  const [held, setHeld] = useState(false);
  const told = useRef(onAt);
  told.current = onAt;

  const paint = useCallback(() => {
    slots.current.forEach((el, i) =>
      el && write(el, spotOf(i, turn.current, n, geom.current)));
    /* the dots follow a drag as it crosses the halfway mark; a glide has already said where it is going */
    const k = mod(Math.round(turn.current), n);
    if (!gliding.current && k !== near.current) { near.current = k; told.current?.(k, false); }
  }, [n, geom]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /* ── the settle ──────────────────────────────────────────
     Quart-out from wherever the ring currently is to a whole
     position. It reads its start from the live value rather
     than from where the drag began, so a second swipe during
     one turns the ring further instead of snapping it back. */
  const glide = (to) => {
    cancelAnimationFrame(raf.current);
    const from = turn.current;
    near.current = mod(to, n);
    told.current?.(near.current, true);
    if (still || from === to) {
      gliding.current = false;
      turn.current = to;
      paint();
      return;
    }
    gliding.current = true;
    const ms = BASE * rate(clamp(settle, 0, 100));
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      turn.current = mix(from, to, out(p));
      if (p >= 1) gliding.current = false;
      paint();
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const go = (d) => glide(Math.round(turn.current) + d);
  /* to card k, the short way round */
  const to = (k) => {
    const base = Math.round(turn.current);
    let d = mod(k - base, n);
    if (d > n / 2) d -= n;
    glide(base + d);
  };

  const down = (e) => {
    if (n < 2 || e.button || e.target.closest?.('.rxn, input, select, textarea')) return;
    drag.current = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: turn.current, last: e.clientX,
      t: e.timeStamp, vx: 0, moved: false,
    };
  };

  const move = (e) => {
    const g = drag.current;
    if (!g || e.pointerId !== g.id) return;
    if (!g.moved) {
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) { drag.current = null; return; } // a scroll, not a swipe
      if (Math.abs(dx) < SLOP) return;
      /* it is a drag from here: the ring stops where it is and follows, from this point so it does not jump */
      cancelAnimationFrame(raf.current);
      gliding.current = false;
      g.moved = true; g.x0 = e.clientX; g.t0 = turn.current; g.last = e.clientX; g.t = e.timeStamp;
      setHeld(true);
      getSelection?.()?.removeAllRanges();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
    }
    const dx = e.clientX - g.x0;

    /* px per ms, smoothed against the previous reading so one
       jittery frame cannot fake a flick — and measured from
       the LAST position rather than from the grab, because the
       speed at release is the only part of a swipe that says
       how far it meant to go */
    const dt = Math.max(1, e.timeStamp - g.t);
    g.vx = (g.vx + (e.clientX - g.last) / dt) / 2;
    g.last = e.clientX;
    g.t = e.timeStamp;

    /* ── no rubber band, because there is no end ─────────
       A row had to give at its first and last card, or it read
       as broken input. A ring has neither, so the drag is a
       plain one-to-one and keeps going as long as you do. */
    turn.current = g.t0 - dx / geom.current.pull;
    paint();
  };

  const up = (e) => {
    const g = drag.current;
    if (!g || (e && e.pointerId !== g.id)) return;
    drag.current = null;
    if (!g.moved) return; // a tap: the buttons' business
    setHeld(false);
    /* the click a browser sends after the release belongs to the drag, not to whatever is under the finger */
    swallow.current = true;
    setTimeout(() => { swallow.current = false; }, 80);
    /* where it would come to rest if it kept going, capped so
       a hard flick cannot spin the ring past where you can
       follow it */
    const carry = clamp((-g.vx * TOSS) / geom.current.pull, -MOST, MOST);
    glide(Math.round(turn.current + carry));
  };

  const key = (e) => {
    if (e.target !== e.currentTarget) return; // arrows inside a card belong to what is focused there
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d || n < 2) return;
    e.preventDefault();
    go(d);
  };

  const click = (e) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return {
    slots, paint, go, to, held, dragged: () => swallow.current,
    bind: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up, onKeyDown: key, onClickCapture: click, onDragStart: (e) => e.preventDefault() },
  };
}

/* ── one card, and the press is its own ───────────────────
   A component per card rather than a loop, because the tilt is
   a pair of springs and a hook cannot be called n times from
   the parent. It costs nothing at rest: a spring at its target
   runs no loop at all.

   (Its children are the headline. They are the same elements
   from one of this card's renders to the next, so React leaves
   them alone while the springs run.) */
export function Card({ className = '', sink, off, children }) {
  const skin = useRef(null);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const [on, setOn] = useState(false);
  const still = stillness();

  /* ── the state, and there is only this ───────────────────
     Where the pointer is, as -1..1 on each axis, sprung. The
     spring is on the POSITION rather than on the rotation, so
     the transform and both gradients are three readings of one
     number instead of three things animating toward the same
     place. */
  const live = on && !off;
  const sx = useSpring(live ? pt.x : 0, 50, still);
  const sy = useSpring(live ? pt.y : 0, 50, still);
  const lit = useSpring(live ? 1 : 0, 50, still);

  const deep = clamp(sink, 0, 100) / 100;
  const max = deep * 13;
  /* IT SINKS, IT DOES NOT LIFT — the tilt card's rule. The
     point you are over goes AWAY and the far side comes up, so
     the card is being touched rather than displayed. */
  const rx = -sy * max;
  const ry = sx * max;

  /* the pointer in the card's own terms, as a PERCENTAGE. The
     wall, the overlay and the Pro sheet all draw this card at
     their own scale, and a gradient placed in pixels would
     land somewhere else in each of them. */
  const px = ((sx + 1) / 2) * 100;
  const py = ((sy + 1) / 2) * 100;
  const dark = deep * 0.5 * lit;
  /* the rim is a hint, not a highlight: at the tilt card's own
     0.34 a white wash slides across the photograph and reads
     as a sheen laid ON the picture rather than as the far edge
     of a dented surface catching light */
  const rim = deep * 0.16 * lit;

  const track = (e) => {
    const el = skin.current;
    /* a mouse only: a finger on a headline is reading, scrolling or swiping, and each of those already moves the card */
    if (!el || off || e.pointerType !== 'mouse') return;
    const b = el.getBoundingClientRect();
    setPt({
      x: clamp(((e.clientX - b.left) / b.width) * 2 - 1, -1, 1),
      y: clamp(((e.clientY - b.top) / b.height) * 2 - 1, -1, 1),
    });
    setOn(true);
  };

  /* at rest the card carries no transform at all, so its words are drawn flat and sharp */
  const resting = Math.abs(rx) < 0.005 && Math.abs(ry) < 0.005 && lit < 0.005;
  return (
    <div
      ref={skin}
      className={`car-card ${className}`}
      onPointerMove={track}
      /* `out` with a containment test rather than `leave` — the
         rehearsal's scripted pointer walks off carrying
         `relatedTarget: null`, which React does not synthesise
         a leave from, and the card would finish the demo still
         sunk under a cursor that had gone. */
      onPointerOut={(e) => {
        const el = skin.current;
        const to = e.relatedTarget;
        if (!el || !to || !el.contains(to)) setOn(false);
      }}
      onPointerCancel={() => setOn(false)}
      style={resting ? undefined : {
        /* translateZ FIRST, so the retreat is measured in the
           room's axes rather than in the card's own — after a
           rotation the card's z points off to one side and
           "back" stops meaning back */
        transform: `translateZ(${(-10 * deep * lit).toFixed(2)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`,
        /* ── ONE SHADOW, AND IT DOES NOT MOVE ─────────────
           It tightened as the card sank, which is the honest
           physics, and on four cards it was four shadows
           resizing as the pointer crossed them — the ring
           flickering rather than one card being touched. The
           dent and the rim say the card went back; the shadow
           only has to say it is off the ground. (It is the
           card's own, in styles.css.) */
      }}
    >
      {children}
      {/* the shade a card wears behind the front one (--dim, written with its place on the ring) */}
      <span className="car-dim" aria-hidden="true" />
      {/* the dent, and the rim opposite it. The shadow pools
          where the surface is deepest, which is under the
          pointer, and the light catches the far edge that has
          risen — so the two are placed at mirrored points and
          neither is centred on anything. This layer is what
          makes the transform read as a press. */}
      {resting ? null : (
        <span
          className="car-sheen"
          aria-hidden="true"
          style={{
            backgroundImage: `radial-gradient(44% 36% at ${px.toFixed(1)}% ${py.toFixed(1)}%, rgba(9, 14, 28, ${dark.toFixed(3)}) 0%, rgba(9, 14, 28, 0) 100%), radial-gradient(54% 44% at ${(100 - px).toFixed(1)}% ${(100 - py).toFixed(1)}%, rgba(255, 255, 255, ${rim.toFixed(3)}) 0%, rgba(255, 255, 255, 0) 100%)`,
          }}
        />
      )}
    </div>
  );
}
