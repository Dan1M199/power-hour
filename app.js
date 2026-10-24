import { computeLeague, WEIGHTS } from './lib/engine.js';
import { bumpChart, scatter, radar, weeklyBars, divergingBars, heatTable, faceDot, TEAM_COLORS } from './lib/charts.js';
import { buildStories, keyMatchup, matchupQuips } from './lib/stories.js';
import { applyOverrides } from './lib/overrides.js';
import { tradeIdeas } from './lib/trades.js';
import { breakdown, shortName } from './lib/matchup.js';
import { MEMBERS, photoUrl } from './lib/members.js';
import { bullseye } from './lib/bullseye.js';

// ---------- config ----------
const TZ = 'America/Chicago';
const SOURCE_NAMES = { fp: 'FantasyPros', ds: 'DraftSharks', ll: 'LeagueLogs' };
// the site's author: his own lineup blunders always make the lead story
const EDITOR = { user: 'dmir9999', name: 'Dan' };
// money week: whoever scores closest to the target, over or under, takes the doubled bonus (lib/bullseye.js). The board
// shows from now through the week after, then disappears on its own; set to null to drop it early.
const MONEY_WEEK = {
  week: 7, target: 120, prize: 80, usual: 40, title: "Mo's birthday bullseye", honoree: '1004163936612089856',
  why: "120 is 10/20, Commissioner Mo's birthday", flyer: 'assets/money-week-flyer.jpg',
};
// last season's champion carries a trophy wherever their team shows up
const CHAMPION = { user: '1004111276118761472', season: 2025 };

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = (x) => (x == null || Number.isNaN(x) ? '–' : Number(x).toFixed(1));
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
// fair American odds for a probability, rounded the way a sportsbook posts them (no vig)
function american(p) {
  if (p == null) return '–';
  if (p <= 0) return 'OTB';
  if (p >= 1) return '-10000';
  const raw = p >= 0.5 ? (-100 * p) / (1 - p) : (100 * (1 - p)) / p;
  const a = Math.abs(raw), step = a >= 2000 ? 100 : a >= 1000 ? 50 : a >= 300 ? 10 : 5;
  const r = Math.min(50000, Math.round(a / step) * step);
  return p >= 0.5 ? `-${Math.max(100, r)}` : `+${Math.max(100, r)}`;
}
const half = (x) => (Math.round(x * 2) / 2).toFixed(1);
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

let DATA = null; // computed league
let RAW = null;
let myTeam = Number(store.get('ph-my-team')) || null;
const wireState = { type: 'all', mine: false, limit: 50, trades: 3 };
const tradeState = { shape: 'all', cache: {} };
let VOTES = null; // { week, open, counts: { "3-8": { "3": n } }, mine: { "3-8": "3" } } once /api/votes answers

// ---------- data ----------
const getJSON = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} from ${url}`);
  return r.json();
};
const chicagoDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// the day's data key: the Central date, rolling over at 6am so the morning snapshot has last night's games final
const morningKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 6 * 36e5));

// Sleeper is read once per morning through /api/league (CDN-cached per key), never straight from the browser
async function loadLive() {
  const key = morningKey();
  const [snap, ros] = await Promise.all([
    getJSON(`/api/league?d=${key}`),
    getJSON(`/api/ros?d=${key}`).catch((e) => ({ error: String(e.message || e) })),
  ]);
  return { ...snap, ros };
}

async function load() {
  const demo = new URLSearchParams(location.search).has('demo') || window.__DEMO__;
  RAW = window.__DEMO__ || (demo ? await getJSON('demo/demo.json') : await loadLive());
  RAW.isDemo = !!demo;
  const ros = RAW.ros && !RAW.ros.error ? RAW.ros : null;
  const patched = ros ? applyOverrides(ros.values) : { values: {}, applied: [] };
  DATA = computeLeague({
    league: RAW.league,
    users: RAW.users,
    rosters: RAW.rosters,
    matchups: RAW.matchups,
    transactions: RAW.transactions,
    players: ros ? ros.players : {},
    ros: patched.values,
    byes: ros?.byes || {},
    currentWeek: RAW.state.week,
    lastScored: RAW.league.settings?.last_scored_leg,
  });
  DATA.rosMeta = ros;
  DATA.overrides = patched.applied;
  DATA.rosError = RAW.ros && RAW.ros.error;
  // stable team colours by roster id
  DATA.color = Object.fromEntries([...DATA.teams].sort((a, b) => a.rid - b.rid).map((t, i) => [t.rid, TEAM_COLORS[i % TEAM_COLORS.length]]));
  // the demo snapshot is frozen in time, so "fresh" is measured from its newest move
  const now = RAW.isDemo && DATA.feed.length ? DATA.feed[0].ts + 6 * 36e5 : Date.now();
  DATA.now = now;
  DATA.stories = buildStories(DATA, { now, dateKey: chicagoDate(), editor: EDITOR });
  DATA.bull = MONEY_WEEK ? bullseye(DATA, MONEY_WEEK) : null;
  // money week leads the headlines for as long as it runs
  const ms = moneyStory();
  if (ms) DATA.stories = { lead: ms, more: [DATA.stories.lead, ...DATA.stories.more].filter(Boolean) };
  DATA.key = keyMatchup(DATA);
  DATA.quips = matchupQuips(DATA);
}

// ---------- shared bits ----------
const team = (rid) => DATA.byRid[rid];
const short = (name, n = 15) => (name.length > n ? name.slice(0, n - 1) + '…' : name);
const nameOf = (id) => DATA.helpers.nameOf(id);
const posOf = (id) => DATA.helpers.posOf(id);
const posTag = (id) => { const p = posOf(id); return p ? `<span class="pos ${p}">${p}</span>` : ''; };
const member = (t) => (t && MEMBERS[t.ownerId]) || null;
// the person, not the Sleeper handle, wherever we can
const faceSrc = (t) => (member(t) ? photoUrl(member(t).photo) : null);
const firstName = (t) => member(t)?.first || t.owner;
// the team picture from Sleeper; manager headshots are reserved for headshot() below
function avatar(t, cls = 'avatar') {
  const initials = esc(t.name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?');
  if (!t.avatar) return `<span class="${cls} ph" aria-hidden="true">${initials}</span>`;
  return `<img class="${cls}" src="https://sleepercdn.com/avatars/thumbs/${esc(t.avatar)}" alt="" loading="lazy" data-initials="${initials}">`;
}
// a bigger, named photo for the places a face is the point (headlines, manager cards, the face-off)
const headshot = (t, cls) => {
  const m = member(t);
  return m ? `<img class="${cls}" src="${photoUrl(m.photo)}" alt="${esc(m.first)}" decoding="async" data-initials="${esc(m.first[0])}">` : avatar(t, cls);
};
function fixAvatars(root) {
  root.querySelectorAll('img[data-initials]').forEach((img) => {
    img.addEventListener('error', () => {
      const s = document.createElement('span');
      s.className = img.className + ' ph';
      s.textContent = img.dataset.initials;
      s.setAttribute('aria-hidden', 'true');
      img.replaceWith(s);
    }, { once: true });
  });
}
// ---------- the defending champion ----------
const TROPHY = '<svg class="trophy" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 2.5h10v2h3.2v3.2a4.2 4.2 0 0 1-4.3 4.2 5.2 5.2 0 0 1-2.9 3.1v2.6h3.3v3.9H7.7v-3.9H11v-2.6a5.2 5.2 0 0 1-2.9-3.1 4.2 4.2 0 0 1-4.3-4.2V4.5H7zm0 4H5.8v1.2A2.2 2.2 0 0 0 7 9.6zm10 0v3.1a2.2 2.2 0 0 0 1.2-2V6.5z" fill="#FFC107" stroke="#12301A" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const isChamp = (t) => !!(t && CHAMPION && t.ownerId === CHAMPION.user);
// a trophy (and, with a label, the season) next to the champion's team name
const champTag = (t, label = true) => (isChamp(t) ? `<span class="champ${label ? '' : ' bare'}" title="${CHAMPION.season} league champion">${TROPHY}${label ? `${CHAMPION.season} champ` : ''}</span>` : '');
// a trophy pinned to the corner of the champion's photo
const champBadge = (t) => (isChamp(t) ? `<span class="champ-badge" title="${CHAMPION.season} league champion">${TROPHY}</span>` : '');

// ---------- money week ----------
const money = (x) => `$${x}`;
const awayText = (r) => (r.dist < 0.05 ? 'dead on 120' : `${f1(r.dist)} ${r.side}`);
function moneyStory() {
  const B = DATA.bull, M = MONEY_WEEK;
  if (!B) return null;
  const rules = `Closest to ${M.target} points, over or under, wins ${money(M.prize)} in week ${M.week}, double the usual ${money(M.usual)}. ${M.why}.`;
  const base = { type: 'money', kicker: 'Money week', tone: 'good', stamp: money(M.prize) };
  const honoree = DATA.teams.find((t) => t.ownerId === M.honoree);
  if (B.state === 'soon') return { ...base, rids: honoree ? [honoree.rid] : [], headline: `Money week is coming: closest to ${M.target} wins ${money(M.prize)}`, deck: rules };
  const [a, b] = B.rows, A = team(a.rid), Bt = team(b.rid);
  if (B.state === 'final') {
    return { ...base, rids: [a.rid], stamp: `+${money(M.prize)}`, headline: `${firstName(A)} hit the bullseye and banks ${money(M.prize)}`,
      deck: `${A.name} scored ${f1(a.score)} in week ${M.week}, ${awayText(a)}, the closest anyone came to ${M.target}. ${Bt.name} missed by ${f1(b.dist)}. Happy birthday, Commish.` };
  }
  const live = B.state === 'live';
  return { ...base, rids: [a.rid, b.rid],
    headline: live ? `${firstName(A)} is ${f1(a.dist)} points from ${money(M.prize)}` : `${M.title}: closest to ${M.target} takes ${money(M.prize)}`,
    deck: live
      ? `${A.name} is on pace for ${f1(a.score)}${a.banked ? ` with ${f1(a.banked)} already banked` : ''}, ${awayText(a)}. ${Bt.name} is next at ${f1(b.score)}. ${rules}`
      : `${rules} Right now ${A.name} projects closest at ${f1(a.score)}, with ${Bt.name} right behind at ${f1(b.score)}.` };
}
// on each matchup card: how far that team projects from the target
function bullTag(rid) {
  const B = DATA.bull;
  if (!B || !B.rows.length || B.state === 'final') return '';
  const k = B.rows.findIndex((r) => r.rid === rid), r = B.rows[k];
  return `<small class="bull-tag${k === 0 ? ' lead' : ''}" data-tip="${esc(`Money week: closest to ${MONEY_WEEK.target} wins ${money(MONEY_WEEK.prize)}. ${team(rid).name} is ${ordinal(k + 1)} closest.`)}">${k === 0 ? `${money(MONEY_WEEK.prize)} pace, ` : ''}${awayText(r)}</small>`;
}
// the target: rings every few points from the target, over on the top half, under on the bottom; the closest three
// wear their manager's face
function bullTarget(B) {
  const S = 300, c = S / 2, R = 132, core = 22, max = 15;
  // square-root scale: the race near the bullseye gets the room, long shots bunch at the rim
  const rad = (d) => core + Math.sqrt(Math.min(d, max + 2) / max) * (R - core);
  const rings = [[15, 'w'], [10, 'o'], [5, 'w'], [2, 'o']];
  let s = `<svg class="chart target" viewBox="0 0 ${S} ${S}" role="img" aria-label="Distance from ${B.target} for every team">`;
  rings.forEach(([d, k]) => (s += `<circle cx="${c}" cy="${c}" r="${rad(d)}" class="ring ${k}"/>`));
  s += `<circle cx="${c}" cy="${c}" r="${core}" class="core"/><text x="${c}" y="${c + 7}" class="core-t" text-anchor="middle">${B.target}</text>`;
  [2, 5, 10, 15].forEach((d) => (s += `<text x="${c + rad(d) - 4}" y="${c - 4}" class="ring-t" text-anchor="end">${d}</text>`));
  s += `<text x="${c}" y="12" class="side-t" text-anchor="middle">Over</text><text x="${c}" y="${S - 4}" class="side-t" text-anchor="middle">Under</text>`;
  const halves = { over: B.rows.filter((r) => r.side !== 'under'), under: B.rows.filter((r) => r.side === 'under') };
  const marks = [];
  for (const [side, rs] of Object.entries(halves)) {
    // spread each half evenly, over teams across the top and under across the bottom; stepping through the slots
    // (rather than filling them in order) keeps the closest few, who sit near the middle, from stacking on each other
    const n = rs.length, gcd = (x, y) => (y ? gcd(y, x % y) : x);
    let step = Math.max(1, Math.round(n * 0.4));
    while (n > 1 && gcd(step, n) !== 1) step++;
    rs.forEach((r, i) => {
      const ang = (side === 'over' ? Math.PI : 0) + ((((i * step) % n) + 1) / (n + 1)) * Math.PI;
      marks.push({ r, x: c + Math.cos(ang) * rad(r.dist), y: c + Math.sin(ang) * rad(r.dist) });
    });
  }
  const rank = new Map(B.rows.map((r, i) => [r.rid, i]));
  marks.sort((p, q) => rank.get(q.r.rid) - rank.get(p.r.rid)); // closest drawn last, on top
  for (const { r, x, y } of marks) {
    const t = team(r.rid), k = rank.get(r.rid), tip = `${t.name}: ${f1(r.score)}${B.state === 'final' ? '' : ' projected'}, ${awayText(r)}`;
    const img = k < 3 ? faceSrc(t) : null;
    s += img ? faceDot(x.toFixed(1), y.toFixed(1), 13, img, DATA.color[t.rid], tip) : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${DATA.color[t.rid]}" class="mk" data-tip="${esc(tip)}"/>`;
  }
  return s + '</svg>';
}
function bullBoard() {
  const B = DATA.bull, M = MONEY_WEEK;
  if (!B) return '';
  const status = { soon: `Coming in week ${M.week}.`, upcoming: `Before kickoff, by projection. Every team is still live: a typical week swings about ${Math.round(DATA.meta.sd)} points either way.`, live: 'Games are underway: banked points plus the rest projected.', final: 'Final scores.' }[B.state];
  const list = B.rows.map((r, i) => {
    const t = team(r.rid);
    return `<li class="${i === 0 ? 'lead' : ''} ${r.rid === myTeam ? 'mine' : ''}">
        <span class="n">${i + 1}</span>${avatar(t)}
        <span class="who"><b>${esc(t.name)}${champTag(t, false)}</b><small>${esc(firstName(t))}${r.banked ? `, ${f1(r.banked)} banked` : ''}</small></span>
        <span class="sc">${f1(r.score)}</span>
        <span class="away ${r.side}">${awayText(r)}</span>
        ${B.state === 'final' ? (i === 0 ? `<span class="pw won">${money(M.prize)}</span>` : '<span class="pw"></span>') : `<span class="pw" data-tip="${esc(`${t.name} lands closest to ${M.target} in ${(r.pWin * 100).toFixed(1)}% of 20,000 simulated weeks`)}">${pct(r.pWin)}</span>`}
      </li>`;
  }).join('');
  return `
    <section class="bull glass rim" aria-labelledby="bull-hed">
      <div class="bull-copy">
        <p class="kicker"><span>Money week</span><span class="k">Week ${M.week} bonus</span></p>
        <h2 id="bull-hed">${esc(M.title)}</h2>
        <p class="lead-deck">Closest to ${M.target} points, over or under, wins it all. ${esc(M.why)}. Happy birthday, Commish.</p>
        <div class="ticket" aria-label="Prize ${money(M.prize)}, doubled from ${money(M.usual)}"><s>${money(M.usual)}</s><b>${money(M.prize)}</b><small>prize, doubled</small></div>
        <a class="flyer" href="${asset(M.flyer)}" target="_blank" rel="noopener"><img src="${asset(M.flyer)}" alt="Money week flyer: ${esc(M.title)}, closest to ${M.target} wins ${money(M.prize)}" loading="lazy"><span>Open the flyer</span></a>
      </div>
      ${B.rows.length ? `<div class="bull-chart">${bullTarget(B)}<p class="sub">${status}</p></div>
      <div class="bull-list">
        <div class="bull-head"><span>Team</span><span>${B.state === 'final' ? 'Score' : 'Proj'}</span><span>From ${M.target}</span><span>${B.state === 'final' ? 'Prize' : 'Wins it'}</span></div>
        <ol>${list}</ol>
      </div>` : `<div class="bull-chart"><p class="sub">${status}</p></div>`}
    </section>`;
}
// files the single-file preview inlines (window.__ASSETS__); served from the site otherwise
const asset = (p) => window.__ASSETS__?.[p] || p;

// circled down-arrow that marks anything tappable to expand; CSS flips it when open
const XP = '<span class="xp" aria-hidden="true"><svg width="12" height="8" viewBox="0 0 12 8"><path d="M1 1.5l5 5 5-5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
const record = (t) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`;
const updatedText = () => {
  const iso = DATA.rosMeta?.updated;
  if (!iso) return '';
  const d = new Date(iso);
  return `Rankings refreshed ${d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
};

// ---------- views ----------
function viewRankings() {
  const m = DATA.meta;
  const chips = DATA.rosMeta
    ? Object.entries(DATA.rosMeta.sources).map(([k, s]) => `<span class="chip ${s.ok ? '' : 'off'}" title="${s.ok ? `${s.matched} of ${s.rows} players matched` : esc(s.error)}"><span class="dot"></span>${SOURCE_NAMES[k] || k}</span>`).join('')
    : '<span class="chip off"><span class="dot"></span>ROS rankings unavailable</span>';
  const notice = DATA.rosError
    ? `<div class="notice glass"><strong>Results-only mode.</strong> The rest-of-season rankings couldn't be loaded (${esc(DATA.rosError)}), so these ranks use this season's results alone until they come back.</div>`
    : '';
  const items = DATA.teams.map((t, i) => rankRow(t, i)).join('');
  return `
    <div class="hero">
      ${leadStory()}
      <section class="view-head">
        <div>
          <h2 class="page-title"><span class="wk">Week ${m.lastScored + 1}</span>Power Rankings</h2>
          <p>Rest-of-season roster strength, who's left on the schedule, and what's already happened. Tap any team to see why it sits where it does.</p>
        </div>
        <div class="sources">${chips}${updatedText() ? `<span class="chip">${esc(updatedText())}</span>` : ''}</div>
      </section>
    </div>
    ${notice}
    <ol class="ranks enter">${items}</ol>
    ${futuresBoard()}
    <details class="panel glass method-box">
      <summary><h2>How the score works</h2>${XP}</summary>
      <div class="method">
        <p><b>Rest-of-season roster (${Math.round((WEIGHTS.rosProj + WEIGHTS.depth) * 100)}%).</b> Every player gets a consensus value from FantasyPros, DraftSharks and LeagueLogs half-PPR ROS rankings (LeagueLogs counts half, since it tracks the FantasyPros consensus closely). We build each team's best possible starting lineup from DraftSharks' weekly projections, discounted for games a player is expected to miss, then add the value of the top four bench pieces.</p>
        <p><b>Remaining schedule (${Math.round(WEIGHTS.sos * 100)}%).</b> Priced in wins: each team's expected wins against its actual remaining opponents, minus what it would expect against an average opponent. Opponent strength uses the same projection as the playoff odds (about two-thirds projected lineup, one-third points per game so far).</p>
        <p><b>Results so far (${Math.round((WEIGHTS.allPlay + WEIGHTS.pfPerGame + WEIGHTS.winPct + WEIGHTS.form) * 100)}%).</b> All-play win rate (your record if you played every team every week) carries the most weight because it strips out schedule luck. Points per game, actual record and the last three weeks round it out.</p>
        <p><b>Scale.</b> Each input is compared to the rest of the league, so 50 is a dead-average team. The bars under each score show the roster, schedule and results parts separately.</p>
        <p><b>Playoff odds.</b> 10,000 simulations of the remaining regular-season schedule, using each team's projected lineup blended with its actual scoring. Ties in the standings go to points for, like Sleeper.</p>
      </div>
    </details>`;
}

// ---------- championship futures ----------
function futuresBoard() {
  if (!DATA.meta.futures) return '';
  const board = [...DATA.teams].sort((a, b) => b.champPct - a.champPct || b.finalPct - a.finalPct);
  const tile = (t, i) => `<li class="fut ${t.rid === myTeam ? 'mine' : ''} ${i === 0 ? 'fav' : ''}" data-tip="${esc(`${t.name}: wins the title in ${(t.champPct * 100).toFixed(1)}% of simulations, reaches the final in ${(t.finalPct * 100).toFixed(1)}%, makes the playoffs in ${pct(t.playoffPct)}`)}">
      ${avatar(t)}<span class="fn"><b>${esc(t.name)}${champTag(t, false)}</b><small>${(t.champPct * 100).toFixed(1)}% title, ${pct(t.finalPct)} final</small></span><span class="odds-tag">${american(t.champPct)}</span>
    </li>`;
  return `<section class="panel glass futures">
      <h2>Championship futures</h2>
      <p class="sub">Fair odds to win the title, from 10,000 simulations of the rest of the season and the ${DATA.meta.playoffTeams}-team playoff bracket, bye weeks included. No house cut, so they're better than any book would give you.</p>
      <ol class="fut-list">${board.map(tile).join('')}</ol>
    </section>`;
}

// ---------- lead story ----------
function rankSpark(t, w = 84, h = 30) {
  const v = t.rankHistory, n = DATA.teams.length;
  if (v.length < 2) return '';
  const x = (i) => 3 + (i / (v.length - 1)) * (w - 6), y = (r) => 3 + ((r - 1) / (n - 1)) * (h - 6);
  const d = v.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r).toFixed(1)}`).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Power rank by week" data-tip="${esc(`${t.name} power rank by week: ${v.join(', ')}`)}">
    <path d="${d}" stroke="${DATA.color[t.rid]}" pathLength="1"/><circle cx="${x(v.length - 1)}" cy="${y(v[v.length - 1])}" r="3" fill="${DATA.color[t.rid]}"/></svg>`;
}

// the front-page photo: whoever the story is about, with a stamp on the first face saying what kind of day it was
const STAMPS = {
  trade: 'Deal', wire: 'Pickup', cut: 'Cut', flurry: 'Busy', dud: 'Benched?', star: 'Star turn', unbeaten: 'Perfect',
  winless: 'Winless', upset: 'Upset', blowout: 'Boom', nailbiter: 'Phew', explosion: 'Boom', climb: 'Rising',
  fall: 'Sliding', unlucky: 'Robbed', lucky: 'Lucky', giant: 'Giant', gotw: 'Big game',
};
function leadFaces(st) {
  const ts = st.rids.map(team).filter((t) => member(t)).slice(0, 2);
  if (!ts.length) return '';
  const stamp = st.stamp || (st.type === 'streak' ? (st.tone === 'good' ? 'Heater' : 'Skid') : STAMPS[st.type]);
  return `<div class="lead-faces n${ts.length} ${esc(st.tone || '')}" aria-hidden="true">
      ${ts.map((t, k) => `<span class="lf">${headshot(t, 'lead-face')}${champBadge(t)}<span class="cap">${esc(firstName(t))}</span>${k === 0 && stamp ? `<em class="stamp">${esc(stamp)}</em>` : ''}</span>`).join('')}
    </div>`;
}

// three headlines in one square card: swipe, arrows or dots; the active dot's fill is the auto-advance timer
const CAROUSEL_SIZE = 3;
function leadStory() {
  const s = DATA.stories;
  if (!s?.lead) return '';
  const stories = [s.lead, ...s.more].slice(0, CAROUSEL_SIZE);
  const date = new Date(DATA.now).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
  const cast = (st) => st.rids.map(team).filter(Boolean).map((t) => `
    <div class="cast-team">${avatar(t)}
      <div class="cast-name"><b>${esc(t.name)}${champTag(t, false)}</b><small>No. ${t.powerRank} power, ${record(t)}</small></div>
      ${rankSpark(t)}
      <span class="cast-odds"><b>${pct(t.playoffPct)}</b><small>playoffs</small></span>
    </div>`).join('');
  const slide = (st, i) => `
    <article class="slide" id="slide-${i}" role="group" aria-roledescription="slide" aria-label="Headline ${i + 1} of ${stories.length}">
      <div class="slide-top">
        <p class="kicker"><span>${i ? `Also today` : esc(date)}</span><span class="k">${esc(st.kicker)}</span></p>
        ${leadFaces(st)}
      </div>
      <${i ? 'h2' : 'h1'} class="lead-hed">${esc(st.headline)}</${i ? 'h2' : 'h1'}>
      <p class="lead-deck">${esc(st.deck)}</p>
      <div class="cast">${cast(st)}</div>
    </article>`;
  const arrow = (dir, label, d) => `<button type="button" class="car-arrow" data-dir="${dir}" aria-label="${label}"><svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  return `
    <section class="lead-car glass rim" aria-roledescription="carousel" aria-label="Today's headlines">
      <div class="car-track" tabindex="0">${stories.map(slide).join('')}</div>
      ${stories.length > 1 ? `<div class="car-nav">
        ${arrow(-1, 'Previous headline', 'M7.5 1.5 2 7l5.5 5.5')}
        <div class="car-dots">${stories.map((_, i) => `<button type="button" class="car-dot" data-i="${i}" aria-label="Show headline ${i + 1}" aria-controls="slide-${i}"${i ? '' : ' aria-current="true"'}><i></i></button>`).join('')}</div>
        ${arrow(1, 'Next headline', 'M1.5 1.5 7 7l-5.5 5.5')}
      </div>` : ''}
    </section>`;
}

let carouselFit = null, carouselSeen = null;
function bindCarousel() {
  carouselFit = null;
  carouselSeen?.disconnect();
  const car = $('.lead-car'), track = car?.querySelector('.car-track');
  if (!track) return;
  const dots = [...car.querySelectorAll('.car-dot')], n = dots.length;
  if (n < 2) return;
  let idx = 0, steering = 0;
  const slides = [...track.querySelectorAll('.slide')];
  // on phones the card hugs the story that's showing instead of the tallest one, so short stories leave no gap
  const phone = matchMedia('(max-width: 760px)');
  const fit = () => { track.style.height = phone.matches ? `${slides[idx].offsetHeight}px` : ''; };
  const show = (i, resize = true) => {
    idx = (i + n) % n;
    dots.forEach((d, k) => (k === idx ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    if (resize) fit();
  };
  fit();
  document.fonts?.ready.then(fit); // headline height changes once the display font arrives
  carouselFit = fit; // re-run on real width changes (see onWidthChange)
  // Only rotate while the card is mostly on screen. A rotation changes the card's height on phones, and iPhone
  // Safari doesn't anchor scrolling, so rotating while someone reads further down would jolt the whole page.
  carouselSeen = new IntersectionObserver(([e]) => car.classList.toggle('away', e.intersectionRatio < 0.6), { threshold: [0, 0.6] });
  carouselSeen.observe(car);
  const go = (i) => {
    show(i);
    const sl = slides[idx];
    sl.classList.remove('enter');
    void sl.offsetWidth; // restart the animation
    sl.classList.add('enter');
    clearTimeout(steering);
    steering = setTimeout(() => (steering = 0), 700); // ignore scroll events from our own smooth scroll
    track.scrollTo({ left: idx * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  // during a finger swipe, move the dots right away but resize only once the slide has settled
  let settle = 0;
  track.addEventListener('scroll', () => {
    if (steering) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== idx) show(i, false);
    clearTimeout(settle);
    settle = setTimeout(fit, 140);
  }, { passive: true });
  dots.forEach((d) => {
    d.addEventListener('click', () => go(Number(d.dataset.i)));
    d.querySelector('i').addEventListener('animationend', () => go(idx + 1));
  });
  car.querySelectorAll('.car-arrow').forEach((b) => b.addEventListener('click', () => go(idx + Number(b.dataset.dir))));
  // touch has no hover, so hold the timer while a finger is down
  track.addEventListener('pointerdown', () => car.classList.add('held'));
  ['pointerup', 'pointercancel'].forEach((e) => track.addEventListener(e, () => car.classList.remove('held')));
}

function rankRow(t, i) {
  const mv = t.movement > 0 ? `<span class="move up" title="Up ${t.movement} since last week">▲${t.movement}</span>`
    : t.movement < 0 ? `<span class="move down" title="Down ${-t.movement} since last week">▼${-t.movement}</span>`
    : '<span class="move flat" title="No change since last week">–</span>';
  const mine = t.rid === myTeam;
  const ros = t.rosScore != null ? `<div class="split-row"><span>Roster</span><span class="track"><i class="ros" style="width:${t.rosScore}%"></i></span><span>${Math.round(t.rosScore)}</span></div>` : '';
  return `
  <li class="rank ${mine ? 'mine' : ''}" style="--i:${i}" data-rid="${t.rid}">
    <span class="jersey" aria-hidden="true">${t.powerRank}</span>
    <div class="rank-card glass ${t.powerRank <= 3 ? 'rim' : ''}">
      <button class="rank-btn" aria-expanded="false" aria-controls="d-${t.rid}">
        ${avatar(t)}
        <div class="team-line">
          <div class="team-name"><span class="sr-only">Rank ${t.powerRank}:</span><span class="name">${esc(t.name)}</span>${champTag(t)}${mv}${mine ? '<span class="you">You</span>' : ''}</div>
          <div class="team-meta"><span><b>${record(t)}</b></span><span class="owner" title="${esc(t.owner)} on Sleeper">${esc(firstName(t))}</span><span>${f1(t.pfPerGame)} pts/gm</span><span class="tier ${t.tier.key}">${t.tier.label}</span></div>
        </div>
        <div class="meter">
          <div class="meter-top"><span class="score">${t.score.toFixed(1)}</span><small>power score</small></div>
          <div class="split">${ros}${t.sosScore != null ? `<div class="split-row" data-tip="${esc(`${t.name}: ${t.schedWins >= 0 ? '+' : ''}${t.schedWins.toFixed(2)} wins from the remaining schedule vs an average one`)}"><span>Schedule</span><span class="track"><i class="sos" style="width:${t.sosScore}%"></i></span><span>${Math.round(t.sosScore)}</span></div>` : ''}<div class="split-row"><span>Results</span><span class="track"><i class="res" style="width:${t.resultsScore}%"></i></span><span>${Math.round(t.resultsScore)}</span></div></div>
        </div>
        <div class="odds"><b>${pct(t.playoffPct)}</b><small>playoffs</small>${XP}</div>
      </button>
      <div class="detail" id="d-${t.rid}"><div></div></div>
    </div>
  </li>`;
}

// the manager's trading card at the top of an opened team: photo, a stat line, and any league-wide superlatives they own
function superlatives(t) {
  const ts = DATA.teams, mv = (x) => DATA.managerMoves[x.rid] || { moves: 0, tradeNet: 0 };
  const top = (f, dir = 1) => { const ok = ts.filter((x) => f(x) != null); return ok.length ? ok.reduce((a, b) => (dir * (f(b) - f(a)) > 0 ? b : a)) : null; };
  const best = (x) => Math.max(0, ...x.weeks.map((w) => w.pts || 0));
  const out = [];
  const add = (cond, label, tip, tone = 'good') => { if (cond && out.length < 3) out.push({ label, tip, tone }); };
  add(isChamp(t), `Defending champion`, `Won the ${CHAMPION?.season} title. Everyone else is chasing that trophy.`, 'champ');
  add(top(best) === t, 'Season high', `Highest single-week score in the league: ${f1(best(t))}`);
  add(top((x) => x.pfPerGame) === t, 'Points machine', `Most points per game in the league (${f1(t.pfPerGame)})`);
  add(top((x) => x.efficiency) === t, 'Lineup sniper', `Best lineup efficiency in the league (${pct(t.efficiency)} of optimal)`);
  add(top((x) => x.efficiency, -1) === t, 'Bench is loaded', `Worst lineup efficiency in the league (${pct(t.efficiency)} of optimal)`, 'bad');
  add(top((x) => x.luck) === t && t.luck > 0.5, 'Horseshoe', `Luckiest record in the league: ${signed(t.luck)} wins over all-play expectation`, 'bad');
  add(top((x) => x.luck, -1) === t && t.luck < -0.5, 'Snakebitten', `Unluckiest record in the league: ${signed(t.luck)} wins against all-play expectation`);
  add(top((x) => mv(x).moves) === t && mv(t).moves > 0, 'Lives on the wire', `Most completed moves in the league (${mv(t).moves})`, 'neutral');
  add(DATA.meta.hasRos && top((x) => mv(x).tradeNet) === t && mv(t).tradeNet > 1, 'Trade shark', `Best trade ledger in the league (${signed(mv(t).tradeNet)} ROS value)`);
  add(DATA.meta.hasRos && top((x) => mv(x).tradeNet, -1) === t && mv(t).tradeNet < -1, 'Got fleeced', `Worst trade ledger in the league (${signed(mv(t).tradeNet)} ROS value)`, 'bad');
  return out;
}
function managerCard(t) {
  const m = member(t);
  const bestWk = t.weeks.reduce((a, w) => (!a || (w.pts || 0) > a.pts ? w : a), null);
  const moves = DATA.managerMoves[t.rid]?.moves || 0;
  const stat = (v, l, tip) => `<div${tip ? ` data-tip="${esc(tip)}"` : ''}><b>${v}</b><small>${l}</small></div>`;
  const sup = superlatives(t);
  return `<div class="mgr">
      <span class="mgr-ph">${headshot(t, `mgr-face${t.tier.key === 'stinks' ? ' drained' : ''}`)}${champBadge(t)}</span>
      <div class="mgr-id"><small>Manager</small><b>${esc(m ? m.first : t.owner)}</b><span>@${esc(t.owner)}</span></div>
      <div class="mgr-stats">
        ${stat(record(t), 'record')}
        ${bestWk ? stat(f1(bestWk.pts), `best, week ${bestWk.week}`) : ''}
        ${t.efficiency != null ? stat(pct(t.efficiency), 'lineup IQ', `Started ${(t.efficiency * 100).toFixed(1)}% of their best possible lineup`) : ''}
        ${stat(signed(t.luck), 'luck (wins)', `${record(t)} actual vs ${f1(t.expectedWins)} expected wins from all-play`)}
        ${stat(moves, moves === 1 ? 'move' : 'moves')}
      </div>
      ${sup.length ? `<div class="mgr-sup">${sup.map((s) => `<span class="sup ${s.tone}" data-tip="${esc(s.tip)}">${esc(s.label)}</span>`).join('')}</div>` : ''}
    </div>`;
}

function rankDetail(t) {
  const n = DATA.teams.length;
  const why = t.why.map((w, k) => `<li class="${w.tone}" style="--k:${k}"><b>${esc(w.title)}</b><span>${esc(w.text)}</span></li>`).join('');
  const axes = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const rad = DATA.meta.hasRos
    ? radar({ axes, values: axes.map((p) => 1 - (t.posRanks[p] - 1) / (n - 1)), color: DATA.color[t.rid], tips: axes.map((p) => `${p}: ${ordinal(t.posRanks[p])} of ${n} (${f1(t.posGroups[p])} proj pts/wk)`) })
    : '';
  const lineup = DATA.meta.hasRos
    ? `<ul class="lineup">${t.rosLineup.filter(Boolean).map((l) => `<li><span class="slot">${l.slot === 'FLEX' ? 'FLX' : l.slot}</span><span class="pl">${posTag(l.id)}${esc(nameOf(l.id))}</span><span class="pt">${f1(l.pts)}</span></li>`).join('')}</ul>`
    : '';
  const avg = t.weeks.map((w) => {
    const all = DATA.weekly.find((x) => x.week === w.week);
    const vals = all ? Object.values(all.scores) : [];
    return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  });
  const seeds = t.seedDist || [];
  const pt = DATA.meta.playoffTeams;
  const maxSeed = Math.max(...seeds, 0.01);
  return `
    <div class="detail-inner">
      ${managerCard(t)}
      <ul class="why">${why}</ul>
      <div class="detail-side">
        ${rad ? `<div class="mini"><h4>Position groups vs the league</h4><div class="mini-row">${rad}<div>${lineup}</div></div></div>` : ''}
        ${t.schedule.length ? `<div class="mini"><h4>Remaining schedule (opponent power rank, colored by win chance)</h4>
          <div class="sched">${t.schedule.map((g) => { const o = team(g.rid); return `<span class="g" style="--p:${Math.max(0, Math.min(1, (g.pWin - 0.3) / 0.4)).toFixed(3)}" data-tip="${esc(`Week ${g.week} vs ${o.name}: No. ${o.powerRank} power, ${f1(g.proj)} proj pts/wk, ${pct(g.pWin)} win chance`)}"><small>W${g.week}</small><b>${o.powerRank}</b></span>`; }).join('')}</div>
          <p class="sched-sum">${t.schedWins >= 0 ? '+' : ''}${t.schedWins.toFixed(2)} wins vs an average slate, ${t.ranks.schedWins === DATA.teams.length ? 'the toughest' : `${ordinal(DATA.teams.length + 1 - t.ranks.schedWins)}-toughest`} in the league.</p></div>` : ''}
        <div class="mini"><h4>Weekly points (green = win, dashed = league average)</h4>${weeklyBars({ weeks: t.weeks, avg, width: 560, height: 150 })}</div>
        <div class="mini"><h4>Where they finish in 10,000 simulations (seed 1 → ${seeds.length})</h4>
          <div class="seeds" style="--n:${seeds.length}">${seeds.map((p, i) => `<i class="${i < pt ? 'in' : ''}" style="height:${(p / maxSeed) * 100}%" data-tip="Seed ${i + 1}: ${(p * 100).toFixed(1)}%"></i>`).join('')}</div>
          <div class="seed-axis" style="--n:${seeds.length}">${seeds.map((_, i) => `<span>${i + 1}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
}

// ---------- wire ----------
function dayLabel(ts) {
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const today = fmt(new Date()), yest = fmt(new Date(Date.now() - 864e5)), d = fmt(new Date(ts));
  if (d === today) return 'Today';
  if (d === yest) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' });
}
const timeLabel = (ts) => new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

const signed = (x) => `${x > 0 ? '+' : ''}${f1(x)}`;
const tone = (x) => (x > 0.4 ? 'plus' : x < -0.4 ? 'minus' : 'flat');

// in uneven trades the side receiving fewer players gets a credit for the roster spot it frees up
function spotNote(sides) {
  const r = DATA.meta.replacement, freed = sides.filter((s) => s.spots < 0);
  if (!r || !freed.length) return '';
  return ` Includes ${freed.map((s) => `${f1(r * -s.spots)} for the ${-s.spots === 1 ? 'roster spot' : `${-s.spots} roster spots`} ${esc(team(s.rid).name)} frees up`).join(' and ')}, valued at the best few free agents (${f1(r)} each).`;
}

// the people who shook on it, in the corner of each trade card
function dealFaces(sides) {
  const ts = sides.map((s) => team(s.rid)).filter((t) => member(t));
  if (ts.length < 2) return '';
  const names = ts.map(firstName);
  return `<span class="deal"><span class="deal-faces">${ts.map((t) => headshot(t, 'deal-face')).join('')}</span><span>${esc(names.slice(0, -1).join(', '))} and ${esc(names[names.length - 1])} shook on it</span></span>`;
}

function tradeCard(item) {
  const sides = item.sides;
  const best = Math.max(...sides.map((s) => s.net));
  const winner = sides.length === 2 && Math.abs(sides[0].net - sides[1].net) >= 3 ? sides.find((s) => s.net === best) : null;
  const pick = (p) => `${p.season} round ${p.round} pick`;
  return `<li class="trade glass rim">
    <div class="trade-head">${dealFaces(sides)}<span class="when">${esc(dayLabel(item.ts))}, ${timeLabel(item.ts)}, week ${item.week}</span></div>
    <div class="trade-sides">${sides.map((s) => `
      <div class="trade-side ${winner && winner.rid === s.rid ? 'won' : ''}">
        <h4>${avatar(team(s.rid))}<span class="tn">${esc(team(s.rid).name)}</span>${DATA.meta.hasRos ? `<span class="${tone(s.net)}">${signed(s.net)}</span>` : ''}</h4>
        <p class="gets">Receives</p>
        <ul>${s.adds.map((p) => `<li>${posTag(p.id)}${esc(nameOf(p.id))}${DATA.meta.hasRos ? `<span class="pv">${f1(p.v)}</span>` : ''}</li>`).join('')}${s.picks.filter((p) => p.dir === 'in').map((p) => `<li>${pick(p)}</li>`).join('')}${s.faabIn ? `<li>$${s.faabIn} FAAB</li>` : ''}</ul>
      </div>`).join('')}</div>
    ${DATA.meta.hasRos ? `<p class="verdict">${winner ? `By consensus ROS value, <b>${esc(team(winner.rid).name)}</b> came out ahead by ${f1(Math.abs(sides[0].net - sides[1].net))}.` : 'By consensus ROS value this one is close to even.'}${spotNote(sides)}</p>` : ''}
  </li>`;
}

// one row per transaction: adds and drops on their own lines, net value on the right
function wireRow(item) {
  const s = item.sides[0];
  const line = (p, add) => `<div class="${add ? 'add' : 'drop'}"><span class="sign" aria-label="${add ? 'Added' : 'Dropped'}">${add ? '+' : '−'}</span>${posTag(p.id)}<span class="pl">${esc(nameOf(p.id))}</span></div>`;
  const how = item.type === 'waiver' ? `Waiver${item.bid ? ` $${item.bid}` : ''}` : item.type === 'commissioner' ? 'Commish' : '';
  return `<li>
    <span class="t">${timeLabel(item.ts)}${how ? `<small>${how}</small>` : ''}</span>
    <div class="lines">${s.adds.map((p) => line(p, true)).join('')}${s.drops.map((p) => line(p, false)).join('')}</div>
    ${DATA.meta.hasRos ? `<span class="net ${tone(s.net)}" data-tip="Change in consensus ROS value from this move">${signed(s.net)}</span>` : ''}
  </li>`;
}

function viewWire() {
  const mine = (f) => !(wireState.mine && myTeam) || f.sides.some((s) => s.rid === myTeam);
  const trades = DATA.feed.filter((f) => f.type === 'trade' && mine(f));
  const moves = DATA.feed.filter((f) => f.type !== 'trade' && mine(f));
  const showTrades = wireState.type !== 'waiver', showMoves = wireState.type !== 'trade';

  // adds and drops: day, then team (most recent first), then transactions
  const shown = moves.slice(0, wireState.limit);
  const days = [];
  for (const it of shown) {
    const lbl = dayLabel(it.ts);
    if (!days.length || days[days.length - 1].lbl !== lbl) days.push({ lbl, teams: new Map() });
    const rid = it.sides[0].rid;
    const tm = days[days.length - 1].teams;
    if (!tm.has(rid)) tm.set(rid, []);
    tm.get(rid).push(it);
  }
  const teamCard = (rid, items) => {
    const t = team(rid), net = items.reduce((a, it) => a + it.sides[0].net, 0);
    return `<li class="wire-team glass ${rid === myTeam ? 'mine' : ''}">
      <div class="wt-head">${avatar(t)}<div><b>${esc(t.name)}</b><small>${items.length} move${items.length === 1 ? '' : 's'}</small></div>
        ${DATA.meta.hasRos ? `<span class="net ${tone(net)}" data-tip="Net consensus ROS value from these moves">${signed(net)}<small>net value</small></span>` : ''}</div>
      <ul class="wt-rows">${items.map(wireRow).join('')}</ul>
    </li>`;
  };

  const btn = (k, label) => `<button type="button" data-type="${k}" aria-pressed="${wireState.type === k}">${label}</button>`;
  const fa = DATA.freeAgents.slice(0, 10);
  const mm = Object.values(DATA.managerMoves).sort((a, b) => b.moves - a.moves);
  const traders = Object.values(DATA.managerMoves).filter((m) => m.tradeNet !== 0).sort((a, b) => b.tradeNet - a.tradeNet);
  const isToday = (f) => dayLabel(f.ts) === 'Today';
  const today = DATA.feed.filter(isToday).length;
  const wk = DATA.meta.lastScored + 1;
  const thisWeek = DATA.feed.filter((f) => f.week === wk);
  const active = {};
  thisWeek.forEach((f) => f.sides.forEach((s) => (active[s.rid] = (active[s.rid] || 0) + 1)));
  const busiest = Object.entries(active).sort((a, b) => b[1] - a[1])[0];
  const stat = (v, l, face = '') => `<div${face ? ' class="has-face"' : ''}>${face}<span><b>${v}</b><small>${l}</small></span></div>`;
  return `
    <section class="view-head">
      <div>
        <h1><span class="wk">${today ? `${today} move${today === 1 ? '' : 's'} today` : 'Quiet day so far'}</span>The Wire</h1>
        <p>Trades up top, adds and drops below, grouped by day and team. Numbers are the consensus rest-of-season value a move gained or gave up.</p>
      </div>
    </section>
    <div class="wire-stats glass">
      ${stat(today, 'moves today')}
      ${stat(thisWeek.filter((f) => f.type !== 'trade').length, `adds and drops in week ${wk}`)}
      ${stat(thisWeek.filter((f) => f.type === 'trade').length, `trades in week ${wk}`)}
      ${busiest ? (() => { const bt = team(busiest[0]), m = member(bt); return stat(esc(m ? m.first : short(bt.name, 18)), `busiest this week, ${busiest[1]} moves${m ? ` for ${esc(short(bt.name, 18))}` : ''}`, m ? headshot(bt, 'stat-face') : ''); })() : ''}
    </div>
    <div class="two-col">
      <div>
        <div class="filters" role="group" aria-label="Filter moves">
          ${btn('all', 'Everything')}${btn('trade', `Trades (${trades.length})`)}${btn('waiver', `Adds and drops (${moves.length})`)}
          ${myTeam ? `<button type="button" data-mine aria-pressed="${wireState.mine}">Only my team</button>` : ''}
        </div>
        ${showTrades ? `<section class="wire-sec">
          <h2 class="sec-title"><span>Trades</span><small>${trades.length} this season</small></h2>
          ${trades.length ? `<ul class="moves">${trades.slice(0, wireState.trades).map(tradeCard).join('')}</ul>` : '<p class="empty glass panel">No trades yet.</p>'}
          ${trades.length > wireState.trades ? `<div class="filters"><button type="button" data-more-trades>Show all ${trades.length} trades</button></div>` : ''}
        </section>` : ''}
        ${showMoves ? `<section class="wire-sec">
          <h2 class="sec-title"><span>Adds and drops</span><small>${moves.length} this season</small></h2>
          ${days.length ? days.map((d) => `<section class="day"><h3>${esc(d.lbl)}</h3><ul class="moves">${[...d.teams].map(([rid, items]) => teamCard(rid, items)).join('')}</ul></section>`).join('') : '<p class="empty glass panel">No moves match these filters yet.</p>'}
          ${moves.length > shown.length ? `<div class="filters"><button type="button" data-more>Show older moves (${moves.length - shown.length} more)</button></div>` : ''}
        </section>` : ''}
      </div>
      <aside>
        ${DATA.meta.hasRos ? `<section class="panel glass"><h2>Best available</h2><p class="sub">Highest consensus ROS value not on a roster right now.</p>
          <ol class="fa-list">${fa.map((p, i) => `<li><span class="n">${i + 1}</span><span>${posTag(p.id)}${esc(nameOf(p.id))} <span class="when">${p.pos}${p.prk}</span></span><span class="v" data-tip="Consensus value ${f1(p.v)}, ${f1(p.wk)} proj pts/wk">${f1(p.v)}</span></li>`).join('') || '<li>Nothing notable on waivers.</li>'}</ol></section>` : ''}
        <section class="panel glass"><h2>Busiest managers</h2><p class="sub">Completed moves this season, with net ROS value added.</p>
          ${mm.map((m) => `<div class="leader"><span>${avatar(team(m.rid), "avatar xs")}${esc(team(m.rid).name)}</span><span>${m.moves}${DATA.meta.hasRos ? ` <span class="${m.net >= 0 ? 'plus' : 'minus'}">${signed(m.net)}</span>` : ''}</span></div>`).join('')}
        </section>
        ${traders.length && DATA.meta.hasRos ? `<section class="panel glass"><h2>Trade ledger</h2><p class="sub">Net ROS value from trades at today's consensus. In uneven trades, each roster spot freed up counts as one top free agent (${f1(DATA.meta.replacement)}).</p>
          ${traders.map((m) => `<div class="leader"><span>${avatar(team(m.rid), "avatar xs")}${esc(team(m.rid).name)}</span><span class="${m.tradeNet >= 0 ? 'plus' : 'minus'}">${signed(m.tradeNet)}</span></div>`).join('')}</section>` : ''}
      </aside>
    </div>`;
}

// ---------- matchups ----------
function viewMatchups() {
  const pv = DATA.previews;
  const wk = pv[0]?.week;
  return `
    <section class="view-head">
      <div>
        <h1><span class="wk">${wk ? `Week ${wk}` : 'Off week'}</span>Matchups</h1>
        <p>Projections use each team's best healthy lineup for the week (byes and injuries count as zero), blended with how they've actually been scoring. Win odds assume a typical week-to-week swing of about ${Math.round(DATA.meta.sd)} points. Open any game for the lineups slot by slot, and get your pick in before kickoff.</p>
      </div>
    </section>
    ${gameOfTheWeek()}
    ${bullBoard()}
    ${pv.length ? `<div class="matchups">${pv.map((p, i) => {
      const a = team(p.a), b = team(p.b);
      const isKey = DATA.key && DATA.key.i === i;
      const swing = (t) => (t.playoffIfWin != null && t.playoffIfLoss != null ? Math.round((t.playoffIfWin - t.playoffIfLoss) * 100) : null);
      const sa = swing(a), sb = swing(b);
      const stakes = sa != null && sb != null ? `Playoff odds on the line: ${sa} pts for ${esc(a.name)}, ${sb} for ${esc(b.name)}.` : '';
      return `<article class="mu glass ${p.a === myTeam || p.b === myTeam ? 'rim' : ''} ${isKey ? 'key' : ''}" id="mu-${i}" data-i="${i}">
        ${isKey ? '<span class="key-tag">Game of the week</span>' : ''}
        <p class="mu-quip">${esc(DATA.quips[i])}</p>
        <div class="mu-teams">
          <div class="mu-team">${avatar(a)}<span class="tn">${esc(a.name)}${champTag(a, false)}</span><small>#${a.powerRank} power, ${record(a)}</small>${liveTag(p.liveA)}<span class="pr">${f1(p.projA)}</span>${bullTag(p.a)}</div>
          <span class="vs" aria-hidden="true">vs</span>
          <div class="mu-team right">${avatar(b)}<span class="tn">${esc(b.name)}${champTag(b, false)}</span><small>#${b.powerRank} power, ${record(b)}</small>${liveTag(p.liveB)}<span class="pr">${f1(p.projB)}</span>${bullTag(p.b)}</div>
        </div>
        <div class="wp"><div class="wp-bar" role="img" aria-label="${esc(a.name)} ${pct(p.winA)}, ${esc(b.name)} ${pct(1 - p.winA)}"><i style="width:${p.winA * 100}%"></i><i style="width:${(1 - p.winA) * 100}%"></i></div>
          <div class="wp-labels"><span>${pct(p.winA)}</span><span>${pct(1 - p.winA)}</span></div></div>
        ${betLine(p, a, b, i, stakes)}
        <div class="fan-slot" data-i="${i}">${fanBlock(p)}</div>
        <button type="button" class="mu-more" aria-expanded="false" aria-controls="mud-${i}"><span>Lineup breakdown</span>${XP}</button>
        <div class="detail mu-detail" id="mud-${i}"><div></div></div>
      </article>`;
    }).join('')}</div>` : '<p class="empty glass panel">No regular-season matchups left to preview.</p>'}`;
}

// points already on the board this week (games played so far); the big number is that plus the rest projected
const liveTag = (pts) => (pts == null ? '' : `<small class="live" data-tip="Points scored in games already played. The big number adds the projection for everyone still to play.">${f1(pts)} scored so far</small>`);

// ---------- fan picks ----------
// a random id kept on this device; re-voting from the same device replaces its pick
let VOTER = null;
const voterId = () => {
  if (VOTER) return VOTER;
  VOTER = store.get('ph-voter');
  if (!VOTER) {
    VOTER = crypto.randomUUID?.() || `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    store.set('ph-voter', VOTER);
  }
  return VOTER;
};
const pairKey = (p) => [p.a, p.b].sort((x, y) => x - y).join('-');

function fanBlock(p) {
  if (!VOTES || VOTES.week !== p.week) return '';
  const pair = pairKey(p), c = VOTES.counts[pair] || {}, mine = VOTES.mine?.[pair];
  const na = c[p.a] || 0, nb = c[p.b] || 0, n = na + nb, fa = n ? na / n : 0.5;
  const pick = (t) => `<button type="button" class="pick ${String(t.rid) === mine ? 'on' : ''}" data-pair="${pair}" data-pick="${t.rid}" aria-pressed="${String(t.rid) === mine}">${esc(short(t.name, 18))}</button>`;
  // the split stays hidden until you've picked, so nobody just follows the crowd
  const reveal = n > 0 && (mine || !VOTES.open);
  const head = !VOTES.open ? 'Fan picks (voting closed)' : mine ? 'Your pick is in. Tap the other side to switch.' : 'Who wins? Cast your pick';
  return `<div class="fan">
      <div class="fan-head"><span>${head}</span><small>${n} fan vote${n === 1 ? '' : 's'}</small></div>
      ${VOTES.open ? `<div class="picks">${pick(team(p.a))}${pick(team(p.b))}</div>` : ''}
      ${reveal ? `<div class="wp-bar fan-bar" role="img" aria-label="Fans: ${pct(fa)} ${esc(team(p.a).name)}, ${pct(1 - fa)} ${esc(team(p.b).name)}"><i style="width:${fa * 100}%"></i><i style="width:${(1 - fa) * 100}%"></i></div>
        <div class="wp-labels"><span>Fans ${pct(fa)}</span><span>${pct(1 - fa)}</span></div>` : ''}
    </div>`;
}
function paintVotes(err) {
  document.querySelectorAll('.fan-slot').forEach((el) => {
    const i = Number(el.dataset.i);
    el.innerHTML = fanBlock(DATA.previews[i]) + (err && err.i === i ? `<p class="fan-err">${esc(err.msg)}</p>` : '');
  });
}
async function loadVotes() {
  const wk = DATA.previews[0]?.week;
  if (!wk || RAW.isDemo) return; // the demo snapshot and the single-file preview never call the vote store
  try {
    const r = await fetch(`/api/votes?week=${wk}&voter=${encodeURIComponent(voterId())}`);
    if (!r.ok) return; // unavailable: voting stays hidden
    const body = await r.json();
    if (!body.enabled) return; // store not connected yet
    VOTES = body;
    paintVotes();
  } catch { /* offline or no API: voting stays hidden */ }
}
async function castVote(btn) {
  const pair = btn.dataset.pair, pick = btn.dataset.pick, i = Number(btn.closest('.fan-slot').dataset.i);
  const prev = VOTES.mine[pair];
  if (prev === pick) return;
  const before = JSON.stringify(VOTES);
  // show it right away, then confirm with the server
  const c = (VOTES.counts[pair] ||= {});
  if (prev) c[prev] = Math.max(0, (c[prev] || 1) - 1);
  c[pick] = (c[pick] || 0) + 1;
  VOTES.mine[pair] = pick;
  paintVotes();
  try {
    const r = await fetch('/api/votes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week: VOTES.week, pair, pick, voter: voterId() }) });
    const body = await r.json().catch(() => ({}));
    // the server's own reasons (closed, already voted from this network) are final; outages are worth a retry
    if (!r.ok) throw new Error(r.status >= 500 || !body.error ? 'Vote not saved. Try again in a moment.' : `${body.error}.`);
    VOTES = body;
    paintVotes();
  } catch (e) {
    VOTES = JSON.parse(before);
    paintVotes({ i, msg: e instanceof TypeError ? 'Vote not saved: no connection. Try again in a moment.' : e.message });
  }
}

// normal CDF (Abramowitz-Stegun), for the prop odds below
function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2);
  const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - q : q;
}
// sportsbook-style line from the projections: the moneyline stays on the card, everything else sits behind "More odds"
function betLine(p, a, b, i, stakes) {
  const fav = p.projA >= p.projB ? a : b, margin = Math.abs(p.projA - p.projB);
  const even = margin < 0.25;
  // the margin is normal with the two teams' week spreads combined, the same model as the win odds
  const sdOf = (t) => t.sdWeek?.[p.week] ?? DATA.meta.sd, sd = Math.hypot(sdOf(a), sdOf(b));
  const within = (x) => phi((x - (p.projA - p.projB)) / sd) - phi((-x - (p.projA - p.projB)) / sd);
  const close = within(5), blowout = 1 - within(20);
  const B = DATA.bull && DATA.bull.state !== 'final' && DATA.bull.rows.length ? DATA.bull : null;
  const bull = (rid) => B.rows.find((r) => r.rid === rid)?.pWin ?? 0;
  const tile = (label, val, sub = '', tip = '') => `<span${tip ? ` data-tip="${esc(tip)}"` : ''}><small>${label}</small><b>${val}</b>${sub ? `<small class="who">${sub}</small>` : ''}</span>`;
  const pair = (label, va, vb, tip) => `<span class="pair" data-tip="${esc(tip)}"><small>${label}</small><b class="a">${va}</b><b class="b">${vb}</b></span>`;
  return `
    <div class="ml" data-tip="Fair moneyline from the win odds: minus is the favourite (bet that much to win 100), plus is the underdog (what 100 wins).">
      <b class="a">${american(p.winA)}</b><small>Moneyline</small><b class="b">${american(1 - p.winA)}</b>
    </div>
    <button type="button" class="odds-more" aria-expanded="false" aria-controls="odds-${i}"><span>More odds</span>${XP}</button>
    <div class="detail odds-detail" id="odds-${i}"><div>
      <div class="line">
        ${tile('Spread', even ? 'Pick' : `-${half(margin)}`, even ? '' : esc(fav.name), 'From the projected margin')}
        ${tile('Total', half(p.projA + p.projB), 'combined points', 'Projected combined score')}
        ${pair('Team totals', f1(p.projA), f1(p.projB), `${a.name} ${f1(p.projA)}, ${b.name} ${f1(p.projB)} projected`)}
        ${tile('Nail-biter', american(close), 'margin under 5', `${pct(close)} chance the final margin is under 5 points`)}
        ${tile('Blowout', american(blowout), 'margin 20+', `${pct(blowout)} chance the final margin is 20 points or more`)}
        ${B ? pair(`Closest to ${B.target}`, american(bull(p.a)), american(bull(p.b)), `Money week: odds each team lands closest to ${B.target} of all twelve and takes ${money(MONEY_WEEK.prize)}`) : ''}
      </div>
      ${stakes ? `<p class="mu-note">${stakes}</p>` : ''}
    </div></div>`;
}

// ---------- matchup breakdown ----------
const bdCache = {};
function matchupDetail(i) {
  const pv = DATA.previews[i], bd = (bdCache[i] ||= breakdown(DATA, pv));
  const A = team(pv.a), B = team(pv.b);
  const max = Math.max(1, ...bd.rows.flatMap((r) => [r.a?.proj || 0, r.b?.proj || 0]));
  const flag = (p) => {
    if (p.played) return '<em class="st fin" title="Game over: these points are final">FINAL</em>';
    if (p.bye) return '<em class="st out" title="On a bye this week">BYE</em>';
    if (!p.status) return '';
    const label = p.out ? (p.status === 'IR' ? 'IR' : 'OUT') : p.status[0];
    return `<em class="st ${p.out ? 'out' : p.status === 'Questionable' ? 'q' : 'd'}" title="${esc(p.status)}">${esc(label)}</em>`;
  };
  const who = (p, side) => p
    ? `<div class="h2h-p ${side}"><b><span class="full">${esc(p.name)}</span><span class="short">${esc(shortName(p))}</span></b><small>${esc([p.team, p.pos].filter(Boolean).join(' '))}${flag(p)}</small></div>`
    : `<div class="h2h-p ${side} empty"><b>Empty</b><small>nobody set</small></div>`;
  const tip = (p) => !p ? 'Empty slot'
    : p.played ? `${p.name}: scored ${f1(p.proj)} (game over), ${f1(p.pre)} projected`
    : `${p.name}: ${p.bye ? 'on a bye, ' : p.out ? `${p.status}, ` : ''}${f1(p.proj)} projected${p.floor != null && p.proj > 0 ? `, floor ${f1(p.floor)} to ceiling ${f1(p.ceil)}` : ''}`;
  const row = (r) => {
    const pa = r.a?.proj || 0, pb = r.b?.proj || 0;
    return `<div class="h2h-row ${r.edge > 0.5 ? 'win-a' : r.edge < -0.5 ? 'win-b' : 'even'}" data-tip="${esc(`${tip(r.a)}. ${tip(r.b)}.`)}">
      ${who(r.a, 'a')}<b class="pts a">${f1(pa)}</b><span class="slot">${r.slot === 'FLEX' ? 'FLX' : esc(r.slot)}</span><b class="pts b">${f1(pb)}</b>${who(r.b, 'b')}
      <div class="h2h-bar"><span class="a"><i style="width:${(pa / max) * 100}%"></i></span><span class="b"><i style="width:${(pb / max) * 100}%"></i></span></div>
    </div>`;
  };
  const src = bd.source.a === 'set' && bd.source.b === 'set' ? 'Starting lineups as set in Sleeper'
    : bd.source.a !== 'set' && bd.source.b !== 'set' ? "Lineups aren't set yet, so these are each team's best projected starters"
    : `${esc((bd.source.a === 'set' ? B : A).name)} hasn't set a lineup, so theirs is the best projected one`;
  const gmax = Math.max(1, ...bd.groups.map((g) => Math.abs(g.edge)));
  const grp = (g) => {
    const side = g.edge > 0.25 ? 'a' : g.edge < -0.25 ? 'b' : 'n';
    const sum = (k) => g.rows.reduce((a, r) => a + (r[k]?.proj || 0), 0);
    return `<div class="grp ${side}" data-tip="${esc(`${g.key}: ${A.name} ${f1(sum('a'))}, ${B.name} ${f1(sum('b'))}`)}"><span class="g">${g.key}</span><span class="gtrack"><i style="width:${(Math.abs(g.edge) / gmax) * 50}%"></i></span><b>${side === 'n' ? 'Even' : `+${f1(Math.abs(g.edge))}`}</b></div>`;
  };
  return `
    <div class="bd">
      <div class="bd-main">
        <div class="bd-head"><div class="a">${avatar(A)}<b>${f1(bd.totals.a)}</b><span>${esc(A.name)}</span></div><p>${src}</p><div class="b">${avatar(B)}<b>${f1(bd.totals.b)}</b><span>${esc(B.name)}</span></div></div>
        <div class="h2h">${bd.rows.map(row).join('')}</div>
      </div>
      <div class="bd-side">
        <h4>Where it's won</h4>
        <div class="grp-legend"><span class="a">${esc(short(A.name, 16))}</span><span class="b">${esc(short(B.name, 16))}</span></div>
        ${bd.groups.map(grp).join('')}
        <h4>Things to watch</h4>
        <ul class="watch">${bd.watch.map((w) => `<li class="${w.tone}">${esc(w.text)}</li>`).join('') || '<li class="n">Nothing unusual: both lineups are set and healthy.</li>'}</ul>
      </div>
    </div>
    <p class="bd-note">${DATA.live ? 'Players marked final show their actual points, locked in for the week. ' : ''}Player projections are DraftSharks rest-of-season weekly averages, with players on a bye or ruled out counted as zero. Hover or tap a row for floor and ceiling.</p>`;
}

function toggleMatchup(card) {
  const open = !card.classList.contains('open');
  const holder = card.querySelector('.mu-detail > div');
  if (open && !holder.innerHTML) holder.innerHTML = matchupDetail(Number(card.dataset.i));
  // Desktop: the open card takes the whole row. Glide every card from its old spot to its new one (FLIP, transform
  // only) instead of letting the grid jump. Phones are one column already, so nothing moves sideways there.
  const grid = card.parentElement, cards = [...grid.children];
  const glide = !lite() && !calm() && getComputedStyle(grid).gridTemplateColumns.split(' ').length > 1;
  const first = glide ? new Map(cards.map((c) => [c, c.getBoundingClientRect()])) : null;
  card.classList.toggle('open', open);
  card.querySelector('.mu-more').setAttribute('aria-expanded', open);
  if (!glide) return;
  for (const c of cards) {
    const a = first.get(c), b = c.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }
  const top = card.getBoundingClientRect().top;
  if (open && (top < 90 || top > innerHeight * 0.6)) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function gameOfTheWeek() {
  const k = DATA.key;
  if (!k) return '';
  const { p } = k;
  const a = team(p.a), b = team(p.b);
  return `
    <section class="gotw glass rim" aria-labelledby="gotw-hed">
      ${faceoff(p, a, b)}
      <div class="gotw-copy">
        <p class="kicker"><span>Game of the week</span><span class="k">${esc(a.name)} vs ${esc(b.name)}</span></p>
        <h2 id="gotw-hed">${esc(k.headline)}</h2>
        <p class="lead-deck">${esc(k.deck)}</p>
        <div class="gotw-score">
          <div><span class="tn">${esc(a.name)}</span><b>${f1(p.projA)}</b></div>
          <div class="wp-bar" role="img" aria-label="${esc(a.name)} ${pct(p.winA)}, ${esc(b.name)} ${pct(1 - p.winA)}"><i style="width:${p.winA * 100}%"></i><i style="width:${(1 - p.winA) * 100}%"></i></div>
          <div class="right"><span class="tn">${esc(b.name)}</span><b>${f1(p.projB)}</b></div>
        </div>
        <button type="button" class="gotw-more" data-open="${k.i}">Lineup breakdown${XP}</button>
      </div>
      <div class="gotw-chart">
        ${playoffDrive(a, b)}
        <p class="sub">Picked from this week's slate by stakes (${Math.round(p.stakes * 100)} combined points of playoff odds on the line, ${Math.round(k.stakesNorm * 100)}% of the week's biggest) and closeness (${Math.round(k.closeness * 100)} out of 100, where 100 is a dead-even projection).</p>
      </div>
    </section>`;
}

// the fight-poster header: both managers nose to nose, blue corner against amber corner
function faceoff(p, a, b) {
  const favA = p.winA >= 0.5;
  const side = (t, k, win, fav) => `
    <div class="fo-side ${k}">
      <span class="fo-ph">${headshot(t, 'fo-face')}${champBadge(t)}</span>
      <div class="fo-tag">
        ${fav ? '<span class="fo-fav">Favourite</span>' : '<span class="fo-fav dog">Underdog</span>'}
        <b>${esc(firstName(t))}</b>
        <small>${esc(t.name)}, ${record(t)}</small>
        <span class="fo-odds">${pct(win)}<small> to win</small></span>
      </div>
    </div>`;
  return `<div class="faceoff" aria-hidden="true">${side(a, 'a', p.winA, favA)}<span class="fo-vs"><i>vs</i></span>${side(b, 'b', 1 - p.winA, !favA)}</div>`;
}

// The playoff drive: each team is a football on a field that runs from 0% playoff odds (its own goal line) to 100%
// (the end zone). Pick a result and both balls move to where the simulations say that result leaves them.
function playoffDrive(a, b) {
  const odds = (t, won) => (won ? t.playoffIfWin : t.playoffIfLoss) ?? t.playoffPct;
  const states = {
    now: [a.playoffPct, b.playoffPct],
    a: [odds(a, true), odds(b, false)],
    b: [odds(a, false), odds(b, true)],
  };
  const lane = (t, side, k) => `
    <div class="lane ${side}" style="${Object.entries(states).map(([s, v]) => `--at-${s}:${v[k].toFixed(3)}`).join(';')}">
      <span class="ghost" aria-hidden="true"></span>
      <span class="runner" aria-hidden="true"><span class="ball"><b class="ball-pct"></b><small class="ball-gain"></small></span></span>
    </div>`;
  const btn = (s, label) => `<button type="button" data-s="${s}" aria-pressed="${s === 'now'}">${label}</button>`;
  return `
    <div class="drive" data-s="now" data-a="${esc(a.name)}" data-b="${esc(b.name)}" data-states='${JSON.stringify(states)}'>
      <div class="drive-head">
        <h4>The playoff drive</h4>
        <p class="drive-key"><span class="a">${headshot(a, 'avatar')}${esc(a.name)}</span><span class="b">${headshot(b, 'avatar')}${esc(b.name)}</span></p>
        <div class="drive-pick" role="group" aria-label="Show playoff odds after a result">${btn('now', 'Today')}${btn('a', `${esc(short(a.name, 14))} win`)}${btn('b', `${esc(short(b.name, 14))} win`)}</div>
      </div>
      <div class="drive-field">
        <span class="endzone" aria-hidden="true">Playoffs</span>
        ${[0.25, 0.5, 0.75].map((x) => `<span class="yard" style="--y:${x}" aria-hidden="true">${x * 100}</span>`).join('')}
        ${lane(a, 'a', 0)}${lane(b, 'b', 1)}
      </div>
      <p class="drive-note" aria-live="polite"></p>
    </div>`;
}

// fill in the drive's numbers and sentence for the picked result
function paintDrive(el, s) {
  const st = JSON.parse(el.dataset.states), names = [el.dataset.a, el.dataset.b];
  el.dataset.s = s;
  el.querySelectorAll('.drive-pick button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.s === s));
  el.querySelectorAll('.lane').forEach((ln, k) => {
    const v = st[s][k], d = v - st.now[k], pts = Math.round(d * 100);
    ln.querySelector('.ball-pct').textContent = pct(v);
    const g = ln.querySelector('.ball-gain');
    g.textContent = s === 'now' || !pts ? '' : `${pts > 0 ? '+' : ''}${pts}`;
    g.className = `ball-gain ${pts > 0 ? 'up' : 'down'}`;
  });
  const move = (k) => { const pts = Math.round((st[s][k] - st.now[k]) * 100); return `${names[k]} ${pts >= 0 ? 'climbs' : 'drops'} to ${pct(st[s][k])} (${pts >= 0 ? '+' : ''}${pts})`; };
  el.querySelector('.drive-note').textContent = s === 'now'
    ? `Today ${names[0]} sits at ${pct(st.now[0])} playoff odds and ${names[1]} at ${pct(st.now[1])}. Pick a result to see where it sends them.`
    : `If ${names[s === 'a' ? 0 : 1]} wins: ${move(s === 'a' ? 0 : 1)}, ${move(s === 'a' ? 1 : 0)}.`;
}

// ---------- trade lab ----------
function setMyTeam(rid) {
  myTeam = rid || null;
  store.set('ph-my-team', myTeam ? String(myTeam) : null);
  $('#my-team').value = myTeam ? String(myTeam) : '';
  route();
}

function viewTrades() {
  const teamSelect = `<label class="trade-pick"><span>Trade ideas for</span><select id="trade-team"><option value="">Choose your team</option>${[...DATA.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => `<option value="${t.rid}" ${t.rid === myTeam ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>`;
  const head = `
    <section class="view-head">
      <div>
        <h1><span class="wk">${myTeam ? esc(team(myTeam).name) : 'Pick your team'}</span>Trade Lab</h1>
        <p>Every 1-for-1, 2-for-1 and 1-for-2 swap with the rest of the league, kept only when both starting lineups get better and the consensus values line up. Ranked by how much the deal helps you, with a bonus for deals the other side should like too.</p>
      </div>
      <div>${teamSelect}</div>
    </section>`;
  if (!DATA.meta.hasRos) return head + '<p class="empty glass panel">Trade ideas need the rest-of-season rankings, which are unavailable right now.</p>';
  if (!myTeam) return head + '<p class="empty glass panel">Choose your team above to see trade ideas built around its needs.</p>';

  const me = team(myTeam), n = DATA.teams.length;
  const all = (tradeState.cache[myTeam] ||= tradeIdeas(DATA, myTeam));
  const ideas = tradeState.shape === 'all' ? all : all.filter((i) => i.shape === tradeState.shape);
  const count = (k) => (k === 'all' ? all.length : all.filter((i) => i.shape === k).length);
  const btn = (k, label) => `<button type="button" data-shape="${k}" aria-pressed="${tradeState.shape === k}">${label} (${count(k)})</button>`;
  const needs = ['QB', 'RB', 'WR', 'TE'].map((p) => {
    const r = me.posRanks[p], cls = r >= n - 3 ? 'need' : r <= 3 ? 'strong' : '';
    return `<span class="need-chip ${cls}" data-tip="${esc(`${p}: ${ordinal(r)} of ${n} in projected starter points (${f1(me.posGroups[p])} pts/wk)`)}"><b>${p}</b>${ordinal(r)}</span>`;
  }).join('');
  const maxGain = Math.max(0.5, ...all.flatMap((i) => [i.gainMe, i.gainThem]));
  const proj = (id) => DATA.helpers.effWeekly(id);
  const list = (ids) => `<ul>${ids.map((id) => `<li>${posTag(id)}<span class="pl">${esc(nameOf(id))}</span><span class="pv" data-tip="Consensus value ${f1(DATA.helpers.valueOf(id))}, ${f1(proj(id))} proj pts/wk">${f1(DATA.helpers.valueOf(id))}</span></li>`).join('')}</ul>`;
  const bar = (label, v) => `<div class="gain"><span>${label}</span><span class="track"><i style="width:${Math.max(3, (v / maxGain) * 100)}%"></i></span><b>+${f1(v)}</b></div>`;
  const card = (i, k) => {
    const them = team(i.partner);
    const band = Math.max(6, 0.15 * (i.get.concat(i.give).reduce((a, id) => a + DATA.helpers.valueOf(id), 0)) / 2);
    const pos = 50 + Math.max(-1, Math.min(1, i.value / band)) * 50;
    return `<article class="idea glass ${k === 0 ? 'rim' : ''}">
      <header class="idea-head">${avatar(them)}<div><small>Idea ${k + 1}, ${i.shape}</small><b>With ${esc(them.name)}</b></div>
        <span class="idea-shape">No. ${them.powerRank} power</span></header>
      <div class="idea-swap">
        <div class="give"><h4>You give</h4>${list(i.give)}</div>
        <span class="swap-arrow" aria-hidden="true"><svg width="22" height="16" viewBox="0 0 22 16"><path d="M1 5h17l-4-4M21 11H4l4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <div class="get"><h4>You get</h4>${list(i.get)}</div>
      </div>
      <div class="idea-impact">
        ${bar('Your lineup', i.gainMe)}
        ${bar(`${esc(short(them.name, 16))}`, i.gainThem)}
        <div class="balance" data-tip="${esc(i.fair)}"><span>Value balance</span><span class="scale"><i class="mid"></i><i class="mark" style="left:${pos}%"></i></span><b>${i.value > 0 ? '+' : ''}${f1(i.value)}</b></div>
      </div>
      <ul class="idea-why">${i.why.map((w) => `<li>${esc(w)}</li>`).join('')}<li class="fair">${esc(i.fair)}</li></ul>
      ${k === 0 && member(them) ? `<p class="pitch">${headshot(them, 'pitch-face')}<span>Best pitch on the board. Time to text <b>${esc(firstName(them))}</b>.</span></p>` : ''}
    </article>`;
  };
  return head + `
    <div class="trade-bar">
      <div class="needs"><span class="lbl">Your position ranks</span>${needs}</div>
      <div class="filters" role="group" aria-label="Trade shape">${btn('all', 'All')}${btn('1 for 1', '1 for 1')}${btn('2 for 1', '2 for 1')}${btn('1 for 2', '1 for 2')}</div>
    </div>
    <p class="sub trade-legend">Green bars are projected starting-lineup points per week gained by each side. The dot on the value balance is your side of the consensus value: right of center you come out ahead, left of center they do. Uneven trades count the cut player or the free-agent pickup they force.</p>
    ${ideas.length ? `<div class="ideas">${ideas.map(card).join('')}</div>`
      : `<p class="empty glass panel">${all.length ? 'No ideas of this shape. Try another filter.' : 'No trade both sides should take right now. Your roster is balanced enough that every fair deal makes one lineup worse. Check back after the next round of waivers or injuries.'}</p>`}`;
}

// ---------- nerd lab ----------
function viewLab() {
  const teams = DATA.teams;
  const n = teams.length;
  const weeks = DATA.history.map((h) => h.week);
  const focus = myTeam || null;
  const bump = bumpChart({
    series: teams.map((t) => ({ id: t.rid, label: t.name, short: short(t.name, 14), color: DATA.color[t.rid], values: t.rankHistory, img: t.rid === focus ? faceSrc(t) : null })),
    weeks, n, focus,
  });
  const luckRows = [...teams].sort((a, b) => b.luck - a.luck).map((t) => ({
    label: short(t.name, 20), value: t.luck,
    tip: `${t.name}: ${record(t)} actual vs ${f1(t.expectedWins)} expected wins from a ${t.allPlayW.toFixed(0)}-${t.allPlayL.toFixed(0)} all-play record`,
  }));
  const avgPf = teams.reduce((a, t) => a + t.pfPerGame, 0) / n;
  const sc = scatter({
    points: teams.map((t) => ({ id: t.rid, x: t.pfPerGame, y: t.pa / Math.max(1, t.games), color: DATA.color[t.rid], img: faceSrc(t), label: t.name, short: short(t.name, 12), tip: `${t.name}: ${f1(t.pfPerGame)} for, ${f1(t.pa / Math.max(1, t.games))} against per game` })),
    xLabel: 'Points for per game', yLabel: 'Points against per game', refX: avgPf, refY: avgPf,
    quadrants: ['Snakebitten', 'Good but unlucky', 'Struggling', 'Cruising'], focus,
  });
  const weeklyHeat = heatTable({
    caption: 'Weekly scoring finish',
    rows: teams.map((t) => short(t.name, 18)),
    cols: DATA.weekly.map((w) => `W${w.week}`),
    n,
    cells: teams.map((t) => DATA.weekly.map((w) => {
      const wk = t.weeks.find((x) => x.week === w.week);
      return wk ? { rank: wk.rank, label: f1(wk.pts), tip: `${t.name}, week ${w.week}: ${f1(wk.pts)} pts, ${ordinal(wk.rank)} of ${n}${wk.result ? ` (${wk.result})` : ''}` } : null;
    })),
  });
  const posHeat = DATA.meta.hasRos ? heatTable({
    caption: 'Position group rank',
    rows: teams.map((t) => short(t.name, 18)),
    cols: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
    n,
    cells: teams.map((t) => ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => ({ rank: t.posRanks[p], label: t.posRanks[p], tip: `${t.name} ${p}: ${ordinal(t.posRanks[p])} (${f1(t.posGroups[p])} proj pts/wk)` }))),
  }) : '';
  const schedTeams = [...teams].sort((a, b) => a.schedWins - b.schedWins);
  const schedHeat = schedTeams[0]?.schedule.length ? heatTable({
    caption: 'Remaining schedule',
    rows: schedTeams.map((t) => `${short(t.name, 16)} (${t.schedWins >= 0 ? '+' : ''}${t.schedWins.toFixed(2)})`),
    cols: schedTeams[0].schedule.map((g) => `W${g.week}`),
    n,
    cells: schedTeams.map((t) => t.schedule.map((g) => {
      const o = team(g.rid);
      return { rank: n + 1 - o.powerRank, label: o.powerRank, tip: `${t.name}, week ${g.week}: vs ${o.name} (No. ${o.powerRank} power, ${f1(g.proj)} proj pts/wk), ${pct(g.pWin)} win chance` };
    })),
  }) : '';
  const oddsRows = [...teams].sort((a, b) => b.playoffPct - a.playoffPct || b.projWins - a.projWins);
  const eff = [...teams].filter((t) => t.efficiency != null).sort((a, b) => b.efficiency - a.efficiency);
  const effAvg = eff.reduce((a, t) => a + t.efficiency, 0) / (eff.length || 1);
  const effRows = eff.map((t) => ({ label: short(t.name, 20), value: (t.efficiency - effAvg) * 100, tip: `${t.name}: started ${(t.efficiency * 100).toFixed(1)}% of their best possible lineup, ${f1(t.leftOnBench)} pts/wk left on the bench` }));

  return `
    <section class="view-head"><div>
      <h1><span class="wk">For the spreadsheet people</span>Nerd Lab</h1>
      <p>Everything under the hood of the rankings, plus a few things that are just fun to argue about. Hover or tap any mark for the numbers${myTeam ? '; your team is highlighted' : ''}.</p>
    </div></section>
    <div class="lab-grid">
      <section class="panel glass span-12"><h2>Rank flow</h2><p class="sub">Power rank after each week. The roster half uses today's ROS values throughout, so the movement comes from results.</p>${bump}</section>
      <section class="panel glass span-6"><h2>Luck index</h2><p class="sub">Actual wins minus all-play expected wins. Orange teams are winning more than their scores deserve, blue teams less.</p>${divergingBars({ rows: luckRows })}</section>
      <section class="panel glass span-6"><h2>Points for vs against</h2><p class="sub">Dashed lines are the league average. Bottom right is where you want to live.</p>${sc}</section>
      ${schedHeat ? `<section class="panel glass span-12"><h2>Schedule strength</h2><p class="sub">Each cell is that week's opponent by current power rank; red is a top team, green a bottom one. Teams run toughest to easiest, with the schedule's effect in expected wins next to the name. This counts for ${Math.round(WEIGHTS.sos * 100)}% of the power score.</p>${schedHeat}</section>` : ''}
      <section class="panel glass span-12"><h2>Weekly finishes</h2><p class="sub">Each cell is that week's score; green finished near the top of the league, red near the bottom.</p>${weeklyHeat}</section>
      ${posHeat ? `<section class="panel glass span-7"><h2>Position group ranks</h2><p class="sub">League rank of each team's projected rest-of-season starters by position, flex spots included.</p>${posHeat}</section>` : ''}
      <section class="panel glass ${posHeat ? 'span-5' : 'span-12'}"><h2>Playoff odds</h2><p class="sub">From 10,000 simulated finishes to the regular season, top ${DATA.meta.playoffTeams} get in.</p>
        <table class="table"><thead><tr><th>Team</th><th class="num">Playoffs</th><th class="num">Bye</th><th class="num">Proj W</th><th class="num">Last</th></tr></thead><tbody>
        ${oddsRows.map((t) => `<tr${t.rid === myTeam ? ' class="mine"' : ''}><td class="tm">${avatar(t, "avatar xs")}${esc(short(t.name, 20))}</td><td class="num"><b>${pct(t.playoffPct)}</b></td><td class="num">${pct(t.byePct)}</td><td class="num">${f1(t.projWins)}</td><td class="num">${pct(t.lastPct)}</td></tr>`).join('')}
        </tbody></table></section>
      <section class="panel glass span-6"><h2>Lineup efficiency</h2><p class="sub">Share of their best possible lineup each manager actually started, compared with the league average of ${(effAvg * 100).toFixed(1)}%.</p>${divergingBars({ rows: effRows, unit: ' pts' }).replace(/ pts</g, '%<')}</section>
      <section class="panel glass span-6"><h2>Biggest single games</h2><p class="sub">Top individual starter performances this season.</p>
        <table class="table"><thead><tr><th>Player</th><th>Team</th><th class="num">Wk</th><th class="num">Pts</th></tr></thead><tbody>
        ${DATA.topPerformances.map((p) => `<tr><td>${posTag(p.id)}${esc(nameOf(p.id))}</td><td>${esc(short(team(p.rid).name, 18))}</td><td class="num">${p.week}</td><td class="num"><b>${f1(p.pts)}</b></td></tr>`).join('')}
        </tbody></table></section>
      ${DATA.meta.hasRos && DATA.divisive.length ? `<section class="panel glass span-6"><h2>Experts can't agree</h2><p class="sub">Rostered players where the ranking sources disagree the most. Overall rank by source.</p>
        <table class="table"><thead><tr><th>Player</th><th class="num">FP</th><th class="num">DS</th><th class="num">LL</th></tr></thead><tbody>
        ${DATA.divisive.map((d) => `<tr><td>${posTag(d.id)}${esc(nameOf(d.id))}<br><small class="when">${esc(team(d.rid)?.name || '')}</small></td><td class="num">${d.r.fp ?? '–'}</td><td class="num">${d.r.ds ?? '–'}</td><td class="num">${d.r.ll ?? '–'}</td></tr>`).join('')}
        </tbody></table></section>` : ''}
      ${DATA.meta.hasRos ? `<section class="panel glass span-6"><h2>Waiver and trade ROI</h2><p class="sub">Consensus ROS value added through moves, valued at today's rankings. Uneven trades credit each freed roster spot as one top free agent.</p>
        ${divergingBars({ rows: Object.values(DATA.managerMoves).sort((a, b) => b.net - a.net).map((m) => ({ label: short(team(m.rid).name, 20), value: m.net, tip: `${team(m.rid).name}: ${f1(m.waiverNet)} from adds and drops, ${f1(m.tradeNet)} from trades over ${m.moves} moves` })) })}</section>` : ''}
    </div>`;
}

// ---------- shell ----------
// ---------- motion ----------
// Everything here animates transform/opacity only, runs when on screen, and is skipped under reduced motion.
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// phones and touch screens get the light set: no page morphs or scroll reveals, which cost the most on mobile GPUs
const lite = () => matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const morphs = () => !!document.startViewTransition && !calm() && !lite();
const ORDER = ['rankings', 'wire', 'matchups', 'trades', 'lab'];
let currentView = null;

// gold pill behind the active tab; with view transitions the browser morphs it, otherwise CSS slides it
function placeInk({ settle = false } = {}) {
  const ink = $('.tab-ink'), a = $('.tabs a[aria-current]');
  if (!ink || !a) return;
  if (settle) ink.classList.remove('live'); // a re-measure snaps into place instead of sliding
  ink.style.width = `${a.offsetWidth}px`;
  ink.style.transform = `translateX(${a.offsetLeft}px)`;
  // the browser morphs the pill during a view transition; otherwise CSS slides it
  requestAnimationFrame(() => ink.classList.toggle('live', !morphs()));
}

// count big numbers up from zero, keeping their format (decimals, sign, %)
const COUNT = '.score, .odds b, .wire-stats b, .mu-team .pr, .gotw-score b, .cast-odds b';
function countAll(els) {
  // measure every final width first, then write, so this costs one layout instead of one per number
  const todo = els.filter((el) => !el.dataset.counted).map((el) => ({ el, w: el.getBoundingClientRect().width }));
  todo.forEach(({ el, w }) => countUp(el, w));
}
function countUp(el, w) {
  el.dataset.counted = '1';
  const m = el.textContent.trim().match(/^([+-]?)(\d+(?:\.\d+)?)(%?)$/);
  if (!m) return;
  if (getComputedStyle(el).display === 'inline') el.style.display = 'inline-block';
  el.style.minWidth = `${Math.ceil(w)}px`;
  const target = Number(m[2]), dec = (m[2].split('.')[1] || '').length, t0 = performance.now(), dur = 750;
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
    el.textContent = `${m[1]}${(target * e).toFixed(dec)}${m[3]}`;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// cards and panels rise in as they scroll into view, staggered within each batch
const REVEAL = '.hero > .lead-car, .notice, .gotw, .bull, .matchups > .mu, .wire-stats, .sec-title, .moves > li, .day > h3, .two-col aside > .panel, .lab-grid > .panel, .trade-bar, .trade-legend, .ideas > .idea, .method-box, .empty';
let io = null;
function reveal(root) {
  io?.disconnect();
  if (calm() || !('IntersectionObserver' in window)) return;
  if (lite()) {
    // phones: count the numbers on the first screen once; nothing runs while scrolling
    countAll([...root.querySelectorAll(COUNT)].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }));
    return;
  }
  io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, k) => {
      const el = e.target;
      io.unobserve(el);
      countAll([...el.querySelectorAll(COUNT)]);
      if (!el.classList.contains('reveal')) return;
      el.style.setProperty('--d', `${Math.min(k, 8) * 60}ms`);
      el.classList.add('in');
      // drop the classes once risen so hover transitions aren't stuck behind the reveal delay
      el.addEventListener('animationend', function done(ev) {
        if (ev.target !== el) return;
        el.classList.remove('reveal', 'in');
        el.removeEventListener('animationend', done);
      });
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  root.querySelectorAll(REVEAL).forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  root.querySelectorAll('.rank').forEach((el) => io.observe(el)); // ranking rows have their own rise; just count
}

const VIEWS = { rankings: viewRankings, wire: viewWire, matchups: viewMatchups, trades: viewTrades, lab: viewLab };
function route({ fresh = false } = {}) {
  const v = (location.hash || '#rankings').slice(1);
  const key = VIEWS[v] ? v : 'rankings';
  const dir = !currentView || key === currentView ? 'same' : ORDER.indexOf(key) > ORDER.indexOf(currentView) ? 'fwd' : 'back';
  const render = () => {
    document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    placeInk();
    paintMe();
    const app = $('#app');
    app.innerHTML = VIEWS[key]();
    fixAvatars(app);
    bind(key);
    if (fresh) { app.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
    reveal(app);
    currentView = key;
  };
  document.documentElement.dataset.dir = dir;
  if (currentView && morphs()) document.startViewTransition(render);
  else render();
}

function bind(key) {
  if (key === 'rankings') {
    bindCarousel();
    document.querySelectorAll('.rank-btn').forEach((b) =>
      b.addEventListener('click', () => {
        const li = b.closest('.rank');
        const open = !li.classList.contains('open');
        const holder = li.querySelector('.detail > div');
        if (open && !holder.innerHTML) holder.innerHTML = rankDetail(team(Number(li.dataset.rid)));
        // The jersey number is centred on the row. Pin it at its current pixel spot while the row is open so it
        // neither jumps nor drifts as the row grows; release the pin once the row has finished closing.
        const jersey = li.querySelector('.jersey');
        clearTimeout(li._unpin);
        if (open) {
          jersey.style.top = `${jersey.getBoundingClientRect().top - li.getBoundingClientRect().top}px`;
          jersey.style.transform = 'none';
        } else {
          li._unpin = setTimeout(() => { if (!li.classList.contains('open')) jersey.style.top = jersey.style.transform = ''; }, 450);
        }
        li.classList.toggle('open', open);
        b.setAttribute('aria-expanded', open);
      })
    );
    setTimeout(() => $('.ranks')?.classList.remove('enter'), 1400);
  }
  if (key === 'matchups') {
    $('.matchups')?.addEventListener('click', (e) => { const b = e.target.closest('.pick'); if (b && VOTES?.open) castVote(b); });
    document.querySelectorAll('.mu-more').forEach((b) => b.addEventListener('click', () => toggleMatchup(b.closest('.mu'))));
    document.querySelectorAll('.odds-more').forEach((b) => b.addEventListener('click', () => {
      const card = b.closest('.mu'), open = !card.classList.contains('odds-open');
      card.classList.toggle('odds-open', open);
      b.setAttribute('aria-expanded', open);
    }));
    const drive = $('.drive');
    if (drive) {
      paintDrive(drive, 'now');
      drive.querySelector('.drive-pick').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) paintDrive(drive, b.dataset.s); });
    }
    $('.gotw-more')?.addEventListener('click', (e) => {
      const card = $(`#mu-${e.currentTarget.dataset.open}`);
      if (!card) return;
      if (!card.classList.contains('open')) toggleMatchup(card);
      card.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
    });
  }
  if (key === 'trades') {
    $('#trade-team')?.addEventListener('change', (e) => setMyTeam(Number(e.target.value)));
    document.querySelectorAll('[data-shape]').forEach((b) => b.addEventListener('click', () => { tradeState.shape = b.dataset.shape; route(); }));
  }
  if (key === 'wire') {
    document.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { wireState.type = b.dataset.type; wireState.limit = 50; route(); }));
    $('[data-mine]')?.addEventListener('click', () => { wireState.mine = !wireState.mine; route(); });
    $('[data-more]')?.addEventListener('click', () => { wireState.limit += 50; route(); });
    $('[data-more-trades]')?.addEventListener('click', () => { wireState.trades = Infinity; route(); });
  }
}

// your own face next to the team picker once you have chosen a team
function paintMe() {
  const img = $('#my-face'), src = myTeam ? faceSrc(team(myTeam)) : null;
  if (!img) return;
  img.hidden = !src;
  if (src && img.getAttribute('src') !== src) img.src = src;
}

function initTeamPicker() {
  const sel = $('#my-team');
  sel.innerHTML = '<option value="">Your team</option>' + [...DATA.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => `<option value="${t.rid}" ${t.rid === myTeam ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  sel.addEventListener('change', () => {
    myTeam = Number(sel.value) || null;
    store.set('ph-my-team', myTeam ? String(myTeam) : null);
    route();
  });
}

function initTooltips() {
  const tip = $('#tip');
  const show = (el, x, y) => {
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14))}px`;
    tip.style.top = `${Math.min(window.innerHeight - r.height - 8, y + 16)}px`;
  };
  const hide = () => (tip.hidden = true);
  let touch = false;
  document.addEventListener('pointerdown', (e) => (touch = e.pointerType !== 'mouse'), { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // a finger dragging over marks would flash tips mid-scroll
    const el = e.target.closest?.('[data-tip]');
    if (el && el.dataset.tip) show(el, e.clientX, e.clientY); else hide();
  });
  // touch: tap a mark to see its numbers, tap anywhere else (or scroll) to dismiss
  document.addEventListener('click', (e) => {
    if (!touch) return;
    const el = e.target.closest?.('[data-tip]');
    if (el && el.dataset.tip && !el.closest('button')) show(el, e.clientX, e.clientY); else hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
  document.addEventListener('pointerleave', hide);
}

async function main() {
  initTooltips();
  try {
    await load();
  } catch (e) {
    $('#app').innerHTML = `<section class="loading"><div class="notice glass"><strong>Couldn't reach Sleeper.</strong> ${esc(e.message || e)}. Check your connection and reload the page.</div></section>`;
    return;
  }
  $('#league-name').textContent = `${RAW.league.name} ${RAW.league.season}`;
  $('#footer-meta').textContent = `${RAW.isDemo ? 'Demo snapshot. ' : ''}Through week ${DATA.meta.lastScored}. ${updatedText() ? `${updatedText()}.` : ''}${DATA.overrides.length ? ` Manual fixes: ${DATA.overrides.map((o) => o.note).join('; ')}.` : ''}`;
  initTeamPicker();
  const ed = DATA.teams.find((t) => t.owner === EDITOR.user);
  if (ed && faceSrc(ed)) {
    const mh = $('#masthead');
    mh.innerHTML = `<img src="${faceSrc(ed)}" alt="" width="44" height="44"><span>The Power Hour is put together by <b>${esc(EDITOR.name)}</b>, whose own lineup mistakes are always front-page news.</span>`;
    mh.hidden = false;
  }
  const champ = DATA.teams.find(isChamp);
  if (champ) {
    const el = $('#reigning');
    el.innerHTML = `${faceSrc(champ) ? `<span class="mgr-ph"><img src="${faceSrc(champ)}" alt="" width="44" height="44">${champBadge(champ)}</span>` : ''}<span>Reigning champion: <b>${esc(firstName(champ))}</b>, who won it all in ${CHAMPION.season} with ${esc(champ.name)}. The rest of the league is chasing that trophy.</span>`;
    el.hidden = false;
  }
  window.addEventListener('hashchange', () => route({ fresh: true }));
  loadVotes();
  let lastWidth = innerWidth;
  window.addEventListener('resize', () => {
    if (innerWidth === lastWidth) return; // height-only resizes are the browser toolbar, ignore them
    lastWidth = innerWidth;
    placeInk({ settle: true });
    carouselFit?.();
  }, { passive: true });
  route();
  // the first route can measure the tabs before the stylesheet or the fonts have applied (fast or cached data)
  const settle = () => placeInk({ settle: true });
  if (document.readyState !== 'complete') window.addEventListener('load', settle, { once: true });
  document.fonts?.ready.then(settle);
}
main();
