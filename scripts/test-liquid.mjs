// The liquid shape (lib/liquid.js): a card's contents always sit inside the liquid, neighbours join, headings on the grass
// stay clear, the traced paths close, and the same page draws the same shape.
import assert from 'node:assert';
import { liquidOptions, buildField, contours, pathOf, toneField, shineOf } from '../lib/liquid.js';

const at = (F, x, y) => {
  const fx = (x - F.ox) / F.c, fy = (y - F.oy) / F.c, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, g = (a, b) => F.d[b * F.nx + a];
  return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
};

for (const W of [390, 1440]) {
  const o = liquidOptions(W), x = W > 760 ? 130 : 12, w = W - x * 2;
  // a stack of rows, one in your colour, a dark board on top, a section heading between two rows, then the end zone
  const prims = [{ x, y: 40, w, h: 420, tone: 'board' }];
  let y = 500;
  for (let r = 0; r < 8; r++) { prims.push({ x, y, w, h: 180, tone: r === 3 ? 'mine' : 'face' }); y += 180 + (W > 760 ? 42 : 34); }
  const block = { x, y: y + 10, w: 300, h: 50 };
  prims.push({ x, y: y + 80, w, h: 200, tone: 'face' });
  prims.push({ x: -80, y: y + 340, w: W + 160, h: 400, tone: 'turf', pool: true, still: true });
  const t0 = performance.now();
  const F = buildField(prims, [block], { ...o, H: y + 700 });
  const paths = [pathOf(contours(F, F.d)), ...F.tones.flatMap((t) => [pathOf(contours(F, toneField(F, t, false))), pathOf(contours(F, toneField(F, t, true)))]), shineOf(F, F.d)];
  const ms = performance.now() - t0;
  console.log(`${W}px: ${prims.length} cards, ${F.necks.length} necks, ${F.nx}x${F.ny} field, ${paths.join('').length} chars, ${ms.toFixed(1)} ms`);

  // every point of a card's content box (its padding in from the edge) is well inside the liquid
  for (const p of prims.filter((q) => !q.pool)) for (let px = p.x + 14; px <= p.x + p.w - 14; px += 20) for (let py = p.y + 14; py <= p.y + p.h - 14; py += 20) assert(at(F, px, py) < -2, `outside at ${px},${py} (${at(F, px, py).toFixed(1)})`);
  // every neighbouring pair joins through a neck, and the stack reaches the end zone
  for (let r = 1; r < 9; r++) assert(F.necks.some((n) => (n.i === r - 1 && n.j === r) || (n.i === r && n.j === r - 1)), `rows ${r - 1} and ${r} don't join`);
  assert(at(F, block.x + 150, block.y + 25) > 0, 'liquid ran over the heading on the grass');
  // a band is the same shape as the whole page, just less of it
  const mid = prims[3], Fb = buildField(prims, [block], { ...o, H: y + 700, band: [mid.y - 300, mid.y + mid.h + 300] });
  for (let px = 20; px < W - 20; px += 37) for (let py = mid.y - 60; py < mid.y + mid.h + 60; py += 29) assert(Math.abs(at(F, px, py) - at(Fb, px, py)) < 0.5, `band differs at ${px},${py}`);
  // a channel between two rows stays open wherever there's no neck
  const a = prims[2], b = prims[3], gapY = (a.y + a.h + b.y) / 2;
  const free = [];
  for (let px = x + 60; px < x + w - 60; px += 10) if (!F.necks.some((n) => Math.abs((n.x0 + n.x1) / 2 - px) < 70 && n.y0 < gapY && n.y1 > gapY)) free.push(px);
  for (const px of free) assert(at(F, px, gapY) > 1, `channel closes at ${px} (${at(F, px, gapY).toFixed(1)})`);
  // paths close, and nothing is empty
  for (const p of paths.slice(0, -1)) assert(p && /Z$/.test(p), 'an open path');
  assert(paths.at(-1), 'no highlights');
  // same page, same shape: a device never sees a different blob
  const again = buildField(prims, [block], { ...o, H: y + 700 });
  assert.strictEqual(pathOf(contours(again, again.d)), paths[0], 'not deterministic');
  // a level below zero shrinks it (the entrance), down to nothing joined
  const small = contours(F, F.d, -24);
  assert(small.length >= prims.length - 1, 'the shrunken shape should be separate cards');
}
console.log('liquid ok');
