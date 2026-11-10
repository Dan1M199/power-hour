// Sharing the team dashboard as a picture or a PDF. The sheet is copied into an off-screen stage at the desktop
// width (three columns, whatever the phone's width) and drawn to a canvas by html-to-image (loaded only when someone
// shares). The picture is the dashboard alone, edge to edge on its own lilac (Dan, Nov 10: no logo band, no grass). The PDF is written here by hand: one page, the picture as a JPEG.
// navigator.share with files opens the iPhone's share sheet (Messages, Save Image, Save to Files); where files can't
// be shared, the file downloads instead.

const STAGE_W = 968; // the sheet at three columns: 928 inside its own 20px gutters
// a wait that gives up: fonts and pictures that never report back can't hold the picture up for good
const within = (p, ms) => Promise.race([p, new Promise((ok) => setTimeout(ok, ms))]);
const lapse = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('The picture took too long')), ms))]);

/** Draws the dashboard (the .paper element) to a canvas. */
export async function captureSheet(paper) {
  const { toCanvas } = await import('html-to-image');
  const stage = document.createElement('div');
  stage.className = 'share-stage';
  stage.style.width = `${STAGE_W}px`;
  const sheet = paper.cloneNode(true);
  // the controls stay behind; every tile is drawn at the end of its intro
  sheet.querySelectorAll('.pp-pick, .pp-share, .pv-expand, .focus-index, .swipe-hint').forEach((n) => n.remove());
  sheet.querySelectorAll('.pp-tile').forEach((t) => { t.style.opacity = '1'; t.style.transform = 'none'; });
  // a range input's track and thumb are the browser's own drawing, which html-to-image can't see: a still copy instead
  sheet.querySelectorAll('input[type=range]').forEach((r) => {
    const still = document.createElement('span');
    still.className = 'share-range';
    still.style.setProperty('--v', String((Number(r.value) - Number(r.min)) / (Number(r.max) - Number(r.min) || 1)));
    r.replaceWith(still);
  });
  stage.append(sheet);
  document.body.append(stage);
  // html-to-image drops CSS-only paint on SVG shapes (the odds arc lost its strokes and the sun came out black), so
  // each shape's computed paint is written onto the copy as plain attributes
  for (const el of stage.querySelectorAll('svg *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') { el.remove(); continue; } // hidden by CSS, which wouldn't come along (the odds glow)
    for (const k of ['fill', 'stroke', 'stroke-width', 'stroke-opacity', 'fill-opacity', 'opacity', 'stroke-linecap', 'stop-color', 'stop-opacity']) {
      const v = cs.getPropertyValue(k);
      if (v) el.setAttribute(k, v);
    }
  }
  // Safari draws box-shadow wrongly inside the picture (offset black wedges by every tile, the dots turned into
  // arrows), and every inked edge here is a box-shadow ring. On the copy each ring becomes an outline of the same
  // width and colour, which takes no room, so nothing moves; the hard ledges under them are dropped (flat).
  for (const el of stage.querySelectorAll('*')) {
    const shadow = getComputedStyle(el).boxShadow;
    if (!shadow || shadow === 'none') continue;
    const ring = ringOf(shadow);
    el.style.boxShadow = 'none';
    if (ring) {
      el.style.outline = `${ring.width}px solid ${ring.color}`;
      el.style.outlineOffset = `${ring.offset}px`;
    }
  }
  try {
    await within(Promise.all([document.fonts?.ready, ...[...stage.querySelectorAll('img')].map((img) => img.decode?.().catch(() => {}))]), 2000);
    // the copy that gets drawn sits in place, not off-screen where the stage waits
    const opts = { pixelRatio: 2, cacheBust: false, backgroundColor: getComputedStyle(sheet).backgroundColor, style: { position: 'static', left: '0', top: '0' } };
    // Safari leaves pictures out of the first drawing (they're still being inlined), so it draws twice
    if (/AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent)) await lapse(toCanvas(stage, opts), 20000);
    return await lapse(toCanvas(stage, opts), 20000);
  } finally {
    stage.remove();
  }
}

// The ring in a computed box-shadow: its zero-offset, unblurred shadows with a spread, outermost first; the outline
// is the outermost one less any ring inside it (a gap ring like the schedule slate's), or sits inside for an inset one.
export function ringOf(shadow) {
  const parts = shadow.split(/,(?![^(]*\))/).map((p) => {
    const color = (p.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/i) || [])[0];
    const n = (p.replace(/rgba?\([^)]*\)/gi, '').match(/-?[\d.]+px/g) || []).map(parseFloat);
    return { color, inset: /\binset\b/.test(p), x: n[0] || 0, y: n[1] || 0, blur: n[2] || 0, spread: n[3] || 0 };
  }).filter((r) => r.color && !r.x && !r.y && !r.blur && r.spread > 0);
  if (!parts.length) return null;
  const inset = parts.filter((r) => r.inset), out = parts.filter((r) => !r.inset).sort((a, b) => a.spread - b.spread);
  if (out.length) {
    const outer = out[out.length - 1], inner = out.length > 1 ? out[out.length - 2].spread : 0;
    return { width: outer.spread - inner, color: outer.color, offset: inner };
  }
  const r = inset.sort((a, b) => b.spread - a.spread)[0];
  return { width: r.spread, color: r.color, offset: -r.spread };
}

const toBlob = (canvas, type, q) => new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('The picture could not be made'))), type, q));
export const pngOf = (canvas) => toBlob(canvas, 'image/png');

/** A one-page PDF holding the canvas as a JPEG, the page the picture's size at 72 dpi over 2 (it's drawn at 2x). */
export async function pdfOf(canvas) {
  const jpg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
  const w = canvas.width, h = canvas.height, pw = (w / 2) * 0.75, ph = (h / 2) * 0.75;
  const draw = `q ${pw.toFixed(2)} 0 0 ${ph.toFixed(2)} 0 0 cm /Im0 Do Q`;
  const enc = new TextEncoder(), parts = [], offsets = [];
  let length = 0;
  const put = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); length += b.length; };
  const obj = (n, body) => { offsets[n] = length; put(`${n} 0 obj\n`); body(); put('\nendobj\n'); };
  put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => put('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => put('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { put(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); put(jpg); put('\nendstream'); });
  obj(5, () => put(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
  const xref = length;
  put(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}`);
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

/** Whether this browser can hand files to the system share sheet. */
export const canShareFiles = () => {
  try { return !!navigator.canShare?.({ files: [new File(['x'], 'x.png', { type: 'image/png' })] }); } catch { return false; }
};

/**
 * Opens the share sheet with the file, or downloads it where files can't be shared. Resolves 'shared', 'saved' or
 * 'cancelled' (the person closed the sheet); anything else throws.
 */
export async function shareFile(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; throw e; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'saved';
}
