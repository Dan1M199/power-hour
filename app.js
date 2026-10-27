import { computeLeague, WEIGHTS, WEIGHTS_PROPOSED } from './lib/engine.js';
import { bumpChart, scatter, radar, weeklyBars, divergingBars, heatTable, faceDot, TEAM_COLORS } from './lib/charts.js';
import { buildStories, keyMatchup, matchupQuips } from './lib/stories.js';
import { applyOverrides } from './lib/overrides.js';
import { tradeIdeas } from './lib/trades.js';
import { breakdown, shortName } from './lib/matchup.js';
import { MEMBERS, photoUrl } from './lib/members.js';
import { bullseye } from './lib/bullseye.js';
import { nightEdition, nightBoard } from './lib/nightdesk.js';
import { TZ, NEWS_CLOCK, centralDate, morningKey, leagueKey, isOnHold, isNightDesk, inGameWindow, isFinalCall } from './lib/newsclock.js';

// ---------- config ----------
const SOURCE_NAMES = { fp: 'FantasyPros', ds: 'DraftSharks', ll: 'LeagueLogs' };
// the site's author: his own lineup blunders always make the lead story
const EDITOR = { user: 'dmir9999', name: 'Dan' };
// money week: whoever scores closest to the target, over or under, takes the doubled bonus (lib/bullseye.js). The board
// shows from now through the week after, then disappears on its own; set to null to drop it early.
const MONEY_WEEK = {
  week: 7, target: 120, prize: 80, usual: 40, title: "Mo's birthday bullseye", honoree: '1004163936612089856',
  why: "120 is 10/20, Commissioner Mo's birthday", flyer: 'assets/money-week-flyer.jpg',
};
// The news clock (lib/newsclock.js): the hold on Sunday's news, the late pull after Sunday night football, the night
// edition and the game window. ?at=2026-10-25T22:45-05:00 pretends it's that moment for the page (not for the data:
// snapshot keys always follow the real clock, and the API redirects any other key to the current one).
// ?rehearse=1 (linked from the admin page, and only with the admin password in this session): the final call as
// visitors will get it, right now. The clock pretends it's 10:50pm tonight, the scores as they stand count as final,
// and nothing is remembered (no "seen" flags, no poll votes). A strip along the bottom says it's a rehearsal.
const REHEARSE = (() => { try { return new URLSearchParams(location.search).has('rehearse') && !!sessionStorage.getItem('ph-admin'); } catch { return false; } })();
const AT = (() => {
  const v = new URLSearchParams(location.search).get('at') || (REHEARSE ? '2026-10-26T22:50:00-05:00' : null);
  const d = v && new Date(v);
  return d && !isNaN(d) ? d : null;
})();
const clock = () => AT || new Date();
const T0 = Date.now();
const tick = () => (AT ? +AT + (Date.now() - T0) : Date.now()); // the clock still running, for countdowns under ?at=

// Dan's call for week 7: the new formula is published, so the power rankings page stays shut until tonight's final call
// at 10:45pm, its tab hidden and a countdown in its place. Past that time it stays shut while the week is still being
// played (Monday night running long), until Tuesday 6am at the latest. Set to null to drop it.
const RANKINGS_LOCK = { until: Date.parse('2026-10-26T22:45:00-05:00'), end: Date.parse('2026-10-27T06:00:00-05:00') };
// before the final call the whole site waits behind the countdown (the admin page and a rehearsal excepted)
const siteLocked = () => !!RANKINGS_LOCK && !REHEARSE && tick() < RANKINGS_LOCK.until;
function rankingsLocked() {
  if (!RANKINGS_LOCK || DATA.after || DATA.finalCall) return false;
  const now = tick();
  return now < RANKINGS_LOCK.until || (now < RANKINGS_LOCK.end && DATA.liveMode);
}
const onHold = () => isOnHold(clock());
const gameWindow = () => inGameWindow(clock());
const nightDesk = () => isNightDesk(clock());
const finalCall = () => isFinalCall(clock());

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
const chicagoDate = () => centralDate(clock());

// Sleeper is read once per morning through /api/league (CDN-cached per key), never straight from the browser
async function loadLive() {
  const key = morningKey();
  const [snap, ros] = await Promise.all([
    getJSON(`/api/league?d=${leagueKey()}`),
    getJSON(`/api/ros?d=${key}`).catch((e) => ({ error: String(e.message || e) })),
  ]);
  return { ...snap, ros };
}

// the engine input for a league snapshot (the public one, or the admin page's draft) with the morning ROS values
function leagueInput(raw, extra = {}) {
  const ros = RAW.ros && !RAW.ros.error ? RAW.ros : null;
  const patched = ros ? applyOverrides(ros.values) : { values: {}, applied: [] };
  return {
    input: {
      league: raw.league, users: raw.users, rosters: raw.rosters, matchups: raw.matchups, transactions: raw.transactions,
      players: ros ? ros.players : {}, ros: patched.values, byes: ros?.byes || {},
      currentWeek: raw.state.week, lastScored: raw.league.settings?.last_scored_leg,
      // the published power-score weights ride on the snapshot (admin page); none means the engine's defaults
      weights: raw.config?.weights || undefined,
      ...extra,
    },
    ros, patched,
  };
}

// a snapshot with the week in progress counted as final (the admin preview, and the final call): scores so far, or each team's projected finish
function asFinal(raw, mode) {
  if (mode === 'off') return raw;
  const pre = computeLeague({ ...leagueInput(raw).input, sims: 500 });
  const w = pre.previews[0]?.week;
  if (!w) return raw;
  const proj = Object.fromEntries(pre.previews.flatMap((p) => [[p.a, p.projA], [p.b, p.projB]]));
  const rows = (raw.matchups[w] || []).map((m) => ({ ...m, points: mode === 'proj' ? proj[m.roster_id] ?? m.points ?? 0 : m.points || 0 }));
  const byId = Object.fromEntries(rows.map((m) => [m.roster_id, m]));
  const split = (x) => ({ i: Math.floor(x), d: Math.round((x - Math.floor(x)) * 100) });
  const rosters = raw.rosters.map((r) => {
    const m = byId[r.roster_id], o = m && rows.find((x) => x.matchup_id === m.matchup_id && x.roster_id !== r.roster_id);
    if (!m || !o) return r;
    const s = { ...r.settings }, pf = split((s.fpts || 0) + (s.fpts_decimal || 0) / 100 + m.points), pa = split((s.fpts_against || 0) + (s.fpts_against_decimal || 0) / 100 + o.points);
    s.fpts = pf.i; s.fpts_decimal = pf.d; s.fpts_against = pa.i; s.fpts_against_decimal = pa.d;
    if (m.points > o.points) s.wins = (s.wins || 0) + 1; else if (m.points < o.points) s.losses = (s.losses || 0) + 1; else s.ties = (s.ties || 0) + 1;
    return { ...r, settings: s };
  });
  return { ...raw, rosters, matchups: { ...raw.matchups, [w]: rows }, league: { ...raw.league, settings: { ...raw.league.settings, last_scored_leg: w } }, state: { ...raw.state, week: w + 1 } };
}

async function load() {
  const demo = new URLSearchParams(location.search).has('demo') || window.__DEMO__;
  RAW = window.__DEMO__ || (demo ? await getJSON('demo/demo.json') : await loadLive());
  RAW.isDemo = !!demo;
  build(RAW);
  // anyone who has already been through the final-scores reveal this week goes straight to the new rankings
  if (DATA.finalCall && !REHEARSE && store.get('ph-final-seen') === finalSeenKey()) buildFinal();
}

// computes a league snapshot into DATA (the helpers below all read DATA) and dresses it for the page
function build(raw) {
  const { input, ros, patched } = leagueInput(raw);
  DATA = computeLeague(input);
  DATA.raw = raw;
  DATA.rosMeta = ros;
  // live-week mode: games are on (or there are points on the board) and this week is still unscored
  DATA.liveMode = DATA.previews.length > 0 && (!!DATA.live || gameWindow());
  // the final call: after Monday night football every game is done, so the week reads as final before Sleeper scores it
  DATA.finalCall = DATA.liveMode && !!DATA.live && finalCall() && (REHEARSE || nightBoard(DATA).every((g) => g.final));
  DATA.fetched = RAW.fetched ? new Date(RAW.fetched).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null;
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
  // after Sunday night football the night desk takes over the headlines
  if (nightDesk() && DATA.live) {
    const people = Object.fromEntries(DATA.teams.map((t) => [t.rid, firstName(t)]));
    const ed = nightEdition(DATA, { dateKey: chicagoDate(), editor: EDITOR, people });
    if (ed?.length) DATA.stories = { lead: ed[0], more: ed.slice(1), night: true };
  }
  // a one-off from the editor's desk, after the rest, for as long as it runs
  const sass = sassStory();
  if (sass) DATA.stories = { ...DATA.stories, more: [...DATA.stories.more, sass], extra: true };
  const ms = moneyStory();
  if (ms) DATA.stories = { ...DATA.stories, lead: ms, more: [DATA.stories.lead, ...DATA.stories.more].filter(Boolean) };
  // once the week is final the headlines come down; the week after, the shakeup leads
  if (DATA.finalCall) DATA.stories = null;
  else if (!DATA.liveMode && shakeupOn()) DATA.stories = shakeupStories();
  DATA.key = keyMatchup(DATA);
  DATA.quips = matchupQuips(DATA);
  return DATA;
}

// The new power rankings after the final call: this week's final scores counted into records and points for, ranked
// with the live published weights. The final-scores page stays reachable from it (DATA.after).
function buildFinal() {
  const live = DATA;
  if (live.after || !live.finalCall) return live;
  build(asFinal(RAW, 'now'));
  DATA.liveMode = false;
  DATA.after = live; // first: the shakeup compares against this week-in-progress snapshot
  DATA.stories = shakeupOn() ? shakeupStories() : null;
  revealed = true;
  return DATA;
}
let revealed = false; // this visitor has been through the final-scores reveal
const finalSeenKey = () => `${RAW.league.season}-w${(DATA.after || DATA).previews[0]?.week}`;
// render with another computed league in DATA (the final-scores page after the reveal)
function withData(D, fn) { const keep = DATA; DATA = D; try { return fn(); } finally { DATA = keep; } }

// ---------- shared bits ----------
const RESULT_KEYS = ['allPlay', 'pfPerGame', 'winPct', 'standing', 'form', 'lastWeek'];
const weightTotal = () => Object.values(DATA.meta.weights).reduce((a, b) => a + b, 0) || 1;
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
  if (rankingsLocked()) return viewLocked();
  const m = DATA.meta;
  const chips = DATA.rosMeta
    ? Object.entries(DATA.rosMeta.sources).map(([k, s]) => `<span class="chip ${s.ok ? '' : 'off'}" title="${s.ok ? `${s.matched} of ${s.rows} players matched` : esc(s.error)}"><span class="dot"></span>${SOURCE_NAMES[k] || k}</span>`).join('')
    : '<span class="chip off"><span class="dot"></span>ROS rankings unavailable</span>';
  const notice = DATA.rosError
    ? `<div class="notice glass"><strong>Results-only mode.</strong> The rest-of-season rankings couldn't be loaded (${esc(DATA.rosError)}), so these ranks use this season's results alone until they come back.</div>`
    : '';
  const items = DATA.teams.map((t, i) => rankRow(t, i)).join('');
  // while a week is being played the headlines move to the Live tab and these ranks hold until the week is final
  const held = !!DATA.liveMode;
  const head = `
      <section class="view-head">
        <div>
          <h2 class="page-title"><span class="wk">${held ? `On hold during week ${m.lastScored + 1}` : `Week ${m.lastScored + 1}`}</span>Power Rankings</h2>
          <p>Rest-of-season roster strength, who's left on the schedule, and what's already happened. Tap any team to see why it sits where it does.</p>
        </div>
        <div class="sources">${chips}${updatedText() ? `<span class="chip">${esc(updatedText())}</span>` : ''}${!held && MESSAGE_VIDEO && !window.__DEMO__ ? '<button type="button" class="chip to-again" data-message hidden>Watch the important message again</button>' : ''}</div>
      </section>`;
  const hold = DATA.finalCall
    ? `<div class="notice glass hold"><span><strong>Week ${m.lastScored + 1} is final.</strong> These are the ranks going into the week. The new ones are ready.</span></div>${revealCta(false)}`
    : held ? `<div class="notice glass hold"><span><strong>Power rankings are on hold.</strong> Week ${m.lastScored + 1} is being played, so these are the ranks going into the week. They update Tuesday morning once every game is final. For how this week is going, see the <a href="#live">Live</a> tab.</span></div>` : '';
  return `
    ${held ? head : `<div class="hero">${leadStory()}${head}</div>`}
    ${hold}${notice}
    <div id="poll-slot">${pollCard()}</div>
    <ol class="ranks enter">${items}</ol>
    ${futuresBoard()}
    <details class="panel glass method-box">
      <summary><h2>How the score works</h2>${XP}</summary>
      <div class="method">
        <p><b>Rest-of-season roster (${Math.round(((DATA.meta.weights.rosProj || 0) + (DATA.meta.weights.depth || 0)) * 100 / weightTotal())}%).</b> Every player gets a consensus value from FantasyPros, DraftSharks and LeagueLogs half-PPR ROS rankings (LeagueLogs counts half, since it tracks the FantasyPros consensus closely). We build each team's best possible starting lineup from DraftSharks' weekly projections, discounted for games a player is expected to miss, then add the value of the top four bench pieces.</p>
        <p><b>Remaining schedule (${Math.round((DATA.meta.weights.sos || 0) * 100 / weightTotal())}%).</b> Priced in wins: each team's expected wins against its actual remaining opponents, minus what it would expect against an average opponent. Opponent strength uses the same projection as the playoff odds (about two-thirds projected lineup, one-third points per game so far).</p>
        <p><b>Results so far (${Math.round(RESULT_KEYS.reduce((a, k) => a + (DATA.meta.weights[k] || 0), 0) * 100 / weightTotal())}%).</b> All-play win rate (your record if you played every team every week) strips out schedule luck. Points per game, the actual record${DATA.meta.weights.standing ? ', your place in the standings' : ''}, the last three weeks${DATA.meta.weights.lastWeek ? ' and last week on its own' : ''} round it out.</p>
        <p><b>Scale.</b> Each input is compared to the rest of the league, so 50 is a dead-average team. The bars under each score show the roster, schedule and results parts separately.</p>
        <p><b>Playoff odds.</b> 10,000 simulations of the remaining regular-season schedule, using each team's projected lineup blended with its actual scoring. Ties in the standings go to points for, like Sleeper.</p>
      </div>
    </details>`;
}

// the rankings page while it's shut: a scoreboard counting down to the final call
const hms = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((x) => String(x).padStart(2, '0')).join(':'); };
function viewLocked(site = false) {
  const left = RANKINGS_LOCK.until - tick();
  return `
    <section class="view-head"><div>
      <h2 class="page-title"><span class="wk">Back at 10:45pm</span>${site ? 'The Power Hour' : 'Power Rankings'}</h2>
      <p>Week ${DATA.meta.lastScored + 1} is wrapping up. Final scores and the new power rankings are on the way.</p>
    </div></section>
    <section class="lock glass rim" aria-label="Countdown to 10:45pm">
      <p class="lock-msg">${site ? 'Check back in at 10:45pm.' : 'This page will be live after the game.'}</p>
      ${left > 0
        ? `<div class="lock-clock" data-lock role="timer" aria-live="off">${hms(left)}</div>
          <p class="lock-sub">${site ? 'Tonight at 10:45pm Central the final scores go up and the new power rankings open. Keep this page open and it loads by itself.' : 'Tonight at 10:45pm Central. Until then, follow the games on the <a href="#live">Live</a> tab.'}</p>`
        : `<div class="lock-clock wait">Final whistle pending</div>
          <p class="lock-sub">The game is still going. The rankings open the moment every game is final. Check back soon.</p>`}
    </section>`;
}
let lockTimer = 0;
function bindLock() {
  clearInterval(lockTimer);
  const el = $('[data-lock]');
  if (!el) return;
  lockTimer = setInterval(() => {
    const left = RANKINGS_LOCK.until - tick();
    if (!document.body.contains(el)) return clearInterval(lockTimer);
    el.textContent = hms(left);
    if (left > 0) return;
    clearInterval(lockTimer);
    el.textContent = 'Pulling the final scores…';
    // a fresh load picks up the final snapshot; a few seconds of spread so not every open page asks at once, and
    // under ?at= (a fixed pretend time) there is no new snapshot to get, so it just re-renders
    if (AT) { paintTabs(); route(); } else setTimeout(() => location.reload(), 3000 + Math.random() * 12000);
  }, 1000);
}

// ---------- the important message: Dan's video, taking over the power rankings page ----------
// The first time a device sees the power rankings (not the countdown or the on-hold page), a full-screen card says an
// important message is incoming, counts down, then plays the video with sound. Phones block sound without a tap, so if
// the browser refuses it shows a "Tap to play" button instead. Seen once it ends or is skipped; a chip on the page plays
// it again. It only appears once the file is actually there. Set MESSAGE_VIDEO to null to drop it.
const MESSAGE_VIDEO = { id: 'w7-message', src: 'assets/important-message.mp4' };
const messageSeen = () => !REHEARSE && store.get(`ph-video-${MESSAGE_VIDEO.id}`) === '1';
const messageOn = () => !!MESSAGE_VIDEO && !window.__DEMO__ && !DATA.liveMode && !rankingsLocked();
let messageReady = null; // the HEAD check for the file, once
async function maybeMessage(force = false) {
  if (!messageOn() || $('.takeover') || (!force && messageSeen())) return;
  messageReady ||= fetch(MESSAGE_VIDEO.src, { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
  if (!(await messageReady) || $('.takeover') || currentView !== 'rankings') return; // moved on while checking
  const el = document.createElement('div');
  el.className = 'takeover';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'to-title');
  el.innerHTML = `
    <div class="to-card">
      <h2 id="to-title">Important Message Incoming</h2>
      <p class="to-sub">Please watch.</p>
      <div class="to-count" aria-hidden="true">3</div>
      <video class="to-video" src="${MESSAGE_VIDEO.src}" playsinline controls preload="auto" hidden></video>
      <button type="button" class="cta to-play" hidden>Tap to play</button>
      <button type="button" class="to-skip" hidden>Skip</button>
    </div>`;
  document.body.append(el);
  document.documentElement.classList.add('locked');
  const v = el.querySelector('video'), count = el.querySelector('.to-count'), play = el.querySelector('.to-play'), skip = el.querySelector('.to-skip');
  const done = () => {
    if (!REHEARSE) store.set(`ph-video-${MESSAGE_VIDEO.id}`, '1');
    v.pause();
    el.classList.add('out');
    setTimeout(() => { el.remove(); document.documentElement.classList.remove('locked'); }, calm() ? 0 : 350);
  };
  const start = () => {
    count.hidden = true; play.hidden = true; v.hidden = false;
    v.play().then(() => setTimeout(() => (skip.hidden = false), 5000)).catch(() => { play.hidden = false; play.focus(); });
  };
  v.addEventListener('ended', done);
  v.addEventListener('error', () => { el.remove(); document.documentElement.classList.remove('locked'); });
  play.addEventListener('click', start);
  skip.addEventListener('click', done);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !skip.hidden) done(); });
  for (let n = 3; n > 0; n--) { count.textContent = n; await new Promise((r) => setTimeout(r, 1000)); }
  start();
}

// ---------- the editor's one-off headlines ----------
// Dan's request for week 7: an extra headline for Chubb in my Jeanty bragging about Jaxon Smith-Njigba's big Sunday
// night. JSN's points come from the live data once his game shows as played; until the snapshot catches up, the number
// Dan reported stands in. Gone after Tuesday 6am Central. Set SASS to null to drop it.
const SASS = { owner: '857297655477444608', week: 7, until: Date.parse('2026-10-27T06:00:00-05:00'), star: 'Jaxon Smith-Njigba', reported: 26.8 };
function sassStory() {
  if (!SASS || clock() >= SASS.until) return null;
  const t = DATA.teams.find((x) => x.ownerId === SASS.owner);
  const p = t && DATA.previews.find((x) => x.week === SASS.week && (x.a === t.rid || x.b === t.rid));
  if (!p) return null;
  const side = p.a === t.rid ? 'a' : 'b', opp = team(side === 'a' ? p.b : p.a);
  const mine = side === 'a' ? { proj: p.projA, banked: p.liveA || 0, win: p.winA } : { proj: p.projB, banked: p.liveB || 0, win: 1 - p.winA };
  const theirs = side === 'a' ? { banked: p.liveB || 0 } : { banked: p.liveA || 0 };
  const bd = breakdown(DATA, p), other = side === 'a' ? 'b' : 'a';
  const rows = bd.rows.map((r) => r[side]).filter(Boolean);
  const jsn = rows.find((x) => x.name === SASS.star);
  // who the other side still has on Monday night, best projection first
  const still = (xs) => xs.filter((x) => x && !x.played && !x.out && !x.bye && x.proj > 0).sort((x, y) => y.proj - x.proj);
  const oppLeft = still(bd.rows.map((r) => r[other]));
  const pts = jsn?.played ? jsn.proj : SASS.reported, pre = jsn?.pre;
  const left = rows.filter((x) => !x.played && !x.out && !x.bye && x.proj > 0 && x !== jsn);
  const rank = DATA.previews.flatMap((q) => [q.projA, q.projB]).sort((x, y) => y - x).indexOf(mine.proj) + 1;
  const N = firstName(t), O = opp.name, gap = Math.abs(mine.banked - theirs.banked);
  // "a 16.7" but "an 11.6", "an 18", "an 8": the article follows how the number is said
  const an = (x) => { const i = Math.floor(x); return i === 11 || i === 18 || String(i)[0] === '8' ? 'an' : 'a'; };
  const seed = [...chicagoDate()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  const pick = (xs) => xs[Math.abs(seed) % xs.length];
  const ahead = mine.win >= 0.5;
  const behind = mine.banked > theirs.banked, savior = oppLeft[0];
  // ahead with the other side still playing Monday: the brag comes with the miracle they'd need
  const headline = behind && savior
    ? pick([
      `JSN went nuclear for ${f1(pts)}. Now ${O} needs a Monday night miracle from ${savior.name}`,
      `Jaxon Smith-Njigba hung ${f1(pts)} on ${O}, and only ${savior.name} can save them now`,
    ])
    : pick([
      `Jaxon Smith-Njigba just hung ${f1(pts)} on the league. Chubb in my Jeanty would like a word`,
      `JSN went nuclear for ${f1(pts)} and Chubb in my Jeanty is not being humble about it`,
    ]);
  const lead = mine.banked >= theirs.banked ? `${f1(gap)} behind` : `${f1(gap)} ahead, for now`;
  const share = mine.banked > 0 && jsn?.played ? Math.round((pts / mine.banked) * 100) : null;
  const deck = [
    `${N} would never brag, so we will.`,
    `Jaxon Smith-Njigba put up ${f1(pts)} points${pre ? ` on ${an(pre)} ${f1(pre)}-point projection, ${(pts / pre).toFixed(1)} times what the experts saw coming` : ''}${share ? `, ${share}% of everything Chubb in my Jeanty has scored this week` : ''}.`,
    'Anyone who let him get away can sit quietly.',
    left.length
      ? `Chubb in my Jeanty is ${ordinal(rank)} in the league this week by projection, with ${left.slice(0, 2).map((x) => x.name).join(' and ')} still to play Monday.`
      : `Chubb in my Jeanty is done for the week, ${ordinal(rank)} in the league by projection.`,
    behind && savior
      ? `${O} is ${f1(gap)} back with ${oppLeft.slice(0, 2).map((x) => x.name).join(' and ')} left on Monday night. ${oppLeft.length === 1 ? `${savior.name} would need ${f1(gap)} on his own` : `They'd need ${f1(gap)} between them`}, against ${oppLeft.length === 1 ? `${an(savior.pre ?? savior.proj)} ${f1(savior.pre ?? savior.proj)}-point projection${savior.ceil ? ` and ${an(savior.ceil)} ${f1(savior.ceil)}-point ceiling` : ''}` : `${f1(oppLeft.reduce((a, x) => a + (x.pre ?? x.proj), 0))} projected`}. That's not a comeback, that's a Monday night miracle. ${pct(mine.win)} to win.`
      : `${O} is ${lead}. ${pct(mine.win)} to win.`,
    ahead ? "You're welcome, league." : 'Whatever happens from here, JSN did his part. The rest of the lineup knows what it did.',
  ].join(' ');
  return { type: 'sass', kicker: 'A note from the desk', tone: 'good', stamp: 'JSN szn', rids: [t.rid, opp.rid], headline, deck };
}

// ---------- the week 7 shakeup ----------
// Once week 7 is final (from the final call, or Sleeper's own scoring), the power rankings page leads with the shakeup:
// how far the new ranks moved from where teams stood after week 6 on the old formula (the engine's default weights),
// then week 7's closest games, then the money week result. The bottom six of the new ranks get a fan poll
// (api/poll.js). Set SHAKEUP to null to drop it all.
const SHAKEUP = { week: 7, poll: { id: 'w7-bottom6', question: 'Which one of the bottom 6 has the best chance at a playoff run?' } };
const shakeupOn = () => !!SHAKEUP && DATA.meta.lastScored === SHAKEUP.week;
const GROUPS = { roster: ['rosProj', 'depth'], schedule: ['sos'], results: RESULT_KEYS };
const shareOf = (w, keys) => { const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1; return keys.reduce((a, k) => a + (w[k] || 0), 0) / tot; };

function shakeupStories() {
  const wk = SHAKEUP.week;
  // where everyone stood going into the week: week 6 ranks on the old formula
  // what the rankings page showed going into the week: the week-in-progress snapshot (DATA.after, the final call) on
  // the old formula; once Sleeper has scored the week there is no such snapshot, so the old formula's week 6 ranks
  const before = DATA.after?.raw;
  const old = computeLeague({ ...leagueInput(before || DATA.raw).input, weights: WEIGHTS, sims: 200 });
  const moves = DATA.teams.map((t) => {
    const o = old.byRid[t.rid], was = before ? o.powerRank : o.rankHistory[wk - 2] ?? o.powerRank;
    t.movement = was - t.powerRank; // the arrows on the ranking rows tell the same story as the headline
    return { t, was, d: t.movement };
  });
  const moved = moves.filter((m) => m.d).length;
  const up = [...moves].sort((a, b) => b.d - a.d)[0], down = [...moves].sort((a, b) => a.d - b.d)[0];
  const top = DATA.teams[0], topWas = moves.find((m) => m.t === top).was;
  const W = DATA.meta.weights, fresh = Object.keys({ ...W, ...WEIGHTS }).some((k) => Math.abs((W[k] || 0) / (Object.values(W).reduce((a, b) => a + b, 0) || 1) - (WEIGHTS[k] || 0) / (Object.values(WEIGHTS).reduce((a, b) => a + b, 0) || 1)) > 0.005);
  const pctOf = (w, g) => Math.round(shareOf(w, GROUPS[g]) * 100);
  const formula = fresh
    ? `The formula got an upgrade: results now carry ${pctOf(W, 'results')}% of the score (was ${pctOf(WEIGHTS, 'results')}%), rest-of-season roster ${pctOf(W, 'roster')}% (was ${pctOf(WEIGHTS, 'roster')}%) and schedule ${pctOf(W, 'schedule')}% (was ${pctOf(WEIGHTS, 'schedule')}%)${W.standing && !WEIGHTS.standing ? ', and your place in the real standings counts for the first time' : ''}. More of what actually happened, less guessing.`
    : '';
  const lead = {
    type: 'shakeup', kicker: 'Power rankings shakeup', tone: 'good', stamp: 'Shakeup', rids: [up.t.rid, down.t.rid].filter((r, i, a) => a.indexOf(r) === i),
    headline: up.d > 0 && down.d < 0
      ? `Power rankings earthquake: ${firstName(up.t)} soars ${up.d}, ${firstName(down.t)} crashes ${-down.d}. Nobody is safe`
      : `Power rankings earthquake: ${moved} of ${DATA.teams.length} teams flipped. Nobody is safe`,
    deck: [
      `${fresh ? 'A brand-new formula and a' : 'A'} wild week ${wk} just flipped ${moved} of ${DATA.teams.length} teams.`,
      formula,
      up.d > 0 ? `${up.t.name} is the big winner, up ${up.d} spot${up.d === 1 ? '' : 's'} to ${ordinal(up.t.powerRank)}.` : '',
      down.d < 0 ? `${down.t.name} takes the fall, down ${-down.d} to ${ordinal(down.t.powerRank)}.` : '',
      topWas === 1 ? `${top.name} holds on to No. 1.` : `${top.name} is the new No. 1, up from ${ordinal(topWas)}.`,
    ].filter(Boolean).join(' '),
  };
  return { lead, more: [closeGames(wk), moneyStory()].filter(Boolean) };
}

// week 7's two closest finishes, and the bench points the loser of the closest one left sitting
function closeGames(wk) {
  const rows = DATA.raw.matchups?.[wk] || [], by = {};
  rows.forEach((m) => (by[m.matchup_id] ||= []).push(m));
  const pts = (m) => m.custom_points ?? m.points ?? 0;
  const games = Object.values(by).filter((g) => g.length === 2).map(([a, b]) => {
    const [w, l] = pts(a) >= pts(b) ? [a, b] : [b, a];
    return { w, l, W: team(w.roster_id), L: team(l.roster_id), margin: pts(w) - pts(l) };
  }).filter((g) => g.W && g.L).sort((a, b) => a.margin - b.margin);
  if (games.length < 2) return null;
  const [g1, g2] = games;
  // the loser's worst call: a bench player who outscored a starter at the same position by more than the margin
  const regret = (g) => {
    const pp = g.l.players_points || {}, st = (g.l.starters || []).filter((x) => x && x !== '0');
    let best = null;
    (g.l.players || []).filter((id) => !st.includes(id)).forEach((b) => st.forEach((s) => {
      const p = posOf(b), swing = (pp[b] || 0) - (pp[s] || 0);
      if (p && p === posOf(s) && swing > g.margin && (!best || swing > best.swing)) best = { b, s, swing };
    }));
    return best && { ...best, bp: pp[best.b] || 0, sp: pp[best.s] || 0 };
  };
  const r = regret(g1), fn = firstName;
  const line = (g) => `${g.W.name} ${f1(pts(g.w))}, ${g.L.name} ${f1(pts(g.l))}`;
  const headline = g1.margin < 5 && g2.margin < 5
    ? `${f1(g1.margin)} points and ${f1(g2.margin)} points: week ${wk}'s two closest games went down to the last snap`
    : `Decided by ${f1(g1.margin)}: ${fn(g1.W)} survives ${fn(g1.L)} in week ${wk}'s closest finish`;
  const deck = [
    `${line(g1)}. A ${f1(g1.margin)}-point game, the closest of the week.`,
    r ? `It didn't have to end that way for ${fn(g1.L)}: ${nameOf(r.b)} scored ${f1(r.bp)} on the bench while ${nameOf(r.s)} started and scored ${f1(r.sp)}. That swap wins it.` : `${fn(g1.L)} will be replaying every lineup call all week.`,
    `Next closest: ${line(g2)}, a ${f1(g2.margin)}-point margin.`,
  ].join(' ');
  return { type: 'nailbiter', kicker: 'Down to the wire', tone: 'neutral', stamp: 'Phew', rids: [g1.W.rid, g1.L.rid], headline, deck };
}

// the fan poll on top of the power rankings: the bottom six of the new ranks, one vote per network, no changes
let POLL = null; // { enabled, options, counts, total, mine } once /api/poll answers
// this device's poll id, kept here and (by the server) in a cookie, so clearing one doesn't make a new voter
const pollDevice = () => store.get('ph-device') || '';
const keepDevice = (b) => { if (b?.device) store.set('ph-device', b.device); };
const pollChoices = () => POLL?.options || DATA.teams.slice(-6).map((t) => t.rid);
function pollCard() {
  if (!SHAKEUP?.poll || !shakeupOn() || DATA.liveMode || !POLL?.enabled) return '';
  const opts = pollChoices().map(team).filter(Boolean), voted = POLL.mine != null, n = POLL.total || 0;
  const choice = (t) => {
    const c = POLL.counts?.[t.rid] || 0, share = n ? c / n : 0, mine = POLL.mine === t.rid;
    return voted
      ? `<li class="poll-res ${mine ? 'mine' : ''}" data-tip="${esc(`${t.name}: ${c} vote${c === 1 ? '' : 's'}`)}">${avatar(t)}<span class="pn"><b>${esc(t.name)}${mine ? ' <small>Your pick</small>' : ''}</b><span class="poll-bar"><i style="width:${share * 100}%"></i></span></span><b class="pp">${pct(share)}</b></li>`
      : `<li><button type="button" class="poll-pick" data-poll="${t.rid}">${avatar(t)}<span class="pn"><b>${esc(t.name)}</b><small>No. ${t.powerRank} power, ${record(t)}, ${pct(t.playoffPct)} playoffs</small></span></button></li>`;
  };
  return `<section class="panel glass poll" id="poll" aria-label="Fan poll">
      <h2>${esc(SHAKEUP.poll.question)}</h2>
      <p class="sub">${voted ? `${n} vote${n === 1 ? '' : 's'} so far. Your vote is locked in.` : 'One vote per device, and no changing it once it\'s in. Choose wisely.'}</p>
      <ol class="poll-list ${voted ? 'done' : ''}">${opts.map(choice).join('')}</ol>
      ${POLL.err ? `<p class="adm-err" role="alert">${esc(POLL.err)}</p>` : ''}
    </section>`;
}
async function loadPoll() {
  if (!SHAKEUP?.poll || !shakeupOn()) return;
  try { POLL = await getJSON(`/api/poll?id=${SHAKEUP.poll.id}&device=${encodeURIComponent(pollDevice())}`); keepDevice(POLL); } catch { POLL = null; }
  paintPoll();
}
function paintPoll() {
  const el = $('#poll-slot');
  if (!el) return;
  el.innerHTML = pollCard();
  fixAvatars(el);
}
async function castPoll(rid) {
  if (REHEARSE) { POLL = { ...POLL, err: 'Rehearsal: votes are off. This is where the vote would lock in.' }; return paintPoll(); }
  if (!confirm(`Lock in ${team(rid).name}? You can't change it.`)) return;
  try {
    const r = await fetch('/api/poll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: SHAKEUP.poll.id, pick: rid, options: pollChoices(), device: pollDevice() }) });
    const body = await r.json().catch(() => ({}));
    keepDevice(body);
    POLL = body.enabled ? { ...body, err: r.ok ? '' : body.error } : { ...POLL, err: body.error || `Poll answered ${r.status}` };
  } catch (e) { POLL = { ...POLL, err: String(e.message || e) }; }
  paintPoll();
}

// ---------- live week: weekly rankings and projected standings ----------
// every team this week: projected final (banked plus the rest projected, as on the matchup cards), what's banked, who's
// still to play, and how its game stands (from the night desk's board: locked once the other side can't catch up)
function liveWeek() {
  const sides = {};
  nightBoard(DATA).forEach((g) => [g.lead, g.trail].forEach((s) => (sides[s.t.rid] = { s, g, opp: (s === g.lead ? g.trail : g.lead).t, ahead: s === g.lead && g.gap > 0 })));
  const rows = DATA.previews.flatMap((p) => [[p.a, p.projA, p.liveA, p.winA], [p.b, p.projB, p.liveB, 1 - p.winA]]).map(([rid, proj, banked, win]) => {
    const x = sides[rid];
    return { t: team(rid), proj, banked: banked || 0, win, left: x?.s.left || [], opp: x?.opp, locked: !!x?.g.locked, final: !!x?.g.final, ahead: !!x?.ahead, gap: x?.g.gap || 0 };
  });
  rows.sort((a, b) => b.proj - a.proj || b.banked - a.banked);
  // standings now and after the week if every game goes the way it's trending; record first, then points for (Sleeper)
  const order = (list) => [...list].sort((a, b) => b.w - a.w || b.pf - a.pf);
  const base = DATA.teams.map((t) => ({ t, w: t.wins + 0.5 * t.ties, pf: t.pf }));
  const seedNow = new Map(order(base).map((x, i) => [x.t.rid, i + 1]));
  rows.forEach((r) => (r.won = r.final ? r.ahead : r.win >= 0.5)); // a finished game goes by the score, not the odds
  const after = order(rows.map((r) => ({ t: r.t, r, w: r.t.wins + 0.5 * r.t.ties + (r.won ? 1 : 0), pf: r.t.pf + r.proj })));
  return { rows, standings: after.map((x, i) => ({ ...x, seed: i + 1, was: seedNow.get(x.t.rid) })) };
}

// "Your week": a note from the desk to whoever picked a team. Winning gets congratulated, losing gets roasted, and a
// coin flip gets a pep talk if they're ahead or a reality check if they're behind. Wording rotates daily.
function yourWeek(rows, standings) {
  if (!myTeam) return `<section class="you-card glass empty"><p>Pick your team in the top right and the desk will tell you how your week is going. No sugarcoating.</p></section>`;
  const k = rows.findIndex((r) => r.t.rid === myTeam), r = rows[k];
  if (!r) return '';
  const t = r.t, N = esc(firstName(t)), o = rows.find((x) => x.t === r.opp), O = r.opp ? esc(r.opp.name) : 'your opponent';
  const P = pct(r.win), margin = o ? Math.abs(r.proj - o.proj) : 0, star = r.left[0] ? esc(r.left[0].name) : '';
  const st = standings.find((x) => x.t.rid === myTeam), mv = st ? st.was - st.seed : 0;
  const kind = r.final || r.locked ? (r.ahead ? 'won' : 'lost') : r.win >= 0.7 ? 'good' : r.win <= 0.3 ? 'bad' : r.win >= 0.5 ? 'up' : 'down';
  const lines = {
    won: [`It's over, ${N}, and you won. ${O} can't catch you${r.final ? '' : ', Monday or not'}. Take the victory lap, you earned this one.`,
      `${N}, ${O} is done. Lock it in, screenshot it, send it to the group chat.`],
    lost: [`${N}, it's done. ${O} beat you and it wasn't close. Go set next week's lineup before you embarrass yourself again.`,
      `Bad news, ${N}: ${O} already has this one in the bag. You can stop refreshing now.`,
      `${N}. Buddy. ${O} can't lose this from here. Maybe try starting players who score.`],
    good: [`Look at you, ${N}. ${P} to beat ${O}, ${f1(r.proj)} projected, ${ordinal(k + 1)} in the league. Don't get used to it.`,
      `${N}, this is what a functioning lineup looks like. ${P} to win${star ? ` with ${star} still to play` : ''}. Enjoy it.`],
    bad: [`${N}, ${P}. That's your chance against ${O}. Your lineup is a cry for help.`,
      `Bold strategy, ${N}: get outscored by ${f1(margin)} and hope ${O} forgets to show up. ${P} odds.`,
      `${N}, the model ran 10,000 simulations and you lose most of them. ${P} to beat ${O}. Thoughts and prayers.`],
    up: [`This is yours, ${N}. ${P} to win, a ${f1(margin)}-point game${star ? `, and ${star} still to play` : ''}. Lock in.`,
      `${N}, you're ${f1(margin)} up on ${O} by projection. Nobody blinks. Let's go.`],
    down: [`Don't get your hopes up, ${N}. ${P} to win and you're counting on ${star || 'a miracle'}. Brave.`,
      `${N}, it's close, and close usually means you lose. ${P} against ${O}. Start drafting the excuses.`],
  }[kind];
  const seed = [...`${chicagoDate()}${t.rid}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  let msg = lines[Math.abs(seed) % lines.length];
  const so = r.banked > 0 ? '' : 'projected '; // before kickoff it's all projection
  if (k === rows.length - 1) msg += ` Also: ${so}dead last in the league this week. Even your bench is embarrassed.`;
  else if (k === 0 && !msg.includes('1st in the league')) msg += ` ${so ? 'Projected top' : 'Top'} score in the whole league, too.`;
  const chip = (v, cls = '') => `<span class="you-chip ${cls}">${v}</span>`;
  const bull = DATA.bull && DATA.bull.state !== 'final' && DATA.bull.rows.find((x) => x.rid === myTeam);
  const tone = kind === 'won' || kind === 'good' ? 'good' : kind === 'lost' || kind === 'bad' ? 'bad' : 'close';
  return `<section class="you-card glass ${tone}" aria-label="Your week">
      ${headshot(t, 'you-face')}
      <div class="you-body">
        <small>Your week, ${N}</small>
        <p class="you-msg">${msg}</p>
        <div class="you-chips">
          ${chip(`${ordinal(k + 1)} this week`)}
          ${chip(r.final || r.locked ? (r.ahead ? 'Won' : 'Lost') : `${P} to win`, r.win >= 0.5 ? 'up' : 'down')}
          ${st ? chip(`Projected ${ordinal(st.seed)}${mv ? ` (${mv > 0 ? 'up' : 'down'} ${Math.abs(mv)})` : ''}`, mv > 0 ? 'up' : mv < 0 ? 'down' : '') : ''}
          ${bull ? chip(`Money week: ${awayText(bull)}`) : ''}
        </div>
      </div>
    </section>`;
}

function viewLive() {
  // after the reveal DATA holds the new rankings; this page keeps showing the week that just ended
  if (DATA.after) return withData(DATA.after, viewLive);
  const fin = !!DATA.finalCall;
  const wk = DATA.previews[0]?.week, { rows, standings } = liveWeek();
  const pt = DATA.meta.playoffTeams, n = rows.length;
  const max = Math.max(1, ...rows.map((r) => r.proj)) * 1.04;
  const played = DATA.live?.teams.length || 0;
  const status = (r) => {
    const o = r.opp ? esc(r.opp.name) : 'their opponent';
    if (r.final) return r.ahead ? `<span class="st-chip won">Beat ${o}</span>` : `<span class="st-chip lost">Lost to ${o}</span>`;
    if (r.locked) return r.ahead ? `<span class="st-chip won">Locked up vs ${o}</span>` : `<span class="st-chip lost">Can't catch ${o}</span>`;
    return `<span class="st-chip ${r.win >= 0.5 ? 'up' : 'down'}">${pct(r.win)} to beat ${o}</span>`;
  };
  const row = (r, i) => {
    const t = r.t, rest = Math.max(0, r.proj - r.banked);
    const tip = `${t.name}: ${f1(r.banked)} scored, ${f1(rest)} more projected from ${r.left.length ? r.left.map((x) => x.name).join(', ') : 'nobody'}`;
    return `<li class="wr ${t.rid === myTeam ? 'mine' : ''} ${i === n - 1 ? 'last' : ''}">
        <span class="wr-n">${i + 1}</span>${avatar(t)}
        <div class="wr-who"><b>${esc(t.name)}${champTag(t, false)}</b>${status(r)}</div>
        <div class="wr-bar" data-tip="${esc(tip)}"><i class="bk" style="width:${(r.banked / max) * 100}%"></i><i class="rs" style="width:${(rest / max) * 100}%"></i></div>
        <div class="wr-num"><b>${f1(r.proj)}</b><small>${fin ? 'Final' : `${f1(r.banked)} in, ${r.left.length ? `${r.left.length} to play` : 'all done'}`}</small></div>
      </li>`;
  };
  const srow = (x) => {
    const t = x.t, r = x.r, won = r.won, mv = x.was - x.seed;
    const after = `${t.wins + (won ? 1 : 0)}-${t.losses + (won ? 0 : 1)}${t.ties ? `-${t.ties}` : ''}`;
    return `<tr class="${t.rid === myTeam ? 'mine' : ''} ${x.seed === pt ? 'cut' : ''}">
        <td class="num seed"><b>${x.seed}</b>${mv ? `<span class="move ${mv > 0 ? 'up' : 'down'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : ''}</td>
        <td class="tm">${avatar(t, 'avatar xs')}${esc(short(t.name, 22))}${champTag(t, false)}</td>
        <td class="num now">${record(t)}<small> (${ordinal(x.was)})</small></td>
        <td class="num"><b data-tip="${esc(`${t.name}: ${after} with ${f1(x.pf)} points for after the week`)}">${after}</b></td>
        <td class="num"><span class="${won ? 'plus' : 'minus'}" data-tip="${esc(`${t.name} wins this week in ${pct(r.win)} of outcomes`)}">${r.final || r.locked ? (won ? 'W' : 'L') : pct(r.win)}</span></td>
        <td class="num pf">${f1(x.pf)}</td>
        <td class="num"><b>${pct(t.playoffPct)}</b></td>
      </tr>`;
  };
  const head = fin
    ? `<section class="view-head">
        <div>
          <h2 class="page-title"><span class="wk">Week ${wk} final</span>Final Scores</h2>
          <p>Every game is in. The week, best score to worst, and the standings it leaves behind. Sleeper makes it official Tuesday; the new power rankings are ready now.</p>
        </div>
        <div class="sources"><span class="chip"><span class="dot"></span>All games final</span>${DATA.fetched ? `<span class="chip">Scores as of ${esc(DATA.fetched)}</span>` : ''}</div>
      </section>`
    : `<div class="hero">
      ${leadStory()}
      <section class="view-head">
        <div>
          <h2 class="page-title"><span class="wk">Week ${wk} live</span>Weekly Rankings</h2>
          <p>How this week is going, best to worst: everything scored so far plus the projection for everyone still to play. The power rankings are on hold until the week is final and come back ${rankingsLocked() ? 'tonight after the game' : 'Tuesday morning'}.</p>
        </div>
        <div class="sources"><span class="chip"><span class="dot live"></span>${played} NFL team${played === 1 ? '' : 's'} played so far</span>${DATA.fetched ? `<span class="chip">Scores as of ${esc(DATA.fetched)}</span>` : ''}</div>
      </section>
    </div>`;
  return `
    ${head}
    ${fin ? revealCta(revealed) : yourWeek(rows, standings)}
    <div class="live-grid">
      <section class="panel glass live-panel wk-rank">
        <h2>Week ${wk}, top to bottom</h2>
        <p class="sub">${fin ? 'Final scores. 12th is the worst week in the league.' : 'By projected final score. Dark is banked, striped is still to come. 12th is the worst week in the league.'}</p>
        <ol class="wr-list">${rows.map(row).join('')}</ol>
      </section>
      <section class="panel glass live-panel wk-stand">
        <h2>${fin ? 'Standings after the week' : 'Projected standings'}</h2>
        <p class="sub">${fin ? `The table with week ${wk} counted, points added for the tiebreaker.` : `The table after week ${wk} if every game ends the way it's trending, projected points added for the tiebreaker.`} The dashed line is the playoff cut (top ${pt}).</p>
        <div class="heat-wrap"><table class="table stand">
          <thead><tr><th class="num">Seed</th><th>Team</th><th class="num">Before</th><th class="num">After</th><th class="num">This week</th><th class="num pf">PF after</th><th class="num">Playoffs</th></tr></thead>
          <tbody>${standings.map(srow).join('')}</tbody>
        </table></div>
        <p class="sub stand-note">Playoff odds are from 10,000 simulations of the season with this week's ${fin ? 'final' : 'live'} scores in.</p>
      </section>
    </div>`;
}

// ---------- the final call: from the final scores to the new power rankings ----------
// The button at the top of the final-scores page. Pressing it asks who you are, gives you the verdict on your week
// (congratulations or a roast), then loads the new power rankings.
function revealCta(seen) {
  return `<div class="unveil-cta">${seen
    ? '<a class="cta" href="#rankings">Back to the power rankings</a>'
    : '<button type="button" class="cta" data-reveal>Done with Live Ranks, Show me the Power Ranking</button>'}</div>`;
}

// the button turns into a football and flies off like a deep pass, then the team picker opens
const FOOTBALL = `<svg viewBox="-50 -50 100 100" aria-hidden="true"><defs><clipPath id="fb-clip"><path d="M-47 0Q0-42 47 0Q0 42-47 0Z"/></clipPath></defs>
  <g transform="rotate(-38)"><path d="M-47 0Q0-42 47 0Q0 42-47 0Z" fill="#7B3735"/>
  <g clip-path="url(#fb-clip)" fill="#FDE9E3"><rect x="-33" y="-40" width="9" height="80"/><rect x="24" y="-40" width="9" height="80"/></g>
  <g stroke="#fff" stroke-width="3.4" stroke-linecap="round"><path d="M-17 0H17"/><path d="M-12-5V5M-6-5V5M0-5V5M6-5V5M12-5V5"/></g></g></svg>`;
function passThenReveal(btn) {
  if (calm() || !btn.animate || $('.unveil') || btn.classList.contains('thrown')) return openReveal();
  btn.classList.add('thrown');
  const r = btn.getBoundingClientRect(), size = 72;
  const ball = document.createElement('div');
  ball.className = 'pass-ball';
  ball.innerHTML = FOOTBALL;
  ball.style.left = `${r.left + r.width / 2 - size / 2}px`;
  ball.style.top = `${r.top + r.height / 2 - size / 2}px`;
  document.body.append(ball);
  // the snap: the button squeezes down into the ball
  btn.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.15)', opacity: 0 }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
  ball.animate([{ transform: 'scale(0.2) rotate(0deg)', opacity: 0 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
  // the throw: up over the field in an arc, a tight spiral, shrinking as it goes deep, out past the top right
  const dx = innerWidth - r.left + 120, dy = -(r.top + 160), h = Math.min(260, innerHeight * 0.35), frames = [];
  for (let k = 0; k <= 20; k++) {
    const t = k / 20, x = dx * t, y = dy * t - h * 4 * t * (1 - t);
    frames.push({ transform: `translate(${x}px, ${y}px) rotate(${-25 + 30 * t}deg) scale(${1 - 0.45 * t}, ${(1 - 0.45 * t) * (0.75 + 0.25 * Math.abs(Math.cos(t * Math.PI * 6)))})` });
  }
  setTimeout(() => {
    const fly = ball.animate(frames, { duration: 1100, easing: 'cubic-bezier(0.3, 0.1, 0.6, 1)', fill: 'forwards' });
    fly.finished.then(() => ball.remove());
    setTimeout(() => { openReveal(); btn.getAnimations().forEach((a) => a.cancel()); btn.classList.remove('thrown'); }, 850);
  }, 260);
}

// the verdict on one team's week, from the final scores
function verdict(rid) {
  const { rows, standings } = liveWeek();
  const k = rows.findIndex((x) => x.t.rid === rid), r = rows[k];
  if (!r) return null;
  const o = rows.find((x) => x.t === r.opp), me = r.banked, them = o ? o.banked : 0, margin = Math.abs(me - them);
  const t = r.t, N = esc(firstName(t)), OF = r.opp ? esc(firstName(r.opp)) : 'your opponent', O = r.opp ? esc(r.opp.name) : 'your opponent';
  const kind = me > them ? 'won' : me < them ? 'lost' : 'tie';
  const size = margin >= 30 ? 'big' : margin < 5 ? 'close' : 'mid';
  const score = `${f1(me)} to ${f1(them)}`, back = `${f1(them)} to ${f1(me)}`;
  const lines = {
    won: {
      big: [`${N}, you didn't beat ${OF}, you buried them. ${score}. Somebody check on ${OF}.`,
        `${score}. ${N} took ${O} apart by ${f1(margin)} and didn't even say sorry.`],
      close: [`${N}, you won by ${f1(margin)}. That's it. You'll tell everyone it was never in doubt. It was.`,
        `Survived, ${N}. ${score} over ${OF}. Your heart rate can come down now.`],
      mid: [`Congratulations, ${N}. ${score} over ${O}. Go talk your trash, you earned it.`,
        `W secured, ${N}. ${score} over ${OF}. Screenshot it and send it to the group chat.`],
    },
    lost: {
      big: [`${N}. ${back}. ${OF} didn't beat you, they filed a restraining order against your lineup.`,
        `You lost by ${f1(margin)}, ${N}. That's not a loss, that's a cry for help.`],
      close: [`${N}, you lost by ${f1(margin)}. One field goal. Think about that all week.`,
        `${back}, ${N}. ${f1(margin)} points. Somewhere on your bench is the guy who would have won it.`],
      mid: [`${N}, ${OF} beat you ${back}. Your lineup should be ashamed. So should you.`,
        `Tough one, ${N}. Kidding, it wasn't tough, you just lost. ${back} to ${O}.`],
    },
    tie: { mid: [`A tie, ${N}. ${score}. Nobody wins. Mostly you.`] },
  }[kind];
  const pool = lines[size] || lines.mid;
  const seed = [...`${chicagoDate()}${rid}`].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
  let extra = '';
  if (k === 0) extra = kind === 'won' ? 'Top score in the whole league, too.' : 'Top score in the whole league, and you still lost. Brutal.';
  else if (k === rows.length - 1) extra = 'Also the lowest score in the league. Even your bench is embarrassed.';
  else if (kind === 'lost' && k < 3) extra = `The ${ordinal(k + 1)} best score in the league, and it still wasn't enough.`;
  else if (kind === 'won' && k >= rows.length - 3) extra = `Only the ${ordinal(k + 1)} best score in the league. ${OF} just had it worse.`;
  const st = standings.find((x) => x.t.rid === rid), mv = st ? st.was - st.seed : 0;
  const rec = `${t.wins + (kind === 'won' ? 1 : 0)}-${t.losses + (kind === 'lost' ? 1 : 0)}${t.ties + (kind === 'tie' ? 1 : 0) ? `-${t.ties + (kind === 'tie' ? 1 : 0)}` : ''}`;
  const bull = DATA.bull?.rows?.[0]?.rid === rid ? `Closest to ${DATA.bull.target}: the $${MONEY_WEEK.prize} is yours` : '';
  return { t, kind, me, them, opp: r.opp, msg: pool[Math.abs(seed) % pool.length], extra, rank: k + 1, rec, seed: st?.seed, mv, bull };
}

// the overlay: pick your team, get the verdict, then the new power rankings load in
function openReveal() {
  if ($('.unveil')) return;
  const live = DATA;
  const el = document.createElement('div');
  el.className = 'unveil';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'unveil-title');
  const close = () => { el.remove(); document.documentElement.classList.remove('locked'); };
  const pick = () => `
    <div class="unveil-card glass rim">
      <button type="button" class="unveil-x" aria-label="Close">×</button>
      <h2 id="unveil-title">Which team is yours?</h2>
      <p class="sub">The desk has your result. Brace yourself.</p>
      <div class="unveil-teams">${[...live.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => `
        <button type="button" class="unveil-team ${t.rid === myTeam ? 'mine' : ''}" data-rid="${t.rid}">${avatar(t)}<span><b>${esc(t.name)}</b><small>${esc(firstName(t))}</small></span></button>`).join('')}
      </div>
    </div>`;
  const told = (v) => `
    <div class="unveil-card glass rim ${v.kind}">
      <div class="verdict">
        ${headshot(v.t, `verdict-face${v.kind === 'lost' ? ' drained' : ''}`)}
        <div>
          <p class="verdict-wl"><b>${v.kind === 'won' ? 'W' : v.kind === 'lost' ? 'L' : 'T'}</b><span>${f1(v.me)} to ${f1(v.them)}${v.opp ? ` vs ${esc(v.opp.name)}` : ''}</span></p>
          <h2 id="unveil-title" class="verdict-msg">${v.msg}</h2>
          ${v.extra ? `<p class="verdict-extra">${esc(v.extra)}</p>` : ''}
          <div class="you-chips">
            <span class="you-chip">${v.rec}</span>
            <span class="you-chip">${ordinal(v.rank)} score of ${live.teams.length}</span>
            ${v.seed ? `<span class="you-chip ${v.mv > 0 ? 'up' : v.mv < 0 ? 'down' : ''}">${ordinal(v.seed)} in the standings${v.mv ? ` (${v.mv > 0 ? 'up' : 'down'} ${Math.abs(v.mv)})` : ''}</span>` : ''}
            ${v.bull ? `<span class="you-chip up">${esc(v.bull)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="unveil-load" role="status">
        <video class="kick" autoplay muted loop playsinline poster="assets/kicker-poster.webp" aria-hidden="true"><source src="assets/kicker.webm" type="video/webm"><source src="assets/kicker.mp4" type="video/mp4"></video>
        <p>Pulling in the new power rankings…</p>
        <div class="unveil-bar"><i></i></div>
      </div>
    </div>`;
  el.innerHTML = pick();
  document.body.append(el);
  document.documentElement.classList.add('locked');
  fixAvatars(el);
  el.querySelector('.unveil-team.mine, .unveil-team')?.focus();
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.classList.contains('going')) close(); });
  el.addEventListener('click', async (e) => {
    if (e.target.closest('.unveil-x') || e.target === el) { if (!el.classList.contains('going')) close(); return; }
    const b = e.target.closest('.unveil-team');
    if (!b || el.classList.contains('going')) return;
    el.classList.add('going');
    const rid = Number(b.dataset.rid);
    myTeam = rid;
    store.set('ph-my-team', String(rid));
    $('#my-team').value = String(rid);
    el.innerHTML = told(verdict(rid));
    fixAvatars(el);
    const v = el.querySelector('video');
    if (calm()) v?.remove(); else v?.play?.().catch(() => {});
    // let the verdict sink in while the bar fills; the new rankings are worked out underneath
    const READ_MS = calm() ? 3500 : 6000;
    el.querySelector('.unveil-bar i').style.animationDuration = `${READ_MS}ms`;
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 60)); // paint the verdict before the heavy lifting
    buildFinal();
    if (!REHEARSE) store.set('ph-final-seen', finalSeenKey());
    loadPoll(); // the shakeup poll sits on top of the new rankings
    await new Promise((r) => setTimeout(r, Math.max(0, READ_MS - (performance.now() - t0))));
    el.classList.add('out');
    await new Promise((r) => setTimeout(r, calm() ? 0 : 350));
    close();
    paintTabs();
    if (location.hash === '#rankings') route({ fresh: true }); else location.hash = '#rankings';
  });
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

// three headlines in one square card (four on night-edition nights): swipe, arrows or dots; the active dot's fill is the
// auto-advance timer
const CAROUSEL_SIZE = 3;
function leadStory() {
  const s = DATA.stories;
  if (!s?.lead) return '';
  const stories = [s.lead, ...s.more].slice(0, CAROUSEL_SIZE + (s.night ? 1 : 0) + (s.extra ? 1 : 0));
  const date = new Date(AT || DATA.now).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
  const cast = (st) => st.rids.map(team).filter(Boolean).map((t) => `
    <div class="cast-team">${avatar(t)}
      <div class="cast-name"><b>${esc(t.name)}${champTag(t, false)}</b><small>No. ${t.powerRank} power, ${record(t)}</small></div>
      ${rankSpark(t)}
      <span class="cast-odds"><b>${pct(t.playoffPct)}</b><small>playoffs</small></span>
    </div>`).join('');
  const slide = (st, i) => `
    <article class="slide${st.type === 'shakeup' ? ' breaking' : ''}" id="slide-${i}" role="group" aria-roledescription="slide" aria-label="Headline ${i + 1} of ${stories.length}">
      <div class="slide-top">
        <p class="kicker">${st.type === 'shakeup' ? '<span class="brk"><i aria-hidden="true"></i>Breaking</span>' : ''}<span>${i ? (st.type === 'monday' || st.type === 'locked' || (st.type === 'sass' && s.night) ? 'Tonight' : 'Also today') : esc(date)}</span><span class="k">${esc(st.kicker)}</span></p>
        ${leadFaces(st)}
      </div>
      <${i ? 'h2' : 'h1'} class="lead-hed">${esc(st.headline)}</${i ? 'h2' : 'h1'}>
      <p class="lead-deck">${esc(st.deck)}</p>
      <div class="cast">${cast(st)}</div>
    </article>`;
  const arrow = (dir, label, d) => `<button type="button" class="car-arrow" data-dir="${dir}" aria-label="${label}"><svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  return `
    <section class="lead-car glass rim" aria-roledescription="carousel" aria-label="Today's headlines">
      ${onHold() ? `<p class="desk-note" role="status"><span class="live-dot" aria-hidden="true"></span>${esc(NEWS_CLOCK.holdNote)}</p>` : ''}
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
      ${schedHeat ? `<section class="panel glass span-12"><h2>Schedule strength</h2><p class="sub">Each cell is that week's opponent by current power rank; red is a top team, green a bottom one. Teams run toughest to easiest, with the schedule's effect in expected wins next to the name. This counts for ${Math.round((DATA.meta.weights.sos || 0) * 100 / weightTotal())}% of the power score.</p>${schedHeat}</section>` : ''}
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

// ---------- admin (Dan only: #admin, reached from the footer logo) ----------
// Every action goes to /api/admin with the password, which the server checks; this page only shows what the server
// allows. A manual pull lands in a private draft; the preview recomputes the power rankings with any weights, on the
// live snapshot or the draft, optionally counting the week in progress as final; nothing changes for anyone else
// until Publish.
const WEIGHT_INFO = {
  rosProj: ['Roster: best lineup', 'Projected weekly points of the best rest-of-season starting lineup'],
  depth: ['Roster: bench', 'Value of the best bench pieces'],
  sos: ['Schedule left', 'Expected wins vs the actual remaining opponents, minus vs an average slate'],
  allPlay: ['All-play', 'Record if you played every team every week'],
  pfPerGame: ['Points per game', 'Season scoring average'],
  winPct: ['Record', 'Actual win percentage'],
  standing: ['Standings place', 'Place in the real standings: record, then points for'],
  form: ['Last 3 weeks', 'Scoring average over the last three weeks'],
  lastWeek: ['Last week', 'Last week\'s score on its own'],
};
const adminState = { pw: null, status: null, draft: null, source: 'live', week: 'off', weights: { ...WEIGHTS_PROPOSED }, msg: '', busy: false };
try { adminState.pw = sessionStorage.getItem('ph-admin'); } catch { /* storage unavailable */ }

async function adminCall(action, extra = {}) {
  const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminState.pw, action, ...extra }) });
  const body = await r.json().catch(() => ({ error: `Admin API answered ${r.status}` }));
  if (!r.ok) { const e = new Error(body.error || `Admin API answered ${r.status}`); e.status = r.status; e.body = body; throw e; }
  return body;
}

function adminPreview() {
  const base = adminState.source === 'draft' && adminState.draft ? adminState.draft : RAW;
  const raw = asFinal(base, adminState.week);
  const D = computeLeague({ ...leagueInput(raw).input, weights: adminState.weights, sims: 2000 });
  return { D, raw };
}

function adminLogin(err = '') {
  return `
    <section class="view-head"><div>
      <h1><span class="wk">Admin</span>Front office</h1>
      <p>For the commissioner\'s desk only.</p>
    </div></section>
    <form class="panel glass adm-login" id="adm-login">
      <label for="adm-pw">Password</label>
      <div class="adm-row"><input id="adm-pw" type="password" inputmode="numeric" autocomplete="current-password" required><button type="submit" class="adm-btn primary">Unlock</button></div>
      ${err ? `<p class="adm-err" role="alert">${esc(err)}</p>` : ''}
    </form>`;
}

function viewAdmin() {
  if (!adminState.status) return adminLogin(adminState.loginErr || '');
  const st = adminState.status, pub = st.config?.weights, staged = st.staged;
  const wk = DATA.previews[0]?.week;
  const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never');
  const draftOk = st.draft && st.draft.key === st.key;
  const seg = (name, val, label) => `<button type="button" data-${name}="${val}" aria-pressed="${adminState[name] === val}">${label}</button>`;
  const total = Object.values(adminState.weights).reduce((a, b) => a + b, 0) || 1;
  const slider = (k) => `
    <label class="adm-w" title="${esc(WEIGHT_INFO[k][1])}">
      <span class="adm-wn">${WEIGHT_INFO[k][0]}<small>${esc(WEIGHT_INFO[k][1])}</small></span>
      <input type="range" min="0" max="0.4" step="0.01" value="${adminState.weights[k] || 0}" data-w="${k}">
      <b data-wv="${k}">${Math.round(((adminState.weights[k] || 0) / total) * 100)}%</b>
    </label>`;
  return `
    <section class="view-head"><div>
      <h1><span class="wk">Admin</span>Front office</h1>
      <p>Pull fresh data, try out power-score weights, and publish when it looks right. Published weights wait here until you press Update rankings live; nothing changes for anyone else before that.</p>
    </div></section>
    <div class="adm-grid">
      <section class="panel glass adm-status">
        <h2>What's live</h2>
        <dl>
          <div><dt>League snapshot</dt><dd>${esc(st.key)}, revision ${st.rev}<small>${RAW.isDemo ? 'Demo snapshot on this page' : `Fetched ${esc(when(RAW.fetched))}`}</small></dd></div>
          <div><dt>Power-score weights</dt><dd>${pub ? 'Custom' : 'Default'}<small>${pub ? `Published ${esc(when(st.config.at))}` : 'The original 45 / 10 / 45 mix'}</small></dd></div>
          ${staged ? `<div><dt>Waiting to go live</dt><dd>${staged.weights ? 'Custom weights' : 'Default weights'}<small>Published ${esc(when(staged.at))}, not live yet</small></dd></div>` : ''}
          <div><dt>Rankings sources</dt><dd>${RAW.ros?.updated ? `Scraped ${esc(when(RAW.ros.updated))}` : 'Unavailable'}<small>FantasyPros, DraftSharks and LeagueLogs; normally once a morning</small></dd></div>
          <div><dt>Your draft</dt><dd>${st.draft ? `Pulled ${esc(when(st.draft.fetched))}` : 'None yet'}<small>${st.draft ? (draftOk ? 'Ready to publish' : 'From an earlier snapshot window: pull again to publish') : 'Private until published'}</small></dd></div>
        </dl>
        <div class="adm-actions">
          <button type="button" class="adm-btn primary" data-act="pull" ${st.nextPullIn ? 'disabled' : ''}>${st.nextPullIn ? `Pull again in ${st.nextPullIn}s` : 'Pull fresh from Sleeper'}</button>
          <button type="button" class="adm-btn" data-act="pub-data" ${draftOk ? '' : 'disabled'}>Publish draft data</button>
          <button type="button" class="adm-btn" data-act="ros">Refresh rankings sources</button>
          <a class="adm-btn" href="./?rehearse=1#live">Rehearse the 10:45pm flow</a>
        </div>
        <p class="sub">One pull every two minutes at most. A pull goes to your draft only; the site keeps its once-a-morning schedule.</p>
        ${adminState.msg ? `<p class="adm-msg" role="status">${esc(adminState.msg)}</p>` : ''}
      </section>
      <section class="panel glass adm-weights">
        <h2>Power-score weights</h2>
        <div class="filters adm-seg" role="group" aria-label="Data">${seg('source', 'live', 'Live snapshot')}${st.draft ? seg('source', 'draft', 'Your draft') : ''}</div>
        <div class="filters adm-seg" role="group" aria-label="This week">${seg('week', 'off', `Through week ${DATA.meta.lastScored}`)}${wk ? `${seg('week', 'now', `Week ${wk} final as it stands`)}${seg('week', 'proj', `Week ${wk} projected finish`)}` : ''}</div>
        <div class="filters adm-seg" role="group" aria-label="Presets">
          <button type="button" data-preset="default">Load default</button><button type="button" data-preset="proposed">Load proposed</button>${pub ? '<button type="button" data-preset="published">Load live</button>' : ''}${staged?.weights ? '<button type="button" data-preset="staged">Load waiting</button>' : ''}
        </div>
        <div class="adm-sliders">${Object.keys(WEIGHT_INFO).map(slider).join('')}</div>
        <div class="adm-actions">
          <button type="button" class="adm-btn primary" data-act="pub-weights">Publish these weights</button>
          ${pub ? '<button type="button" class="adm-btn" data-act="pub-default">Go back to default weights</button>' : ''}
        </div>
        <div class="adm-actions">
          <button type="button" class="adm-btn primary" data-act="golive" ${staged ? '' : 'disabled'}>Update rankings live</button>
          ${staged ? '<button type="button" class="adm-btn" data-act="unstage">Discard waiting weights</button>' : ''}
        </div>
        <p class="sub">${staged ? `Waiting to go live: ${staged.weights ? 'your published weights' : 'the default weights'}. The power rankings tab keeps the current weights until you press Update rankings live.` : 'Publishing saves the weights here first. The power rankings tab only changes when you press Update rankings live.'}</p>
      </section>
    </div>
    <section class="panel glass adm-results" id="adm-results">${adminResults()}</section>`;
}

// the preview next to what everyone sees now: a slope chart from live rank to preview rank, then the table
function adminResults() {
  const { D } = adminPreview(), n = D.teams.length;
  const H = 30 * n + 20, x0 = 150, x1 = 410, y = (r) => 20 + (r - 1) * 30;
  const lines = D.teams.map((t) => {
    const a = DATA.byRid[t.rid].powerRank, b = t.powerRank, c = DATA.color[t.rid], mine = t.rid === myTeam;
    return `<g class="${mine ? 'mine' : ''}" data-tip="${esc(`${t.name}: ${ordinal(a)} now, ${ordinal(b)} in the preview`)}">
      <line x1="${x0}" y1="${y(a)}" x2="${x1}" y2="${y(b)}" stroke="${c}" stroke-width="${mine ? 4 : 2.5}"/>
      <circle cx="${x0}" cy="${y(a)}" r="5" fill="${c}"/><circle cx="${x1}" cy="${y(b)}" r="5" fill="${c}"/>
      <text x="${x0 - 12}" y="${y(a) + 4}" text-anchor="end" class="label">${esc(short(t.name, 16))}</text>
      <text x="${x1 + 12}" y="${y(b) + 4}" class="label">${b}. ${esc(short(t.name, 16))}</text></g>`;
  }).join('');
  const chart = `<svg class="chart adm-slope" viewBox="0 0 560 ${H}" role="img" aria-label="Live power rank to preview rank">
    <text x="${x0}" y="10" text-anchor="middle" class="axis-title">Live</text><text x="${x1}" y="10" text-anchor="middle" class="axis-title">Preview</text>${lines}</svg>`;
  const row = (t) => {
    const was = DATA.byRid[t.rid].powerRank, mv = was - t.powerRank;
    return `<tr class="${t.rid === myTeam ? 'mine' : ''}">
      <td class="num"><b>${t.powerRank}</b></td>
      <td>${mv ? `<span class="move ${mv > 0 ? 'up' : 'down'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : '<span class="move-none">–</span>'}</td>
      <td class="tm">${avatar(t, 'avatar xs')}${esc(short(t.name, 22))}</td>
      <td class="num">${record(t)}</td>
      <td class="num">${DATA.byRid[t.rid].score.toFixed(1)} → <b>${t.score.toFixed(1)}</b></td>
      <td class="num">${t.rosScore != null ? Math.round(t.rosScore) : '–'}</td>
      <td class="num">${t.sosScore != null ? Math.round(t.sosScore) : '–'}</td>
      <td class="num">${Math.round(t.resultsScore)}</td>
      <td class="num">${pct(t.playoffPct)}</td>
    </tr>`;
  };
  const moved = D.teams.filter((t) => DATA.byRid[t.rid].powerRank !== t.powerRank).length;
  return `<h2>Preview</h2>
    <p class="sub">${moved ? `${moved} of ${n} teams move compared with what the site shows now.` : 'Same order as what the site shows now.'} ${adminState.week === 'off' ? '' : `Week ${DATA.previews[0]?.week} is counted as final (${adminState.week === 'now' ? 'scores so far' : 'projected finish'}), so records include it.`}</p>
    <div class="adm-res">
      <div class="adm-chart">${chart}</div>
      <div class="heat-wrap"><table class="table">
        <thead><tr><th class="num">Rank</th><th></th><th>Team</th><th class="num">Record</th><th class="num">Score</th><th class="num">Roster</th><th class="num">Sched</th><th class="num">Results</th><th class="num">Playoffs</th></tr></thead>
        <tbody>${D.teams.map(row).join('')}</tbody>
      </table></div>
    </div>`;
}

let adminTimer = 0;
function paintAdminResults() {
  clearTimeout(adminTimer);
  adminTimer = setTimeout(() => {
    const el = $('#adm-results');
    if (el) { el.innerHTML = adminResults(); fixAvatars(el); }
    const total = Object.values(adminState.weights).reduce((a, b) => a + b, 0) || 1;
    document.querySelectorAll('[data-wv]').forEach((b) => (b.textContent = `${Math.round(((adminState.weights[b.dataset.wv] || 0) / total) * 100)}%`));
  }, 120);
}

async function adminAct(act) {
  const confirmations = {
    'pub-data': 'Publish the draft? Everyone gets this snapshot within a minute.',
    'pub-weights': 'Publish these weights? They wait here until you press Update rankings live.',
    'pub-default': 'Publish the default weights? They wait here until you press Update rankings live.',
    golive: 'Update the power rankings for everyone with the waiting weights? Visitors see them within a minute.',
    unstage: 'Discard the waiting weights? The live rankings stay as they are.',
    ros: 'Re-scrape FantasyPros, DraftSharks and LeagueLogs now? Everyone gets the new values within a minute. No Sleeper call.',
  };
  if (confirmations[act] && !confirm(confirmations[act])) return;
  adminState.msg = act === 'pull' ? 'Pulling from Sleeper…' : act === 'golive' ? 'Updating the live rankings…' : act === 'unstage' ? 'Discarding…' : act === 'ros' ? 'Scraping the ranking sites…' : 'Publishing…';
  route();
  try {
    if (act === 'pull') {
      const r = await adminCall('pull');
      adminState.status = r; adminState.draft = r.snapshot; adminState.source = 'draft';
      adminState.msg = `Pulled ${new Date(r.snapshot.fetched).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })}. The preview now uses your draft.`;
    } else if (act === 'golive') {
      const r = await adminCall('golive');
      adminState.status = r;
      adminState.msg = `Rankings updated live with the ${r.live} (revision ${r.rev}). Visitors pick it up within a minute; reload this page to see it as they will.`;
    } else if (act === 'ros') {
      const r = await adminCall('ros');
      adminState.status = r;
      const src = Object.entries(r.sources).map(([k, x]) => `${SOURCE_NAMES[k] || k} ${x.ok ? `${x.matched} players` : 'failed'}`).join(', ');
      adminState.msg = `Rankings refreshed: ${src}. Visitors get them within a minute; reload this page to preview with them.`;
    } else if (act === 'unstage') {
      adminState.status = await adminCall('unstage');
      adminState.msg = 'Waiting weights discarded. The live rankings are unchanged.';
    } else {
      const extra = act === 'pub-data' ? { data: true } : act === 'pub-weights' ? { weights: adminState.weights } : { weights: null };
      const r = await adminCall('publish', extra);
      adminState.status = r;
      adminState.msg = act === 'pub-data'
        ? `Published data (revision ${r.rev}). Visitors pick it up within a minute; reload this page to see it as they will.`
        : `Published ${r.published.join(' and ')}. Nobody sees them yet: press Update rankings live when you're ready.`;
    }
  } catch (e) {
    if (e.body?.key) adminState.status = e.body;
    adminState.msg = e.message;
  }
  route();
}

async function adminUnlock(pw) {
  adminState.pw = pw;
  try {
    adminState.status = await adminCall('status');
    adminState.loginErr = '';
    try { sessionStorage.setItem('ph-admin', pw); } catch { /* storage unavailable */ }
    if (adminState.status.draft) adminState.draft = (await adminCall('draft')).snapshot;
  } catch (e) {
    adminState.status = null; adminState.pw = null;
    try { sessionStorage.removeItem('ph-admin'); } catch { /* storage unavailable */ }
    adminState.loginErr = e.message;
  }
  route();
}

function bindAdmin() {
  $('#adm-login')?.addEventListener('submit', (e) => { e.preventDefault(); adminUnlock($('#adm-pw').value); });
  $('#adm-pw')?.focus();
  document.querySelectorAll('[data-w]').forEach((r) => r.addEventListener('input', () => { adminState.weights[r.dataset.w] = Number(r.value); paintAdminResults(); }));
  document.querySelectorAll('[data-source], [data-week]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.source) adminState.source = b.dataset.source; else adminState.week = b.dataset.week;
    route();
  }));
  document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.preset;
    adminState.weights = { ...(p === 'default' ? WEIGHTS : p === 'published' ? adminState.status.config.weights : p === 'staged' ? adminState.status.staged.weights : WEIGHTS_PROPOSED) };
    route();
  }));
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => adminAct(b.dataset.act)));
}

// ---------- shell ----------
// ---------- motion ----------
// Everything here animates transform/opacity only, runs when on screen, and is skipped under reduced motion.
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// phones and touch screens get the light set: no page morphs or scroll reveals, which cost the most on mobile GPUs
const lite = () => matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const morphs = () => !!document.startViewTransition && !calm() && !lite();
const ORDER = ['live', 'rankings', 'wire', 'matchups', 'trades', 'lab'];
let currentView = null;

// gold pill behind the active tab; with view transitions the browser morphs it, otherwise CSS slides it
function placeInk({ settle = false } = {}) {
  const ink = $('.tab-ink'), a = $('.tabs a[aria-current]');
  if (ink && !a) { ink.style.width = '0px'; return; } // a page with no tab (the admin page)
  if (!ink || !a) return;
  if (settle) ink.classList.remove('live'); // a re-measure snaps into place instead of sliding
  ink.style.width = `${a.offsetWidth}px`;
  ink.style.transform = `translateX(${a.offsetLeft}px)`;
  // the browser morphs the pill during a view transition; otherwise CSS slides it
  requestAnimationFrame(() => ink.classList.toggle('live', !morphs()));
}

// count big numbers up from zero, keeping their format (decimals, sign, %)
const COUNT = '.score, .wr-num b, .odds b, .wire-stats b, .mu-team .pr, .gotw-score b, .cast-odds b';
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
const REVEAL = '.hero > .lead-car, .live-panel, .you-card, .notice, .gotw, .bull, .matchups > .mu, .wire-stats, .sec-title, .moves > li, .day > h3, .two-col aside > .panel, .lab-grid > .panel, .trade-bar, .trade-legend, .ideas > .idea, .method-box, .empty';
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

const VIEWS = { admin: viewAdmin, live: viewLive, rankings: viewRankings, wire: viewWire, matchups: viewMatchups, trades: viewTrades, lab: viewLab };
function route({ fresh = false } = {}) {
  // while a week is being played the Live tab is the front page; it only exists then
  const home = DATA.liveMode ? 'live' : 'rankings';
  const v = (location.hash || `#${home}`).slice(1);
  const key = VIEWS[v] && (v !== 'live' || DATA.liveMode || DATA.after) ? v : home;
  const dir = !currentView || key === currentView ? 'same' : ORDER.indexOf(key) > ORDER.indexOf(currentView) ? 'fwd' : 'back';
  const render = () => {
    document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    placeInk();
    paintMe();
    const app = $('#app');
    const shut = siteLocked() && key !== 'admin';
    app.innerHTML = shut ? viewLocked(true) : VIEWS[key]();
    fixAvatars(app);
    if (shut) bindLock(); else bind(key);
    if (fresh) { app.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
    reveal(app);
    currentView = key;
  };
  document.documentElement.dataset.dir = dir;
  if (currentView && morphs()) document.startViewTransition(render);
  else render();
}

function bind(key) {
  if (key === 'admin') {
    bindAdmin();
    // a password saved earlier this session unlocks straight away (the server still checks it)
    if (adminState.pw && !adminState.status && !adminState.loginErr && !adminState.trying) {
      adminState.trying = true;
      adminUnlock(adminState.pw).finally(() => (adminState.trying = false));
    }
  }
  if (key === 'live') bindCarousel();
  document.querySelectorAll('[data-reveal]').forEach((b) => b.addEventListener('click', () => passThenReveal(b)));
  if (key === 'rankings') {
    bindLock();
    if (!DATA.liveMode) bindCarousel();
    maybeMessage();
    const again = $('[data-message]');
    if (again) {
      messageReady?.then((ok) => (again.hidden = !ok));
      if (!messageReady) fetch(MESSAGE_VIDEO.src, { method: 'HEAD' }).then((r) => (again.hidden = !r.ok)).catch(() => {});
      again.addEventListener('click', () => maybeMessage(true));
    }
    $('#poll-slot')?.addEventListener('click', (e) => { const b = e.target.closest('[data-poll]'); if (b) castPoll(Number(b.dataset.poll)); });
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

// the Live tab exists while a week is on, and reads "Final" once the week is (before and after the reveal)
function paintTabs() {
  const a = $('.tabs a[data-view="live"]'), fin = DATA.finalCall || DATA.after;
  a.hidden = !DATA.liveMode && !DATA.after;
  a.textContent = fin ? 'Final' : 'Live';
  $('.tabs a[data-view="rankings"]').hidden = rankingsLocked(); // shut until the final call
  $('.tabs').hidden = siteLocked(); // the whole site waits for the countdown
  $('.brand').setAttribute('href', DATA.liveMode ? '#live' : '#rankings');
  placeInk({ settle: true });
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

// The kicker loader (#loading in index.html). Its 300 ms timer is started by the inline script right after it, so it
// runs even while app.js is still downloading; fast loads never see it. Once shown, the kick restarted from the top, and
// done() keeps it up until one full kick has played, then fades it out and resolves when it's gone (right away if it
// never appeared). Under reduced motion it's the still frame, no video, no wait, no fade.
function startLoader() {
  const el = $('#loading'), video = el?.querySelector('video'), state = window.__loader || {};
  const still = calm() || !video;
  // one kick is the clip's length (2.7 s; fallback until its metadata arrives), capped so a slow file can't hold the page
  const kickMs = () => Math.min(6000, (video && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 2.75) * 1000);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return {
    async done() {
      clearTimeout(state.timer);
      if (!state.shownAt || !el) return;
      if (!still) await wait(Math.max(0, state.shownAt + kickMs() - performance.now()));
      el.classList.add('out');
      if (!still) await wait(350); // the fade (styles.css, #loading)
      video?.pause();
    },
  };
}

async function main() {
  initTooltips();
  const loader = startLoader();
  try {
    await load();
    await loader.done();
  } catch (e) {
    await loader.done();
    $('#app').innerHTML = `<section class="loading"><div class="notice glass"><strong>Couldn't reach Sleeper.</strong> ${esc(e.message || e)}. Check your connection and reload the page.</div></section>`;
    return;
  }
  $('#league-name').textContent = `${RAW.league.name} ${RAW.league.season}`;
  $('#footer-meta').textContent = `${RAW.isDemo ? 'Demo snapshot. ' : ''}Through week ${DATA.meta.lastScored}. ${updatedText() ? `${updatedText()}.` : ''}${DATA.overrides.length ? ` Manual fixes: ${DATA.overrides.map((o) => o.note).join('; ')}.` : ''}`;
  initTeamPicker();
  paintTabs();
  if (REHEARSE) {
    const b = document.createElement('div');
    b.className = 'rehearse-strip';
    b.setAttribute('role', 'status');
    b.innerHTML = 'Rehearsal: the 10:45pm flow with the scores as they stand now. Nothing here is saved or seen by anyone. <a href="./?rehearse=1#live">Start over</a> <a href="./#admin">Back to admin</a>';
    document.body.append(b);
  }
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
  loadPoll();
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
