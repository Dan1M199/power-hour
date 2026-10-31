import { computeLeague, PARTS } from './lib/engine.js';
import { radar, weeklyBars, TEAM_COLORS } from './lib/charts.js';
import { buildStories, keyMatchup, matchupQuips } from './lib/stories.js';
import { applyOverrides } from './lib/overrides.js';
import { breakdown, shortName, fits, nfl } from './lib/matchup.js';
import { MEMBERS, GUESTS, DESK_PEOPLE, photoUrl } from './lib/members.js';
import { bullseye } from './lib/bullseye.js';
import { mount } from './src/mount.jsx';
import { Lab } from './src/lab/Lab.jsx';
import { WirePage } from './src/wire/WirePage.jsx';
import { TradesPage } from './src/trades/TradesPage.jsx';
import { GamesPage } from './src/games/GamesPage.jsx';
import { loadVotes } from './src/games/votes.js';
import { RankingsPage } from './src/rankings/RankingsPage.jsx';
import { LivePage } from './src/live/LivePage.jsx';
import { createStore } from './src/store.js';
import { nightEdition, nightBoard } from './lib/nightdesk.js';
import { TZ, NEWS_CLOCK, centralDate, morningKey, leagueKey, isOnHold, isNightDesk, inGameWindow } from './lib/newsclock.js';

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
const AT = (() => {
  const v = new URLSearchParams(location.search).get('at');
  const d = v && new Date(v);
  return d && !isNaN(d) ? d : null;
})();
const clock = () => AT || new Date();
const T0 = Date.now();
const tick = () => (AT ? +AT + (Date.now() - T0) : Date.now()); // the clock still running, for countdowns under ?at=

const onHold = () => isOnHold(clock());
const gameWindow = () => inGameWindow(clock());
const nightDesk = () => isNightDesk(clock());

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
const tradeState = { shape: 'all' };
// the Nerd lab's sub-page (#lab/team is the team dashboard) and the team it shows (yours until you pick another)
const labState = { sub: null, team: null };

// ---------- data ----------
const getJSON = async (url, res = fetch(url)) => {
  const r = await res;
  if (!r.ok) throw new Error(`${r.status} from ${url}`);
  return r.json();
};
const chicagoDate = () => centralDate(clock());

// Sleeper is read once per morning through /api/league (CDN-cached per key), never straight from the browser. The
// inline script in index.html has usually started both requests while the modules were downloading (window.__early);
// one it made for a key that has since rolled over is left alone.
const early = (name, url) => (window.__early?.[name]?.url === url ? window.__early[name].res : fetch(url));
async function loadLive() {
  window.__early ||= {}; // no head start: make sure the inline script can't start a second copy now
  const league = `/api/league?d=${leagueKey()}`, ros = `/api/ros?d=${morningKey()}`;
  const [snap, rosData] = await Promise.all([
    getJSON(league, early('league', league)),
    getJSON(ros, early('ros', ros)).catch((e) => ({ error: String(e.message || e) })),
  ]);
  return { ...snap, ros: rosData };
}

// the engine input for a league snapshot with the morning ROS values
function leagueInput(raw, extra = {}) {
  const ros = RAW.ros && !RAW.ros.error ? RAW.ros : null;
  const patched = ros ? applyOverrides(ros.values) : { values: {}, applied: [] };
  return {
    input: {
      league: raw.league, users: raw.users, rosters: raw.rosters, matchups: raw.matchups, transactions: raw.transactions,
      players: ros ? ros.players : {}, ros: patched.values, byes: ros?.byes || {}, weekly: ros?.weekly || null,
      currentWeek: raw.state.week, lastScored: raw.league.settings?.last_scored_leg,
      // the power score always uses the engine's WEIGHTS: one formula, the same on every device
      ...extra,
    },
    ros, patched,
  };
}

// a snapshot with the week in progress counted as final (the final call): scores so far, or each team's projected finish.
// pre is the league already computed from this snapshot (the week and its projections don't depend on the simulation,
// so one run will do when there isn't one)
function asFinal(raw, mode, pre = computeLeague({ ...leagueInput(raw).input, sims: 1 })) {
  if (mode === 'off') return raw;
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
  // once every game of the week is final the new rankings are what everyone sees, straight away: they depend only on
  // the snapshot, never on this device's clock or on whether it went through the reveal
  if (DATA.finalCall) buildFinal();
}

// computes a league snapshot into DATA (the helpers below all read DATA) and dresses it for the page. after: the
// week-in-progress league these are the new rankings of (the final call); its final-scores page stays reachable.
function build(raw, after = null) {
  const { input, ros, patched } = leagueInput(raw);
  DATA = computeLeague(input);
  seenRanks.clear(); // new rankings make their entrance again
  DATA.raw = raw;
  DATA.after = after;
  DATA.rosMeta = ros;
  // live-week mode: games are on (or there are points on the board) and this week is still unscored
  DATA.liveMode = !after && DATA.previews.length > 0 && (!!DATA.live || gameWindow());
  // the final call: every game of the week is done (from the data alone), so the week counts as final before Sleeper
  // scores it
  DATA.finalCall = DATA.liveMode && !!DATA.live && nightBoard(DATA).every((g) => g.final);
  DATA.fetched = RAW.fetched ? new Date(RAW.fetched).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' }) : null;
  DATA.overrides = patched.applied;
  DATA.rosError = RAW.ros && RAW.ros.error;
  // stable team colours by roster id
  DATA.color = Object.fromEntries([...DATA.teams].sort((a, b) => a.rid - b.rid).map((t, i) => [t.rid, TEAM_COLORS[i % TEAM_COLORS.length]]));
  // the demo snapshot is frozen in time, so "fresh" is measured from its newest move
  const now = RAW.isDemo && DATA.feed.length ? DATA.feed[0].ts + 6 * 36e5 : Date.now();
  DATA.now = now;
  DATA.bull = MONEY_WEEK ? bullseye(DATA, MONEY_WEEK) : null;
  DATA.stories = after ? (shakeupOn() ? shakeupStories() : null) : headlines();
  DATA.key = keyMatchup(DATA);
  DATA.quips = matchupQuips(DATA);
  return DATA;
}

// the headline carousel for a league being played or about to be (after the final call it's the shakeup or nothing)
function headlines() {
  // once the week is final the headlines come down; the week after, the shakeup leads
  if (DATA.finalCall) return null;
  if (!DATA.liveMode && shakeupOn()) {
    const shake = shakeupStories(); // always run: it also sets the week's movement arrows on the ranking rows
    return (deskOn() && deskStories()) || shake;
  }
  let stories = buildStories(DATA, { now: DATA.now, dateKey: chicagoDate(), editor: EDITOR });
  // the week's desk: no recaps of last week once the new week is being played, and the leak stays on top
  if (deskOn()) {
    const recap = new Set(['upset', 'blowout', 'nailbiter', 'explosion', 'climb', 'fall']);
    const leaks = [clobberStory(), ...deskNews(), tonightStory()].filter(Boolean);
    // the desk's own trade slides cover this week's deals
    if (leaks.some((st) => st.group === 'trades')) recap.add('trade');
    const told = new Set(leaks.map((st) => st.player?.id).filter(Boolean)); // a pickup the desk already has a slide on
    const keep = [stories.lead, ...stories.more].filter((st) => st && !recap.has(st.type) && !told.has(st.pid));
    const all = [...leaks, ...keep];
    stories = { ...stories, lead: all[0], more: all.slice(1), size: Math.min(all.length, CAROUSEL_SIZE + leaks.length) };
  }
  // after Sunday night football the night desk takes over the headlines
  if (nightDesk() && DATA.live) {
    const people = Object.fromEntries(DATA.teams.map((t) => [t.rid, firstName(t)]));
    const ed = nightEdition(DATA, { dateKey: chicagoDate(), editor: EDITOR, people });
    if (ed?.length) stories = { lead: ed[0], more: ed.slice(1), night: true };
  }
  // a one-off from the editor's desk, after the rest, for as long as it runs
  const sass = sassStory();
  if (sass) stories = { ...stories, more: [...stories.more, sass], extra: true };
  // money week leads the headlines for as long as it runs
  const ms = deskOn() ? null : moneyStory();
  if (ms) stories = { ...stories, lead: ms, more: [stories.lead, ...stories.more].filter(Boolean) };
  return stories;
}

// The new power rankings after the final call: this week's final scores counted into records and points for. The
// final-scores page stays reachable from it (DATA.after), and the shakeup compares against that week-in-progress league.
function buildFinal() {
  const live = DATA;
  if (live.after || !live.finalCall) return live;
  return build(asFinal(RAW, 'now', live), live);
}
// render with another computed league in DATA (the final-scores page after the reveal)
function withData(D, fn) { const keep = DATA; DATA = D; try { return fn(); } finally { DATA = keep; } }

// ---------- shared bits ----------
const weightTotal = () => Object.values(DATA.meta.weights).reduce((a, b) => a + b, 0) || 1;
// one part's share of the power score, in whole percent (PARTS in lib/engine.js)
const pctW = (g) => Math.round(PARTS[g].reduce((a, k) => a + (DATA.meta.weights[k] || 0), 0) * 100 / weightTotal());
const team = (rid) => DATA.byRid[rid];
// a position group's score in words: weighted pts/wk the starters add over the league's baseline starter (lib/engine.js)
const groupSaid = (t, p) => {
  const b = DATA.meta.posBase?.[p], v = t.posGroups[p];
  return b ? `${v >= 0 ? '+' : '−'}${f1(Math.abs(v))} pts/wk over the ${p}${b.n} line of ${f1(b.pts)}` : `${f1(v)} pts/wk`;
};
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
// a picture that fails to load (a Sleeper avatar gone missing) turns into its initials. Load errors don't bubble, so one
// capturing listener on the document covers every picture any render ever adds.
function initAvatarFallback() {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.initials) return;
    const s = document.createElement('span');
    s.className = img.className + ' ph';
    s.textContent = img.dataset.initials;
    s.setAttribute('aria-hidden', 'true');
    img.replaceWith(s);
  }, true);
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
// on each matchup card (src/games): how far that team projects from the target
function bullInfo(rid) {
  const B = DATA.bull;
  if (!B || !B.rows.length || B.state === 'final') return null;
  const k = B.rows.findIndex((r) => r.rid === rid), r = B.rows[k];
  return { lead: k === 0, tip: `Money week: closest to ${MONEY_WEEK.target} wins ${money(MONEY_WEEK.prize)}. ${team(rid).name} is ${ordinal(k + 1)} closest.`, text: `${k === 0 ? `${money(MONEY_WEEK.prize)} pace, ` : ''}${awayText(r)}` };
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
// The power rankings are React (src/rankings), mounted into #app by bind. The hero (headline carousel, page head and
// league desk) is still built here as HTML and bound by bindCarousel and mountTalk, since the Live page shares it.
const viewRankings = () => '';
function rankingsProps() {
  const m = DATA.meta;
  const chips = DATA.rosMeta
    ? Object.entries(DATA.rosMeta.sources).map(([k, s]) => `<span class="chip ${s.ok ? '' : 'off'}" title="${s.ok ? `${s.matched} of ${s.rows} players matched` : esc(s.error)}"><span class="dot"></span>${SOURCE_NAMES[k] || k}</span>`).join('')
    : '<span class="chip off"><span class="dot"></span>ROS rankings unavailable</span>';
  // while a week is being played the headlines move to the Live tab and these ranks hold until the week is final
  const held = !!DATA.liveMode;
  const head = `
        <div>
          <h2 class="page-title"><span class="wk">${held ? `On hold during week ${m.lastScored + 1}` : `Week ${m.lastScored + 1}`}</span>Power Rankings</h2>
          <p>Where you sit in the standings, how much you score, who's left on your schedule and how your roster projects, in that order. Tap any team to see why it sits where it does.</p>
        </div>
        <div class="sources">${chips}${updatedText() ? `<span class="chip">${esc(updatedText())}</span>` : ''}${!held && MESSAGE_VIDEO && !window.__DEMO__ ? '<button type="button" class="chip to-again" data-message hidden>Watch the important message again</button>' : ''}</div>
      `;
  return {
    held, head, hero: held ? null : `${leadStory()}<section class="view-head">${head}</section>${talkSlot()}`,
    rosError: DATA.rosError || null, calm: calm(),
    poll: { on: !!SHAKEUP?.poll && shakeupOn() && !DATA.liveMode, question: SHAKEUP?.poll?.question, store: pollStore, onPick: castPoll },
  };
}

// ---------- the important message: Dan's video, taking over the power rankings page ----------
// The first time a device sees the power rankings (not the countdown or the on-hold page), a full-screen card says an
// important message is incoming, counts down, then plays the video with sound. Phones block sound without a tap, so if
// the browser refuses it shows a "Tap to play" button instead. Seen once it ends or is skipped; a chip on the page plays
// it again. It only appears once the file is actually there. Set MESSAGE_VIDEO to null to drop it.
const MESSAGE_VIDEO = { id: 'w7-message', src: 'assets/important-message.mp4' };
const messageSeen = () => store.get(`ph-video-${MESSAGE_VIDEO.id}`) === '1';
const messageOn = () => !!MESSAGE_VIDEO && !window.__DEMO__ && !DATA.liveMode;
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
    store.set(`ph-video-${MESSAGE_VIDEO.id}`, '1');
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
// how far the new ranks moved from where teams stood after week 6 on the old formula (OLD_WEIGHTS, what everyone saw),
// then week 7's closest games, then the money week result. The bottom six of the new ranks get a fan poll
// (api/poll.js). Set SHAKEUP to null to drop it all.
// feature: team names the headline is about instead of the biggest riser and faller (Dan's pick for week 7)
const SHAKEUP = { week: 7, feature: ['Anita Max Wynn', 'Chubb in my Jeanty'], poll: { id: 'w7-bottom6', question: 'Which one of the bottom 6 has the best chance at a playoff run?' } };
const shakeupOn = () => !!SHAKEUP && DATA.meta.lastScored === SHAKEUP.week;
// the formula the site ran through week 6, so the shakeup measures moves against the ranks people actually saw
const OLD_WEIGHTS = { rosProj: 0.35, depth: 0.10, sos: 0.10, allPlay: 0.20, pfPerGame: 0.10, winPct: 0.10, form: 0.05 };
const shareOf = (w, keys) => { const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1; return keys.reduce((a, k) => a + (w[k] || 0), 0) / tot; };

function shakeupStories() {
  const wk = SHAKEUP.week;
  // where everyone stood going into the week: week 6 ranks on the old formula
  // what the rankings page showed going into the week: the week-in-progress snapshot (DATA.after, the final call) on
  // the old formula; once Sleeper has scored the week there is no such snapshot, so the old formula's week 6 ranks
  const before = DATA.after?.raw;
  // ranks never depend on the simulation, so one run is plenty
  const old = computeLeague({ ...leagueInput(before || DATA.raw).input, weights: OLD_WEIGHTS, sims: 1 });
  const moves = DATA.teams.map((t) => {
    const o = old.byRid[t.rid], was = before ? o.powerRank : o.rankHistory[wk - 2] ?? o.powerRank;
    t.movement = was - t.powerRank; // the arrows on the ranking rows tell the same story as the headline
    return { t, was, d: t.movement };
  });
  const moved = moves.filter((m) => m.d).length;
  const up = [...moves].sort((a, b) => b.d - a.d)[0], down = [...moves].sort((a, b) => a.d - b.d)[0];
  const top = DATA.teams[0], topWas = moves.find((m) => m.t === top).was;
  const W = DATA.meta.weights;
  const pctOf = (w, g) => Math.round(shareOf(w, PARTS[g]) * 100);
  const formula = `The formula got an overhaul: your place in the standings now drives ${pctOf(W, 'standing')}% of the score, scoring ${pctOf(W, 'scoring')}%, the schedule left ${pctOf(W, 'schedule')}% and the rest-of-season roster ${pctOf(W, 'roster')}% (it was ${pctOf(OLD_WEIGHTS, 'roster')}%). Win and score, and you climb.`;
  // the featured teams, worded from their actual moves
  const featured = (SHAKEUP.feature || []).map((n) => moves.find((m) => m.t.name === n)).filter(Boolean);
  const said = (m, verb) => (m.d > 0 ? `${m.t.name} ${verb} ${m.d} to ${ordinal(m.t.powerRank)}` : m.d < 0 ? `${m.t.name} drops ${-m.d} to ${ordinal(m.t.powerRank)}` : `${m.t.name} holds at ${ordinal(m.t.powerRank)}`);
  const lead = {
    type: 'shakeup', kicker: 'Power rankings shakeup', tone: 'good', stamp: 'Shakeup',
    rids: (featured.length ? featured.map((m) => m.t) : [up.t, down.t]).map((t) => t.rid).filter((r, i, a) => a.indexOf(r) === i),
    headline: featured.length === 2
      ? `Power rankings earthquake: ${featured[0].d > 0 ? `${featured[0].t.name} jumps to ${ordinal(featured[0].t.powerRank)}` : said(featured[0], 'jumps')}, ${said(featured[1], 'soars')}. Nobody is safe`
      : up.d > 0 && down.d < 0
      ? `Power rankings earthquake: ${firstName(up.t)} soars ${up.d}, ${firstName(down.t)} crashes ${-down.d}. Nobody is safe`
      : `Power rankings earthquake: ${moved} of ${DATA.teams.length} teams flipped. Nobody is safe`,
    deck: [
      `A brand-new formula and a wild week ${wk} just flipped ${moved} of ${DATA.teams.length} teams.`,
      formula,
      ...(featured.length
        ? featured.map((m) => (m.d > 0 ? `${m.t.name} climbs into ${ordinal(m.t.powerRank)}${m.d > 1 ? `, up ${m.d} spots` : ''}.` : m.d < 0 ? `${m.t.name} slips to ${ordinal(m.t.powerRank)}.` : `${m.t.name} holds at ${ordinal(m.t.powerRank)}.`))
        : [up.d > 0 ? `${up.t.name} is the big winner, up ${up.d} spot${up.d === 1 ? '' : 's'} to ${ordinal(up.t.powerRank)}.` : '',
          down.d < 0 ? `${down.t.name} takes the fall, down ${-down.d} to ${ordinal(down.t.powerRank)}.` : '']),
      topWas === 1 ? `${top.name} holds on to No. 1.` : `${top.name} is the new No. 1, up from ${ordinal(topWas)}.`,
    ].filter(Boolean).join(' '),
  };
  const rest = [closeGames(wk), moneyStory()].filter(Boolean);
  // the video headline goes on top while it runs, with the shakeup right behind it
  const clip = clipStory();
  return clip ? { lead: clip, more: [lead, ...rest], extra: true } : { lead, more: rest };
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

// ---------- the week's desk ----------
// Dan's forward-facing headlines for the week ahead, from Wednesday once waivers have run: a breaking lead from a tip he
// passed on, then the wire since `since`, the games with the most playoff odds on them, the Sunday traps (byes, empty
// slots, injuries) and an upset watch. Nothing about last week. Every number comes from the morning snapshot, so the
// slides keep up as lineups change. Runs while `week` is the week ahead and replaces the shakeup carousel (the poll
// stays). Once the games start, the leaks stay on top of the live headlines. Set DESK to null to drop it.
const DESK = {
  week: 8, since: Date.parse('2026-10-27T06:00:00-05:00'),
  // Dan's tip, Oct 28: WarreningU and Anita Max Wynn are working on Judkins to WarreningU for a high-value player, more
  // to come; separately, Kittle is on the table. It comes down on its own once Judkins changes teams.
  leak: { buyer: '1266185245770661888', seller: '1004099157217685504', player: '12512', block: '4217' },
  // Dan's second tip (Oct 28, the Wardfather shipping out Kyle Monangai) and the wire slide (Tre Tucker through four rosters
  // overnight; the Tucker slide below stays) were taken down Oct 29 at his request; set `ship` again to bring a tip like it back.
  ship: null,
  // Thursday's desk, Oct 29, after Wednesday's two trades. Judkins went somewhere other than WarreningU (twistStory, against
  // the leak above), and Mustafa (WarreningU) still did a deal with Aadil (Chubb in my Jeanty): `deal`. Both read the
  // trades from the snapshot and stay down until they show up in it.
  deal: { from: '1266185245770661888', to: '857297655477444608' },
  // the rumor mill: Rashee Rice and Cam Skattebo are the names being floated
  rumors: ['10229', '12481'],
  // Tre Tucker: three managers went for him (Dan's count), and he landed with Akrm
  contest: { player: '10213', to: '1004101289912926208', tries: 3 },
  // tonight's game (Thursday, Oct 29: Panthers at Packers, 7:15pm Central): the rostered players Sleeper projects highest
  // lead a "players to watch tonight" slide from the morning until the game is about over. Null drops it.
  tonight: { teams: ['CAR', 'GB'], kickoff: Date.parse('2026-10-29T19:15:00-05:00'), game: 'Panthers at Packers' },
  // Dan's lead for Friday, Oct 30: his own Operation Sneak In getting clobbered by Stefano's IWillSonU, told on a
  // scoreboard (clobberStory, scoreBug). It only runs while it really is a beating; null drops it.
  clobber: { by: '1402120808771391488', on: '964343481231593472' },
};
// the carousel's sections, in order: a short label under each cluster of dots and a colour pip, repeated on the kicker
const GROUPS = { trades: 'Trades', rumors: 'Rumors', wire: 'Wire', week: 'Games' };
const deskOn = () => !!DESK && DATA.meta.lastScored === DESK.week - 1;
const ownerTeam = (owner) => DATA.teams.find((t) => t.ownerId === owner);
const rosterOf = (id) => DATA.teams.find((t) => t.players.includes(id));
const valueOf = (id) => DATA.helpers.valueOf(id);
const clockTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();
const listOf = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const roomRank = (t, pos) => (t.posRanks[pos] === 1 ? "the league's best" : `the ${ordinal(t.posRanks[pos])}-ranked`);
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n) => WORDS[n] || String(n);

const ROOM = { QB: 'quarterbacks', RB: 'backs', WR: 'receivers', TE: 'tight ends', K: 'kicker', DEF: 'defense' };
const Cap = (s) => s[0].toUpperCase() + s.slice(1);
const poss = (n) => (n.endsWith('s') ? `${n}'` : `${n}'s`);

// the trade news (leaks, done deals, rumors, the Tucker scramble), in section order; it also stays on top once games start
function deskNews() {
  const order = Object.keys(GROUPS);
  return [leakStory(), twistStory(), businessStory(), rumorStory(), shipStory(), tuckerStory()].filter(Boolean)
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}
function deskStories() {
  const sel = [...deskNews(), tonightStory(), raceStory(), upsetStory()].filter(Boolean);
  return sel.length ? { lead: sel[0], more: sel.slice(1), size: sel.length } : null;
}

// trades completed since the desk's cutoff, and one clause per side saying what they got
const deskTrades = () => DATA.feed.filter((f) => f.type === 'trade' && f.ts >= DESK.since);
const gets = (s) => {
  const picks = s.picks.filter((p) => p.dir === 'in').map((p) => `a ${p.season} ${ordinal(p.round)}-round pick`);
  return `${team(s.rid).name} gets ${listOf([...s.adds.map((a) => nameOf(a.id)), ...picks]) || 'nothing'}`;
};
const dealSaid = (f) => `${f.sides.map(gets).join('; ')}.`;
// who won it on consensus value (over replacement, like the trade ledger)
function valueSaid(f) {
  const [w, l] = [...f.sides].sort((a, b) => b.net - a.net);
  if (!l || w.net - l.net < 4) return 'By consensus value it is close to even.';
  return `By consensus value, ${firstName(team(w.rid))} came out ${f1(w.net)} ahead.`;
}
// what the incoming players do to each side's position groups
const roomsSaid = (f) => {
  const said = f.sides.map((s) => {
    const t = team(s.rid), pos = [...new Set(s.adds.map((a) => a.pos).filter((p) => ROOM[p]))];
    return pos.length ? `${poss(firstName(t))} ${listOf(pos.map((p) => `${ROOM[p]} rank ${ordinal(t.posRanks[p])}`))}` : '';
  }).filter(Boolean);
  return said.length ? `Now ${said.join('; ')}.` : '';
};

// plot twist: the leak had Judkins headed to one team, and he landed with another
function twistStory() {
  const L = DESK.leak, expected = ownerTeam(L.buyer);
  const deal = deskTrades().find((f) => f.sides.some((s) => s.adds.some((a) => a.id === L.player)));
  const to = deal && team(deal.sides.find((s) => s.adds.some((a) => a.id === L.player)).rid);
  if (!to || to === expected) return null;
  const P = nameOf(L.player), info = DATA.helpers.player(L.player), rooms = roomsSaid(deal);
  return {
    type: 'twist', group: 'trades', breaking: true, kicker: 'Trade desk', tone: 'trade', stamp: 'Plot twist', rids: deal.sides.map((s) => s.rid),
    player: { id: L.player, name: P, short: shortName(info), line: `${info.pos}, ${nfl(info.team)}`, pin: { team: to, label: `To ${firstName(to)}` } },
    mark: [P],
    headline: `Plot twist: ${P} lands with ${to.name}, not ${expected ? expected.name : 'the team the desk expected'}`,
    deck: [
      `On Wednesday the desk had ${P} headed to ${expected ? `${poss(firstName(expected))} ${expected.name}` : 'another team'}. ${firstName(to)} got him instead.`,
      `The full deal: ${dealSaid(deal)}`,
      valueSaid(deal),
      rooms,
      `${firstName(to)} is ${record(to)} with ${pct(to.playoffPct)} playoff odds.`,
    ].filter(Boolean).join(' '),
  };
}

// the buyer from the leak still did business: what went to Aadil, and the rest of the deal
function businessStory() {
  const B = DESK.deal, from = ownerTeam(B.from), to = ownerTeam(B.to);
  const deal = from && to && deskTrades().find((f) => f.sides.some((s) => s.rid === from.rid) && f.sides.some((s) => s.rid === to.rid));
  const sent = deal && deal.sides.find((s) => s.rid === to.rid).adds.filter((a) => deal.sides.some((s) => s.rid === from.rid && s.drops.some((d) => d.id === a.id)));
  if (!sent?.length) return null;
  const names = sent.map((a) => nameOf(a.id)), rooms = roomsSaid(deal), F = firstName(from), T = firstName(to);
  return {
    type: 'deal', group: 'trades', kicker: 'Trade desk', tone: 'trade', stamp: 'Deal', rids: [from.rid, to.rid],
    mark: names,
    headline: `No bad business here: ${F} follows through and sends ${listOf(names)} to ${T}`,
    deck: [
      `${F} was shopping for a deal on Wednesday, and the Judkins talks weren't the only ones. ${F} and ${T} got one done.`,
      `The full deal: ${dealSaid(deal)}`,
      valueSaid(deal),
      rooms,
      `${F} is ${record(from)} with ${pct(from.playoffPct)} playoff odds; ${T} is ${record(to)} with ${pct(to.playoffPct)}.`,
    ].filter(Boolean).join(' '),
  };
}

// the rumor mill: the names being floated, where they sit and what they're worth
function rumorStory() {
  const ids = DESK.rumors.filter((id) => rosterOf(id));
  if (!ids.length) return null;
  const names = ids.map(nameOf), done = deskTrades().length;
  const about = (id) => {
    const t = rosterOf(id), r = RAW.ros?.values?.[id] || {}, pos = posOf(id);
    return `${nameOf(id)}${r.prk ? ` (the ${ordinal(r.prk)}-ranked ${SLOT_WORD[pos] || pos} in the consensus, ${f1(r.wk)} a week projected)` : ''} is on ${poss(firstName(t))} ${t.name}, ${record(t)} with ${pct(t.playoffPct)} playoff odds.`;
  };
  return {
    type: 'rumor', group: 'rumors', kicker: 'Rumor mill', tone: 'trade', stamp: 'Rumor', rids: [...new Set(ids.map((id) => rosterOf(id).rid))],
    mark: names,
    headline: `${listOf(names)} ${ids.length > 1 ? 'are among the names' : 'is the name'} to watch as the trade market heats up`,
    deck: [
      `${done >= 2 ? `${Cap(count(done))} trades went through this week, and the` : 'The'} market isn't done.`,
      ...ids.map(about),
      'Nothing is close yet. More to come.',
    ].join(' '),
  };
}

// the Tre Tucker scramble: several managers went for him, one got him, and what he does for that lineup
function tuckerStory() {
  const C = DESK.contest, to = ownerTeam(C.to);
  if (!to || rosterOf(C.player) !== to) return null;
  const got = DATA.feed.find((f) => f.ts >= DESK.since && f.sides.some((s) => s.rid === to.rid && s.adds.some((a) => a.id === C.player)));
  if (!got) return null;
  // the claims that lost, when the snapshot carries them
  const lost = [...new Set((DATA.raw.transactions || []).flat()
    .filter((x) => x?.type === 'waiver' && x.status === 'failed' && (x.status_updated || x.created) >= DESK.since && x.adds?.[C.player] != null)
    .map((x) => x.adds[C.player]))].filter((rid) => rid !== to.rid).map(team).filter(Boolean);
  const P = nameOf(C.player), first = P.split(' ')[0], info = DATA.helpers.player(C.player), r = RAW.ros?.values?.[C.player] || {};
  const T = firstName(to), slot = to.rosLineup.find((l) => l?.id === C.player), pos = info.pos;
  const how = got.type === 'trade' ? 'traded for him' : got.type === 'waiver' ? 'won the claim' : 'got to him first';
  return {
    type: 'contest', group: got.type === 'trade' ? 'trades' : 'wire', kicker: got.type === 'trade' ? 'Trade desk' : 'Waiver wire', tone: 'good', stamp: 'Claimed', rids: [to.rid],
    player: { id: C.player, name: P, short: shortName(info), line: `${pos}, ${nfl(info.team)}`, pin: { team: to, label: `To ${T}` } },
    mark: [P],
    headline: `Conflict of ${P}: ${count(C.tries)} managers tried to get ${first}, and he lands on ${poss(T)} team`,
    deck: [
      lost.length === C.tries - 1 ? `${listOf(lost.map(firstName))} went for ${first} too, but ${T} ${how}.` : `${Cap(count(C.tries))} managers went for ${first}, and ${T} ${how}.`,
      r.prk ? `He's the ${ordinal(r.prk)}-ranked ${SLOT_WORD[pos] || pos} in the consensus, projected for ${f1(r.wk)} a week the rest of the way.` : '',
      `Let's see how this helps: ${slot ? `he goes straight into ${poss(T)} best lineup at ${slot.slot === 'FLEX' ? 'flex' : SLOT_WORD[slot.slot] || slot.slot}` : `for now he's depth, outside ${poss(T)} best lineup`}, and ${poss(T)} ${ROOM[pos] || pos} rank ${ordinal(to.posRanks[pos])}.`,
      `${T} is ${record(to)} with ${pct(to.playoffPct)} playoff odds.`,
    ].filter(Boolean).join(' '),
  };
}

// the tip: who's talking, why the pieces fit, and how far apart they are by consensus value
function leakStory() {
  const L = DESK.leak, buyer = ownerTeam(L.buyer), seller = ownerTeam(L.seller);
  if (!buyer || !seller || rosterOf(L.player) !== seller) return null; // the deal happened (or fell apart into a new home)
  const block = rosterOf(L.block), P = nameOf(L.player), K = nameOf(L.block), kSur = K.split(' ').pop(), pSur = P.split(' ').pop();
  // the other tight end on the team shopping Kittle: the reason he's spare
  const spare = block && block.players.filter((id) => id !== L.block && posOf(id) === 'TE').sort((a, b) => valueOf(b) - valueOf(a))[0];
  const gap = Math.abs(valueOf(L.player) - valueOf(L.block));
  const kittleSwap = block === buyer;
  const info = DATA.helpers.player(L.player), r = RAW.ros?.values?.[L.player] || {}, age = RAW.ros?.players?.[L.player]?.a;
  return {
    type: 'leak', group: 'trades', breaking: true, kicker: 'Trade desk', tone: 'trade', stamp: 'On the move', rids: [buyer.rid, seller.rid],
    // the player is the story: his name leads the headline in yellow, and his card stands where the photos go
    player: { id: L.player, name: P, short: shortName(info), line: `${info.pos}, ${nfl(info.team)}`, pin: { team: buyer, label: `To ${firstName(buyer)}` } },
    mark: [P],
    headline: `${P} to ${buyer.name} is in the works, and ${kSur} is on the table`,
    deck: [
      `Sources tell the desk ${buyer.name} and ${seller.name} are working on a trade that sends ${P} to ${firstName(buyer)} in exchange for a high-value player. More to come.`,
      r.prk ? `${age ? `He's ${age}, the` : `${pSur} is the`} ${ordinal(r.prk)}-ranked running back in the consensus, worth ${f1(valueOf(L.player))} and projected for ${f1(r.wk)} a week the rest of the way.` : '',
      kittleSwap
        ? `On paper it fits: ${seller.name} has ${roomRank(seller, 'RB')} running back room and ${roomRank(seller, 'TE')} tight ends, while ${buyer.name} has ${roomRank(buyer, 'TE')} tight ends${spare ? ` (${K} and ${nameOf(spare)})` : ''} and ${roomRank(buyer, 'RB')} backs.`
        : `${seller.name} has ${roomRank(seller, 'RB')} running back room; ${buyer.name}'s backs rank ${ordinal(buyer.posRanks.RB)}.`,
      block ? `Separately, sources say ${K} is on the table${block !== buyer ? `, and ${firstName(block)} is listening` : ''}${RAW.ros?.byes?.[DATA.helpers.player(L.block)?.team] === DESK.week ? ` (he's on a bye this week anyway)` : ''}.${kittleSwap ? ` If ${kSur} is the piece coming back, the two are ${f1(gap)} apart in consensus value (${kSur} ${f1(valueOf(L.block))}).` : ''}` : '',
      `${firstName(buyer)} is buying at ${record(buyer)} with ${pct(buyer.playoffPct)} playoff odds. Nothing is signed.`,
    ].filter(Boolean).join(' '),
  };
}

// the second tip, quick: who's going out, that it's nearly done, that the other side isn't confirmed
function shipStory() {
  const S = DESK.ship, seller = S && ownerTeam(S.seller);
  if (!seller || rosterOf(S.player) !== seller) return null;
  const P = nameOf(S.player), info = DATA.helpers.player(S.player), r = RAW.ros?.values?.[S.player] || {};
  return {
    type: 'ship', group: 'trades', breaking: true, kicker: 'Trade desk', tone: 'trade', stamp: 'On the move', rids: [seller.rid],
    player: { id: S.player, name: P, short: shortName(info), line: `${info.pos}, ${nfl(info.team)}`, pin: { team: seller, label: `From ${firstName(seller)}` } },
    mark: [P],
    headline: `${seller.name} is shipping out ${P}`,
    deck: `Sources say ${firstName(seller)} is moving ${P}, and the deal is almost done. The trade partner hasn't been confirmed.${r.prk ? ` He's the ${ordinal(r.prk)}-ranked back in the consensus.` : ''} More to come.`,
  };
}

// players to watch tonight: the rostered players in tonight's game with the highest Sleeper projections (the blend when
// Sleeper has none), one per position, who has them and whether they're in the lineup. Runs until about three hours after kickoff.
function tonightStory() {
  const T = DESK.tonight;
  if (!T || DATA.now > T.kickoff + 3 * 36e5) return null;
  const proj = RAW.ros?.weekly?.week === DESK.week ? RAW.ros.weekly.proj || {} : {};
  const sl = (id) => proj[id]?.[2] ?? proj[id]?.[0] ?? null;
  const starting = new Set(DATA.previews.flatMap((p) => [...(p.startersA || []), ...(p.startersB || [])]));
  const picks = DATA.teams.flatMap((t) => t.players.map((id) => ({ id, t, info: DATA.helpers.player(id) })))
    .filter((x) => T.teams.includes(x.info?.team) && sl(x.id) >= 5)
    .sort((a, b) => sl(b.id) - sl(a.id))
    .filter((x, i, xs) => xs.findIndex((y) => y.info.pos === x.info.pos) === i).slice(0, 3); // one per position
  if (picks.length < 2) return null;
  const top = picks[0], names = picks.map((x) => nameOf(x.id));
  const line = (x) => `${nameOf(x.id)} (${x.info.pos}, ${nfl(x.info.team)}) projects ${f1(sl(x.id))} on Sleeper for ${firstName(x.t)}, ${starting.has(x.id) ? 'in the lineup' : 'on the bench for now'}.`;
  const benched = [...new Set(picks.filter((x) => !starting.has(x.id)).map((x) => firstName(x.t)))];
  return {
    type: 'tonight', group: 'week', kicker: 'Players to watch tonight', tone: 'neutral', stamp: 'Tonight', rids: [...new Set(picks.map((x) => x.t.rid))].slice(0, 2),
    player: { id: top.id, name: names[0], short: shortName(top.info), line: `${top.info.pos}, ${nfl(top.info.team)}`, pin: { team: top.t, label: `${firstName(top.t)}'s` } },
    mark: names,
    headline: `${listOf(names)} kick off week ${DESK.week} tonight`,
    deck: [
      `${T.game}, ${clockTime(T.kickoff)} Central, Thursday night.`,
      ...picks.map(line),
      benched.length ? `Players lock at kickoff, so ${listOf(benched)} ${benched.length > 1 ? 'have' : 'has'} until ${clockTime(T.kickoff)} to make the call.` : '',
    ].filter(Boolean).join(' '),
  };
}

// the beating of the week, on a scoreboard: points banked so far, projected finals, win odds and the players doing it.
// Dan's own team on the wrong end (DESK.clobber). Gone if the game turns into anything but a beating.
function clobberStory() {
  const C = DESK.clobber, W = C && ownerTeam(C.by), L = C && ownerTeam(C.on);
  const p = W && L && DATA.previews.find((x) => [x.a, x.b].includes(W.rid) && [x.a, x.b].includes(L.rid));
  if (!p) return null;
  const side = (t) => {
    const a = p.a === t.rid;
    return { t, key: a ? 'a' : 'b', banked: (a ? p.liveA : p.liveB) || 0, proj: a ? p.projA : p.projB, win: a ? p.winA : 1 - p.winA };
  };
  const w = side(W), l = side(L), lead = w.banked - l.banked;
  if (w.win < 0.6 && lead < 10) return null;
  const bd = breakdown(DATA, p);
  // each side's key players: who has already played, best game first, then the biggest projections still to come
  const key = (s) => {
    const xs = bd.rows.map((r) => r[s.key]).filter(Boolean);
    const done = xs.filter((x) => x.played).sort((a, b) => b.proj - a.proj);
    const left = xs.filter((x) => !x.played && x.proj > 0).sort((a, b) => b.proj - a.proj);
    return [...done.slice(0, 2), ...left].slice(0, 3);
  };
  const kw = key(w), kl = key(l), best = kw.find((x) => x.played), mine = kl.find((x) => x.played), hope = kl.find((x) => !x.played);
  const Wf = firstName(W), Lf = firstName(L);
  const vs = (x) => `${f1(x.proj)} (projected ${f1(x.pre)})`;
  return {
    type: 'clobber', group: 'week', breaking: true, kicker: 'Blowout watch', tone: 'bad', stamp: 'Clobbering', rids: [W.rid, L.rid], drain: L.rid,
    mark: [L.name, W.name],
    headline: lead > 0
      ? `${L.name} is getting clobbered: ${W.name} leads ${f1(w.banked)} to ${f1(l.banked)}`
      : `${L.name} is about to get clobbered: ${W.name} projects ${f1(w.proj)} to ${f1(l.proj)}`,
    deck: [
      best ? `${nameOf(best.id)} put up ${vs(best)} for ${Wf}.` : '',
      mine ? `${Lf} got ${vs(mine)} from ${nameOf(mine.id)}.` : '',
      `The model gives ${Lf} ${pct(l.win)}${hope ? `, and the best hope left is ${nameOf(hope.id)} at ${f1(hope.proj)} projected` : ''}.` + ' Yes, the editor signed off on this one.',
    ].filter(Boolean).join(' '),
    bug: { w, l, kw, kl },
  };
}
// the clobber story's scoreboard: both scores, the projected finals, a win-odds bar and each side's key players
function scoreBug({ w, l, kw, kl }) {
  const score = (s, cls) => `<div class="bug-side ${cls}">
      <span class="bug-team">${esc(short(s.t.name, 20))}</span>
      <b class="bug-pts">${f1(s.banked)}</b>
      <small>Projected ${f1(s.proj)}</small>
    </div>`;
  const row = (x) => {
    const d = x.played ? x.proj - x.pre : 0, tag = !x.played ? 'proj' : d >= 4 ? 'boom' : d <= -4 ? 'bust' : 'done';
    return `<li class="${tag}" data-tip="${esc(x.played ? `${x.name}: ${f1(x.proj)} points, projected ${f1(x.pre)}` : `${x.name}: projected ${f1(x.proj)}, still to play`)}">
        <span class="pos ${x.pos}">${x.pos}</span><span class="bug-pl">${esc(shortName(x))}</span><b>${f1(x.proj)}</b><small>${x.played ? 'Final' : 'Proj'}</small>
      </li>`;
  };
  const wp = Math.round(w.win * 100);
  return `<div class="bug">
      <div class="bug-score">${score(w, 'lead')}<span class="bug-vs">vs</span>${score(l, 'trail')}</div>
      <div class="bug-odds" role="img" aria-label="${esc(`${w.t.name} ${wp}% to win, ${l.t.name} ${100 - wp}%`)}">
        <span>${wp}%</span><i style="--w:${wp}%"></i><span>${100 - wp}%</span>
      </div>
      <div class="bug-key"><ul>${kw.map(row).join('')}</ul><ul>${kl.map(row).join('')}</ul></div>
    </div>`;
}

// the wire since waivers: the player who changed hands the most, then the best claims and the busiest manager
function wireStory() {
  const moves = DATA.feed.filter((f) => f.ts >= DESK.since && (f.type === 'waiver' || f.type === 'free_agent')).sort((a, b) => a.ts - b.ts);
  if (!moves.length) return null;
  const events = moves.flatMap((f) => f.sides.flatMap((s) => [
    ...s.adds.map((a) => ({ id: a.id, rid: s.rid, ts: f.ts, add: true, waiver: f.type === 'waiver', v: a.v })),
    ...s.drops.map((d) => ({ id: d.id, rid: s.rid, ts: f.ts, add: false })),
  ]));
  const teamsAdding = (id) => new Set(events.filter((e) => e.add && e.id === id).map((e) => e.rid));
  const hot = [...new Set(events.map((e) => e.id))].map((id) => ({ id, n: teamsAdding(id).size })).sort((a, b) => b.n - a.n || valueOf(b.id) - valueOf(a.id))[0];
  const claims = events.filter((e) => e.add && e.waiver && e.id !== DESK.contest?.player).sort((a, b) => valueOf(b.id) - valueOf(a.id)).slice(0, 2);
  const busy = Object.entries(moves.reduce((m, f) => (f.sides.forEach((s) => (m[s.rid] = (m[s.rid] || 0) + 1)), m), {})).sort((a, b) => b[1] - a[1])[0];
  const lines = [];
  let headline, rids = [];
  if (hot && hot.n >= 2) {
    const steps = events.filter((e) => e.id === hot.id), now = rosterOf(hot.id), name = nameOf(hot.id);
    // one clause per manager, in order: added (and dropped, with how long he lasted)
    const stints = [];
    steps.forEach((e) => {
      if (e.add) stints.push({ rid: e.rid, in: e.ts });
      else { const s = [...stints].reverse().find((x) => x.rid === e.rid && x.out == null); if (s) s.out = e.ts; }
    });
    const said = stints.map((s) => s.out != null
      ? `${firstName(team(s.rid))} added him at ${clockTime(s.in)} and ${s.out - s.in < 60000 ? 'cut him the same minute' : `cut him ${Math.round((s.out - s.in) / 60000)} minutes later`}`
      : `${firstName(team(s.rid))} grabbed him at ${clockTime(s.in)} and kept him`);
    headline = now ? `${name} went through ${count(hot.n)} rosters overnight. ${firstName(now)} kept him` : `${name} went through ${count(hot.n)} rosters overnight and nobody kept him`;
    lines.push(`${said.map((x) => `${x}.`).join(' ')}${now ? ` At ${f1(valueOf(hot.id))} in consensus value, he was the best player to change hands.` : ''}`);
    rids = now ? [now.rid] : [];
  }
  if (claims.length) lines.push(`Top waiver claims by value: ${listOf(claims.map((c) => `${firstName(team(c.rid))} landed ${nameOf(c.id)}`))}.`);
  if (busy && busy[1] >= 3) lines.push(`${firstName(team(Number(busy[0])))} made ${busy[1]} moves, the most in the league.`);
  if (!headline) {
    const top = claims[0];
    if (!top) return null;
    headline = `${firstName(team(top.rid))} won the wire with ${nameOf(top.id)}`;
    rids = [top.rid];
  }
  if (busy && !rids.includes(Number(busy[0]))) rids.push(Number(busy[0]));
  return { type: 'wire', group: 'wire', kicker: 'Waiver wire', tone: 'good', stamp: 'Pickup', rids: rids.slice(0, 2), headline, deck: lines.join(' ') };
}

// the two games with the most playoff odds riding on them
function raceStory() {
  const swing = (t) => (t.playoffIfWin ?? t.playoffPct) - (t.playoffIfLoss ?? t.playoffPct);
  const games = [...DATA.previews].sort((a, b) => b.stakes - a.stakes).slice(0, 2).filter((p) => p.stakes >= 0.2);
  if (!games.length) return null;
  const leak = leakStory() ? [ownerTeam(DESK.leak.buyer), ownerTeam(DESK.leak.seller)] : []; // only while the talks are live
  const vs = (p) => `${firstName(team(p.a))} vs ${firstName(team(p.b))}`;
  const side = (t) => `${t.name} (${record(t)}) goes to ${pct(t.playoffIfWin)} with a win and ${pct(t.playoffIfLoss)} with a loss`;
  const deck = games.map((p) => {
    const A = team(p.a), B = team(p.b), fav = p.winA >= 0.5 ? A : B;
    const mid = leak.find((t) => t === A || t === B);
    const favSaid = `${firstName(fav)} is the ${pct(Math.max(p.winA, 1 - p.winA))} favourite`;
    return `${side(A)}; ${side(B)}. ${mid === fav ? `${favSaid}, in the middle of trade talks.` : `${favSaid}.${mid ? ` ${firstName(mid)} is playing it in the middle of trade talks.` : ''}`}`;
  });
  return {
    type: 'race', group: 'week', kicker: 'Playoff picture', tone: 'neutral', stamp: 'Big game', rids: [games[0].a, games[0].b],
    headline: games.length === 2 ? `${vs(games[0])} and ${vs(games[1])}: the two games that swing the playoff race` : `${vs(games[0])} is the week's playoff swing game`,
    deck: deck.join(' '),
  };
}

// the best record in the league playing as an underdog
function upsetStory() {
  const dogs = DATA.previews.flatMap((p) => [[p.a, p.winA, p.b, p.projA, p.projB], [p.b, 1 - p.winA, p.a, p.projB, p.projA]])
    .filter(([, w]) => w < 0.4).map(([rid, w, opp, mine, theirs]) => ({ t: team(rid), w, opp: team(opp), mine, theirs }))
    .sort((a, b) => b.t.wins - a.t.wins || a.t.losses - b.t.losses);
  const d = dogs[0];
  if (!d || d.t.wins < 4) return null;
  const all = DATA.previews.flatMap((p) => [p.projA, p.projB]).sort((a, b) => b - a), oppRank = all.indexOf(d.theirs) + 1;
  return {
    type: 'upset', group: 'week', kicker: 'Upset watch', tone: 'neutral', stamp: 'Upset?', rids: [d.t.rid, d.opp.rid],
    headline: `${firstName(d.t)}'s ${d.t.losses ? `${record(d.t)} ` : 'unbeaten '}${d.t.name.replace(/^The /, '')} is a ${pct(d.w)} underdog this week`,
    deck: `${firstName(d.t)} is ${record(d.t)}${d.t.playoffPct > 0.99 ? ' and already a lock for the playoffs' : ` with ${pct(d.t.playoffPct)} playoff odds`}, but ${firstName(d.opp)}'s ${d.opp.name} projects ${f1(d.theirs)} to ${f1(d.mine)}${oppRank === 1 ? ', the highest projected score in the league this week' : ''}. If the favourite holds, ${firstName(d.opp)} moves to ${pct(d.opp.playoffIfWin)} playoff odds.`,
  };
}

// ---------- the video headline ----------
// Dan's request after week 7: Tony Pollard scored the most points in the league for Mo the week after Akrm traded him
// there, and the headline card plays the "Tony ya Tony" clip. Every number comes from the snapshot: his points and
// where they rank, the trade and what came back, Akrm's game and the starter Pollard could have replaced. It leads the
// headlines while week 7 is the latest result (as long as the shakeup runs). Set CLIP to null to drop it.
const CLIP = {
  week: 7, player: '5967', seller: '1004101289912926208', kicker: 'Tony ya Tony', stamp: 'Sold low',
  src: 'assets/tony_ya_tony.mp4', poster: 'assets/tony_ya_tony-poster.webp', label: 'Video: the Tony ya Tony chant',
};
const SLOT_WORD = { QB: 'quarterback', RB: 'running back', WR: 'receiver', TE: 'tight end', K: 'kicker', DEF: 'defense' };
const say = (n) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);
const n1 = (x) => f1(x).replace(/\.0$/, ''); // 35 rather than 35.0 in a headline
function clipStory() {
  if (!CLIP || DATA.meta.lastScored !== CLIP.week) return null;
  const wk = CLIP.week, id = CLIP.player, M = DATA.raw.matchups || {}, rows = M[wk] || [];
  const seller = DATA.teams.find((t) => t.ownerId === CLIP.seller);
  const row = rows.find((m) => m.players?.includes(id)), sold = seller && rows.find((m) => m.roster_id === seller.rid);
  const pts = row?.players_points?.[id];
  // the trade that sent him away (the latest one, should there be more)
  const deal = (DATA.raw.transactions || []).flat().filter((x) => x?.type === 'trade' && x.status === 'complete' && x.drops?.[id] === seller?.rid)
    .sort((a, b) => (b.status_updated || 0) - (a.status_updated || 0))[0];
  if (!deal || !row || !sold || row === sold || pts == null) return null;
  const owner = team(row.roster_id), to = team(deal.adds?.[id]);
  const S = firstName(seller), O = firstName(owner), P = nameOf(id), last = P.split(' ').slice(1).join(' ') || P;
  // where his week ranks among every rostered player in the league
  const rank = 1 + rows.flatMap((m) => (m.players || []).map((p) => m.players_points?.[p] || 0)).filter((x) => x > pts).length;
  const gap = wk - deal.leg, when = gap <= 0 ? 'days' : gap === 1 ? 'a week' : `${say(gap)} weeks`;
  const headline = `${P} went off for ${rank === 1 ? 'a league-best ' : ''}${n1(pts)}, ${when} after ${S} traded him away`;

  // what came back, and what it scored for the seller this week
  const pp = sold.players_points || {}, st = sold.starters || [];
  const back = Object.keys(deal.adds || {}).filter((p) => deal.adds[p] === seller.rid), kept = back.filter((p) => sold.players?.includes(p));
  const got = back.length ? back.map(nameOf).join(' and ') : deal.draft_picks?.length ? 'draft picks' : '';
  const date = new Date(deal.status_updated || deal.created).toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric' });
  const sent = `${S} sent ${last} to ${to ? firstName(to) : 'a rival'} on ${date}${got ? ` for ${got}` : ''}${kept.length
    ? `, who ${kept.length > 1 ? 'combined for' : 'put up'} ${f1(kept.reduce((a, p) => a + (pp[p] || 0), 0))}${kept.some((p) => st.includes(p)) ? '' : ' on the bench'} this week` : ''}.`;

  // the seller's weakest starter in a spot he could have filled, against the margin of their game
  const pos = posOf(id), slots = DATA.meta.slots;
  const weak = st.map((p, i) => ({ p, slot: slots[i], x: pp[p] || 0 })).filter((s) => s.p && s.p !== '0' && fits(s.slot, pos)).sort((a, b) => a.x - b.x)[0];
  const opp = rows.find((m) => m.matchup_id === sold.matchup_id && m.roster_id !== sold.roster_id);
  let used = '';
  if (weak && opp && pts > weak.x) {
    const score = (m) => m.custom_points ?? m.points ?? 0, margin = score(opp) - score(sold), swing = pts - weak.x;
    const W = `${nameOf(weak.p)} scored ${f1(weak.x)} at ${SLOT_WORD[weak.slot] || 'flex'}`, T = team(opp.roster_id).name;
    used = margin > 0
      ? `And ${S} could have used him: ${W} in a ${f1(margin)}-point loss to ${T}. ${last} in that spot ${swing > margin ? `wins it by ${f1(swing - margin)}` : `claws back ${f1(swing)} of it`}.`
      : `${S} still beat ${T} by ${f1(-margin)}, but ${W}. ${last} in that spot is ${f1(swing)} more.`;
  }

  // his points on each roster, week by week
  const tally = (rid) => {
    let n = 0, sum = 0;
    for (let w = 1; w <= wk; w++) {
      const m = M[w]?.find((x) => x.roster_id === rid);
      if (m?.players?.includes(id)) { n++; sum += m.players_points?.[id] || 0; }
    }
    return { n, sum };
  };
  const was = tally(seller.rid), now = tally(owner.rid);
  const since = now.n < was.n && now.sum > was.sum ? `The tally: ${f1(was.sum)} points in ${say(was.n)} weeks with ${S}, ${f1(now.sum)} in ${say(now.n)} with ${O}.` : '';
  return { type: 'clip', kicker: CLIP.kicker, tone: 'bad', stamp: CLIP.stamp, rids: [owner.rid, seller.rid], face: seller.rid, clip: CLIP,
    headline, deck: [sent, used, since].filter(Boolean).join(' ') };
}

// the fan poll on top of the power rankings: the bottom six of the new ranks, one vote per network, no changes
const pollStore = createStore(null); // { enabled, options, counts, total, mine, err } once /api/poll answers
// this device's poll id, kept here and (by the server) in a cookie, so clearing one doesn't make a new voter
const pollDevice = () => store.get('ph-device') || '';
const keepDevice = (b) => { if (b?.device) store.set('ph-device', b.device); };
const pollChoices = () => pollStore.get()?.options || DATA.teams.slice(-6).map((t) => t.rid);
async function loadPoll() {
  if (!SHAKEUP?.poll || !shakeupOn()) return;
  let P = null;
  try { P = await getJSON(`/api/poll?id=${SHAKEUP.poll.id}&device=${encodeURIComponent(pollDevice())}`); keepDevice(P); } catch { P = null; }
  pollStore.set(P);
}
async function castPoll(rid) {
  if (!confirm(`Lock in ${team(rid).name}? You can't change it.`)) return;
  const P = pollStore.get();
  try {
    const r = await fetch('/api/poll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: SHAKEUP.poll.id, pick: rid, options: pollChoices(), device: pollDevice() }) });
    const body = await r.json().catch(() => ({}));
    keepDevice(body);
    pollStore.set(body.enabled ? { ...body, err: r.ok ? '' : body.error } : { ...P, err: body.error || `Poll answered ${r.status}` });
  } catch (e) { pollStore.set({ ...P, err: String(e.message || e) }); }
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

// The Live tab is React (src/live/LivePage.jsx), mounted into #app by bind. Its hero (headline carousel, page head,
// league desk) is built here as HTML and bound by bindCarousel and mountTalk, like the power rankings'.
const viewLive = () => '';
function liveProps() {
  // after the reveal DATA holds the new rankings; this page keeps showing the week that just ended
  if (DATA.after) return withData(DATA.after, liveProps);
  const fin = !!DATA.finalCall;
  const wk = DATA.previews[0]?.week, { rows, standings } = liveWeek();
  const played = DATA.live?.teams.length || 0;
  const bull = DATA.bull && DATA.bull.state !== 'final' && DATA.bull.rows.find((x) => x.rid === myTeam);
  const head = fin
    ? `
        <div>
          <h2 class="page-title"><span class="wk">Week ${wk} final</span>Final Scores</h2>
          <p>Every game is in. The week, best score to worst, and the standings it leaves behind. Sleeper makes it official Tuesday; the new power rankings are ready now.</p>
        </div>
        <div class="sources"><span class="chip"><span class="dot"></span>All games final</span>${DATA.fetched ? `<span class="chip">Scores as of ${esc(DATA.fetched)}</span>` : ''}</div>
      `
    : null;
  const hero = fin ? null : `
      ${leadStory()}
      <section class="view-head">
        <div>
          <h2 class="page-title"><span class="wk">Week ${wk} live</span>Weekly Rankings</h2>
          <p>How this week is going, best to worst: everything scored so far plus the projection for everyone still to play. The power rankings are on hold until every game is final.</p>
        </div>
        <div class="sources"><span class="chip"><span class="dot live"></span>${played} NFL team${played === 1 ? '' : 's'} played so far</span>${DATA.fetched ? `<span class="chip">Scores as of ${esc(DATA.fetched)}</span>` : ''}</div>
      </section>
      ${talkSlot()}
    `;
  return { D: DATA, fin, wk, rows, standings, hero, head, bull: bull ? awayText(bull) : null, onReveal: passThenReveal, h: { ...reactHelpers(), today: chicagoDate() } };
}

// ---------- the final call: from the final scores to the new power rankings ----------
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
  const live = DATA.after || DATA; // the week-in-progress snapshot the verdict reads
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
      <div class="unveil-verdict">
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
    el.innerHTML = told(withData(live, () => verdict(rid)));
    const v = el.querySelector('video');
    if (calm()) v?.remove(); else v?.play?.().catch(() => {});
    // let the verdict sink in while the bar fills; the new rankings are worked out underneath
    const READ_MS = calm() ? 3500 : 6000;
    el.querySelector('.unveil-bar i').style.animationDuration = `${READ_MS}ms`;
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 60)); // paint the verdict before the heavy lifting
    buildFinal();
    loadPoll(); // the shakeup poll sits on top of the new rankings
    await new Promise((r) => setTimeout(r, Math.max(0, READ_MS - (performance.now() - t0))));
    el.classList.add('out');
    await new Promise((r) => setTimeout(r, calm() ? 0 : 350));
    close();
    paintTabs();
    if (location.hash === '#rankings') route({ fresh: true }); else location.hash = '#rankings';
  });
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
      ${ts.map((t, k) => `<span class="lf">${headshot(t, `lead-face${st.drain === t.rid ? ' drained' : ''}`)}${champBadge(t)}<span class="cap">${esc(firstName(t))}</span>${k === 0 && stamp ? `<em class="stamp">${esc(stamp)}</em>` : ''}</span>`).join('')}
    </div>`;
}

// a video story's clip, printed like the headline photos: the stamp on its corner and the face of whoever the joke is on.
// It plays muted on a loop while its slide is showing (bindClip); a tap anywhere on it starts it over with sound.
const CLIP_ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  muted: '<path d="M3.5 9.5v5h3.8l4.7 4v-13l-4.7 4z" fill="currentColor"/><path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  sound: '<path d="M3.5 9.5v5h3.8l4.7 4v-13l-4.7 4z" fill="currentColor"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
};
const clipButton = (state) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">${CLIP_ICONS[state]}</svg><span>${state === 'play' ? 'Play' : 'Sound'}</span>`;
function clipPrint(st) {
  const C = st.clip, who = team(st.face), m = member(who);
  return `<figure class="clip-print ${esc(st.tone || '')}">
      <div class="clip-frame">
        <video class="clip" muted playsinline loop preload="none" poster="${esc(asset(C.poster))}" aria-label="${esc(C.label)}"><source src="${esc(asset(C.src))}" type="video/mp4"></video>
        <button type="button" class="clip-sound">${clipButton('play')}</button>
      </div>
      ${C.stamp ? `<em class="stamp" aria-hidden="true">${esc(C.stamp)}</em>` : ''}
      ${m ? `<span class="lf clip-who" aria-hidden="true">${headshot(who, 'lead-face')}<span class="cap">${esc(m.first)}</span></span>` : ''}
    </figure>`;
}

// a story's key name in yellow, in the headline and the deck (st.mark)
const marked = (text, marks = []) => marks.reduce((h, m) => h.split(esc(m)).join(`<mark class="hl">${esc(m)}</mark>`), esc(text));
// the player a story is about, printed like a trading card where the headline photos go: his Sleeper headshot, name and
// position, the stamp, and the face of the manager he's headed to pinned on the corner
function playerPrint(st) {
  const P = st.player, to = P.pin?.team, m = to && member(to);
  const initials = P.name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return `<figure class="player-print ${esc(st.tone || '')}" aria-hidden="true">
      <div class="pp-card">
        <img class="pp-img" src="https://sleepercdn.com/content/nfl/players/${esc(P.id)}.jpg" alt="" decoding="async" data-initials="${esc(initials)}">
        <figcaption><b>${esc(P.short)}</b><small>${esc(P.line)}</small></figcaption>
      </div>
      ${st.stamp ? `<em class="stamp">${esc(st.stamp)}</em>` : ''}
      ${m ? `<span class="lf pp-who">${headshot(to, 'lead-face')}<span class="cap">${esc(P.pin.label)}</span></span>` : ''}
    </figure>`;
}

// three headlines in one square card (four on night-edition nights): swipe, arrows or dots; the active dot's fill is the
// auto-advance timer
const CAROUSEL_SIZE = 3;
function leadStory() {
  const s = DATA.stories;
  if (!s?.lead) return '';
  const stories = [s.lead, ...s.more].slice(0, s.size || CAROUSEL_SIZE + (s.night ? 1 : 0) + (s.extra ? 1 : 0));
  carouselStories = stories; // the league desk tags comments with these
  // sections: runs of slides sharing a group, when every slide has one
  const runs = stories.every((st) => GROUPS[st.group]) ? stories.reduce((a, st, i) => { const r = a[a.length - 1]; if (r?.g === st.group) r.i.push(i); else a.push({ g: st.group, i: [i] }); return a; }, []) : null;
  const groupPos = (st, i) => { const r = runs?.find((x) => x.i.includes(i)); return r && r.i.length > 1 ? `<small>${r.i.indexOf(i) + 1} of ${r.i.length}</small>` : ''; };
  const dot = (i) => `<button type="button" class="car-dot" data-i="${i}" aria-label="Show headline ${i + 1}${runs ? `, ${GROUPS[stories[i].group]}` : ''}" aria-controls="slide-${i}"${i ? '' : ' aria-current="true"'}><i></i></button>`;
  const dotRail = () => (runs
    ? `<div class="car-dots grouped">${runs.map((r) => `<div class="car-group g-${r.g}"><div class="cg-dots">${r.i.map(dot).join('')}</div><span class="cg-label">${GROUPS[r.g]}</span></div>`).join('')}</div>`
    : `<div class="car-dots">${stories.map((_, i) => dot(i)).join('')}</div>`);
  const date = new Date(AT || DATA.now).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' });
  const cast = (st) => st.rids.map(team).filter(Boolean).map((t) => `
    <div class="cast-team">${avatar(t)}
      <div class="cast-name"><b>${esc(t.name)}${champTag(t, false)}</b><small>No. ${t.powerRank} power, ${record(t)}</small></div>
      ${rankSpark(t)}
      <span class="cast-odds"><b>${pct(t.playoffPct)}</b><small>playoffs</small></span>
    </div>`).join('');
  const slide = (st, i) => {
    const top = `<div class="slide-top">
        <p class="kicker">${st.type === 'shakeup' || st.breaking ? '<span class="brk"><i aria-hidden="true"></i>Breaking</span>' : ''}<span>${i ? (st.type === 'monday' || st.type === 'locked' || st.type === 'tonight' || (st.type === 'sass' && s.night) ? 'Tonight' : 'Also today') : esc(date)}</span><span class="k${st.group ? ` g-${st.group}` : ''}">${esc(st.kicker)}${groupPos(st, i)}</span></p>
        ${st.clip ? '' : st.player ? playerPrint(st) : leadFaces(st)}
      </div>`;
    const hed = `<${i ? 'h2' : 'h1'} class="lead-hed${st.mark ? ' marked' : ''}">${marked(st.headline, st.mark)}</${i ? 'h2' : 'h1'}>`;
    // a video story puts its clip beside the kicker and headline, where the photos would be
    return `
    <article class="slide${st.type === 'shakeup' || st.breaking ? ' breaking' : ''}${st.clip ? ' has-clip' : ''}" id="slide-${i}" role="group" aria-roledescription="slide" aria-label="Headline ${i + 1} of ${stories.length}">
      ${st.clip ? `<div class="clip-head">${top}${hed}</div>${clipPrint(st)}` : `${top}${hed}`}
      <p class="lead-deck">${marked(st.deck, st.mark)}</p>
      ${st.bug ? scoreBug(st.bug) : `<div class="cast">${cast(st)}</div>`}
    </article>`;
  };
  const arrow = (dir, label, d) => `<button type="button" class="car-arrow" data-dir="${dir}" aria-label="${label}"><svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
  return `
    <section class="lead-car glass rim" aria-roledescription="carousel" aria-label="Today's headlines">
      ${onHold() ? `<p class="desk-note" role="status"><span class="live-dot" aria-hidden="true"></span>${esc(NEWS_CLOCK.holdNote)}</p>` : ''}
      <div class="car-track" tabindex="0">${stories.map(slide).join('')}</div>
      ${stories.length > 1 ? `<div class="car-nav">
        ${arrow(-1, 'Previous headline', 'M7.5 1.5 2 7l5.5 5.5')}
        <div class="car-mid">
          ${dotRail()}
          <button type="button" class="car-pause" aria-pressed="${carouselPaused}" aria-label="${carouselPaused ? 'Play' : 'Pause'} the headlines">${pauseIcon(carouselPaused)}</button>
        </div>
        ${arrow(1, 'Next headline', 'M1.5 1.5 7 7l-5.5 5.5')}
      </div>` : ''}
    </section>`;
}

let carouselFit = null, carouselSeen = null, clipSync = null;
// the pause button holds the headlines where they are for the rest of the visit (every page's carousel), until pressed again
let carouselPaused = false;
const pauseIcon = (paused) => `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">${paused
  ? '<path d="M4.5 2.5v11l9-5.5z" fill="currentColor"/>'
  : '<path d="M4 2.5h2.6v11H4zm5.4 0H12v11H9.4z" fill="currentColor"/>'}</svg>`;
function bindCarousel() {
  carouselFit = null;
  clipSync = null;
  carouselNow = null;
  carouselSeen?.disconnect();
  const car = $('.lead-car'), track = car?.querySelector('.car-track');
  if (!track) return;
  const dots = [...car.querySelectorAll('.car-dot')], n = dots.length;
  const slides = [...track.querySelectorAll('.slide')];
  let idx = 0, steering = 0;
  clipSync = bindClip(car, slides, dots, () => idx);
  // Only rotate (or play a clip) while the card is mostly on screen. A rotation changes the card's height on phones,
  // and iPhone Safari doesn't anchor scrolling, so rotating while someone reads further down would jolt the whole page.
  carouselSeen = new IntersectionObserver(([e]) => { car.classList.toggle('away', e.intersectionRatio < 0.6); clipSync?.(); }, { threshold: [0, 0.6] });
  carouselSeen.observe(car);
  if (n < 2) return;
  // on phones the card hugs the story that's showing instead of the tallest one, so short stories leave no gap
  const phone = matchMedia('(max-width: 760px)');
  const fit = () => { track.style.height = phone.matches ? `${slides[idx].offsetHeight}px` : ''; };
  const show = (i, resize = true) => {
    idx = (i + n) % n;
    dots.forEach((d, k) => (k === idx ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
    if (resize) fit();
    clipSync?.();
  };
  fit();
  document.fonts?.ready.then(fit); // headline height changes once the display font arrives
  carouselFit = fit; // re-run on real width changes (see onWidthChange)
  carouselNow = { at: () => idx, go: (i) => go(i) }; // for the league desk's headline chips
  const go = (i) => {
    show(i);
    const sl = slides[idx];
    sl.classList.remove('enter');
    void sl.offsetWidth; // restart the animation
    sl.classList.add('enter');
    clearTimeout(steering);
    steering = setTimeout(() => (steering = 0), 700); // ignore scroll events from our own smooth scroll
    track.scrollTo({ left: idx * track.clientWidth, behavior: calm() ? 'auto' : 'smooth' });
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
  car.classList.toggle('paused', carouselPaused);
  car.querySelector('.car-pause')?.addEventListener('click', (e) => {
    const b = e.currentTarget;
    carouselPaused = !carouselPaused;
    car.classList.toggle('paused', carouselPaused);
    b.setAttribute('aria-pressed', String(carouselPaused));
    b.setAttribute('aria-label', `${carouselPaused ? 'Play' : 'Pause'} the headlines`);
    b.innerHTML = pauseIcon(carouselPaused);
  });
  // touch has no hover, so hold the timer while a finger is down
  track.addEventListener('pointerdown', () => car.classList.add('held'));
  ['pointerup', 'pointercancel'].forEach((e) => track.addEventListener(e, () => car.classList.remove('held')));
}

// A video story's clip plays muted on a loop, and only while its slide is showing, the card is mostly on screen, the tab
// is visible and nothing covers the page (the important message and the reveal lock it with html.locked). Its dot runs
// as long as the clip and holds while the video loads, so the two finish together. A tap starts the clip over with
// sound, and the dot with it; leaving the slide mutes it again. Under reduced motion or Save-Data, or when the browser
// refuses to autoplay (iPhone Low Power Mode), it shows the still until tapped. Returns the check to re-run on changes.
function bindClip(car, slides, dots, current) {
  const v = car.querySelector('video.clip');
  if (!v) return null;
  const slide = v.closest('.slide'), btn = slide.querySelector('.clip-sound'), dot = dots[slides.indexOf(slide)];
  const auto = !calm() && !navigator.connection?.saveData;
  let blocked = false, sound = false, here = false, hold = 0;
  const paint = () => {
    const state = v.paused ? 'play' : v.muted ? 'muted' : 'sound';
    if (btn.dataset.state === state) return;
    btn.dataset.state = state;
    btn.innerHTML = clipButton(state);
    if (state === 'play') btn.removeAttribute('aria-pressed'); else btn.setAttribute('aria-pressed', String(state === 'sound'));
  };
  const hush = () => { sound = false; v.muted = true; v.loop = true; };
  // the dot waits for the frames to move ('playing'), though never more than 3 s on a slow connection
  const wait = (on) => { clearTimeout(hold); car.classList.toggle('buffering', on); if (on) hold = setTimeout(() => wait(false), 3000); };
  const play = () => {
    if (v.paused) wait(true); // a clip already running (a tap for sound) just starts over; 'waiting' covers a stall
    if (!v.readyState && v.networkState !== v.NETWORK_LOADING) v.load(); // Safari won't fetch a preload="none" clip on play() alone
    // a refusal blocks autoplay from here on; a start cut short by pause() (a swipe, the takeover) doesn't
    v.play()?.catch((e) => { if (e?.name !== 'AbortError' && !sound) blocked = true; wait(false); paint(); });
  };
  const showing = () => slides[current()] === slide && !car.classList.contains('away') && !document.hidden && !document.documentElement.classList.contains('locked');
  const sync = () => {
    if (!v.isConnected) { v.pause(); if (clipSync === sync) clipSync = null; return; } // another page replaced it
    const was = here;
    here = slides[current()] === slide;
    if (!showing()) {
      if (!v.paused) v.pause();
      wait(false);
      if (!here) hush(); // it comes back silent, from the top
      return paint();
    }
    if (!was) v.currentTime = 0;
    if (v.paused && (sound || (auto && !blocked))) play();
    paint();
  };
  const tap = () => {
    if (!v.paused && !v.muted) { // sound off: back to the silent loop, or a stop where nothing autoplays
      hush();
      if (!auto || blocked) v.pause();
      return paint();
    }
    sound = true; blocked = false;
    v.muted = false; v.loop = false; v.currentTime = 0;
    // start the dot over with the clip (it only runs on the slide that's showing)
    const fill = dot?.querySelector('i');
    if (fill) { fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = ''; }
    play();
    paint();
  };
  v.addEventListener('playing', () => { wait(false); paint(); });
  v.addEventListener('waiting', () => { if (showing()) wait(true); });
  v.addEventListener('pause', paint);
  v.addEventListener('loadedmetadata', () => dot?.style.setProperty('--fill', `${v.duration}s`));
  // only a clip with sound ends (the silent one loops): back to the silent loop, from the top
  v.addEventListener('ended', () => { hush(); v.currentTime = 0; if (auto && !blocked && showing()) play(); paint(); });
  btn.addEventListener('click', tap);
  v.addEventListener('click', tap);
  sync();
  return sync;
}

// ---------- wire ----------
// The Wire is React (src/wire/WirePage.jsx), mounted into #app by bind; its filters live in wireState.
const viewWire = () => '';
const signed = (x) => `${x > 0 ? '+' : ''}${f1(x)}`;

// ---------- matchups ----------
// The Games page is React (src/games), mounted into #app by bind; fan picks load at startup (src/games/votes.js).
const viewMatchups = () => '';

// ---------- trade lab ----------
// The Trade lab is React (src/trades/TradesPage.jsx), mounted into #app by bind; its shape filter lives in tradeState.
function setMyTeam(rid) {
  myTeam = rid || null;
  store.set('ph-my-team', myTeam ? String(myTeam) : null);
  $('#my-team').value = myTeam ? String(myTeam) : '';
  route();
}
const viewTrades = () => '';

// ---------- nerd lab ----------
// The Nerd lab is React (src/lab): the lab itself (#lab) and the team dashboard (#lab/team), mounted into #app by bind.
// The team dashboard opens on your team, or whichever was picked there last (labState.team).
const dashTeam = () => (team(labState.team) ? labState.team : myTeam && team(myTeam) ? myTeam : DATA.teams[0].rid);
// formatting and names for the React pages, so they read exactly like the rest of the site
const reactHelpers = () => ({
  f1, pct, ordinal, short, record, nfl, groupSaid, pctW, nameOf, posOf, faceSrc, first: firstName, teams: DATA.teams,
  american, half, signed, isChamp, champSeason: CHAMPION?.season, bull: bullInfo, moneyWeek: MONEY_WEEK && { target: MONEY_WEEK.target, prize: money(MONEY_WEEK.prize) },
  shortName: (id) => shortName(DATA.helpers.player(id) || { name: nameOf(id) }),
});
const viewLab = () => '';

// The React pages: their view function above leaves #app empty, bind mounts the page there, and route takes it down
// (unmountReact) before it puts up the next page.
let unmountReact = null;
function mountView(Page, props) {
  unmountReact?.();
  unmountReact = mount($('#app'), Page, { D: DATA, me: myTeam, h: reactHelpers(), ...props });
}

// ---------- shell ----------
// ---------- motion ----------
// Everything here animates transform/opacity only, runs when on screen, and is skipped under reduced motion.
// each media query is parsed once; its .matches stays live as the window or the settings change
const mq = (q) => { const m = matchMedia(q); return () => m.matches; };
const calm = mq('(prefers-reduced-motion: reduce)');
// phones and touch screens get the light set: no page morphs or scroll reveals, which cost the most on mobile GPUs
const lite = mq('(max-width: 760px), (pointer: coarse)');
const morphs = () => !!document.startViewTransition && !calm() && !lite();
const ORDER = ['live', 'rankings', 'wire', 'matchups', 'trades', 'lab'];
let currentView = null;

// gold pill behind the active tab; with view transitions the browser morphs it, otherwise CSS slides it
function placeInk({ settle = false } = {}) {
  const ink = $('.tab-ink'), a = $('.tabs a[aria-current]');
  if (ink && !a) { ink.style.width = '0px'; return; } // no tab to mark
  if (!ink || !a) return;
  if (settle) ink.classList.remove('live'); // a re-measure snaps into place instead of sliding
  ink.style.width = `${a.offsetWidth}px`;
  ink.style.transform = `translateX(${a.offsetLeft}px)`;
  // the browser morphs the pill during a view transition; otherwise CSS slides it
  requestAnimationFrame(() => ink.classList.toggle('live', !morphs()));
}

// count big numbers up from zero, keeping their format (decimals, sign, %)
const COUNT = '.score, .wr-num b, .odds b, .wire-stats b, .mu-team .pr, .gotw-score b, .cast-odds b';
// Reads first (final widths and display, one layout for the whole batch), writes later in startCounts, so a batch never
// interleaves reads and writes. Each number's width is locked so growing digits can't nudge the layout.
function measureCounts(els) {
  return els.filter((el) => !el.dataset.counted).map((el) => ({ el, w: el.getBoundingClientRect().width, inline: getComputedStyle(el).display === 'inline' }));
}
// one animation-frame loop drives every number counting on the page
const counting = new Set();
let countRaf = 0;
function startCounts(plan, delay = 0) {
  const t0 = performance.now() + delay;
  for (const { el, w, inline } of plan) {
    el.dataset.counted = '1';
    const m = el.textContent.trim().match(/^([+-]?)(\d+(?:\.\d+)?)(%?)$/);
    if (!m) continue;
    if (inline) el.style.display = 'inline-block';
    el.style.minWidth = `${Math.ceil(w)}px`;
    counting.add({ el, sign: m[1], target: Number(m[2]), dec: (m[2].split('.')[1] || '').length, unit: m[3], t0 });
  }
  if (counting.size && !countRaf) countRaf = requestAnimationFrame(countFrame);
}
function countFrame(now) {
  for (const c of counting) {
    const k = Math.min(1, Math.max(0, (now - c.t0) / 750)), e = 1 - (1 - k) ** 3;
    c.el.textContent = `${c.sign}${(c.target * e).toFixed(c.dec)}${c.unit}`;
    if (k === 1) counting.delete(c);
  }
  countRaf = counting.size ? requestAnimationFrame(countFrame) : 0;
}
const countAll = (els) => startCounts(measureCounts(els));

// The power rankings arrive as you scroll: the first time a row comes into view it rises and grows into place (CSS
// .rank.arrive), a few at a time, its numbers counting up. Phones get this too: it's transform and opacity only, and
// the rows are the point of the page. Rows already seen this visit (another tab and back, a new team picked) render in
// place, so each row makes its entrance once; a new computed league (the final call) starts the set over.
const seenRanks = new Set();
let rankIo = null;
function revealRanks(root) {
  rankIo?.disconnect();
  const rows = [...root.querySelectorAll('.ranks > .rank')].filter((el) => !seenRanks.has(el.dataset.rid));
  if (!rows.length) return;
  rows.forEach((el) => el.classList.add('pending'));
  rankIo = new IntersectionObserver((entries) => {
    const arriving = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    if (!arriving.length) return;
    // measure every row's numbers before any row scales, so their locked widths are the real ones
    const plans = arriving.map((el) => measureCounts([...el.querySelectorAll(COUNT)]));
    arriving.forEach((el, k) => {
      const d = Math.min(k, 4) * 70;
      rankIo.unobserve(el);
      seenRanks.add(el.dataset.rid);
      startCounts(plans[k], d + 120); // the count starts as its row shows up
      el.style.setProperty('--d', `${d}ms`);
      el.classList.replace('pending', 'arrive');
      el.addEventListener('animationend', function done(ev) {
        if (ev.target !== el) return;
        el.classList.remove('arrive');
        el.removeEventListener('animationend', done);
      });
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  rows.forEach((el) => rankIo.observe(el));
}

// cards and panels rise in as they scroll into view, staggered within each batch
const REVEAL = '.hero > .lead-car, .live-panel, .you-card, .notice, .gotw, .matchups > .mu, .wire-stats, .sec-title, .moves > li, .day > h3, .two-col aside > .panel, .lab-grid > .panel, .trade-bar, .trade-legend, .ideas > .idea, .futures, .method-box, .empty';
let io = null;
function reveal(root) {
  io?.disconnect();
  rankIo?.disconnect();
  if (calm() || !('IntersectionObserver' in window)) return;
  revealRanks(root);
  if (lite()) {
    // phones: count the numbers on the first screen once (ranking rows count as they arrive); nothing else runs
    // while scrolling
    countAll([...root.querySelectorAll(COUNT)].filter((el) => { if (el.closest('.rank')) return false; const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }));
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
  // cards already on the first screen show at once (the tab change slides the whole page in anyway), so a new tab
  // never opens on an empty field; only what's further down rises in as it scrolls into view
  const first = [], below = [];
  root.querySelectorAll(REVEAL).forEach((el) => { const r = el.getBoundingClientRect(); (r.top < innerHeight * 0.94 && r.bottom > 0 ? first : below).push(el); });
  countAll(first.flatMap((el) => [...el.querySelectorAll(COUNT)]));
  below.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
}

const VIEWS = { live: viewLive, rankings: viewRankings, wire: viewWire, matchups: viewMatchups, trades: viewTrades, lab: viewLab };
function route({ fresh = false } = {}) {
  // while a week is being played the Live tab is the front page; it only exists then
  const home = DATA.liveMode ? 'live' : 'rankings';
  const [v, sub] = (location.hash || `#${home}`).slice(1).split('/');
  const key = VIEWS[v] && (v !== 'live' || DATA.liveMode || DATA.after) ? v : home;
  labState.sub = key === 'lab' && sub === 'team' ? 'team' : null;
  const dir = !currentView || key === currentView ? 'same' : ORDER.indexOf(key) > ORDER.indexOf(currentView) ? 'fwd' : 'back';
  const render = () => {
    unmountReact?.(); // a React page is taken down before its HTML goes
    unmountReact = null;
    document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    placeInk();
    paintMe();
    const app = $('#app');
    app.innerHTML = VIEWS[key]();
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
  if (key === 'rankings') mountView(RankingsPage, rankingsProps());
  if (key === 'live') mountView(LivePage, liveProps());
  if (key === 'live') bindCarousel();
  if (key === 'live' || key === 'rankings') mountTalk();
  if (key === 'rankings') {
    if (!DATA.liveMode) bindCarousel();
    maybeMessage();
    const again = $('[data-message]');
    if (again) {
      messageReady?.then((ok) => (again.hidden = !ok));
      if (!messageReady) fetch(MESSAGE_VIDEO.src, { method: 'HEAD' }).then((r) => (again.hidden = !r.ok)).catch(() => {});
      again.addEventListener('click', () => maybeMessage(true));
    }
  }
  if (key === 'matchups') mountView(GamesPage, { calm: calm(), lite: lite() });
  if (key === 'trades') mountView(TradesPage, { state: tradeState, onState: (x) => Object.assign(tradeState, x), onTeam: setMyTeam });
  if (key === 'wire') mountView(WirePage, { state: wireState, onState: (x) => Object.assign(wireState, x) });
  if (key === 'lab') {
    mountView(Lab, {
      sub: labState.sub, raw: DATA.raw, ros: RAW.ros?.values || {}, calm: calm(),
      team: dashTeam(), onTeam: (rid) => (labState.team = rid),
    });
  }
}

// the Live tab exists while a week is on, and reads "Final" once the week is (before and after the reveal)
function paintTabs() {
  const a = $('.tabs a[data-view="live"]'), fin = DATA.finalCall || DATA.after;
  a.hidden = !DATA.liveMode && !DATA.after;
  a.textContent = fin ? 'Final' : 'Live';
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
  // the tip is measured only when it gets new text, and follows the mouse with a transform, so moving costs no layout
  let shownFor = null, w = 0, h = 0;
  const show = (el, x, y) => {
    if (el !== shownFor || tip.hidden) {
      tip.textContent = el.dataset.tip;
      tip.hidden = false;
      shownFor = el;
      ({ width: w, height: h } = tip.getBoundingClientRect());
    }
    const left = Math.min(innerWidth - w - 8, Math.max(8, x + 14)), top = Math.min(innerHeight - h - 8, y + 16);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  const hide = () => { if (!tip.hidden) { tip.hidden = true; shownFor = null; } };
  let touch = false, moved = null;
  document.addEventListener('pointerdown', (e) => (touch = e.pointerType !== 'mouse'), { passive: true });
  // at most one update per frame, however fast the mouse reports
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // a finger dragging over marks would flash tips mid-scroll
    if (!moved) requestAnimationFrame(() => {
      const { target, x, y } = moved;
      moved = null;
      const el = target.closest?.('[data-tip]');
      if (el && el.dataset.tip) show(el, x, y); else hide();
    });
    moved = { target: e.target, x: e.clientX, y: e.clientY };
  }, { passive: true });
  // touch: tap a mark to see its numbers, tap anywhere else (or scroll) to dismiss
  document.addEventListener('click', (e) => {
    if (!touch) return;
    const el = e.target.closest?.('[data-tip]');
    if (el && el.dataset.tip && !el.closest('button')) show(el, e.clientX, e.clientY); else hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
  document.documentElement.addEventListener('pointerleave', hide); // the mouse left the window
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

// ---------- the league desk: one discussion thread a week, beside the headlines ----------
// Anyone can read; managers post once they've opened their personal link from Dan (api/talk.js). The panel stays put
// while the headlines rotate: a comment can carry the headline it's about (taken from the slide on screen when its
// author starts typing), shown as a chip that turns the carousel back to that slide. Authors can edit for a minute;
// only Dan deletes. It refreshes every 25 seconds while the tab is visible. The demo and the preview bundle skip it.
const TALK = { data: null, ref: null, refTouched: false, editing: null, flash: '', error: '', join: null, invites: null, links: {}, view: null };
let carouselNow = null, carouselStories = [];
// the week being played, from the snapshot as Sleeper has it: it turns over Tuesday morning with the new headlines,
// not Monday night when the final call counts the week early (asFinal moves DATA's last scored week)
const talkWeek = () => (RAW.league.settings?.last_scored_leg ?? DATA.meta.lastScored) + 1;
// the thread on screen: this week's, or an earlier one picked to read back through
const viewWeek = () => TALK.view ?? talkWeek();
const talkSlot = () => (RAW.isDemo || window.__DEMO__ ? '' : '<aside class="talk glass" id="talk" aria-label="League desk" hidden></aside>');
// a headline's thread key: the week and its story type (a second story of the same type gets a number)
const storyKeys = (stories) => { const seen = {}; return stories.map((st) => { const n = (seen[st.type] = (seen[st.type] || 0) + 1); return `w${talkWeek()}:${st.type}${n > 1 ? `-${n}` : ''}`; }); };
const talkNow = () => Date.now() + (TALK.data?.skew || 0);

async function talkCall(body) {
  const r = await fetch(body ? '/api/talk' : `/api/talk?week=${viewWeek()}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Something went wrong (${r.status})`);
  return j;
}
const keepTalk = (d) => { if (d && 'comments' in d) TALK.data = { ...d, skew: d.now ? d.now - Date.now() : 0 }; };

async function loadTalk() {
  if (RAW.isDemo || window.__DEMO__) return;
  try { keepTalk(await talkCall()); } catch { /* keep what's on screen */ }
  paintTalk();
}

// a personal link (#join=<token>) opened on this device: trade it for a session, and make their team "yours"
async function claimTalk() {
  const token = TALK.join;
  TALK.join = null;
  try {
    const r = await talkCall({ action: 'claim', token });
    const t = DATA.teams.find((x) => x.ownerId === r.me);
    TALK.flash = `You're in, ${DESK_PEOPLE[r.me]?.first || 'friend'}. Your comments post as ${t ? t.name : 'you'}.`;
    if (t && !myTeam) { myTeam = t.rid; store.set('ph-my-team', String(t.rid)); $('#my-team').value = String(t.rid); paintMe(); }
  } catch (e) {
    TALK.flash = e.message;
  }
  await loadTalk();
}

function mountTalk() {
  const el = $('#talk');
  if (!el) return;
  el.addEventListener('click', onTalkClick);
  el.addEventListener('input', onTalkInput);
  el.addEventListener('submit', onTalkSubmit);
  el.addEventListener('change', (e) => {
    if (!e.target.matches('[data-week]')) return;
    const w = Number(e.target.value);
    TALK.view = w === talkWeek() ? null : w;
    TALK.editing = null;
    loadTalk();
  });
  if (TALK.data) paintTalk(true); else loadTalk();
}

const ago = (ts) => {
  const s = (talkNow() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
};
const refChip = (ref) => {
  const i = storyKeys(carouselStories).indexOf(ref.key);
  return `<button type="button" class="tc-ref" data-goto="${i}"${i < 0 ? ' disabled' : ''} data-tip="${esc(i < 0 ? `${ref.title} (no longer in the headlines)` : `Show this headline: ${ref.title}`)}">On: ${esc(short(ref.title, 56))}</button>`;
};
function talkItem(c) {
  const D = TALK.data, t = DATA.teams.find((x) => x.ownerId === c.uid), m = DESK_PEOPLE[c.uid];
  const mine = D.me === c.uid, left = D.editMs - (talkNow() - c.ts);
  const editing = TALK.editing === c.id;
  const acts = [
    mine && left > 0 && !editing ? `<button type="button" class="tc-act" data-edit="${esc(c.id)}" aria-label="Edit, ${Math.ceil(left / 1000)} seconds left">Edit<small>${Math.ceil(left / 1000)}s</small></button>` : '',
    D.admin ? `<button type="button" class="tc-act bad" data-del="${esc(c.id)}">Delete</button>` : '',
  ].join('');
  return `<li class="tc${mine ? ' mine' : ''}" data-id="${esc(c.id)}">
      ${t ? headshot(t, 'tc-face') : m?.icon ? `<img class="tc-face icon" src="${m.icon}" alt="" decoding="async">` : `<span class="tc-face ph">${esc((m?.first || '?')[0])}</span>`}
      <div class="tc-body">
        <p class="tc-who"><b>${esc(m?.first || 'Manager')}</b>${t ? `<span>${esc(t.name)}</span>` : GUESTS[c.uid] ? '<span>Guest</span>' : ''}<time>${ago(c.ts)}${c.edited ? ', edited' : ''}</time></p>
        ${c.ref ? refChip(c.ref) : ''}
        ${editing
          ? `<form class="tc-edit" data-id="${esc(c.id)}"><textarea rows="3" maxlength="${D.maxLen}" aria-label="Edit your comment">${esc(c.text)}</textarea><div class="talk-row"><button type="button" class="talk-btn" data-cancel>Cancel</button><button type="submit" class="talk-btn primary">Save</button></div></form>`
          : `<p class="tc-text">${esc(c.text)}</p>`}
        ${acts ? `<div class="tc-acts">${acts}</div>` : ''}
      </div>
    </li>`;
}
function talkList() {
  const cs = TALK.data?.comments || [];
  return cs.length ? cs.map(talkItem).join('') : '<li class="tc-empty">Nothing yet. Start the argument.</li>';
}
const aboutChip = () => (TALK.ref
  ? `<span class="talk-about-on"><span>About: <b>${esc(short(TALK.ref.title, 64))}</b></span><button type="button" class="tc-x" data-unref aria-label="Not about this headline"><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m2 2 8 8m0-8-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></span>`
  : '<button type="button" class="tc-tag" data-tag><svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Tag the headline on screen</button>');
function talkForm() {
  const D = TALK.data;
  if (TALK.view) return `<p class="talk-note">Week ${TALK.view}'s thread is closed. <button type="button" class="tc-link" data-now>Back to week ${talkWeek()}</button></p>`;
  if (!D.me) return '<p class="talk-note">Reading only. Ask Dan for your personal link to join in.</p>';
  return `<form class="talk-form">
      <div class="talk-about">${aboutChip()}</div>
      <textarea rows="3" maxlength="${D.maxLen}" placeholder="Say something to the league" aria-label="Your comment"></textarea>
      <div class="talk-row"><small class="talk-count">0/${D.maxLen}</small><span class="talk-err" role="status"></span><button type="submit" class="talk-btn primary">Post</button></div>
    </form>`;
}
function invitePanel() {
  if (!TALK.invites) return '';
  const people = [...Object.entries(MEMBERS).sort((a, b) => a[1].first.localeCompare(b[1].first)), ...Object.entries(GUESTS)];
  return `<div class="talk-invites">
      <p class="talk-note">Each link signs one manager in, on as many of their devices as they like. A new link replaces the old one and signs those devices out.</p>
      <ul>${people.map(([uid, m]) => {
        const t = DATA.teams.find((x) => x.ownerId === uid), url = TALK.links[uid];
        return `<li><span><b>${esc(m.first)}</b>${t ? `<small>${esc(t.name)}</small>` : GUESTS[uid] ? '<small>Guest</small>' : ''}</span>
          ${url ? `<input readonly value="${esc(url)}" aria-label="${esc(m.first)}'s link"><button type="button" class="talk-btn" data-copy="${esc(uid)}">Copy</button>` : `<button type="button" class="talk-btn" data-invite="${esc(uid)}">New link</button>`}</li>`;
      }).join('')}</ul>
    </div>`;
}

// full paint the first time (or after sign-in changes); after that only the list, so a draft is never wiped
function paintTalk(full = false) {
  const el = $('#talk'), D = TALK.data;
  if (!el) return;
  if (!D?.enabled) { el.hidden = true; el.closest('.hero')?.classList.remove('with-talk'); return; }
  el.hidden = false;
  el.closest('.hero')?.classList.add('with-talk');
  const n = D.comments.length;
  const signed = D.me ? `<span class="talk-me">Posting as <b>${esc(DESK_PEOPLE[D.me]?.first || '')}</b><button type="button" class="tc-pill" data-signout>Sign out</button></span>` : '';
  // earlier weeks' threads stay readable: pick one to read back through
  const cur = talkWeek(), weeks = Array.from({ length: cur }, (_, i) => cur - i);
  const picker = cur > 1 ? `<label class="talk-wk"><span>Week</span><select data-week aria-label="Which week's thread">${weeks.map((w) => `<option value="${w}"${w === D.week ? ' selected' : ''}>${w}${w === cur ? ', this week' : ''}</option>`).join('')}</select></label>` : `<span class="talk-n">Week ${D.week}</span>`;
  const head = `<div class="talk-head">
      <div class="talk-title"><h2>League desk</h2>${D.admin ? `<button type="button" class="talk-btn" data-invites aria-expanded="${!!TALK.invites}">Invite links</button>` : ''}</div>
      <div class="talk-bar"><span class="talk-meta">${picker}<span class="talk-n">${n} comment${n === 1 ? '' : 's'}</span></span>${signed}</div>
    </div>`;
  const flash = TALK.flash ? `<p class="talk-flash" role="status">${esc(TALK.flash)}</p>` : '';
  const signedIn = el.dataset.me ?? '';
  if (full || !el.querySelector('.talk-list') || signedIn !== String(D.me || '') || el.dataset.inv !== String(!!TALK.invites) || el.dataset.wk !== String(D.week)) {
    el.dataset.me = String(D.me || ''); el.dataset.inv = String(!!TALK.invites); el.dataset.wk = String(D.week);
    el.innerHTML = `<div class="talk-in">${head}${flash}${invitePanel()}<ol class="talk-list">${talkList()}</ol>${talkForm()}</div>`;
  } else {
    el.querySelector('.talk-head').outerHTML = head;
    if (TALK.editing == null) el.querySelector('.talk-list').innerHTML = talkList();
  }
  const list = el.querySelector('.talk-list');
  if (list && !TALK.editing && list.dataset.n !== String(n)) { list.scrollTop = list.scrollHeight; list.dataset.n = String(n); }
  // the edit buttons come off when their minute is up
  clearTimeout(TALK.tick);
  const next = D.comments.filter((c) => c.uid === D.me).map((c) => D.editMs - (talkNow() - c.ts)).filter((x) => x > 0);
  if (next.length) TALK.tick = setTimeout(() => paintTalk(), Math.min(...next, 10000) + 50);
}

const currentHeadline = () => {
  const i = carouselNow?.at() ?? 0, st = carouselStories[i];
  return st ? { key: storyKeys(carouselStories)[i], title: st.headline } : null;
};
function onTalkInput(e) {
  const f = e.target.closest('.talk-form');
  if (!f || e.target.tagName !== 'TEXTAREA') return;
  f.querySelector('.talk-count').textContent = `${e.target.value.length}/${TALK.data.maxLen}`;
  // the first keystroke tags the headline on screen, unless the author already chose
  if (!TALK.refTouched && e.target.value.trim()) { TALK.refTouched = true; TALK.ref = currentHeadline(); f.querySelector('.talk-about').innerHTML = aboutChip(); }
}
async function onTalkSubmit(e) {
  e.preventDefault();
  const f = e.target, ta = f.querySelector('textarea'), btn = f.querySelector('[type=submit]'), err = f.querySelector('.talk-err');
  const text = ta.value.trim();
  if (!text) return;
  btn.disabled = true;
  try {
    if (f.classList.contains('tc-edit')) { keepTalk(await talkCall({ action: 'edit', week: viewWeek(), id: f.dataset.id, text })); TALK.editing = null; }
    else {
      keepTalk(await talkCall({ action: 'post', week: talkWeek(), text, ref: TALK.ref }));
      ta.value = ''; TALK.ref = null; TALK.refTouched = false;
      f.querySelector('.talk-about').innerHTML = aboutChip();
      f.querySelector('.talk-count').textContent = `0/${TALK.data.maxLen}`;
    }
    TALK.flash = '';
    paintTalk();
  } catch (x) {
    if (err) err.textContent = x.message; else TALK.flash = x.message;
  } finally {
    btn.disabled = false;
  }
}
async function onTalkClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.goto != null && !b.disabled) { carouselNow?.go(Number(d.goto)); $('.lead-car')?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'nearest' }); }
  else if ('unref' in d) { TALK.ref = null; TALK.refTouched = true; b.closest('.talk-about').innerHTML = aboutChip(); }
  else if ('tag' in d) { TALK.ref = currentHeadline(); TALK.refTouched = true; b.closest('.talk-about').innerHTML = aboutChip(); }
  else if (d.edit) { TALK.editing = d.edit; paintTalk(true); $('#talk .tc-edit textarea')?.focus(); }
  else if ('cancel' in d) { TALK.editing = null; paintTalk(true); }
  else if ('now' in d) { TALK.view = null; loadTalk(); }
  else if (d.del) {
    if (!confirm('Delete this comment for everyone?')) return;
    try { keepTalk(await talkCall({ action: 'delete', week: viewWeek(), id: d.del })); paintTalk(); } catch (x) { TALK.flash = x.message; paintTalk(true); }
  } else if ('invites' in d) { TALK.invites = !TALK.invites; paintTalk(true); }
  else if (d.invite) {
    if (!confirm(`Make a new link for ${DESK_PEOPLE[d.invite]?.first}? Their old link stops working.`)) return;
    try { const r = await talkCall({ action: 'invite', uid: d.invite }); TALK.links[d.invite] = `${location.origin}${location.pathname}#join=${r.token}`; paintTalk(true); }
    catch (x) { TALK.flash = x.message; paintTalk(true); }
  } else if (d.copy) {
    try { await navigator.clipboard.writeText(TALK.links[d.copy]); b.textContent = 'Copied'; } catch { b.closest('li').querySelector('input')?.select(); }
  } else if ('signout' in d) {
    try { await talkCall({ action: 'signout' }); } catch { /* the cookie goes either way */ }
    TALK.flash = ''; await loadTalk();
  }
}

async function main() {
  // a personal link for the league desk: take the token off the address bar before anything routes or gets shared
  const join = /^#join=([A-Za-z0-9_-]{16,128})$/.exec(location.hash);
  if (join) { TALK.join = join[1]; history.replaceState(null, '', location.pathname + location.search); }
  initAvatarFallback();
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
  // a headline clip stops while the tab is hidden or an overlay locks the page (html.locked), and picks up after
  document.addEventListener('visibilitychange', () => clipSync?.());
  new MutationObserver(() => clipSync?.()).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  loadVotes({ week: DATA.previews[0]?.week, demo: RAW.isDemo });
  loadPoll();
  if (TALK.join) claimTalk();
  setInterval(() => { if (document.visibilityState === 'visible' && $('#talk') && TALK.editing == null) loadTalk(); }, 25000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && $('#talk') && TALK.editing == null) loadTalk(); });
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
