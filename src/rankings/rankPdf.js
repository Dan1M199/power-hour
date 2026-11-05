// The power rankings as a one-page PDF for the group chat (Dan only: the button shows while the league desk says he's
// signed in). Drawn straight onto a canvas in the site's type and colours (no DOM capture, so none of Safari's
// html-to-image quirks), then wrapped by pdfOf from the dashboard's share module. Three blocks: the header band, the
// movers (biggest climbs and drops since last week, with the game that did it), and every team with its record, move,
// tier and a one-line reason it sits where it does, built from the four parts of the power score.
import { pdfOf } from '../dashboard/share.js';
export { shareFile } from '../dashboard/share.js';

const W = 816, PAD = 44, SCALE = 2;
const C = {
  board: '#13301C', chalk: '#FFFFFF', amber: '#FFC107', yellow: '#FFEB3B', ink: '#12301A', ink2: '#3C5A43', ink3: '#55705A',
  good: '#28702C', bad: '#C62828', tile: '#E8F0DF', line: '#D5E2CC', paper: '#FFFFFF',
};
const DISPLAY = "'Big Shoulders Display', 'Arial Narrow', sans-serif", BODY = "'Albert Sans', Arial, sans-serif";

// ---------- the words ----------
// each part of the score ranked across the league (1 = best), so a team's line leans on what lifts it and what drags it
function partRanks(D) {
  const keys = ['standing', 'scoring', 'schedule', 'roster'].filter((k) => D.teams.every((t) => t.parts?.[k] != null));
  return Object.fromEntries(D.teams.map((t) => [t.rid, Object.fromEntries(keys.map((k) => [k, 1 + D.teams.filter((o) => o.parts[k] > t.parts[k]).length]))]));
}

function partSaid(t, k, r, h, n) {
  const { f1, ordinal, record } = h;
  if (k === 'standing') return `${record(t)} and ${ordinal(t.seed)} in the standings`;
  if (k === 'scoring') return r <= n / 2 ? `${f1(t.pfPerGame)} points a game, ${ordinal(r)} in the league` : `only ${f1(t.pfPerGame)} points a game (${ordinal(r)})`;
  if (k === 'schedule') return r <= n / 2 ? `the ${r === 1 ? '' : `${ordinal(r)}-`}easiest schedule left` : `the ${r === n ? '' : `${ordinal(n + 1 - r)}-`}toughest schedule left`;
  return r <= n / 2 ? `the ${r === 1 ? '' : `${ordinal(r)}-`}best roster from here` : `a roster that projects ${ordinal(r)} from here`;
}

/** One sentence on why a team sits where it does: its best part of the score, then the part that holds it back. */
export function synopsis(D, t, h, ranks = partRanks(D)) {
  const n = D.teams.length, pr = ranks[t.rid] || {};
  const order = Object.keys(pr).sort((a, b) => pr[a] - pr[b]);
  if (!order.length) return '';
  const best = order[0], worst = order[order.length - 1];
  const up = partSaid(t, best, pr[best], h, n), down = partSaid(t, worst, pr[worst], h, n);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  if (t.powerRank === 1) return `${cap(up)}; nobody has a better all-round case.`;
  if (t.powerRank === n) return `${cap(down)}, and not much else to lean on.`;
  if (pr[worst] <= Math.ceil(n / 3)) return `${cap(up)}, with no real weak spot.`;
  if (pr[best] > n - Math.ceil(n / 3)) return `${cap(down)}; nothing in the score is pulling them up.`;
  return t.powerRank <= n / 2 ? `${cap(up)}, but held back by ${down}.` : `${cap(down)} drags them down, even with ${up}.`;
}

// the game behind a move: last week's result, in words
function gameSaid(D, t, h) {
  const g = t.weeks?.find((x) => x.week === D.meta.lastScored);
  const opp = g && D.byRid[g.opp];
  if (!g || !opp || !g.result) return '';
  const verb = g.result === 'W' ? 'beat' : g.result === 'L' ? 'lost to' : 'tied';
  return `${verb} ${opp.name} ${h.f1(g.pts)} to ${h.f1(g.oppPts)}`;
}

// ---------- the drawing ----------
function wrap(ctx, text, width) {
  const words = text.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const rr = (ctx, x, y, w, hh, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, hh, r); };
function img(src) {
  return new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; setTimeout(() => ok(null), 3000); });
}

function moveText(t) { return t.movement > 0 ? `▲${t.movement}` : t.movement < 0 ? `▼${-t.movement}` : '–'; }

/** Draws the report. Returns the canvas; `layout` only measures. */
function draw(D, h, logo, { title, line }) {
  const ranks = partRanks(D);
  const rows = D.teams.map((t) => ({ t, why: synopsis(D, t, h, ranks) }));
  const movers = [...D.teams].filter((t) => t.movement).sort((a, b) => b.movement - a.movement);
  const up = movers.filter((t) => t.movement > 0).slice(0, 3), down = movers.filter((t) => t.movement < 0).reverse().slice(0, 3);

  // measure first on a scratch context, then draw at the measured height
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `400 14px ${BODY}`;
  const textW = W - PAD * 2 - 76 - 24 - 104; // clear of the playoff odds on the right
  rows.forEach((r) => { r.lines = wrap(measure, r.why, textW); });
  const colW = (W - PAD * 2 - 20) / 2;
  const moverLines = (t) => wrap(measure, `${t.name}, now ${h.ordinal(t.powerRank)}${gameSaid(D, t, h) ? `: ${gameSaid(D, t, h)}` : ''}.`, colW - 64);
  const upL = up.map(moverLines), downL = down.map(moverLines);
  const colH = (ls) => ls.reduce((a, l) => a + 14 + l.length * 19, 0);
  const moversH = movers.length ? 56 + Math.max(colH(upL), colH(downL), 30) + 16 : 0;
  const rowH = (r) => 54 + r.lines.length * 19;
  const HEAD = 132, listTop = HEAD + 28 + moversH + 44;
  const H = listTop + rows.reduce((a, r) => a + rowH(r) + 10, 0) + 70;

  const cv = document.createElement('canvas');
  cv.width = W * SCALE; cv.height = H * SCALE;
  const ctx = cv.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F4F8F0'; ctx.fillRect(0, 0, W, H);

  // header band: the scoreboard
  ctx.fillStyle = C.board; ctx.fillRect(0, 0, W, HEAD);
  ctx.fillStyle = C.amber; ctx.fillRect(0, HEAD - 6, W, 6);
  let x = PAD;
  if (logo) { const lh = 72, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, PAD, (HEAD - 6 - lh) / 2, lw, lh); x += lw + 18; }
  ctx.fillStyle = C.chalk; ctx.font = `800 44px ${DISPLAY}`; ctx.fillText(title, x, 66);
  ctx.fillStyle = C.yellow; ctx.font = `600 16px ${BODY}`; ctx.fillText(line, x, 94);

  let y = HEAD + 28;
  // the movers
  if (movers.length) {
    ctx.fillStyle = C.ink; ctx.font = `800 26px ${DISPLAY}`; ctx.fillText('The movers', PAD, y + 22);
    y += 44;
    const col = (list, ls, x0, good) => {
      rr(ctx, x0, y, colW, Math.max(colH(upL), colH(downL), 30) + 16, 16); ctx.fillStyle = C.paper; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
      let yy = y + 14;
      if (!list.length) { ctx.fillStyle = C.ink3; ctx.font = `400 14px ${BODY}`; ctx.fillText(good ? 'Nobody climbed.' : 'Nobody dropped.', x0 + 16, yy + 16); return; }
      list.forEach((t, i) => {
        ctx.fillStyle = good ? C.good : C.bad; ctx.font = `800 24px ${DISPLAY}`;
        ctx.fillText(moveText(t), x0 + 16, yy + 20);
        ctx.fillStyle = C.ink; ctx.font = `400 14px ${BODY}`;
        ls[i].forEach((l, j) => { if (j === 0) ctx.font = `600 14px ${BODY}`; else ctx.font = `400 14px ${BODY}`; ctx.fillText(l, x0 + 64, yy + 17 + j * 19); });
        yy += 14 + ls[i].length * 19;
      });
    };
    col(up, upL, PAD, true);
    col(down, downL, PAD + colW + 20, false);
    y += Math.max(colH(upL), colH(downL), 30) + 16 + 16;
  }

  // the list
  ctx.fillStyle = C.ink; ctx.font = `800 26px ${DISPLAY}`; ctx.fillText('The rankings', PAD, y + 22);
  y = listTop;
  rows.forEach(({ t, lines }) => {
    const hh = rowH({ lines }), top3 = t.powerRank <= 3;
    rr(ctx, PAD, y, W - PAD * 2, hh, 16); ctx.fillStyle = C.paper; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = top3 ? '#B8860B' : C.ink; ctx.stroke();
    // the rank, painted like a yard number
    rr(ctx, PAD + 10, y + 10, 56, hh - 20, 12); ctx.fillStyle = top3 ? C.amber : C.tile; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `900 34px ${DISPLAY}`; ctx.textAlign = 'center';
    ctx.fillText(String(t.powerRank), PAD + 38, y + hh / 2 + 12); ctx.textAlign = 'left';
    const tx = PAD + 76 + 8;
    ctx.fillStyle = C.ink; ctx.font = `800 22px ${DISPLAY}`; ctx.fillText(t.name, tx, y + 30);
    let mx = tx + ctx.measureText(t.name).width + 10;
    ctx.font = `800 18px ${DISPLAY}`; ctx.fillStyle = t.movement > 0 ? C.good : t.movement < 0 ? C.bad : C.ink3;
    ctx.fillText(moveText(t), mx, y + 30); mx += ctx.measureText(moveText(t)).width + 12;
    ctx.fillStyle = C.ink2; ctx.font = `400 13px ${BODY}`;
    ctx.fillText(`${h.first(t)}, ${h.record(t)}, ${t.tier.label}`, mx, y + 29);
    // playoff odds on the right
    ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.font = `800 22px ${DISPLAY}`;
    ctx.fillText(h.pct(t.playoffPct), W - PAD - 16, y + 30);
    ctx.fillStyle = C.ink3; ctx.font = `400 12px ${BODY}`; ctx.fillText('playoff odds', W - PAD - 16, y + 46); ctx.textAlign = 'left';
    ctx.fillStyle = C.ink2; ctx.font = `400 14px ${BODY}`;
    lines.forEach((l, j) => ctx.fillText(l, tx, y + 54 + j * 19));
    y += hh + 10;
  });

  // how the score works, in one line
  ctx.fillStyle = C.ink3; ctx.font = `400 12px ${BODY}`;
  const w = (g) => `${h.pctW(g)}%`;
  ctx.fillText(`The power score: standing ${w('standing')}, scoring ${w('scoring')}, schedule left ${w('schedule')}, rest-of-season roster ${w('roster')}.`, PAD, y + 22);
  ctx.fillText('Rankings data: FantasyPros, DraftSharks, LeagueLogs. Scores: Sleeper.', PAD, y + 40);
  return cv;
}

/** The PDF of the power rankings as they stand on D. */
export async function rankingsPdf(D, h) {
  await Promise.all([`800 44px ${DISPLAY}`, `900 34px ${DISPLAY}`, `400 14px ${BODY}`, `600 14px ${BODY}`].map((f) => document.fonts?.load(f).catch(() => {})));
  const logo = await img('assets/logo-header.webp');
  const wk = D.meta.lastScored + 1; // the week the page heads them with: the ranks going into it
  const date = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric' });
  const cv = draw(D, h, logo, { title: `Week ${wk} Power Rankings`, line: `The Power Hour, ${date}` });
  return { blob: await pdfOf(cv), name: `power-rankings-week-${wk}.pdf` };
}
