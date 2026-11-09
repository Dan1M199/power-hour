// The 2.0 touch layer: what a finger feels on a phone. Plain DOM beside the React pages, never inside them: every
// effect here draws on its own element on <body> (or runs a Web Animation on the `scale` property, which no stylesheet
// rule uses for layout), so React's nodes, their classes and their own transitions are never touched.
//  - press: a pressable thing dips under the finger and springs back, and a bubble of light spreads from the touch
//  - dock: the phone's tab bar (styles.css, "2.0") follows a finger slid across it; lifting picks the tab under it
//  - shine: a band of light crosses a glass card the first time it comes on screen
//  - top pill: a round glass button that fills as you read down the page and takes you back to the top
//  - hello: the one-time note that says what changed
// All of it is off under reduced motion, and the press and the dock only answer a finger or a pen, never a mouse.

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
// these run their own gestures or are too small a world to dress up: the dock, the football, the emoji picker, the desk
const HANDS_OFF = '.tabs, .navball, .rxn, .adm-page, .paper input, .tx-top';
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
function initDock(placeInk) {
  const nav = document.querySelector('.tabs'), ink = nav?.querySelector('.tab-ink');
  if (!nav || !ink) return;
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
}

// ---------- shine ----------
// The first time a glass card is properly on screen, a band of light crosses it once. The band is drawn on a box laid
// over the card from <body> (page coordinates, so it scrolls with the card), not inside it.
const SHINE = '.lead-car, .gotw, .rank-card, .you-strip, .matchups > .mu, .live-panel, .you-card, .trade, .idea, .lab-grid > .panel, .wire-stats, .futures, .poll';
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
  const KEY = 'ph-hello-2';
  if (root.classList.contains('admin-mode') || root.classList.contains('locked')) return;
  try { if (localStorage.getItem(KEY)) return; localStorage.setItem(KEY, '1'); } catch { return; }
  const note = el('div', 'tx-hello', `<b>2.0</b><span><strong>The Power Hour 2.0.</strong> ${phone() ? 'The tabs moved down to your thumb. Slide a finger along them.' : 'New glass all round, and built for your phone.'}</span>`);
  note.setAttribute('role', 'status');
  document.body.append(note);
  const close = () => { note.classList.remove('on'); setTimeout(() => note.remove(), 500); };
  requestAnimationFrame(() => requestAnimationFrame(() => note.classList.add('on')));
  note.addEventListener('click', close);
  setTimeout(close, 7000);
}

export function initTouch({ placeInk }) {
  initDock(placeInk);
  initTopPill();
  if (!calm()) initPress();
  return { hello };
}
