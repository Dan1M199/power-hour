// The power rankings as a one-page PDF for the group chat (Dan only: the button shows while the editor session is
// signed in). Drawn straight onto a canvas in the site's type and colours (no DOM capture, so none of Safari's
// html-to-image quirks), then wrapped by pdfOf from the dashboard's share module. The look is the site's field: a board
// header with the week's leaders on chips, mowed stripes with chalk yard lines behind everything, the movers with their
// faces, then every team on a glass card with its rank painted on the grass like a yard number (huge for the top three,
// shrinking down the list, standing just clear of the card), the manager's photo, move and tier pills, a one-line reason it sits
// where it does, the four parts of the power score as bars and the playoff odds as a filled pill. Ends in the end zone.
import { pdfOf } from '../dashboard/share.js';
import { MEMBERS, photoUrl } from '../../lib/members.js';
export { shareFile } from '../dashboard/share.js';

const W = 980, PAD = 36, SCALE = 2;
const C = {
  board: '#13301C', chalk: '#FFFFFF', amber: '#FFC107', yellow: '#FFEB3B', ink: '#12301A', ink2: '#3C5A43', ink3: '#55705A',
  good: '#28702C', bad: '#C62828', tile: '#E8F0DF', tile2: '#D5E2CC', paper: '#FFFFFF', gold: '#B8860B',
  grass: '#4CAF50', stripe: '#5AB34F', turf: '#1B5E20', flag: '#D32F2F', sky3: '#B3E5FC', lime: '#D7EDC1', low: '#ECF0E8',
  a: '#29B6F6', bInk: '#985700',
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
const moveText = (t) => (t.movement > 0 ? `▲${t.movement}` : t.movement < 0 ? `▼${-t.movement}` : '–');
const TIER = { elite: [C.amber, C.ink], good: [C.lime, C.ink], mid: [C.sky3, C.ink], low: [C.low, C.ink2], stinks: [C.flag, C.chalk] };
const PART = [['standing', 'Standing', C.amber], ['scoring', 'Scoring', C.bInk], ['schedule', 'Schedule', C.a], ['roster', 'Roster', C.grass]];
// the yard number's size: huge for the podium, then shrinking down the list
const numSize = (r) => (r <= 3 ? [0, 176, 150, 132][r] : Math.max(64, 104 - (r - 4) * 5));

// a glass card: hard ledge under an inked edge
function card(ctx, x, y, w, hh, r, { ledge = C.ink, edge = C.ink, fill = C.paper, lift = 5 } = {}) {
  rr(ctx, x, y + lift, w, hh, r); ctx.fillStyle = ledge; ctx.fill();
  rr(ctx, x, y, w, hh, r); ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = edge; ctx.stroke();
}
// a pill with its words, returns its width
function pill(ctx, x, y, text, { bg, fg, font = `700 12px ${BODY}`, hgt = 22, edge }) {
  ctx.font = font;
  const w = ctx.measureText(text).width + 18;
  rr(ctx, x, y, w, hgt, hgt / 2); ctx.fillStyle = bg; ctx.fill();
  if (edge) { ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke(); }
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.fillText(text, x + 9, y + hgt / 2 + 1); ctx.textBaseline = 'alphabetic';
  return w;
}
// the manager's photo in an inked ring (initials if it won't load; greyed for last place, like the site's .drained)
function face(ctx, pic, t, cx, cy, r, drained) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = C.tile; ctx.fill(); ctx.clip();
  if (pic) {
    const s = Math.min(pic.width, pic.height);
    ctx.drawImage(pic, (pic.width - s) / 2, (pic.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
    if (drained) { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
  } else {
    ctx.fillStyle = C.ink2; ctx.font = `800 ${Math.round(r * 0.8)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((t.name.match(/[A-Za-z0-9]/g) || ['?']).slice(0, 2).join('').toUpperCase(), cx, cy + 1);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
}
// a section title on a white chip (text never sits straight on the grass)
function chipTitle(ctx, x, y, text) {
  ctx.font = `800 24px ${DISPLAY}`;
  const w = ctx.measureText(text).width + 32;
  card(ctx, x, y, w, 40, 20, { lift: 4 });
  ctx.fillStyle = C.ink; ctx.fillText(text, x + 16, y + 29);
}

function draw(D, h, logo, pics, { title, line }) {
  const ranks = partRanks(D), n = D.teams.length;
  const rows = D.teams.map((t) => ({ t, why: synopsis(D, t, h, ranks) }));
  const movers = [...D.teams].filter((t) => t.movement).sort((a, b) => b.movement - a.movement);
  const up = movers.filter((t) => t.movement > 0).slice(0, 3), down = movers.filter((t) => t.movement < 0).reverse().slice(0, 3);
  const top = (f) => [...D.teams].sort((a, b) => f(b) - f(a))[0];

  // the card geometry: the gutter holds the yard numbers, the card starts past it
  // the gutter fits the widest yard number, which stands clear of its card
  const m0 = document.createElement('canvas').getContext('2d');
  const numW = Math.max(...D.teams.map((t) => { m0.font = `900 ${numSize(t.powerRank)}px ${DISPLAY}`; return m0.measureText(String(t.powerRank)).width; }));
  const TUCK = -8, CX = PAD + Math.ceil(numW) - TUCK + 4, CW = W - PAD - CX, RIGHT = CX + CW - 18, ODDS_W = 112;
  const faceR = (r) => (r <= 3 ? 34 : 24);
  const textX = (r) => CX + 20 + faceR(r) * 2 + 16, textW = (r) => RIGHT - ODDS_W - 16 - textX(r);

  // measure first, then draw at the measured height
  const m = document.createElement('canvas').getContext('2d');
  m.font = `400 14px ${BODY}`;
  rows.forEach((r) => {
    r.lines = wrap(m, r.why, textW(r.t.powerRank));
    r.h = Math.max(r.t.powerRank <= 3 ? numSize(r.t.powerRank) * 0.82 : 0, (r.t.powerRank <= 3 ? 84 : 76) + r.lines.length * 19 + 44);
  });
  const colW = (W - PAD * 2 - 24) / 2;
  const moverText = (t) => `${t.name}, now ${h.ordinal(t.powerRank)}${gameSaid(D, t, h) ? `: ${gameSaid(D, t, h)}` : ''}.`;
  m.font = `400 13.5px ${BODY}`;
  const moverLines = (t) => wrap(m, moverText(t), colW - 128);
  const upL = up.map(moverLines), downL = down.map(moverLines);
  const itemH = (ls) => Math.max(52, 14 + ls.length * 18 + 12);
  const colH = (ls) => 20 + ls.reduce((a, l) => a + itemH(l), 0) + 8;
  const boxH = movers.length ? Math.max(colH(upL), colH(downL), 70) : 0;

  const HEAD = 196;
  let y0 = HEAD + 32;
  const moversTop = y0;
  if (movers.length) y0 += 52 + boxH + 36;
  const listTop = y0 + 60;
  const listH = rows.reduce((a, r) => a + r.h + 22, 0);
  const ZONE = 108, H = listTop + listH + 44 + ZONE;

  const cv = document.createElement('canvas');
  cv.width = W * SCALE; cv.height = H * SCALE;
  const ctx = cv.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // the field: mowing stripes with a chalk yard line every two
  for (let y = HEAD, i = 0; y < H - ZONE; y += 90, i++) {
    ctx.fillStyle = i % 2 ? C.stripe : C.grass; ctx.fillRect(0, y, W, 90);
    if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,0.42)'; ctx.fillRect(0, y + 87, W, 3); }
  }
  // the sideline
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(14, HEAD, 4, H - ZONE - HEAD);

  // the header: the scoreboard, a ghost week number, the logo, the title and three leader chips
  ctx.fillStyle = C.board; ctx.fillRect(0, 0, W, HEAD);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.font = `900 300px ${DISPLAY}`; ctx.textAlign = 'right';
  ctx.fillText(String(title.match(/\d+/)?.[0] || ''), W - 20, HEAD + 40);
  ctx.restore();
  ctx.fillStyle = C.amber; ctx.fillRect(0, HEAD - 8, W, 8);
  let x = PAD;
  if (logo) { const lh = 92, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, PAD, 18, lw, lh); x += lw + 20; }
  ctx.fillStyle = C.yellow; ctx.font = `700 15px ${BODY}`; ctx.fillText(line, x, 44);
  ctx.fillStyle = C.chalk; ctx.font = `900 54px ${DISPLAY}`; ctx.fillText(title, x, 96);
  const best = D.teams[0], hot = up[0], scorer = top((t) => t.pfPerGame), odds = top((t) => t.champPct || 0);
  const chips = [
    ['Team to beat', `${best.name}`],
    hot ? ['Biggest climb', `${hot.name} ${moveText(hot)}`] : ['Top scorer', `${scorer.name}, ${h.f1(scorer.pfPerGame)} a game`],
    odds?.champPct ? ['Title favorite', `${odds.name}, ${h.pct(odds.champPct)}`] : ['Top scorer', `${scorer.name}, ${h.f1(scorer.pfPerGame)} a game`],
  ];
  let cx = PAD;
  chips.forEach(([k, v]) => {
    ctx.font = `700 11.5px ${BODY}`; const kw = ctx.measureText(k).width;
    ctx.font = `800 17px ${DISPLAY}`; const vw = ctx.measureText(v).width;
    const w = Math.max(kw, vw) + 28;
    if (cx + w > W - PAD) return;
    rr(ctx, cx, 124, w, 50, 14); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.stroke();
    ctx.fillStyle = C.yellow; ctx.font = `700 11.5px ${BODY}`; ctx.fillText(k, cx + 14, 143);
    ctx.fillStyle = C.chalk; ctx.font = `800 17px ${DISPLAY}`; ctx.fillText(v, cx + 14, 164);
    cx += w + 10;
  });

  // the movers
  if (movers.length) {
    chipTitle(ctx, PAD, moversTop, 'The movers');
    const by = moversTop + 56;
    const col = (list, ls, x0, good) => {
      card(ctx, x0, by, colW, boxH, 20);
      ctx.fillStyle = good ? C.good : C.bad; ctx.font = `800 14px ${BODY}`;
      ctx.fillText(good ? 'Climbing' : 'Sliding', x0 + 18, by + 26);
      let yy = by + 38;
      if (!list.length) { ctx.fillStyle = C.ink3; ctx.font = `400 14px ${BODY}`; ctx.fillText(good ? 'Nobody climbed.' : 'Nobody dropped.', x0 + 18, yy + 20); return; }
      list.forEach((t, i) => {
        const ih = itemH(ls[i]);
        face(ctx, pics[t.rid], t, x0 + 38, yy + ih / 2 - 4, 20, t.powerRank === n);
        ctx.fillStyle = good ? C.good : C.bad; ctx.font = `900 30px ${DISPLAY}`;
        ctx.fillText(moveText(t), x0 + 68, yy + ih / 2 + 7);
        ls[i].forEach((l, j) => { ctx.fillStyle = j ? C.ink2 : C.ink; ctx.font = `${j ? 400 : 700} 13.5px ${BODY}`; ctx.fillText(l, x0 + 118, yy + 18 + j * 18); });
        yy += ih;
      });
    };
    col(up, upL, PAD, true);
    col(down, downL, PAD + colW + 24, false);
  }

  chipTitle(ctx, PAD, listTop - 60, 'The rankings');

  // the yard numbers first, so every card sits over them
  let y = listTop;
  rows.forEach((r) => {
    const s = numSize(r.t.powerRank), cy = y + r.h / 2, num = String(r.t.powerRank);
    ctx.font = `900 ${s}px ${DISPLAY}`; ctx.textAlign = 'right';
    const bx = CX + TUCK, base = cy + s * 0.35, off = Math.max(4, s * 0.05);
    ctx.fillStyle = 'rgba(18,48,26,0.55)'; ctx.fillText(num, bx + off, base + off);
    ctx.fillStyle = r.t.powerRank <= 3 ? C.yellow : C.chalk; ctx.fillText(num, bx, base);
    ctx.lineWidth = r.t.powerRank <= 3 ? 3 : 2; ctx.strokeStyle = C.ink; ctx.strokeText(num, bx, base);
    ctx.textAlign = 'left';
    y += r.h + 22;
  });

  // the cards
  y = listTop;
  rows.forEach(({ t, lines, h: hh }) => {
    const rk = t.powerRank, pod = rk <= 3, last = rk === n;
    card(ctx, CX, y, CW, hh, pod ? 24 : 18, { ledge: pod ? C.gold : C.ink, lift: pod ? 7 : 5 });
    if (pod) { // a gold band across the top of the podium cards
      ctx.save(); rr(ctx, CX, y, CW, hh, 24); ctx.clip();
      ctx.fillStyle = 'rgba(255,193,7,0.16)'; ctx.fillRect(CX, y, CW, 46);
      ctx.restore();
    }
    const fr = faceR(rk);
    face(ctx, pics[t.rid], t, CX + 20 + fr, y + (pod ? 52 : 44), fr, last);
    const tx = textX(rk);
    // name, move pill, tier pill
    ctx.fillStyle = C.ink; ctx.font = `800 ${pod ? 30 : 23}px ${DISPLAY}`;
    const ny = y + (pod ? 44 : 36);
    ctx.fillText(t.name, tx, ny);
    let px = tx + ctx.measureText(t.name).width + 12;
    const mv = t.movement;
    px += pill(ctx, px, ny - (pod ? 21 : 18), moveText(t), { bg: mv > 0 ? C.good : mv < 0 ? C.bad : C.tile2, fg: mv ? C.chalk : C.ink2, font: `800 13px ${BODY}` }) + 6;
    const [tb, tf] = TIER[t.tier.key] || TIER.low;
    pill(ctx, px, ny - (pod ? 21 : 18), t.tier.label, { bg: tb, fg: tf, edge: C.ink });
    // meta
    ctx.fillStyle = C.ink2; ctx.font = `600 13px ${BODY}`;
    ctx.fillText(`${h.first(t)}, ${h.ordinal(t.seed)} seed, ${h.pct(t.champPct || 0)} to win it all`, tx, ny + 22);
    // the reason
    ctx.fillStyle = C.ink; ctx.font = `400 14px ${BODY}`;
    const ly = ny + 46;
    lines.forEach((l, j) => ctx.fillText(l, tx, ly + j * 19));
    // the four parts of the score
    const bw = (RIGHT - tx - 3 * 12) / 4, byy = ly + (lines.length - 1) * 19 + 16;
    PART.forEach(([k, label, col], i) => {
      const v = t.parts?.[k]; if (v == null) return;
      const bx = tx + i * (bw + 12);
      ctx.fillStyle = C.ink3; ctx.font = `700 11.5px ${BODY}`; ctx.fillText(label, bx, byy + 4);
      ctx.textAlign = 'right'; ctx.fillStyle = C.ink2; ctx.fillText(String(Math.round(v)), bx + bw, byy + 4); ctx.textAlign = 'left';
      rr(ctx, bx, byy + 10, bw, 8, 4); ctx.fillStyle = C.tile2; ctx.fill();
      rr(ctx, bx, byy + 10, Math.max(8, bw * v / 100), 8, 4); ctx.fillStyle = col; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = C.ink; rr(ctx, bx, byy + 10, bw, 8, 4); ctx.stroke();
    });
    // the playoff odds, top right, over a filled pill
    ctx.textAlign = 'right'; ctx.fillStyle = C.ink; ctx.font = `900 ${pod ? 34 : 28}px ${DISPLAY}`;
    ctx.fillText(h.pct(t.playoffPct), RIGHT, y + (pod ? 46 : 38));
    ctx.fillStyle = C.ink3; ctx.font = `700 11.5px ${BODY}`; ctx.fillText('playoff odds', RIGHT, y + (pod ? 64 : 55));
    ctx.textAlign = 'left';
    const ox = RIGHT - ODDS_W + 12, oy = y + (pod ? 72 : 62), ow = ODDS_W - 12;
    rr(ctx, ox, oy, ow, 10, 5); ctx.fillStyle = C.tile2; ctx.fill();
    if (t.playoffPct > 0) { rr(ctx, ox, oy, Math.max(10, ow * t.playoffPct), 10, 5); ctx.fillStyle = t.playoffPct >= 0.5 ? C.grass : C.amber; ctx.fill(); }
    rr(ctx, ox, oy, ow, 10, 5); ctx.lineWidth = 1.2; ctx.strokeStyle = C.ink; ctx.stroke();
    y += hh + 22;
  });

  // the end zone: the goal line, the brand and how the score works
  const zy = H - ZONE;
  ctx.fillStyle = C.turf; ctx.fillRect(0, zy, W, ZONE);
  ctx.fillStyle = C.chalk; ctx.fillRect(0, zy, W, 6);
  ctx.fillStyle = C.chalk; ctx.font = `900 30px ${DISPLAY}`; ctx.fillText('The Power Hour', PAD, zy + 46);
  ctx.font = `400 12px ${BODY}`; ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const w = (g) => `${h.pctW(g)}%`;
  ctx.fillText(`The power score: standing ${w('standing')}, scoring ${w('scoring')}, schedule left ${w('schedule')}, rest-of-season roster ${w('roster')}.`, PAD, zy + 70);
  ctx.fillText('Rankings data: FantasyPros, DraftSharks, LeagueLogs. Scores: Sleeper.', PAD, zy + 88);
  return cv;
}

/** The PDF of the power rankings as they stand on D. */
export async function rankingsPdf(D, h) {
  await Promise.all([`900 54px ${DISPLAY}`, `800 24px ${DISPLAY}`, `400 14px ${BODY}`, `700 14px ${BODY}`].map((f) => document.fonts?.load(f).catch(() => {})));
  const [logo, ...faces] = await Promise.all([img('assets/logo-header.webp'), ...D.teams.map((t) => {
    const m = MEMBERS[t.ownerId];
    return m?.photo ? img(photoUrl(m.photo)) : Promise.resolve(null);
  })]);
  const pics = Object.fromEntries(D.teams.map((t, i) => [t.rid, faces[i]]));
  const wk = D.meta.lastScored + 1; // the week the page heads them with: the ranks going into it
  const date = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric' });
  const cv = draw(D, h, logo, pics, { title: `Week ${wk} Power Rankings`, line: `The Power Hour, ${date}` });
  return { blob: await pdfOf(cv), name: `power-rankings-week-${wk}.pdf` };
}
