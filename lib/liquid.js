// Cartoon liquid: the page's cards as one poured shape, pure (no DOM, tested by scripts/test-liquid.mjs).
// Every card is a rounded box in a distance field. Necks (thin capsules between neighbours), drips and slow swells are
// blended in with a smooth minimum, so they join with real fillets, and a touch of noise keeps the edges from ever being
// straight. Marching squares then traces that field into SVG paths: the silhouette, a fill per tone (a neck between two
// tones changes colour at its midpoint), the face above the crescent of deeper liquid along the bottom edges, and the
// hard highlights on the upper left. The whole page takes a few milliseconds, so opening a row can redraw every frame.

const FAR = 64;
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// size settings: a phone has 12px gutters, a desktop room to swell
export const liquidOptions = (W) => {
  const narrow = W <= 760;
  return { W, cell: narrow ? 6 : 8, shift: 1, grow: narrow ? 4 : 5, wave: narrow ? 2 : 2.6, roll: narrow ? 4 : 5, k: narrow ? 26 : 26, neck: narrow ? [9, 16] : [9, 15],
    maxGap: narrow ? 120 : 170, radius: narrow ? [24, 38] : [24, 46], swell: narrow ? 0 : 9, drips: narrow ? 1 : 2, narrow };
};

const hits = (x0, y0, x1, y1, list) => list.some((o) => x1 > o.x - 6 && x0 < o.x + o.w + 6 && y1 > o.y - 6 && y0 < o.y + o.h + 6);

// Which cards join, and where. A spanning tree over the shortest gaps connects everything that can connect, with a few
// extra joins so it isn't a plain chain; a neck is placed on the card edges they share and never crosses `blocks` (the
// section headings and filters sitting on the grass between cards).
export function planFlow(prims, blocks, o) {
  const edges = [];
  prims.forEach((a, i) => prims.slice(i + 1).forEach((b, n) => {
    const j = i + 1 + n;
    const dy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h), dx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
    if (dy >= -4 && dx < -48 && dy <= o.maxGap) edges.push({ i, j, gap: Math.max(dy, 0), axis: 'y', from: Math.max(a.x, b.x), to: Math.min(a.x + a.w, b.x + b.w) });
    else if (dx >= -4 && dy < -48 && dx <= o.maxGap) edges.push({ i, j, gap: Math.max(dx, 0), axis: 'x', from: Math.max(a.y, b.y), to: Math.min(a.y + a.h, b.y + b.h) });
  }));
  edges.sort((a, b) => a.gap - b.gap || a.i - b.i || a.j - b.j);
  const root = prims.map((_, i) => i), find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  const necks = [];
  for (const e of edges) {
    const seed = hash(prims[e.i].id * 31 + prims[e.j].id * 7), tree = find(e.i) !== find(e.j);
    if (!tree && seed > 0.12) continue;
    const a = prims[e.i], b = prims[e.j], neck = placeNeck(a, b, e, seed, blocks, o);
    if (!neck) continue;
    root[find(e.i)] = find(e.j);
    necks.push(neck);
    // a long shared edge carries a second, thinner join
    if (e.to - e.from > 1000 && !o.narrow && seed < 0.14) { const more = placeNeck(a, b, e, (seed + 0.5) % 1, blocks, { ...o, neck: [o.neck[0] - 2, o.neck[1] - 3] }); if (more) necks.push(more); }
  }
  return necks;
}

function placeNeck(a, b, e, seed, blocks, o) {
  const pad = Math.min(170, (e.to - e.from) * 0.26), span = e.to - e.from - pad * 2;
  const r = o.neck[0] + (o.neck[1] - o.neck[0]) * hash(seed * 91);
  const sway = Math.min(span * 0.2, 10 + e.gap * 0.5) * (hash(seed * 53) - 0.5) * 2;
  // a few tries along the shared edge, starting from this neck's own spot
  for (let t = 0; t < 6; t++) {
    const at = e.from + pad + span * ((seed * 0.83 + 0.09 + t * 0.381) % 1);
    const end = Math.max(e.from + pad, Math.min(e.to - pad, at + sway));
    let p;
    if (e.axis === 'y') {
      const [top, low] = a.y < b.y ? [a, b] : [b, a];
      p = { x0: at, y0: top.y + top.h - 6, x1: end, y1: low.y + 6 };
    } else {
      const [lt, rt] = a.x < b.x ? [a, b] : [b, a];
      p = { x0: lt.x + lt.w - 6, y0: at, x1: rt.x + 6, y1: end };
    }
    const box = [Math.min(p.x0, p.x1) - r, Math.min(p.y0, p.y1) + 6, Math.max(p.x0, p.x1) + r, Math.max(p.y0, p.y1) - 6];
    if (!hits(...box, blocks)) return { ...p, r, gap: e.gap, i: a.id, j: b.id };
  }
  return null;
}

// Swells and drips: the things that make a card a formation instead of a box. Each stays in free space.
function formations(prims, necks, blocks, o) {
  const soft = [], drops = [];
  prims.forEach((p) => {
    const i = p.id;
    if (p.pool) {
      // the end zone's surface rolls in long slow waves
      for (let x = -40, n = 0; x < o.W + 40; n++) { const R = 120 + 150 * hash(n + 3); soft.push({ x0: x, y0: p.y + R - 3 - 7 * hash(n + 9), x1: x, y1: p.y + R - 3 - 7 * hash(n + 9), r: R, k: 60 }); x += R * 0.9; }
      return;
    }
    if (p.w < 180 || p.h < 44) return;
    const others = prims.filter((q) => q !== p);
    // a slow swell on a free side
    if (o.swell && !p.still) for (let n = 0; n < 2; n++) {
      const R = Math.min(p.h * 0.42, 50 + 60 * hash(i + n + 20)), out = (0.45 + 0.55 * hash(i * 3 + n)) * o.swell;
      if (R < 40) continue;
      const side = hash(i * 7 + n * 11) > 0.45 || p.noLeft ? 'r' : 'l'; // a rank row's left side is the painted number
      const y = p.y + R + (p.h - R * 2) * hash(i * 13 + n * 5 + 2), clear = o.k + 16; // room for the fillets, or the channel pinches to a sliver

      const cx = side === 'r' ? p.x + p.w + o.grow + out - R : p.x - o.grow - out + R, reach = side === 'r' ? cx + R : cx - R;
      if (reach < 6 || reach > o.W - 6) continue;
      if (hits(Math.min(reach, cx) - clear, y - R * 0.6, Math.max(reach, cx) + clear, y + R * 0.6, others.filter((q) => (side === 'r' ? q.x > p.x + p.w - 1 : q.x + q.w < p.x + 1)))) continue;
      soft.push({ x0: cx, y0: y, x1: cx, y1: y, r: R, k: 30 }); // a tight blend, or it fills the channel to the next card
    }
    // drips off a bottom edge with open space under it
    for (let n = 0; n < (p.drips ?? o.drips); n++) {
      const s = p.drips ? (n + 0.15 + 0.7 * hash(n * 3 + 7)) / p.drips : hash(i * 17 + n * 3 + 7);
      const x = p.x + p.w * (p.drips ? 0.08 + 0.84 * s : 0.14 + 0.72 * s), len = (p.dripLen ?? 34) * (0.3 + 0.7 * hash(i * 5 + n * 19)), r = 3.6 + 2.2 * hash(i + n * 7 + 40);
      const top = p.y + p.h, room = top + o.grow + len + r * 2 + 54;
      if (necks.some((c) => Math.abs(c.x0 - x) < 60 && Math.abs(c.y0 - top) < 16)) continue;
      if (hits(x - r - 4, top + o.grow + 6, x + r + 4, room, blocks) || others.some((q) => x + r + 6 > q.x && x - r - 6 < q.x + q.w && room > q.y - 4 && top < q.y + q.h)) continue;
      soft.push({ x0: x, y0: top - 4, x1: x, y1: top + o.grow + len, r, k: o.k * 0.8, bulb: true });
      soft.push({ x0: x, y0: top + o.grow + len, x1: x, y1: top + o.grow + len, r: r + 3.4, k: 12 });
      if (!p.drips && hash(i * 23 + n) > 0.62) drops.push({ x: x + (hash(i + n) - 0.5) * 3, y: top + o.grow + len + r + 12 + 7 * hash(n + i * 2), r: 5 + 2.5 * hash(i * 29 + n) });
    }
  });
  return { soft, drops };
}

// The field: `prims` are boxes in page pixels, each {x, y, w, h, tone, pool?}; `blocks` are rectangles a neck must not cross.
export function buildField(prims, blocks, o) {
  // With o.band ([top, bottom] in page pixels) only that stretch is rasterized: everything is planned from the whole page,
// so a band is the same shape, just cheaper, which is what lets the liquid follow a row as it opens.
  prims.forEach((p, i) => { p.id ??= i; });
  const c = o.cell, ox = -24, oy = o.band ? Math.floor(o.band[0] / c) * c : 0, H = o.band ? o.band[1] : Math.max(o.H ?? 0, ...prims.map((p) => p.y + p.h + 100));
  const nx = Math.ceil((o.W + 48) / c) + 1, ny = Math.ceil((H - oy) / c) + 1, n = nx * ny;
  const d = new Float32Array(n).fill(FAR);
  const tones = [...new Set(prims.map((p) => p.tone))];
  const necks = planFlow(prims.filter((p) => !p.loose), blocks, o).concat(poolStreams(prims, blocks, o));
  const reach = Math.max(40, ...necks.map((s) => s.gap / 2 + 16));
  const near = tones.length > 1 ? new Map(tones.map((t) => [t, new Float32Array(n).fill(9999)])) : null;
  const win = (x0, y0, x1, y1) => [Math.max(0, Math.floor((x0 - ox) / c)), Math.max(0, Math.floor((y0 - oy) / c)), Math.min(nx - 1, Math.ceil((x1 - ox) / c)), Math.min(ny - 1, Math.ceil((y1 - oy) / c))];
  const blend = o.k + 12;

  prims.forEach((p) => {
    const idx = p.id, g = o.grow, hx = p.w / 2 + g, hy = p.h / 2 + g, cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const max = Math.min(hx, hy) * 0.8, r = (s) => Math.min(max, o.radius[0] + (o.radius[1] - o.radius[0]) * hash(idx * 3 + s));
    const rr = p.pool ? [0, 0, 0, 0] : p.r ? [p.r + g, p.r + g, p.r + g, p.r + g] : [r(1), r(2), r(3), r(4)]; // top left, top right, bottom left, bottom right
    const tn = near?.get(p.tone), R = tn ? reach : blend;
    const [i0, j0, i1, j1] = win(p.x - g - R, p.y - g - R, p.x + p.w + g + R, p.y + p.h + g + R);
    for (let j = j0; j <= j1; j++) {
      const y = oy + j * c, py = y - cy, ay = Math.abs(py);
      for (let i = i0; i <= i1; i++) {
        const x = ox + i * c, px = x - cx, q = rr[(px > 0 ? 1 : 0) + (py > 0 ? 2 : 0)];
        const qx = Math.abs(px) - hx + q, qy = ay - hy + q;
        const dist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - q;
        const k = j * nx + i;
        d[k] = smin(d[k], dist, 16); // not a plain min: two cards meeting never leave a sharp crease
        if (tn && dist < tn[k]) tn[k] = dist;
      }
    }
  });

  const { soft, drops } = formations(prims, necks, blocks, o);
  const blendIn = (s) => {
    const k = s.k ?? o.k, r = s.r, ex = s.x1 - s.x0, ey = s.y1 - s.y0, len2 = ex * ex + ey * ey || 1, pad = r + k + 4;
    const [i0, j0, i1, j1] = win(Math.min(s.x0, s.x1) - pad, Math.min(s.y0, s.y1) - pad, Math.max(s.x0, s.x1) + pad, Math.max(s.y0, s.y1) + pad);
    for (let j = j0; j <= j1; j++) {
      const y = oy + j * c;
      for (let i = i0; i <= i1; i++) {
        const x = ox + i * c, t = Math.max(0, Math.min(1, ((x - s.x0) * ex + (y - s.y0) * ey) / len2));
        const v = Math.hypot(x - s.x0 - ex * t, y - s.y0 - ey * t) - r, m = j * nx + i;
        d[m] = smin(d[m], v, k);
      }
    }
  };
  necks.forEach(blendIn);
  soft.forEach(blendIn);
  for (const s of drops) {
    const pad = s.r + 4, [i0, j0, i1, j1] = win(s.x - pad, s.y - pad, s.x + pad, s.y + pad);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const m = j * nx + i, v = Math.hypot(ox + i * c - s.x, oy + j * c - s.y) - s.r; if (v < d[m]) d[m] = v; }
  }

  // one soft pass near the surface: liquid has no sharp points, so wherever two blends meet in a crease, this rounds it
  const nearby = [];
  for (let m = nx; m < n - nx; m++) if (Math.abs(d[m]) < 16 && m % nx && m % nx !== nx - 1) nearby.push(m);
  const soft2 = new Float32Array(nearby.length);
  nearby.forEach((m, q) => { soft2[q] = (4 * d[m] + 2 * (d[m - 1] + d[m + 1] + d[m - nx] + d[m + nx]) + d[m - nx - 1] + d[m - nx + 1] + d[m + nx - 1] + d[m + nx + 1]) / 16; });
  nearby.forEach((m, q) => { d[m] = soft2[q]; });

  // the wobble, then a positive rim so every contour closes on itself just off the page
  const A = o.wave, B = o.roll ?? 0;
  for (let j = 0; j < ny; j++) {
    const y = oy + j * c;
    for (let i = 0; i < nx; i++) {
      const m = j * nx + i;
      if (d[m] < 30) { const x = ox + i * c; d[m] += A * (Math.sin(x / 83 + 1.3) * Math.cos(y / 61 + 0.7) + 0.6 * Math.sin(x / 37 + y / 53 + 2.1)) / 1.6 - B * (0.5 + 0.5 * Math.sin(x / 97 + y / 173 + 1.1) * Math.cos(y / 139 - x / 211)); } // the second term is a long slow roll that only ever pushes outward
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) d[m] = Math.max(d[m], 1);
    }
  }
  const F = { d, near, tones, nx, ny, n, c, ox, oy, H, W: o.W, shift: o.shift, necks, drops };
  fillSlivers(F);
  return F;
}

// the last card drains into the end zone
function poolStreams(prims, blocks, o) {
  const pool = prims.find((p) => p.pool);
  if (!pool) return [];
  const above = prims.filter((p) => !p.pool && !p.loose);
  if (!above.length) return [];
  const low = Math.max(...above.map((p) => p.y + p.h));
  const last = above.filter((p) => low - (p.y + p.h) < 40 && pool.y - (p.y + p.h) < 240);
  return last.slice(0, 2).map((p, n) => {
    const x = p.x + p.w * (0.3 + 0.4 * hash(n + 5)), r = o.neck[0];
    return { x0: x, y0: p.y + p.h - 6, x1: x + (n ? 14 : -18), y1: pool.y + 6, r, gap: pool.y - p.y - p.h };
  });
}

// One tone's fill: inside the silhouette and closer to this tone's cards than to anyone else's. `face` also stops short
// of the crescent along each bottom edge: a point is face only if the point just below it is still inside.
export function toneField(F, tone, face, out = new Float32Array(F.n)) {
  const { d, near, nx, n } = F, own = near?.get(tone), others = near ? [...near].filter(([t]) => t !== tone).map(([, a]) => a) : [];
  const down = (face ? F.shift : 0) * nx;
  for (let m = 0; m < n; m++) {
    let v = d[m];
    if (v > 12) { out[m] = v; continue; }
    if (own) {
      let o = 9999;
      for (const a of others) if (a[m] < o) o = a[m];
      const split = own[m] - o - 1.2; // a hair of overlap, so no seam shows between two tones
      if (split > v) v = split;
    }
    if (down) { const below = m + down < n ? d[m + down] : 1; if (below > v) v = below; }
    out[m] = v;
  }
  return out;
}

// Marching squares: every closed contour of `a` at `level`, as loops of points with the inside on the right hand.
let linkBuf = null;
export function contours(F, a, level = 0) {
  const { nx, ny, c, ox, oy } = F, size = 2 * nx * ny;
  if (!linkBuf || linkBuf.length < size) linkBuf = new Int32Array(size);
  const next = linkBuf, used = [];
  const link = (from, to) => { next[from] = to + 1; used.push(from); };
  for (let j = 0; j < ny - 1; j++) {
    const row = j * nx;
    for (let i = 0; i < nx - 1; i++) {
      const m = row + i, tl = a[m] < level, tr = a[m + 1] < level, br = a[m + nx + 1] < level, bl = a[m + nx] < level;
      const cs = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (cs === 0 || cs === 15) continue;
      const T = 2 * m, B = 2 * (m + nx), L = 2 * m + 1, R = 2 * (m + 1) + 1;
      switch (cs) {
        case 1: link(L, B); break; case 2: link(B, R); break; case 3: link(L, R); break; case 4: link(R, T); break;
        case 6: link(B, T); break; case 7: link(L, T); break; case 8: link(T, L); break; case 9: link(T, B); break;
        case 11: link(T, R); break; case 12: link(R, L); break; case 13: link(R, B); break; case 14: link(B, L); break;
        case 5: if ((a[m] + a[m + 1] + a[m + nx] + a[m + nx + 1]) / 4 < level) { link(L, T); link(R, B); } else { link(L, B); link(R, T); } break;
        case 10: if ((a[m] + a[m + 1] + a[m + nx] + a[m + nx + 1]) / 4 < level) { link(T, R); link(B, L); } else { link(T, L); link(B, R); } break;
      }
    }
  }
  const point = (e) => {
    const m = e >> 1, i = m % nx, j = (m - i) / nx, x = ox + i * c, y = oy + j * c, v = a[m];
    const w = a[e & 1 ? m + nx : m + 1], t = (level - v) / (w - v || 1);
    return e & 1 ? [x, y + t * c] : [x + t * c, y];
  };
  const loops = [];
  for (const start of used) {
    if (!next[start]) continue;
    const loop = [];
    let e = start;
    while (next[e]) { loop.push(point(e)); const to = next[e] - 1; next[e] = 0; e = to; }
    if (loop.length > 5) loops.push(loop);
  }
  for (const e of used) next[e] = 0;
  return loops;
}

// A hole in the liquid (it runs the other way round) too small or too thin to read as grass: liquid would have closed it.
// Filled in the field, so the outline, the fills and the crescents all agree.
function fillSlivers(F) {
  for (const loop of contours(F, F.d)) {
    let area = 0, around = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    loop.forEach((p, k) => {
      const q = loop[(k + 1) % loop.length];
      area += p[0] * q[1] - q[0] * p[1]; around += Math.hypot(q[0] - p[0], q[1] - p[1]);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    });
    if (area >= 0 || (-area / 2 >= 1500 && -area / around >= 14)) continue;
    for (let j = Math.floor((y0 - F.oy) / F.c); j <= Math.ceil((y1 - F.oy) / F.c); j++) for (let i = Math.floor((x0 - F.ox) / F.c); i <= Math.ceil((x1 - F.ox) / F.c); i++) {
      const m = j * F.nx + i, x = F.ox + i * F.c, y = F.oy + j * F.c;
      if (F.d[m] < 0) continue;
      let inside = false;
      for (let k = 0, l = loop.length - 1; k < loop.length; l = k++) if ((loop[k][1] > y) !== (loop[l][1] > y) && x < loop[l][0] + ((y - loop[l][1]) / (loop[k][1] - loop[l][1])) * (loop[k][0] - loop[l][0])) inside = !inside;
      if (inside) F.d[m] = -1;
    }
  }
}

// A loop as a smooth SVG path: the straight stretches thinned out, then quadratics through the midpoints.
function thin(loop) {
  const out = [loop[0]];
  let a = loop[0];
  for (let k = 1; k < loop.length - 1; k++) {
    const p = loop[k], q = loop[k + 1], l = Math.hypot(p[0] - a[0], p[1] - a[1]);
    if (l > 32) { out.push(p); a = p; continue; }
    if (l < 3) continue;
    const m = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    if (((p[0] - a[0]) * (q[0] - p[0]) + (p[1] - a[1]) * (q[1] - p[1])) / (l * m) < 0.992) { out.push(p); a = p; }
  }
  return out.length > 4 ? out : loop;
}
const n1 = (v) => Math.round(v * 10) / 10;
export function pathOf(loops) {
  let s = '';
  for (const raw of loops) {
    const l = thin(raw), N = l.length;
    const mid = (a, b) => `${n1((a[0] + b[0]) / 2)} ${n1((a[1] + b[1]) / 2)}`;
    s += `M${mid(l[N - 1], l[0])}`;
    for (let k = 0; k < N; k++) s += `Q${n1(l[k][0])} ${n1(l[k][1])} ${mid(l[k], l[(k + 1) % N])}`;
    s += 'Z';
  }
  return s;
}

// The cartoon highlights: an inner contour, kept only where the liquid faces up and to the left, cut to a short stroke.
export function shineOf(F, a, { inset = 10, len = 120 } = {}) {
  const runs = [];
  for (const loop of contours(F, a, -inset)) {
    const N = loop.length, on = (k) => {
      const p = loop[(k + 2) % N], q = loop[(k + N - 2) % N], tx = p[0] - q[0], ty = p[1] - q[1], l = Math.hypot(tx, ty) || 1;
      return (ty / l) * -0.55 + (-tx / l) * -0.83 > 0.76;
    };
    let k0 = 0;
    while (k0 < N && on(k0)) k0++;
    if (k0 === N) continue;
    for (let s = 0; s < N; s++) {
      const k = (k0 + s) % N;
      if (!on(k) || on((k + N - 1) % N)) continue;
      const run = [loop[k]];
      let walked = 0;
      for (let t = 1; t < N && walked < len && on((k + t) % N); t++) { const a1 = loop[(k + t) % N], b1 = run[run.length - 1]; walked += Math.hypot(a1[0] - b1[0], a1[1] - b1[1]); run.push(a1); }
      if (walked > 26) runs.push(run);
    }
  }
  return runs.map((r) => `M${r.map((p) => `${n1(p[0])} ${n1(p[1])}`).join('L')}`).join('');
}
