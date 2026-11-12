// The 2.0 touch layer: what a finger feels on a phone. Plain DOM beside the React pages, never inside them: every
// effect here draws on its own element on <body> (or runs a Web Animation on the `scale` property, which no stylesheet
// rule uses for layout), so React's nodes, their classes and their own transitions are never touched.
//  - press: a pressable thing dips under the finger and springs back, and a bubble of light spreads from the touch
//  - dock: the phone's tab bar (styles.css, "2.0") follows a finger slid across it; lifting picks the tab under it
//  - shine: a band of light crosses a glass card the first time it comes on screen
//  - top pill: a round glass button that fills as you read down the page and takes you back to the top
//  - hello: the one-time note that says what changed
// 2.1 (Dan's request Nov 11, more of an iPhone app):
//  - swipe: a sideways swipe on the page goes to the next or previous tab; a chip follows the finger in from the edge
//  - pull: a scouting report's pull is a handle you can drag open or shut
//  - page in: on phones a new tab's page slides in from the side you're heading
//  - tapping the tab you're already on goes back to the top, as a tab bar does
// All of it is off under reduced motion, and the press and the dock only answer a finger or a pen, never a mouse.

import { GRADIENT_CONTROLS, initGradient } from './gradient.js';

const mq = (q) => { const m = matchMedia(q); return () => m.matches; };
const calm = mq('(prefers-reduced-motion: reduce)');
const phone = mq('(max-width: 760px)');
const root = document.documentElement;
const el = (tag, cls, html = '') => { const n = document.createElement(tag); n.className = cls; n.innerHTML = html; return n; };

// A tick you can feel. Android vibrates; iPhone Safari has no vibration API, but toggling a switch-style checkbox
// through its label plays the system's switch haptic (Safari 17.4 and later), which is all a tick needs. Anything
// older does nothing.
let tickLabel = null;
export function haptic() {
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    if (!tickLabel) {
      tickLabel = el('label', 'tx-haptic', '<input type="checkbox" switch tabindex="-1">');
      tickLabel.setAttribute('aria-hidden', 'true');
      document.body.append(tickLabel);
    }
    tickLabel.click();
  } catch { /* no haptics here */ }
}

// ---------- press ----------
const PRESSABLE = 'a[href], button:not(:disabled), summary, [role="button"], .team-pick';
// these run their own gestures or are too small a world to dress up: the dock, the emoji picker, the desk
const HANDS_OFF = '.tabs, .rxn, .adm-page, .paper input, .tx-top, .me-panel select';
const SPRING = 'cubic-bezier(0.3, 1.5, 0.5, 1)';

function initPress() {
  const lens = el('div', 'tx-lens', '<i></i>');
  lens.setAttribute('aria-hidden', 'true');
  document.body.append(lens);
  const drop = lens.firstChild;
  let held = null, dip = null;

  const release = () => {
    if (!held) return;
    const node = held;
    held = null;
    const from = getComputedStyle(node).scale;
    dip?.cancel();
    dip = null;
    node.animate([{ scale: from === 'none' ? '1' : from }, { scale: '1' }], { duration: 420, easing: SPRING });
  };

  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || calm() || !e.isPrimary) return;
    const hit = e.target.closest?.(PRESSABLE);
    if (!hit || hit.closest(HANDS_OFF)) return;
    // a ranking row's button is its whole card's face, so the card is what dips
    const node = (hit.classList.contains('rank-btn') && hit.closest('.rank-card')) || hit;
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) return;
    release();
    held = node;
    // the dip: about 5px off the longer side, so a pill visibly gives and a card barely breathes
    const s = Math.max(0.93, 1 - 5 / Math.max(r.width, r.height));
    dip = node.animate([{ scale: '1' }, { scale: String(s) }], { duration: 110, easing: 'ease-out', fill: 'forwards' });
    // the light: a box the shape of the thing pressed, a bubble growing in it from under the finger
    if (hit.matches(GRADIENT_CONTROLS)) return; // these ripple on a completed click, on every input device
    const cs = getComputedStyle(node);
    lens.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${cs.borderRadius}`;
    const reach = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY));
    const d = Math.min(2 * reach, 520);
    drop.style.cssText = `left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px`;
    drop.getAnimations().forEach((a) => a.cancel());
    drop.animate([{ transform: 'scale(0.12)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
  }, { passive: true });
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, release, { passive: true });
  // a finger that turns a press into a scroll gets no bubble riding along
  addEventListener('scroll', () => { if (held) { drop.getAnimations().forEach((a) => a.cancel()); release(); } }, { passive: true });
}

// ---------- the dock ----------
// Phones: slide a finger along the tab bar and the amber pill follows it, tab to tab; lifting picks the tab under it.
// A plain tap is left to the link itself. placeInk (app.js) puts the pill back on the page's own tab.
// Real refraction for the dock's glass where the browser can bend a backdrop through an SVG filter (Chromium; iPhone
// Safari can't, and every browser on an iPhone is Safari underneath, so it keeps the CSS frost, caustics and bevel).
// The backdrop is pushed around by a slow, stretched noise, every colour by the same amount, so what passes behind the
// glass bends like it would through a thick lens, clear, with no colour fringes (Dan, Nov 10).
// styles.css applies it under html.lens-glass.
function lensGlass() {
  const ua = navigator.userAgent;
  if (!window.chrome || /iPhone|iPad|iPod/.test(ua) || document.getElementById('dock-lens')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = '<filter id="dock-lens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.008 0.05" numOctaves="2" seed="11" result="n"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G" result="d"/>'
    + '<feGaussianBlur in="d" stdDeviation="1.2"/></filter>';
  document.body.append(svg);
  root.classList.add('lens-glass');
}

function initDock(placeInk) {
  const nav = document.querySelector('.tabs'), ink = nav?.querySelector('.tab-ink');
  if (!nav || !ink) return;
  lensGlass();
  let drag = null;
  const tabs = () => [...nav.querySelectorAll('a')].filter((a) => !a.hidden);
  const under = (x) => {
    let best = null, gap = Infinity;
    for (const a of drag.tabs) { const r = a.getBoundingClientRect(), g = Math.abs(x - (r.left + r.width / 2)); if (g < gap) { gap = g; best = a; } }
    return best;
  };
  const aim = (a) => {
    if (!a || a === drag.over) return;
    drag.over?.classList.remove('hot');
    drag.over = a;
    a.classList.add('hot');
    ink.style.width = `${a.offsetWidth}px`;
    ink.style.transform = `translateX(${a.offsetLeft}px)`;
    haptic();
  };
  const end = (pick) => {
    if (!drag) return;
    const { over, moved, id } = drag;
    drag = null;
    nav.classList.remove('dragging');
    over?.classList.remove('hot');
    try { nav.releasePointerCapture(id); } catch { /* already let go */ }
    if (!moved) return;
    // the lift ends in a click on whatever is under the finger; the slide has already chosen
    nav.dataset.slid = '1';
    setTimeout(() => delete nav.dataset.slid, 80);
    const here = nav.querySelector('a[aria-current]');
    if (pick && over && over !== here) location.hash = over.getAttribute('href');
    else placeInk();
  };
  nav.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !phone() || !e.isPrimary) return;
    drag = { id: e.pointerId, x: e.clientX, moved: false, over: null, tabs: tabs() };
  });
  nav.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.abs(e.clientX - drag.x) < 10) return;
      drag.moved = true;
      drag.over = nav.querySelector('a[aria-current]'); // moving off the page's own tab is the first tick
      nav.classList.add('dragging');
      try { nav.setPointerCapture(drag.id); } catch { /* the finger already left */ }
    }
    aim(under(e.clientX));
  });
  nav.addEventListener('pointerup', (e) => { if (drag && e.pointerId === drag.id) end(true); });
  nav.addEventListener('pointercancel', () => end(false));
  nav.addEventListener('click', (e) => { if (nav.dataset.slid) { e.preventDefault(); e.stopPropagation(); } }, true);
  // the tab you're on: a tap goes back to the top of its page
  nav.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[aria-current]');
    if (!a || scrollY < 40) return;
    e.preventDefault();
    haptic();
    scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' });
  });
}

// ---------- swipe between tabs ----------
// Phones: a sideways swipe anywhere on the page that isn't already something you drag (the headline deck, a slider, a
// table that scrolls) goes to the next tab, or back to the one before. A glass chip with that tab's name follows the
// finger in from the edge and turns amber once letting go will change the page. Touch events, all passive: the
// browser decides between a scroll and this in the first few pixels, the same way we do. Starts within 24px of an
// edge are left to Safari's own back and forward swipe.
const OWN_DRAG = '.lead-car, .tabs, .me, .rxn, .stk, .pull, .lb-pull, .adm-page, .unveil, .share-sheet, .lockout, .vf, input, select, textarea, [contenteditable]';
const scrollsSideways = (n) => {
  for (; n && n !== document.body; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 4) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; }
  }
  return false;
};
let swipeDir = 0; // which way the last swipe went, for pageIn
function initSwipe() {
  // a black island that flows out of the screen's edge, its corners curving into it; the ring fills as you pull
  const chip = el('div', 'tx-swipe', '<span></span><svg viewBox="0 0 32 32" aria-hidden="true"><circle class="sw-track" cx="16" cy="16" r="13" pathLength="100"/><circle class="sw-ring" cx="16" cy="16" r="13" pathLength="100"/><path d="M13.5 10.5l5.5 5.5-5.5 5.5"/></svg>');
  chip.setAttribute('aria-hidden', 'true');
  document.body.append(chip);
  const label = chip.firstChild, ring = chip.querySelector('.sw-ring'), NEED = 96;
  let g = null;
  const hide = () => { chip.classList.remove('on', 'go'); chip.style.transform = ''; g = null; };
  addEventListener('touchstart', (e) => {
    g = null;
    if (!phone() || e.touches.length !== 1 || root.matches('.locked, .admin-mode, .focusing')) return;
    const t = e.touches[0];
    if (t.clientX < 24 || t.clientX > innerWidth - 24) return;
    if (e.target.closest?.(OWN_DRAG) || scrollsSideways(e.target)) return;
    g = { x: t.clientX, y: t.clientY, lock: false, armed: false };
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!g) return;
    if (e.touches.length !== 1) return hide();
    const dx = e.touches[0].clientX - g.x, dy = e.touches[0].clientY - g.y;
    if (!g.lock) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.7) { g = null; return; }
      const tabs = [...document.querySelectorAll('.tabs a')].filter((a) => !a.hidden), i = tabs.findIndex((a) => a.hasAttribute('aria-current'));
      g.dir = dx < 0 ? 1 : -1; // a swipe to the left is the next tab
      g.next = i < 0 ? null : tabs[i + g.dir];
      if (!g.next) { g = null; return; }
      g.lock = true;
      label.textContent = g.next.querySelector('.ts, .tn')?.textContent || g.next.textContent.trim();
      chip.classList.toggle('back', g.dir < 0);
      chip.classList.add('on');
    }
    const pull = Math.max(0, -dx * g.dir), p = Math.min(1, pull / NEED), armed = p >= 1;
    // the chip comes out of the edge with the finger, and gives a little more past the point of no return
    const out = (1 - p) * 105 - (armed ? Math.min(8, (pull - NEED) / 12) : 0);
    chip.style.transform = `translateX(${g.dir > 0 ? out : -out}%)`;
    ring.style.strokeDasharray = `${(p * 100).toFixed(1)} 100`;
    if (armed !== g.armed) { g.armed = armed; chip.classList.toggle('go', armed); haptic(); }
  }, { passive: true });
  addEventListener('touchend', () => {
    if (g?.lock && g.armed) { swipeDir = g.dir; location.hash = g.next.getAttribute('href'); }
    hide();
  }, { passive: true });
  addEventListener('touchcancel', hide, { passive: true });
}

// Phones: the new tab's page slides in from the side you're heading (route() in app.js calls this after it renders).
// One short animation on #app, opacity and the `translate` property only. A fixed thing inside the page (the rankings
// lockout) would be carried along by it, so that page just appears.
export function pageIn(dir) {
  const app = document.getElementById('app'), d = swipeDir || dir;
  swipeDir = 0;
  if (!app || !d || calm() || !phone() || app.querySelector('.lockout')) return;
  app.animate([{ opacity: 0, translate: `${d * 36}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
}

// ---------- the scouting report's pull ----------
// A ranking card's pull is a handle: drag it down and the report opens, drag it up on an open one and it shuts. The
// words give with the finger (a paused Web Animation on `translate`, scrubbed by the drag) and the row's own button
// does the opening, so the drawer's animation is exactly a tap's.
function initPull() {
  const NEED = 30;
  let p = null;
  const drop = () => { p?.give?.cancel(); p = null; };
  addEventListener('touchstart', (e) => {
    drop();
    const pull = e.touches.length === 1 && e.target.closest?.('.pull'), btn = pull && pull.closest('.rank-btn');
    if (!btn) return;
    const open = !!pull.closest('.rank.open'), way = open ? -1 : 1;
    p = { btn, y: e.touches[0].clientY, way, done: false, give: null };
    if (!calm()) { p.give = pull.animate([{ translate: '0 0' }, { translate: `0 ${way * 9}px` }], { duration: 100, fill: 'both' }); p.give.pause(); }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (!p || p.done) return;
    const d = (e.touches[0].clientY - p.y) * p.way;
    if (p.give) p.give.currentTime = Math.max(0, Math.min(1, d / NEED)) * 100;
    if (d < NEED) return;
    p.done = true;
    haptic();
    p.give?.cancel();
    p.btn.click();
  }, { passive: true });
  for (const type of ['touchend', 'touchcancel']) addEventListener(type, drop, { passive: true });
}

// ---------- shine ----------
// The first time a glass card is properly on screen, a band of light crosses it once. The band is drawn on a box laid
// over the card from <body> (page coordinates, so it scrolls with the card), not inside it.
const SHINE = '.car-slot.front .car-card, .gotw, .rank-card, .you-strip, .matchups > .mu, .live-panel, .you-card, .trade, .idea, .lab-grid > .panel, .wire-stats, .futures, .poll';
let shineIo = null;
export function shine(scope) {
  shineIo?.disconnect();
  if (calm() || !('IntersectionObserver' in window) || !scope) return;
  let k = 0, last = 0;
  shineIo = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const card = en.target;
      shineIo.unobserve(card);
      // a card's own entrance (the ranking rows rise and grow) finishes first; a batch goes one after another
      const now = performance.now(), at = Math.max(now + 420, last + 140);
      last = at;
      setTimeout(() => {
        if (!card.isConnected) return;
        const r = card.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight || !r.width) return;
        const box = el('div', 'tx-shine', '<i></i>');
        box.setAttribute('aria-hidden', 'true');
        box.style.cssText = `left:${r.left + scrollX}px;top:${r.top + scrollY}px;width:${r.width}px;height:${Math.min(r.height, 900)}px;border-radius:${getComputedStyle(card).borderRadius}`;
        document.body.append(box);
        // the band is a fixed width, so it reads the same on a phone card and a desktop row
        const band = Math.min(r.width * 0.34, 150), i = box.firstChild;
        i.style.width = `${band}px`;
        const run = i.animate([{ transform: `translateX(${-band * 1.4}px) skewX(-18deg)` }, { transform: `translateX(${r.width + band * 0.4}px) skewX(-18deg)` }],
          { duration: Math.min(1300, 700 + r.width * 0.5), easing: 'cubic-bezier(0.4, 0, 0.3, 1)' });
        run.finished.catch(() => {}).then(() => box.remove());
      }, at - now);
      if (++k > 40) shineIo.disconnect(); // plenty for one page
    }
  }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
  scope.querySelectorAll(SHINE).forEach((card) => shineIo.observe(card));
}

// ---------- the top pill ----------
// Past a screen and a half, a round glass button rises above the dock: its ring fills with how far down the page you
// are, and a tap goes back to the top.
function initTopPill() {
  const C = 2 * Math.PI * 19;
  const btn = el('button', 'tx-top', `<svg viewBox="0 0 44 44" aria-hidden="true"><circle class="tx-top-track" cx="22" cy="22" r="19"/><circle class="tx-top-ring" cx="22" cy="22" r="19" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/><path d="M15.500 24.500L22 18l6.500 6.500"/></svg>`);
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Back to the top');
  btn.tabIndex = -1;
  document.body.append(btn);
  const ring = btn.querySelector('.tx-top-ring');
  let queued = false, on = false, max = 1;
  const measure = () => (max = Math.max(1, root.scrollHeight - innerHeight));
  new ResizeObserver(measure).observe(document.body);
  const paint = () => {
    queued = false;
    const y = Math.max(0, scrollY), show = y > innerHeight * 1.5 && !root.classList.contains('locked');
    if (show !== on) { on = show; btn.classList.toggle('on', on); btn.tabIndex = on ? 0 : -1; }
    if (on) ring.style.strokeDashoffset = (C * (1 - Math.min(1, y / max))).toFixed(1);
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  btn.addEventListener('click', () => { haptic(); scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' }); });
}

// ---------- hello ----------
// Once per device: a glass note above the dock that names the update and the one gesture nobody would guess.
function hello() {
  const KEY = 'ph-hello-40';
  if (root.classList.contains('admin-mode') || root.classList.contains('locked')) return;
  try { if (localStorage.getItem(KEY)) return; localStorage.setItem(KEY, '1'); } catch { return; }
  const note = el('div', 'tx-hello', `<b>4.0</b><span><strong>The Power Hour.</strong> ${phone() ? 'A new look: obsidian, ice and racing red. Your profile button at the top picks your team and switches between ice and obsidian.' : 'A new look: obsidian, ice and racing red. The moon in the bar switches the cards between ice and obsidian.'}</span>`);
  note.setAttribute('role', 'status');
  document.body.append(note);
  const close = () => { note.classList.remove('on'); setTimeout(() => note.remove(), 500); };
  requestAnimationFrame(() => requestAnimationFrame(() => note.classList.add('on')));
  note.addEventListener('click', close);
  setTimeout(close, 7000);
}

export function initTouch({ placeInk }) {
  initGradient();
  initDock(placeInk);
  initTopPill();
  if (!calm()) initPress();
  initSwipe();
  initPull();
  return { hello };
}
