// The scenario receipt (Dan's request Nov 17): a picture of a playoff-path scenario to drop in the group chat. Drawn
// straight onto a canvas in the site's 3.0 look (no DOM capture, so none of Safari's html-to-image quirks): the board
// header, the mowed field, one flat white card on its slab with the team, the odds today and in this scenario, and every
// picked result in week order, each with what it does to the odds on its own. Your own games wear the yellow You tag.
// Shared as a JPEG or a one-page PDF through the dashboard's share module.
import { pdfOf } from '../dashboard/share.js';
import { MEMBERS, photoUrl } from '../../lib/members.js';

const W = 720, PAD = 28, SCALE = 2;
const C = {
  board: '#0D2415', slabBoard: '#040F07', chalk: '#FDFEFB', amber: '#F9B000', gold: '#B67800', yellow: '#FFE01A', pop: '#FF0080',
  grass: '#3E9F46', stripe: '#359A3F', slab: '#1D5F28', face: '#F7FAF3', well: '#E6EEDC', ink: '#0B2412', ink3: '#47604C',
  good: '#28702C', bad: '#C62828', line: '#BFD2AE',
};
const FONT = "'Inter', -apple-system, 'Segoe UI', system-ui, sans-serif";
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const pct = (x) => (x == null ? '–' : x > 0 && x < 0.005 ? '<1%' : x < 1 && x > 0.995 ? '>99%' : `${Math.round(x * 100)}%`);
const signed = (d) => `${d >= 0 ? '+' : '−'}${Math.abs(Math.round(d * 100))}%`;
const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
const timeout = (p, ms) => Promise.race([p, new Promise((ok) => setTimeout(() => ok(null), ms))]);

// a pill of text: returns its width
function pill(ctx, x, y, text, { bg, fg, font = `800 13px ${FONT}`, h = 26, r = 8 }) {
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 20;
  ctx.fillStyle = bg; rr(ctx, x, y, w, h, r); ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, x + 10, y + h / 2 + 1);
  return w;
}

/** The scenario's lines, in week order: who wins, whether it's your game, and what it does to your odds on its own. */
export function scenarioLines(D, base, picks, rid, games) {
  return Object.keys(picks).map(Number).sort((a, b) => games[a].week - games[b].week).map((i) => {
    const g = games[i], winner = picks[i] ? g.ra : g.rb, loser = picks[i] ? g.rb : g.ra, b = base.games[i];
    const mine = g.ra === rid || g.rb === rid;
    const alone = b && base.odds != null ? (winner === g.ra ? b.oA : b.oB) - base.odds : null;
    const name = (r) => short(D.byRid[r].name, 22);
    const text = mine ? (winner === rid ? `You beat ${name(loser)}` : `You lose to ${name(winner)}`) : `${name(winner)} beat ${name(loser)}`;
    return { i, week: g.week, mine, text, alone };
  });
}

/** Draws the receipt; resolves { canvas }. */
export async function drawScenario({ D, base, P, picks, rid, games, sims, weeks, spots }) {
  const t = D.byRid[rid], lines = scenarioLines(D, base, picks, rid, games);
  await timeout(Promise.all([document.fonts.load(`800 20px ${FONT}`), document.fonts.load(`400 14px ${FONT}`)]), 1500);
  const member = MEMBERS[t.ownerId];
  const [logo, face] = await Promise.all([timeout(img('assets/logo-header.webp'), 2000), member ? timeout(img(photoUrl(member.photo)), 2000) : null]);

  const ROW = 50, headH = 96, cardTop = headH + 26;
  const cardH = 24 + 64 + 18 + 104 + 22 + 28 + lines.length * ROW + 16 + 44 + 22;
  const H = cardTop + cardH + 8 + 40 + 30;
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE; canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // the field: mowed stripes
  ctx.fillStyle = C.grass; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.stripe;
  for (let y = headH; y < H; y += 120) ctx.fillRect(0, y + 60, W, 60);

  // the board header
  ctx.fillStyle = C.board; ctx.fillRect(0, 0, W, headH);
  let lx = PAD;
  if (logo) { const lh = 56, lw = (logo.width / logo.height) * lh; ctx.drawImage(logo, PAD, (headH - lh) / 2, lw, lh); lx = PAD + lw + 14; }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.chalk; ctx.font = `800 28px ${FONT}`; ctx.fillText('Playoff scenario', lx, 48);
  ctx.fillStyle = C.yellow; ctx.font = `700 15px ${FONT}`; ctx.fillText(`The Power Hour, the rest of the regular season (weeks ${weeks[0]} to ${weeks[weeks.length - 1]})`, lx, 72);

  // the card on its slab, with a soft shadow on the grass
  const cx = PAD, cw = W - PAD * 2;
  ctx.save(); ctx.shadowColor = 'rgba(4, 30, 12, 0.35)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 18;
  ctx.fillStyle = C.slab; rr(ctx, cx, cardTop + 8, cw, cardH, 20); ctx.fill(); ctx.restore();
  ctx.fillStyle = C.face; rr(ctx, cx, cardTop, cw, cardH, 20); ctx.fill();

  // the team
  let y = cardTop + 24;
  const ix = cx + 24;
  if (face) {
    ctx.save(); ctx.beginPath(); ctx.arc(ix + 30, y + 30, 30, 0, Math.PI * 2); ctx.closePath(); ctx.clip(); ctx.drawImage(face, ix, y, 60, 60); ctx.restore();
    ctx.strokeStyle = C.yellow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ix + 30, y + 30, 31.5, 0, Math.PI * 2); ctx.stroke();
  }
  const tx = face ? ix + 76 : ix;
  ctx.fillStyle = C.ink; ctx.font = `800 26px ${FONT}`; ctx.fillText(short(t.name, 30), tx, y + 28);
  ctx.fillStyle = C.ink3; ctx.font = `600 15px ${FONT}`; ctx.fillText(`${member?.first || 'Their'}${member ? "'s" : ''} road to the top ${spots}, ${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''} today`, tx, y + 52);
  y += 64 + 18;

  // the odds: today, then this scenario
  ctx.fillStyle = C.well; rr(ctx, ix, y, cw - 48, 104, 14); ctx.fill();
  const up = P.odds >= base.odds;
  ctx.fillStyle = C.ink3; ctx.font = `700 13px ${FONT}`; ctx.fillText('Playoff odds today', ix + 18, y + 28); ctx.fillText('In this scenario', ix + 210, y + 28);
  ctx.fillStyle = C.ink3; ctx.font = `800 40px ${FONT}`; ctx.fillText(pct(base.odds), ix + 18, y + 78);
  ctx.fillStyle = C.ink; ctx.font = `800 20px ${FONT}`; ctx.fillText('→', ix + 150, y + 74);
  ctx.fillStyle = up ? C.good : C.bad; ctx.font = `800 56px ${FONT}`; ctx.fillText(pct(P.odds), ix + 210, y + 82);
  const ow = ctx.measureText(pct(P.odds)).width;
  pill(ctx, ix + 222 + ow, y + 50, `${signed(P.odds - base.odds)}`, { bg: up ? C.good : C.bad, fg: C.chalk, font: `800 15px ${FONT}`, h: 30 });
  y += 104 + 22;

  // what needs to happen
  ctx.fillStyle = C.ink; ctx.font = `800 19px ${FONT}`; ctx.textBaseline = 'alphabetic'; ctx.fillText('What needs to happen', ix, y + 18);
  ctx.fillStyle = C.ink3; ctx.font = `600 12.5px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('each on its own', cx + cw - 24, y + 18); ctx.textAlign = 'left';
  y += 28;
  for (const l of lines) {
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ix, y + 0.5); ctx.lineTo(cx + cw - 24, y + 0.5); ctx.stroke();
    let x = ix;
    x += pill(ctx, x, y + 12, `Wk ${l.week}`, { bg: C.board, fg: C.chalk }) + 8;
    if (l.mine) x += pill(ctx, x, y + 12, 'You', { bg: C.yellow, fg: C.ink }) + 8;
    ctx.fillStyle = C.ink; ctx.font = `700 16px ${FONT}`; ctx.textBaseline = 'middle'; ctx.fillText(l.text, x + 4, y + 26);
    if (l.alone != null) {
      ctx.textAlign = 'right'; ctx.font = `800 16px ${FONT}`; ctx.fillStyle = l.alone >= 0.005 ? C.good : l.alone <= -0.005 ? C.bad : C.ink3;
      ctx.fillText(Math.abs(l.alone) < 0.005 ? '±0%' : signed(l.alone), cx + cw - 24, y + 26); ctx.textAlign = 'left';
    }
    ctx.textBaseline = 'alphabetic';
    y += ROW;
  }
  y += 16;
  ctx.fillStyle = C.ink3; ctx.font = `500 12.5px ${FONT}`;
  ctx.fillText(`Read from the ${P.matches.toLocaleString('en-US')} of ${sims.toLocaleString('en-US')} simulated seasons where all of this happens.`, ix, y + 14);
  ctx.fillText('The number beside each result is what it does to the odds on its own.', ix, y + 32);

  // the foot, on the grass
  ctx.fillStyle = C.chalk; ctx.font = `700 13px ${FONT}`;
  const when = new Date().toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric' });
  ctx.fillText(`The Power Hour, NFL Fantasy Championship. Made ${when}.`, PAD, cardTop + cardH + 8 + 34);
  return { canvas };
}

const toBlob = (canvas, type, q) => new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('The picture could not be made'))), type, q));
/** The receipt as files ready to share: a JPEG and a one-page PDF, plus a URL for the preview. */
export async function scenarioFiles(args) {
  const { canvas } = await drawScenario(args);
  const jpg = await toBlob(canvas, 'image/jpeg', 0.92);
  const pdf = await pdfOf(canvas);
  return { jpg, pdf, url: URL.createObjectURL(jpg) };
}
