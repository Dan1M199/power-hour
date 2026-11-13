// 2.3: liquid glass (Dan's request Nov 13, after Apple's Liquid Glass). The floating chrome (the header on desktop,
// the dock, the circle beside it and the top pill on phones) bends the page behind it at its rim the way a thick
// slab of glass does, clear in the middle, and on a mouse its edge catches the light where the pointer is.
//  - lens: each piece gets its own SVG displacement map, drawn to its exact size from a rounded-rect distance field:
//    flat in the middle, then a bezel where what's behind is pulled in from further inside, steepest at the edge
//    (a convex lens profile). Sampling only ever points inward, so the edge never smears in pixels from outside the
//    box. The filter is rebuilt when the piece changes size (the header wraps, the dock grows a sixth tab). It's
//    Chromium only: Safari and Firefox can't run a backdrop through an SVG filter, so they keep the frost, the
//    caustics and the bevel, which read as glass on their own (html.liquid gates the rule in styles.css).
//  - light: on a mouse, --lx/--ly (the pointer's spot on the piece) and --lo (how close it is, 0 to 1) drive a
//    specular highlight along the rim (styles.css, "2.3"). One listener, one frame at most per move.
//  - scroll edges: a strip at the top of the window (and on phones the foot, behind the dock) softly blurs and fades
//    what scrolls under the floating bars, the way an iPhone app's content melts under its bars.
// No React here: every node touched is the static chrome in index.html or one this file adds to <body>.

const root = document.documentElement;
const NS = 'http://www.w3.org/2000/svg';
const LENSED = ['.topbar', '.tabs', '.me-btn', '.tx-top'];
const BEZEL = 18;   // px of rim that bends, at most (less on small pieces)
const DEPTH = 34;   // feDisplacementMap scale: the rim pulls from up to half this far inside

let defs = null, n = 0;

// The displacement map for a w x h box with corner radius r: red is the sideways pull, green the vertical,
// 128 is none. Inside the bezel the pull points back toward the middle, growing as (1 - t)^2 toward the edge.
function lensMap(w, h, r) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), px = img.data;
  const b = Math.max(6, Math.min(BEZEL, h * 0.36, w * 0.36));
  const hx = w / 2 - r, hy = h / 2 - r;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px0 = x + 0.5 - w / 2, py0 = y + 0.5 - h / 2;
      const qx = Math.abs(px0) - hx, qy = Math.abs(py0) - hy;
      let d, nx, ny;
      if (qx > 0 && qy > 0) {
        const L = Math.hypot(qx, qy) || 1;
        d = r - L; nx = qx / L; ny = qy / L;
      } else if (qx > qy) { d = r - qx; nx = 1; ny = 0; }
      else { d = r - qy; nx = 0; ny = 1; }
      nx *= Math.sign(px0) || 1; ny *= Math.sign(py0) || 1;
      const t = Math.min(1, Math.max(0, d / b)), m = (1 - t) * (1 - t);
      const i = (y * w + x) * 4;
      px[i] = 128 - nx * m * 127;
      px[i + 1] = 128 - ny * m * 127;
      px[i + 2] = 128; px[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

function lens(node) {
  const id = `lg-${++n}`;
  let size = '';
  const build = () => {
    const w = Math.round(node.offsetWidth), h = Math.round(node.offsetHeight);
    if (w < 8 || h < 8 || `${w}x${h}` === size) return;
    size = `${w}x${h}`;
    const r = Math.min(parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0, w / 2, h / 2);
    let f = defs.querySelector(`#${id}`);
    if (!f) { f = document.createElementNS(NS, 'filter'); f.id = id; defs.append(f); }
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    for (const [k, v] of [['x', 0], ['y', 0], ['width', w], ['height', h]]) f.setAttribute(k, v);
    f.innerHTML = `<feImage href="${lensMap(w, h, r)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`
      + `<feDisplacementMap in="SourceGraphic" in2="map" scale="${DEPTH}" xChannelSelector="R" yChannelSelector="G"/>`;
    node.style.setProperty('--lg-lens', `url(#${id})`);
  };
  new ResizeObserver(() => requestAnimationFrame(build)).observe(node);
  build();
}

// the rim's light follows a mouse: where the pointer is on each piece, and how near
function light(nodes) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let x = 0, y = 0, queued = false;
  const paint = () => {
    queued = false;
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      if (!r.width) continue;
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
      const o = Math.max(0, 1 - Math.hypot(dx, dy) / 140);
      node.style.setProperty('--lx', `${(x - r.left).toFixed(0)}px`);
      node.style.setProperty('--ly', `${(y - r.top).toFixed(0)}px`);
      node.style.setProperty('--lo', o.toFixed(2));
    }
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!queued) { queued = true; requestAnimationFrame(paint); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => nodes.forEach((node) => node.style.setProperty('--lo', '0')));
}

function edges() {
  for (const side of ['top', 'foot']) {
    const strip = document.createElement('div');
    strip.className = `tx-edge ${side}`;
    strip.setAttribute('aria-hidden', 'true');
    document.body.append(strip);
  }
  // the edges only show once something has scrolled under the bars, as on an iPhone
  let on = false;
  const check = () => { const now = scrollY > 4; if (now !== on) { on = now; root.classList.toggle('scrolled', on); } };
  addEventListener('scroll', check, { passive: true });
  check();
}

export function initLiquid() {
  edges();
  const nodes = () => LENSED.flatMap((s) => [...document.querySelectorAll(s)]);
  const ua = navigator.userAgent;
  if (window.chrome && !/iPhone|iPad|iPod/.test(ua)) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs = document.createElementNS(NS, 'defs');
    svg.append(defs);
    document.body.append(svg);
    // the top pill is added by src/touch.js, so wait a frame for it
    requestAnimationFrame(() => { nodes().forEach(lens); root.classList.add('liquid'); });
  }
  requestAnimationFrame(() => light(nodes()));
}
