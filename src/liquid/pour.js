// Cartoon liquid on the page: one SVG behind everything (just above the grass and the painted rank numbers) holding the
// shape lib/liquid.js traces from the cards. The cards themselves go see-through (data-liq) and their contents sit in
// the liquid. It redraws whenever a card changes size, inside the ResizeObserver callback so the shape never lags the
// content by a frame: opening a row swells the liquid as the row grows. Anything sticky or fixed stays out (--liq: none)
// and keeps the CSS drop in styles.css, and so does the whole site if this never runs. The header gets a small body of
// its own, since it scrolls apart from the page.
import { liquidOptions, buildField, toneField, contours, pathOf, shineOf } from '../../lib/liquid.js';

const NS = 'http://www.w3.org/2000/svg';
const BLOCKS = 'main :is(.sec-title, .day > h3, .filters, .view-head, .lab-head, .trade-bar, .trade-legend, .you-note)';
const MARGIN = 600; // how far past the screen a quick redraw reaches
let page, bar, flow, flowIo, main, foot, top, ro, sig = '', fullSig = '', barSig = '', seen = new WeakSet(), tones = new WeakMap(), lastW = 0, anim = 0, settle = 0;

function layer(parent, place) {
  const root = document.createElementNS(NS, 'svg');
  root.classList.add('liquid');
  root.setAttribute('aria-hidden', 'true');
  place(root);
  const add = (name, cls, into = root) => { const n = document.createElementNS(NS, name); n.setAttribute('class', cls); into.append(n); return n; };
  const shadow = add('path', 'l-shadow'), tones = add('g', 'l-tones'), ink = add('path', 'l-ink'), shine = add('path', 'l-shine'), made = new Map();
  const tone = (t) => {
    if (!made.has(t)) { const g = add('g', `t-${t}`, tones); made.set(t, { deep: add('path', 'l-deep', g), face: add('path', 'l-face', g) }); }
    return made.get(t);
  };
  return { root, shine,
    paint(F, level = 0) {
      const scratch = F.scratch ||= new Float32Array(F.n), take = (a) => pathOf(contours(F, a, level));
      const outline = take(F.d);
      ink.setAttribute('d', outline);
      shadow.setAttribute('d', outline);
      for (const t of F.tones) { const g = tone(t); g.deep.setAttribute('d', take(toneField(F, t, false, scratch))); g.face.setAttribute('d', take(toneField(F, t, true, scratch))); }
      for (const [t, g] of made) if (!F.tones.includes(t)) { g.deep.removeAttribute('d'); g.face.removeAttribute('d'); }
    },
    finish(F, o) { shine.setAttribute('d', shineOf(F, F.d, o)); },
  };
}

// page position from the layout, not getBoundingClientRect: rows mid-entrance carry transforms the liquid shouldn't follow
function box(n) {
  let x = 0, y = 0, p = n;
  while (p) { x += p.offsetLeft; y += p.offsetTop; p = p.offsetParent; }
  return { x, y, w: n.offsetWidth, h: n.offsetHeight };
}

// a card's tone, read from CSS once per class list (a width change can move a media query, so it starts over)
function toneOf(n) {
  let t = tones.get(n);
  if (t?.cls !== n.className) { t = { cls: n.className, tone: getComputedStyle(n).getPropertyValue('--liq').trim() }; tones.set(n, t); }
  return t.tone;
}

function measure() {
  const prims = [], W = document.documentElement.clientWidth;
  if (W !== lastW) { lastW = W; tones = new WeakMap(); }
  if (main.querySelector('.loading:only-child #loading')) return null; // the kicker's still up
  for (const n of main.querySelectorAll('.glass:not(.kick-card)')) {
    if (!n.offsetWidth || !n.offsetHeight) continue;
    const tone = toneOf(n);
    if (!tone || tone === 'none') { if (n.hasAttribute('data-liq')) n.removeAttribute('data-liq'); continue; }
    if (n.getAttribute('data-liq') !== tone) n.setAttribute('data-liq', tone);
    if (!seen.has(n)) { seen.add(n); ro.observe(n); }
    const p = { ...box(n), tone };
    if (n.classList.contains('rank-card')) p.noLeft = true;
    prims.push(p);
  }
  const f = box(foot);
  prims.push({ x: -80, y: f.y, w: W + 160, h: f.h + 120, tone: 'turf', pool: true, still: true });
  return { prims, W, H: f.y + f.h };
}

// 'full' traces the whole page. 'quick' traces only the screen and a margin, which is what runs while something is
// changing size, then a full trace follows once it has been still for a moment. 'entrance' is quick plus the swell.
function draw(mode) {
  const m = measure();
  if (!m) { page.root.style.display = 'none'; sig = fullSig = ''; flow.replaceChildren(); top.classList.remove('poured'); return; }
  const s = `${m.W}|${m.H}|${m.prims.map((p) => `${p.x},${p.y},${p.w},${p.h},${p.tone}`).join(';')}`;
  if (mode === 'full' ? s === fullSig : s === sig && mode !== 'entrance') return;
  sig = s;
  if (mode === 'full') fullSig = s;
  page.root.style.display = '';
  page.root.setAttribute('width', m.W);
  page.root.setAttribute('height', m.H);
  const blocks = [...main.querySelectorAll(BLOCKS)].filter((n) => n.offsetWidth).map(box);
  const band = mode === 'full' ? null : [Math.max(0, scrollY - MARGIN), Math.min(m.H + 40, scrollY + innerHeight + MARGIN)];
  const F = buildField(m.prims, blocks, { ...liquidOptions(m.W), H: m.H + 40, band });
  cancelAnimationFrame(anim);
  top.classList.add('poured');
  clearTimeout(settle);
  if (mode !== 'full') settle = setTimeout(() => draw('full'), 180);
  if (mode === 'entrance') { swell(F); return; }
  page.paint(F);
  page.finish(F, shineSize(m.W));
  if (mode === 'full') runDrops(F, m.prims);
}
const shineSize = (W) => (W <= 760 ? { len: 76 } : undefined);

// The entrance: the liquid on the first screen swells out of each card's middle, necks reach across and join, it
// overshoots a little and settles. It's the same field traced at a rising level, so nothing but the path changes.
function swell(F) {
  const t0 = performance.now(), T = 640;
  page.shine.removeAttribute('d');
  const frame = (now) => {
    const k = Math.min(1, (now - t0) / T);
    if (k >= 1) { page.paint(F); page.finish(F, shineSize(F.W)); return; }
    const c = 1.6, e = 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; // back-out: past full and back
    page.paint(F, (e - 1) * 54);
    anim = requestAnimationFrame(frame);
  };
  page.paint(F, -54);
  anim = requestAnimationFrame(frame);
  clearTimeout(settle);
  settle = setTimeout(() => draw('full'), T + 180);
}

// A droplet running through each neck from one card's edge to the other's, in the colour of the card it left: the
// direction of the flow, and the only motion at rest. Only the ones near the screen run, on the compositor.
function runDrops(F, prims) {
  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const necks = quiet ? [] : F.necks.filter((n) => n.gap >= 14).slice(0, F.W <= 760 ? 14 : 28);
  flowIo ||= new IntersectionObserver((list) => list.forEach((e) => e.target.classList.toggle('on', e.isIntersecting)), { rootMargin: '120px 0px' });
  while (flow.children.length > necks.length) { flowIo.unobserve(flow.lastChild); flow.lastChild.remove(); }
  necks.forEach((n, i) => {
    let a = flow.children[i];
    if (!a) { a = flow.appendChild(document.createElement('span')); a.append(document.createElement('i')); flowIo.observe(a); }
    const dx = n.x1 - n.x0, dy = n.y1 - n.y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, run = Math.max(0, len - 12);
    a.className = `t-${prims.find((p) => p.id === n.i)?.tone ?? 'face'}`;
    a.style.cssText = `left:${(n.x0 + ux * 6).toFixed(1)}px;top:${(n.y0 + uy * 6).toFixed(1)}px;--dx:${(ux * run).toFixed(1)}px;--dy:${(uy * run).toFixed(1)}px;--t:${(1.6 + run / 26).toFixed(2)}s;--w:${(-(i * 0.61) % 3).toFixed(2)}s`;
  });
}

// The header's body: the bar plus a few drips hanging off it, in its own coordinates.
function drawBar() {
  const head = document.querySelector('.topbar');
  const w = head.offsetWidth, h = head.offsetHeight, s = `${w}|${h}`;
  if (s === barSig) return;
  barSig = s;
  const narrow = innerWidth <= 760, H = h + 96;
  const round = Math.min(h / 2, parseFloat(getComputedStyle(head).borderTopLeftRadius) || h / 2);
  const F = buildField([{ x: 0, y: 20, w, h, tone: 'bar', r: round, drips: narrow ? 3 : 4, dripLen: narrow ? 12 : 15, still: true }], [], { ...liquidOptions(w), W: w, cell: 4, H, wave: 1.1, swell: 0, k: 16 });
  // the svg stays inside the page's gutter, or a phone gets a sideways scroll
  const gut = Math.min(12, (innerWidth - w) / 2);
  bar.root.setAttribute('width', w + gut * 2);
  bar.root.setAttribute('height', H);
  bar.root.setAttribute('viewBox', `${-gut} 0 ${w + gut * 2} ${H}`);
  bar.root.style.left = `${-gut}px`;
  bar.paint(F);
  bar.finish(F, { inset: 8, len: narrow ? 40 : 54 });
  top.classList.add('poured-bar');
}

export function pourPage({ entrance = false } = {}) {
  if (page) draw(entrance ? 'entrance' : 'quick');
}

export function initLiquid() {
  main = document.querySelector('main');
  foot = document.querySelector('.footer');
  top = document.documentElement;
  const head = document.querySelector('.topbar');
  if (!main || !foot || !head) return;
  page = layer(main, (root) => main.after(root));
  flow = document.createElement('div');
  flow.id = 'liquid-flow';
  flow.setAttribute('aria-hidden', 'true');
  page.root.after(flow);
  bar = layer(head, (root) => head.prepend(root));
  drawBar();
  ro = new ResizeObserver(() => draw('quick'));
  ro.observe(main);
  ro.observe(foot);
  new ResizeObserver(drawBar).observe(head);
  // cards come and go with a filter or a story; a count-up only swaps text, so only element changes count
  let queued = false;
  new MutationObserver((list) => {
    if (queued || !list.some((m) => [...m.addedNodes, ...m.removedNodes].some((n) => n.nodeType === 1))) return;
    queued = true;
    queueMicrotask(() => { queued = false; draw('quick'); });
  }).observe(main, { childList: true, subtree: true });
}
