// Double tap a headline to fire it (Dan's request Nov 14, after Instagram's double-tap heart): a cartoon flame pops
// where you tapped, overshoots, and floats off in a ring of sparks; the headline gets the league's fire reaction
// (src/hero/reactions.js) if the reactions store is on and this device hasn't already given it one. Like the heart,
// a second double tap never takes it back. Drawn on its own box on <body>, transform and opacity only, and a still
// flame that just fades under reduced motion.
import { react, rx } from '../hero/reactions.js';
import { haptic } from '../touch.js';

const FIRE = '🔥';
const FLAME = `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="bzfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE01A"/><stop offset="0.55" stop-color="#F9B000"/><stop offset="1" stop-color="#FF5A1F"/></linearGradient></defs>
<path d="M12 1.6c.7 3.7 6.1 6.3 6.1 12.1a6.1 6.1 0 0 1-12.2 0c0-3.1 1.7-5.2 3.3-6.5.1 2.1 1 3.3 2.1 3.8-.4-3.6-.1-6.5.7-9.4z" fill="url(#bzfg)" stroke="#12301A" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M12.2 11.4c.4 1.9 3 3.1 3 5.9a3.2 3.2 0 0 1-6.4 0c0-1.5.8-2.6 1.6-3.2.1 1 .5 1.6 1 1.9-.1-1.7.2-3.2.8-4.6z" fill="#FFF6B8"/>
<path d="M8.4 10.2c-.6 1-.9 2-.8 3.1" stroke="#fff" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.9"/></svg>`;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function fireBurst(x, y) {
  const box = document.createElement('div');
  box.className = 'bz-burst';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = `left:${x}px;top:${y}px`;
  box.innerHTML = `<span class="bz-burst-flame">${FLAME}</span>`;
  document.body.append(box);
  const flame = box.firstChild, done = () => box.remove();
  if (calm()) { flame.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 300 }).finished.then(done, done); return; }
  const tilt = (Math.random() - 0.5) * 24;
  flame.animate([
    { transform: `translate(-50%, -50%) scale(0) rotate(${tilt}deg)`, opacity: 0 },
    { transform: `translate(-50%, -50%) scale(1.25) rotate(${-tilt * 0.4}deg)`, opacity: 1, offset: 0.18 },
    { transform: 'translate(-50%, -50%) scale(0.92) rotate(0deg)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.62 },
    { transform: 'translate(-50%, -150%) scale(0.55) rotate(0deg)', opacity: 0 },
  ], { duration: 1100, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }).finished.then(done, done);
  // sparks: a ring of chalk and amber dots thrown out from the middle
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4, d = 56 + Math.random() * 34;
    const s = document.createElement('i');
    s.className = `bz-spark${i % 3 ? '' : ' w'}`;
    box.append(s);
    s.animate([
      { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 1, offset: 0.55 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.2}px), calc(-50% + ${Math.sin(a) * d * 1.2}px)) scale(0)`, opacity: 0 },
    ], { duration: 650, delay: 90, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)', fill: 'backwards' });
  }
}

/** Fire a headline: the burst at (x, y), and the reaction once per device. */
export function fireHeadline(key, x, y) {
  fireBurst(x, y);
  haptic();
  if (key && rx.enabled && !(rx.mine[key] || []).includes(FIRE)) react(key, FIRE, true);
}

/**
 * Pointer handlers for a card that fires on a double tap: two taps within 320ms and 30px of each other, neither of
 * them a drag, a press on a control or a press inside the reactions bar.
 */
export function doubleTap(fire) {
  let last = null, start = null;
  return {
    onPointerDown: (e) => { start = { x: e.clientX, y: e.clientY }; },
    // a mouse's double click would select the word under it
    onMouseDown: (e) => { if (e.detail > 1 && !e.target.closest('input, textarea')) e.preventDefault(); },
    onPointerUp: (e) => {
      const s = start;
      start = null;
      if (!s || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) return (last = null);
      if (e.target.closest('button, a, input, select, video, .rxn')) return (last = null);
      const now = performance.now();
      if (last && now - last.t < 320 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 30) {
        last = null;
        fire(e.clientX, e.clientY);
        return;
      }
      last = { t: now, x: e.clientX, y: e.clientY };
    },
  };
}
