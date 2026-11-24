import { computeLeague, PARTS } from './lib/engine.js';
import { TEAM_COLORS } from './src/charts.jsx';
import { buildStories, keyMatchup, matchupQuips } from './lib/stories.js';
import { applyOverrides } from './lib/overrides.js';
import { shortName, nfl } from './lib/matchup.js';
import { MEMBERS, photoUrl } from './lib/members.js';
import { bullseye } from './lib/bullseye.js';
import { pageRoot } from './src/mount.jsx';
import { LoadError } from './src/shared.jsx';
import { Lab } from './src/lab/Lab.jsx';
import { WirePage } from './src/wire/WirePage.jsx';
import { SECTIONS } from './src/lab/parts.jsx';
import { GamesPage } from './src/games/GamesPage.jsx';
import { loadVotes } from './src/games/votes.js';
import { get as lsGet, put as lsPut } from './src/storage.js';
import { RankingsPage } from './src/rankings/RankingsPage.jsx';
import { LivePage } from './src/live/LivePage.jsx';
import { storyKeys } from './src/hero/storyKeys.js';
import { posts, loadPosts } from './src/admin/posts.js';
import { AdminShell } from './src/admin/AdminShell.jsx';
import { initTouch, shine, pageIn } from './src/touch.js';
import { initLiquid } from './src/liquid.js';
import { streak, wireNew, wireSeen } from './src/buzz/seen.js';
import { streakNote } from './src/buzz/streak.js';
import { startPresence, presenceNow } from './src/buzz/presence.js';
import { initAway, recapNote } from './src/buzz/away.js';
import { initInstall, appBadge } from './src/buzz/install.js';
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
  why: "120 is 10/20, Commissioner Mo's birthday",
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
// the front page: Live while a week is on, and still Live (the final scores) after the final call until the game window
// closes Tuesday 6am; the power rankings otherwise
const liveHome = () => !!DATA.liveMode || (!!DATA.after && gameWindow());

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
const store = { get: lsGet, set: lsPut };

let DATA = null; // computed league
let RAW = null;
let myTeam = Number(store.get('ph-my-team')) || null;
const wireState = { type: 'all', mine: false, limit: 50, trades: 3 };
const tradeState = { shape: 'all' };
// the Lab's section (#lab/team, #lab/trades, #lab/league; plain #lab opens the last one this visit) and the team the
// dashboard shows (yours until you pick another there)
const labState = { sub: 'team', team: null };

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
  const patched = ros ? applyOverrides(ros.values, undefined, { upcoming: (raw.league.settings?.last_scored_leg ?? 0) + 1 }) : { values: {}, applied: [] };
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
  DATA.stories = after ? (finalsOn() ? finalsStories() : null) : headlines();
  DATA.key = keyMatchup(DATA);
  DATA.quips = matchupQuips(DATA);
  return DATA;
}

// the headline carousel for a league being played or about to be (after the final call there's none)
function headlines() {
  if (DATA.finalCall) return null; // once the week is final the headlines come down
  if (finalsOn()) return finalsStories(); // the week just finished: Dan's headlines until Thursday's kickoff
  let stories = buildStories(DATA, { now: DATA.now, dateKey: chicagoDate(), editor: EDITOR });
  // after Sunday night football the night desk takes over the headlines
  if (nightDesk() && DATA.live) {
    const people = Object.fromEntries(DATA.teams.map((t) => [t.rid, firstName(t)]));
    const ed = nightEdition(DATA, { dateKey: chicagoDate(), editor: EDITOR, people });
    if (ed?.length) stories = { lead: ed[0], more: ed.slice(1), night: true };
  }
  // money week leads the headlines for as long as it runs
  const ms = moneyStory();
  if (ms) stories = { ...stories, lead: ms, more: [stories.lead, ...stories.more].filter(Boolean) };
  return stories;
}

// The new power rankings after the final call: this week's final scores counted into records and points for. The
// final-scores page stays reachable from it (DATA.after).
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
// ---------- the theme ----------
// index.html sets html[data-theme] before the first paint; this keeps it in step: the header button flips it and keeps
// the choice on this device (ph-theme), and without a choice it follows the device's setting as that changes.
function initTheme() {
  const html = document.documentElement, btn = $('#theme-btn'), dark = matchMedia('(prefers-color-scheme: dark)');
  const paint = (t) => {
    // nothing transitions while the theme flips, so every colour changes in the same frame instead of fading unevenly
    html.classList.add('theme-switching');
    html.dataset.theme = t;
    setTimeout(() => html.classList.remove('theme-switching'), 60); // a timer, not frames: a background tab runs none
    $('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0A1630' : '#4FBDF2');
    btn?.setAttribute('aria-label', t === 'dark' ? 'Switch to the day game (light mode)' : 'Switch to the night game (dark mode)');
  };
  paint(html.dataset.theme === 'dark' ? 'dark' : 'light');
  btn?.addEventListener('click', () => {
    const t = html.dataset.theme === 'dark' ? 'light' : 'dark';
    paint(t);
    store.set('ph-theme', t);
  });
  dark.addEventListener?.('change', (e) => { if (!store.get('ph-theme')) paint(e.matches ? 'dark' : 'light'); });
}

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
const record = (t) => `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ''}`;
const updatedText = () => {
  const iso = DATA.rosMeta?.updated;
  if (!iso) return '';
  const d = new Date(iso);
  return `Rankings refreshed ${d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
};

// ---------- views ----------
// Every page is React (src/), put up by route() below with the props worked out here; the hero (headline carousel and
// page head, src/hero) is shared by the power rankings and the Live page.
function rankingsProps() {
  // while a week is being played the headlines move to the Live tab and these ranks hold until the week is final
  const held = !!DATA.liveMode;
  return {
    held, car: held ? null : carouselProps(), rosError: DATA.rosError || null, calm: calm(),
    sources: DATA.rosMeta ? Object.entries(DATA.rosMeta.sources).map(([k, s]) => ({ name: SOURCE_NAMES[k] || k, ok: s.ok, title: s.ok ? `${s.matched} of ${s.rows} players matched` : s.error })) : null,
    updated: updatedText() || null,
  };
}

// ---------- headline sections ----------
// the carousel's sections, in order: a short label under each cluster of dots and a colour pip, repeated on the kicker
const GROUPS = { trades: 'Trades', rumors: 'Rumors', wire: 'Wire', week: 'Games', players: 'Players', league: 'League' };
// every headline sits in a section (Dan's request Nov 6): its own group when it has one, else by its type
const TYPE_GROUP = {
  trade: 'trades', wire: 'wire', cut: 'wire', flurry: 'wire',
  upset: 'week', blowout: 'week', nailbiter: 'week', gotw: 'week', monday: 'week', locked: 'week',
  dud: 'players', star: 'players', explosion: 'players',
};
const groupOf = (st) => (GROUPS[st.group] ? st.group : TYPE_GROUP[st.type] || 'league');
// The carousel's order: Dan's own running order for this week when he's set one (api/headlines.js `arrange`, by desk key,
// sections wherever he put them; a post he hasn't placed yet leads, a site headline he hasn't seen yet goes last), else
// the sections together (bySection)
function arrangeStories(list) {
  const keys = posts.arrange?.[`w${headlineWeek()}`];
  if (!keys?.length) return bySection(list);
  const at = (st) => keys.indexOf(st.key);
  const fresh = list.filter((st) => at(st) < 0 && st.type.startsWith('p-')), late = list.filter((st) => at(st) < 0 && !st.type.startsWith('p-'));
  return [...fresh, ...list.filter((st) => at(st) >= 0).sort((a, b) => at(a) - at(b)), ...late];
}
// stories gathered into their sections, the sections in the order they first come up (so the lead stays first)
function bySection(list) {
  const order = [];
  for (const st of list) if (!order.includes(st.group)) order.push(st.group);
  return order.flatMap((g) => list.filter((st) => st.group === g));
}
const valueOf = (id) => DATA.helpers.valueOf(id);
const listOf = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n) => WORDS[n] || String(n);
const ROOM = { QB: 'quarterbacks', RB: 'backs', WR: 'receivers', TE: 'tight ends', K: 'kicker', DEF: 'defense' };
const poss = (n) => (n.endsWith('s') ? `${n}'` : `${n}'s`);

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

// ---------- a news release ----------
// Dan's request Nov 20: the What if tool (the Lab, #lab/whatif) gets a launch headline that leads the carousel, with a
// button to it on the card (st.cta). It runs a week, through Friday Nov 27, 6am Central, and goes through the desk's
// hides, edits and running order like the site's own. Set LAUNCH to null to drop it.
const LAUNCH = { until: Date.UTC(2026, 10, 27, 12) };
function launchStory() {
  if (!LAUNCH || (AT ? +AT : Date.now()) >= LAUNCH.until) return null;
  const weeks = DATA.meta.lastScored, me = myTeam && team(myTeam);
  return {
    type: 'launch', key: `w${headlineWeek()}:launch`, group: 'league', tone: 'good', kicker: 'New in the Lab', stamp: 'New tool',
    rids: me ? [me.rid] : [],
    headline: 'What if you had drafted someone else? The Lab now replays your whole season to find out.',
    deck: `Tap any player on your roster and What if lists who was still on the board at that pick, with the record each one would have given you. Pick one and all ${count(weeks)} weeks get played again: he takes your guy's spot whenever your guy started, the team that really had him plays without him, and the standings follow. Waiver weeks count too.`,
    tick: { hook: 'New tool', line: 'What if you had drafted someone else? The Lab now replays your season.' },
    cta: { href: '#lab/whatif', label: me ? `Replay ${me.name.length > 18 ? 'your' : `${me.name}'s`} draft` : 'Try What if' },
  };
}

// a position in words, for the headlines
const SLOT_WORD = { QB: 'quarterback', RB: 'running back', WR: 'receiver', TE: 'tight end', K: 'kicker', DEF: 'defense' };

// ---------- the week's final call ----------
// Dan's headlines once a week is final (from the final call, then Sleeper's own scoring, until Thursday's kickoff). The
// headlines are Dan's words; every number in the decks comes from the snapshot. Null drops them all.
// Week 11 (Nov 23): Commissioner Mo's trade, Khalil's near miss, Akrm winning through his byes, and Tarek's trade with Hamza.
const FINALS = { week: 11, mo: 'Mo', khalil: 'Khalil', akrm: 'Akrm', tarek: 'Tarek', hamza: 'Hamza', walker: /kenneth walker/i };
const finalsOn = () => !!FINALS && DATA.meta.lastScored === FINALS.week && !DATA.liveMode;
const byFirst = (name) => DATA.teams.find((t) => member(t)?.first === name);
const weekOf = (t, w) => t?.weeks.find((x) => x.week === w);
const gameSaid = (t) => {
  const g = weekOf(t, FINALS.week), o = g && team(g.opp);
  return g && o ? `${firstName(t)} ${g.result === 'W' ? 'beat' : g.result === 'L' ? 'lost to' : 'tied'} ${firstName(o)} ${f1(g.pts)} to ${f1(g.oppPts)}` : '';
};
const oddsSaid = (t) => `${firstName(t)} is ${record(t)} with ${pct(t.playoffPct)} playoff odds`;
const playerCard = (id, t, label) => {
  const info = DATA.helpers.player(id) || {}, P = nameOf(id);
  return { id, name: P, short: shortName(info.name ? info : { name: P }), line: `${info.pos || posOf(id)}, ${nfl(info.team)}`, pin: t ? { team: t, label: label || firstName(t) } : null };
};
// the newest completed trade between two teams, made by the week's games
const tradeOf = (a, b) => DATA.feed.find((f) => f.type === 'trade' && (f.week ?? 0) <= FINALS.week && f.sides.some((s) => s.rid === a.rid) && f.sides.some((s) => s.rid === b.rid));
// what a side's incoming players scored in its starting lineup, in one week or every week since the trade
const startedFor = (side, weeks) => weeks.flatMap((w) => weekPlayers(w).filter((p) => p.rid === side.rid && p.started && side.adds.some((a) => a.id === p.id)));
const sumPts = (ps) => ps.reduce((a, p) => a + p.pts, 0);
const STATUS_SAID = { IR: 'on injured reserve', Out: 'ruled out', Doubtful: 'doubtful', Questionable: 'questionable', PUP: 'on the PUP list', Sus: 'suspended', NA: 'not active' };
const dayOf = (ts) => new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' });

// Commissioner Mo pushed a trade through, and the players it brought in are what got him over the line
function commishStory() {
  const M = byFirst(FINALS.mo), g = weekOf(M, FINALS.week);
  if (!M || !g) return null;
  // his trades made before the week's games, the one whose players scored the most for him that week first (newest on a tie)
  const deals = DATA.feed.filter((f) => f.type === 'trade' && (f.week ?? 0) <= FINALS.week && f.sides.some((s) => s.rid === M.rid))
    .map((f) => ({ f, mine: f.sides.find((s) => s.rid === M.rid) })).map((x) => ({ ...x, used: startedFor(x.mine, [FINALS.week]) }))
    .sort((a, b) => sumPts(b.used) - sumPts(a.used) || b.f.ts - a.f.ts);
  if (!deals.length) return null;
  const { f, mine, used } = deals[0], O = team(g.opp), others = f.sides.filter((s) => s !== mine).map((s) => team(s.rid)).filter(Boolean);
  const got = sumPts(used), margin = g.pts - g.oppPts;
  const star = [...used].sort((a, b) => b.pts - a.pts)[0] || [...mine.adds].sort((a, b) => b.v - a.v)[0];
  const carried = g.result === 'W' && got > margin;
  return {
    type: 'commish', group: 'trades', kicker: "Commissioner's office", tone: 'trade', stamp: 'Sketchy', breaking: true,
    rids: [M.rid, ...others.map((t) => t.rid)], tx: [String(f.id)], player: star ? playerCard(star.id, M, 'Approved by Mo') : undefined, mark: star ? [nameOf(star.id)] : undefined,
    headline: carried ? 'Commissioner Mo getting sketchy? He pushed a trade through, and it inked out the win' : 'Commissioner Mo getting sketchy? He pushed a trade through, and the league has questions',
    deck: [
      `The deal went through ${dayOf(f.ts)}, with the commissioner's blessing: ${dealSaid(f)}`,
      used.length ? `In week ${FINALS.week}, ${listOf(used.map((p) => `${nameOf(p.id)} (${f1(p.pts)})`))} started for Mo, ${f1(got)} points from the trade.` : '',
      g.result === 'W' ? `He beat ${firstName(O)} ${f1(g.pts)} to ${f1(g.oppPts)}, a ${f1(margin)}-point win.${carried ? ` Take the trade away and that's a loss.` : ''}` : `${gameSaid(M)}.`,
      `${oddsSaid(M)}. The league office has opened an investigation. The league office is Mo.`,
    ].filter(Boolean).join(' '),
    tick: { hook: 'Sketchy', line: carried ? `Mo pushed a trade through, and it won him the week by ${f1(margin)}.` : 'Mo pushed a trade through. The league has questions.' },
  };
}

// Khalil came within a couple of points. It's Khalil: he lost
function khalilStory() {
  const K = byFirst(FINALS.khalil), g = weekOf(K, FINALS.week);
  if (!K || !g || g.result !== 'L') return null;
  const O = team(g.opp), gap = g.oppPts - g.pts, box = weekPlayers(FINALS.week).filter((p) => p.rid === K.rid);
  // the bench player who would have won it on his own, swapped in for a starter at his position
  const swap = box.filter((p) => !p.started).flatMap((b) => box.filter((s) => s.started && s.pos === b.pos && b.pts - s.pts > gap).map((s) => ({ b, s, d: b.pts - s.pts })))
    .sort((a, b) => b.d - a.d)[0];
  return {
    type: 'khalil', group: 'week', kicker: 'So close', tone: 'bad', stamp: "It's Khalil", rids: [K.rid, O.rid], drain: K.rid,
    headline: `Khalil was ${f1(gap)} points away from a win. But it's Khalil, so what do you think happened?`,
    deck: [
      `He lost. ${firstName(O)} beat him ${f1(g.oppPts)} to ${f1(g.pts)}.`,
      swap ? `${nameOf(swap.b.id)} sat on his bench with ${f1(swap.b.pts)} while ${nameOf(swap.s.id)} started and put up ${f1(swap.s.pts)}. That one swap wins it.`
        : g.benchPts ? `His bench had ${f1(g.benchPts)} points on it, and nobody there could have saved him either.` : '',
      `${oddsSaid(K)}. Never change, Khalil.`,
    ].filter(Boolean).join(' '),
    tick: { hook: "It's Khalil", line: `Khalil lost by ${f1(gap)}. Of course he did.` },
  };
}

// Akrm had a roster full of byes and won anyway
function akrmStory() {
  const A = byFirst(FINALS.akrm), g = weekOf(A, FINALS.week);
  if (!A || !g || g.result !== 'W') return null;
  const O = team(g.opp), m = (DATA.raw.matchups?.[FINALS.week] || []).find((x) => x.roster_id === A.rid);
  const byes = (m?.players || []).filter((id) => DATA.helpers.byeOf(id) === FINALS.week).sort((a, b) => valueOf(b) - valueOf(a));
  const luck = A.luck, rank = g.rank;
  return {
    type: 'akrm', group: 'week', kicker: 'Bye week survivor', tone: 'good', stamp: 'Luck turning?', rids: [A.rid, O.rid], drain: O.rid,
    headline: byes.length > 1 ? `Akrm had ${count(byes.length)} players on bye and still won. Is the luck finally turning?` : 'Akrm had a lineup full of holes and still won. Is the luck finally turning?',
    deck: [
      byes.length ? `${listOf(byes.slice(0, 4).map(nameOf))}${byes.length > 4 ? ` and ${count(byes.length - 4)} more` : ''} had the week off.` : '',
      `He beat ${firstName(O)} anyway, ${f1(g.pts)} to ${f1(g.oppPts)}, the ${ordinal(rank)}-highest score in the league this week.`,
      rank > 6 ? 'A below-average week, and a win. That is what luck looks like.' : '',
      Math.abs(luck) >= 0.5 ? `On the season his scores say he should have about ${f1(A.expectedWins)} wins; he has ${A.wins}, ${luck < 0 ? `so the universe still owes him ${f1(-luck)}` : `so it's been paying him back`}.` : '',
      `${oddsSaid(A)}.`,
    ].filter(Boolean).join(' '),
    tick: { hook: 'Luck turning?', line: `Akrm won with ${count(byes.length)} players on bye.` },
  };
}

// Tarek won the trade with Hamza; Kenneth Walker might sit a week, and Hamza has egg on his face
function eggStory() {
  const T = byFirst(FINALS.tarek), H = byFirst(FINALS.hamza), f = T && H && tradeOf(T, H);
  if (!f) return null;
  const ts = f.sides.find((s) => s.rid === T.rid), hs = f.sides.find((s) => s.rid === H.rid);
  const since = pointWeeks().filter((w) => w >= (f.week || 1) && w <= FINALS.week);
  const tPts = sumPts(startedFor(ts, since)), hPts = sumPts(startedFor(hs, since));
  const kw = f.sides.flatMap((s) => s.adds.map((a) => ({ ...a, rid: s.rid }))).find((a) => FINALS.walker.test(nameOf(a.id)));
  const info = kw && DATA.helpers.player(kw.id), bye = kw && DATA.helpers.byeOf(kw.id) === FINALS.week + 1;
  const who = kw && team(kw.rid);
  return {
    type: 'eggface', group: 'trades', kicker: 'Trade review', tone: 'trade', stamp: 'Egg on face', rids: [T.rid, H.rid], drain: H.rid, tx: [String(f.id)],
    player: kw ? playerCard(kw.id, who, who?.rid === H.rid ? "Hamza's problem" : `${firstName(who)}'s`) : undefined, mark: kw ? [nameOf(kw.id)] : undefined,
    headline: "Tarek wins the heck out of his trade. Kenneth Walker might sit a week, and Hamza has egg on his face. He's trying to eat it",
    deck: [
      `The deal: ${dealSaid(f)}`,
      since.length ? `Since it went through, Tarek's new players have put up ${f1(tPts)} points in his lineup; Hamza's have given him ${f1(hPts)}.` : '',
      kw ? (info?.status ? `${nameOf(kw.id)} is ${STATUS_SAID[info.status] || `listed ${info.status.toLowerCase()}`}` : `${nameOf(kw.id)} might not suit up`) + (bye ? `, and week ${FINALS.week + 1} is his bye anyway.` : '.') : '',
      `${oddsSaid(T)}; ${oddsSaid(H)}. Hamza says he'd do it again. Pass the hot sauce.`,
    ].filter(Boolean).join(' '),
    tick: { hook: 'Egg on face', line: `Tarek won the trade. Hamza is eating the egg.` },
  };
}

function finalsStories() {
  // week 11's four, in Dan's order
  const sel = [commishStory(), khalilStory(), akrmStory(), eggStory()].filter(Boolean);
  return sel.length ? { lead: sel[0], more: sel.slice(1), size: sel.length } : null;
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

// the Live tab (src/live/LivePage.jsx)
function liveProps() {
  // after the reveal DATA holds the new rankings; this page keeps showing the week that just ended
  if (DATA.after) return withData(DATA.after, liveProps);
  const fin = !!DATA.finalCall;
  const wk = DATA.previews[0]?.week, { rows, standings } = liveWeek();
  const bull = DATA.bull && DATA.bull.state !== 'final' && DATA.bull.rows.find((x) => x.rid === myTeam);
  return {
    D: DATA, fin, wk, rows, standings, car: fin ? carouselProps({ only: true }) : carouselProps(),
    played: DATA.live?.teams.length || 0, fetched: DATA.fetched || null,
    bull: bull ? awayText(bull) : null, onReveal: passThenReveal, h: { ...reactHelpers(), today: chicagoDate() },
  };
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
    await new Promise((r) => setTimeout(r, Math.max(0, READ_MS - (performance.now() - t0))));
    el.classList.add('out');
    await new Promise((r) => setTimeout(r, calm() ? 0 : 350));
    close();
    paintTabs();
    if (location.hash === '#rankings') route({ fresh: true }); else location.hash = '#rankings';
  });
}

// ---------- lead story ----------
// The headline carousel (src/hero/Carousel.jsx): three headlines, a card each on a ring (four on night-edition nights, one
// per story on the week's desk). The stories are data; the carousel draws them.
const CAROUSEL_SIZE = 3;
// the site's own headlines as written, each with its desk key (w{week}:{type}), before Dan's edits and hides
function siteStories() {
  const s = DATA.stories;
  const base = s?.lead ? [s.lead, ...s.more].slice(0, s.size || CAROUSEL_SIZE + (s.night ? 1 : 0) + (s.extra ? 1 : 0) + (s.pinned || 0)) : [];
  const keys = storyKeys(base, headlineWeek());
  return base.map((st, i) => ({ ...st, key: keys[i] }));
}
function carouselProps({ all = false, only = false } = {}) {
  const s = DATA.stories, own = only ? [] : postedStories();
  // Dan's edits and hides from the headline desk (api/headlines.js, by desk key); all: keep the hidden ones, marked
  const desk = (st) => {
    const o = posts.site[st.key];
    if (o?.hide) return all ? [{ ...st, hidden: true }] : [];
    return [o?.story ? { ...st, ...hydrate(o.story), edited: true } : st];
  };
  const site = only ? [] : siteStories().flatMap(desk);
  // a news release (launchStory) leads, unless Dan has hidden it or placed it in his running order like any other
  const party = [launchStory()].filter(Boolean).flatMap(desk), placed = posts.arrange?.[`w${headlineWeek()}`] || [];
  // (behind Dan's own headlines on a final-call week)
  const ahead = (st) => !placed.includes(st.key) && !finalsOn();
  const lead = party.filter(ahead), mixed = party.filter((st) => !ahead(st));
  if (!site.length && !own.length && !party.length) return null;
  return {
    // Dan's own headlines from the admin portal lead, ahead of everything the desk writes, and every headline sits in
    // its section (the dots group them)
    stories: [...lead, ...arrangeStories([...own, ...site, ...mixed].map((st) => withTrade({ ...st, group: groupOf(st) })))],
    date: new Date(AT || DATA.now).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' }),
    hold: onHold() ? NEWS_CLOCK.holdNote : null, night: !!s?.night, groups: GROUPS,
  };
}

// Dan's posted headlines (api/headlines.js, written in the admin portal) as carousel stories: the text as he wrote it,
// the teams and the player card's pinned manager looked up in today's league. A post's type carries its id, so its
// reactions are its own.
function postedStories(list = posts.list) {
  const now = AT ? +AT : Date.now();
  return list.filter((p) => !p.until || p.until > now).map((p) => ({ ...hydrate(p), type: `p-${p.id}`, key: `w${headlineWeek()}:p-${p.id}` }));
}
// The trade graphic under a trade headline (Dan's request Nov 6, src/hero/TradeGraphic.jsx): the deal the headline is
// about (its tx ids, read from the snapshot's feed), each side's incoming players with their consensus values, the
// roster spots it costs the side taking more bodies (at replacement value, like the trade ledger) and each side's net.
// The style is picked per headline at the headline desk (tradeStyle: handoff, seesaw, receipt, playbook or lockers; 'none' keeps the team
// rows); a trade headline nobody has set yet gets the handoff.
const TRADE_STYLES = ['handoff', 'seesaw', 'receipt', 'playbook', 'lockers'];
function withTrade(st) {
  const style = st.tradeStyle === 'none' ? null : TRADE_STYLES.includes(st.tradeStyle) ? st.tradeStyle : 'handoff';
  const f = style && (st.tx || []).map((id) => DATA.feed.find((x) => String(x.id) === String(id) && x.type === 'trade')).find(Boolean);
  if (!f) return st;
  const rep = DATA.meta.replacement || 0;
  const sides = f.sides.filter((x) => team(x.rid)).map((x) => ({
    rid: x.rid, first: firstName(team(x.rid)),
    gets: x.adds.map((a) => {
      const info = DATA.helpers.player(a.id) || {}, n = nameOf(a.id);
      return { id: a.id, name: n, short: shortName(info.name ? info : { name: n }), pos: a.pos || posOf(a.id), v: a.v };
    }).sort((a, b) => b.v - a.v),
    picks: x.picks.filter((p) => p.dir === 'in').map((p) => `${p.season} round ${p.round} pick`),
    cost: Math.max(0, x.spots) * rep, spots: Math.max(0, x.spots), net: x.net,
  }));
  return sides.length < 2 ? st : { ...st, trade: { style, sides } };
}

// a stored story (a post, or Dan's rewrite of a site headline) as the carousel draws it: teams looked up in today's
// league, the player card's pinned manager as a team, empty fields left out so the slide falls back to its defaults
function hydrate(p) {
  const pin = p.player?.pin && team(p.player.pin.rid);
  return {
    ...p, rids: (p.rids || []).filter((r) => team(r)),
    tick: p.tick || undefined, stamp: p.stamp || undefined, group: p.group || undefined, mark: p.mark?.length ? p.mark : undefined,
    player: p.player ? { ...p.player, pin: pin ? { team: pin, label: p.player.pin.label || `To ${firstName(pin)}` } : null } : undefined,
  };
}

// A starting draft for the admin portal from the transactions Dan ticked: the same kind of words the desk's own trade
// slides use (who got what, who won it on consensus value, the position groups after, records and odds). He rewrites
// whatever he likes before posting; once posted the text stays as written.
function draftFor(items) {
  if (!items.length) return null;
  const sides = items.flatMap((f) => f.sides.map((x) => ({ ...x, t: team(x.rid), f })).filter((x) => x.t));
  const rids = [...new Set(sides.map((x) => x.rid))];
  const star = sides.flatMap((x) => x.adds.map((a) => ({ ...a, to: x.t }))).sort((a, b) => valueOf(b.id) - valueOf(a.id))[0];
  const P = star && nameOf(star.id), info = (star && DATA.helpers.player(star.id)) || {}, r = (star && RAW.ros?.values?.[star.id]) || {};
  const rank = star && r.prk ? `, the ${ordinal(r.prk)}-ranked ${SLOT_WORD[star.pos] || star.pos} in the consensus` : '';
  const trades = items.filter((f) => f.type === 'trade'), moves = items.filter((f) => f.type !== 'trade');
  const player = star ? { id: star.id, name: P, short: shortName(info.name ? info : { name: P }), line: `${info.pos || posOf(star.id)}, ${nfl(info.team)}`, pin: { rid: star.to.rid, label: `To ${firstName(star.to)}` } } : null;
  const odds = rids.map((rid) => team(rid)).map((t) => `${firstName(t)} is ${record(t)} with ${pct(t.playoffPct)} playoff odds`).join('; ');
  const tx = items.map((f) => String(f.id)).filter((x) => /^\d+$/.test(x));
  if (trades.length) {
    const f = trades.find((d) => star && d.sides.some((x) => x.adds.some((a) => a.id === star.id))) || trades[0], names = f.sides.map((x) => firstName(team(x.rid)));
    return {
      kicker: 'Trade desk', stamp: 'Done deal', tone: 'trade', group: 'trades', breaking: true, rids, player, mark: P ? [P] : [], tx,
      headline: P ? `${listOf(names)} shake on it: ${P} heads to ${firstName(star.to)}` : `${listOf(names)} shake on it`,
      deck: [
        P && trades.length + moves.length > 1 ? `${P}${rank ? `${rank},` : ''} is the biggest name moving.` : P && rank ? `${P} is${rank.slice(1)}.` : '',
        ...trades.map((d) => `The full deal: ${dealSaid(d)} ${valueSaid(d)} ${roomsSaid(d)}`.trim()),
        moves.length ? moves.map(moveSaid).join(' ') : '',
        `${odds}.`,
      ].filter(Boolean).join(' '),
      tick: { hook: 'Done deal', line: P ? `${P} heads to ${firstName(star.to)}.` : `${listOf(names)} make a trade.` },
    };
  }
  const who = firstName(team(moves[0].sides[0].rid));
  return {
    kicker: 'Wire', stamp: 'Pickup', tone: 'good', group: 'wire', breaking: false, rids, player, mark: P ? [P] : [], tx,
    headline: P ? `${who} grabs ${P} off the wire` : `${who} works the wire`,
    deck: [moves.map(moveSaid).join(' '), P && rank ? `${P}${rank}.` : '', `${odds}.`].filter(Boolean).join(' '),
    tick: { hook: 'Pickup', line: P ? `${who} grabs ${P}.` : `${who} works the wire.` },
  };
}
// The headline desk's other sources (Dan's request Nov 6): player performances and matchups, read from the snapshot.
// A played week's points for every rostered player (players_points; the starters' own where a snapshot keeps only those)
function weekPlayers(w) {
  const out = [];
  for (const m of DATA.raw.matchups?.[w] || []) {
    const t = team(m.roster_id), st = m.starters || [];
    if (!t) continue;
    const pp = m.players_points && Object.keys(m.players_points).length ? m.players_points : Object.fromEntries(st.map((id, i) => [id, (m.starters_points || [])[i]]));
    for (const [id, pts] of Object.entries(pp)) if (id !== '0' && pts != null) out.push({ id, pts: +pts, rid: t.rid, started: st.includes(id), pos: posOf(id), week: w });
  }
  return out.sort((a, b) => b.pts - a.pts);
}
// the weeks with points on the board, newest first (the week being played, while it is, then the scored ones)
const pointWeeks = () => Object.keys(DATA.raw.matchups || {}).map(Number).filter((w) => (DATA.raw.matchups[w] || []).some((m) => m.points > 0)).sort((a, b) => b - a);
// a week's games: the pairs and their scores; the week ahead (or being played) comes from the previews, with the odds
function weekGames(w) {
  const pv = DATA.previews.filter((p) => p.week === w);
  if (pv.length) return pv.map((p) => ({ week: w, a: p.a, b: p.b, ptsA: p.liveA, ptsB: p.liveB, projA: p.projA, projB: p.projB, winA: p.winA, stakes: p.stakes, ahead: true }));
  const by = {};
  for (const m of DATA.raw.matchups?.[w] || []) if (m.matchup_id != null && team(m.roster_id)) (by[m.matchup_id] ||= []).push(m);
  return Object.values(by).filter((x) => x.length === 2).map(([a, b]) => ({ week: w, a: a.roster_id, b: b.roster_id, ptsA: a.points, ptsB: b.points }));
}
const card = (id, t) => {
  const info = DATA.helpers.player(id) || {}, P = nameOf(id);
  return { id, name: P, short: shortName(info.name ? info : { name: P }), line: `${info.pos || posOf(id)}, ${nfl(info.team)}`, pin: t ? { rid: t.rid, label: firstName(t) } : null };
};
const odds = (ts) => `${ts.map((t) => `${firstName(t)} is ${record(t)} with ${pct(t.playoffPct)} playoff odds`).join('; ')}.`;

// a draft from player performances (one week): the top scorer leads, where his points rank, his team's game, the rest
function draftPlayers(sel) {
  const w = sel[0]?.week, all = weekPlayers(w);
  const rows = sel.map((x) => all.find((p) => p.id === x.id)).filter(Boolean).sort((a, b) => b.pts - a.pts);
  if (!rows.length) return null;
  const top = rows[0], t = team(top.rid), P = nameOf(top.id), me = firstName(t), live = w > DATA.meta.lastScored;
  const rank = all.findIndex((p) => p.id === top.id) + 1, posRank = all.filter((p) => p.pos === top.pos).findIndex((p) => p.id === top.id) + 1;
  const g = weekGames(w).find((x) => x.a === t.rid || x.b === t.rid);
  const [mine, theirs, oid] = !g ? [] : g.a === t.rid ? [g.ptsA, g.ptsB, g.b] : [g.ptsB, g.ptsA, g.a];
  const opp = oid && team(oid), them = opp && firstName(opp);
  const bench = !top.started, big = top.pts >= 20;
  const stamp = bench ? 'Benched?' : big ? 'Star turn' : 'Box score';
  const result = !opp || mine == null ? ''
    : live ? `${me} has ${f1(mine)} to ${poss(them)} ${f1(theirs)} so far.`
    : `${me} ${mine > theirs ? 'beat' : mine < theirs ? 'lost to' : 'tied'} ${them} ${f1(mine)} to ${f1(theirs)}${bench && mine < theirs && theirs - mine < top.pts ? `, by less than ${P} scored on the bench` : ''}.`;
  return {
    kicker: 'Box score', stamp, tone: bench ? 'bad' : big ? 'good' : 'neutral', group: 'players', breaking: false,
    rids: [t.rid, ...(opp ? [opp.rid] : [])], player: card(top.id, t), mark: [P], tx: [],
    headline: bench ? `${P} scores ${f1(top.pts)} on ${poss(me)} bench` : big ? `${P} drops ${f1(top.pts)} for ${me}` : `${P} puts up ${f1(top.pts)} for ${me}`,
    deck: [
      `That's ${rank === 1 ? 'the most points' : `the ${ordinal(rank)}-most points`} of any rostered player in week ${w}${live ? ' so far' : ''}, and ${posRank === 1 ? 'the best' : `the ${ordinal(posRank)}-best`} ${SLOT_WORD[top.pos] ? `score by a ${SLOT_WORD[top.pos]}` : `at ${top.pos}`}.`,
      result,
      rows.length > 1 ? `Also: ${listOf(rows.slice(1).map((r) => `${nameOf(r.id)} with ${f1(r.pts)} for ${firstName(team(r.rid))}${r.started ? '' : ' (bench)'}`))}.` : '',
      odds([t]),
    ].filter(Boolean).join(' '),
    tick: { hook: stamp, line: `${P} scores ${f1(top.pts)} for ${me}.` },
  };
}

// a draft from matchups (one week): the first game picked leads; a played one by its score, one ahead by its odds
function draftGames(sel) {
  const games = weekGames(sel[0]?.week).filter((g) => sel.some((x) => x.a === g.a && x.b === g.b));
  if (!games.length) return null;
  const g = games[0], A = team(g.a), B = team(g.b), live = g.ahead && (g.ptsA || g.ptsB);
  const others = games.slice(1).map((x) => {
    const a = firstName(team(x.a)), b = firstName(team(x.b));
    return x.ahead ? `${a} against ${b}, ${pct(Math.max(x.winA, 1 - x.winA))} for ${x.winA >= 0.5 ? a : b}` : `${x.ptsA >= x.ptsB ? a : b} beat ${x.ptsA >= x.ptsB ? b : a} ${f1(Math.max(x.ptsA, x.ptsB))} to ${f1(Math.min(x.ptsA, x.ptsB))}`;
  });
  const also = others.length ? `Also: ${listOf(others)}.` : '';
  if (g.ahead) {
    const [F, D] = g.winA >= 0.5 ? [A, B] : [B, A], p = Math.max(g.winA, 1 - g.winA), close = p < 0.58;
    const stamp = live ? 'Live' : close ? 'Coin flip' : 'Preview';
    return {
      kicker: 'Games', stamp, tone: 'neutral', group: 'week', breaking: false, rids: [F.rid, D.rid], player: null, mark: [], tx: [],
      headline: close ? `${firstName(A)} against ${firstName(B)} is a coin flip` : `${firstName(F)} goes in as a ${pct(p)} favourite against ${firstName(D)}`,
      deck: [
        live ? `${firstName(A)} has ${f1(g.ptsA)} banked to ${poss(firstName(B))} ${f1(g.ptsB)}, and the projections finish it ${f1(g.projA)} to ${f1(g.projB)}.` : `The projections have it ${f1(g.projA)} to ${f1(g.projB)}.`,
        g.stakes >= 0.05 ? `${Math.round(g.stakes * 100)} points of playoff odds ride on it between them.` : '',
        also, odds([A, B]),
      ].filter(Boolean).join(' '),
      tick: { hook: stamp, line: `${firstName(F)} is a ${pct(p)} favourite against ${firstName(D)}.` },
    };
  }
  const [W, L, ws, ls] = g.ptsA >= g.ptsB ? [A, B, g.ptsA, g.ptsB] : [B, A, g.ptsB, g.ptsA];
  const m = ws - ls, stamp = m < 5 ? 'Phew' : m >= 30 ? 'Boom' : 'Final';
  const best = (t) => weekPlayers(g.week).find((p) => p.rid === t.rid && p.started);
  const bw = best(W), bl = best(L);
  return {
    kicker: 'Games', stamp, tone: 'good', group: 'week', breaking: false, rids: [W.rid, L.rid], player: null, mark: [], tx: [],
    headline: m < 5 ? `${firstName(W)} edges ${firstName(L)} by ${f1(m)}` : m >= 30 ? `${firstName(W)} flattens ${firstName(L)} by ${f1(m)}` : `${firstName(W)} beats ${firstName(L)}, ${f1(ws)} to ${f1(ls)}`,
    deck: [
      `Week ${g.week}: ${firstName(W)} ${f1(ws)}, ${firstName(L)} ${f1(ls)}.`,
      bw && bl ? `${poss(firstName(W))} best was ${nameOf(bw.id)} with ${f1(bw.pts)}; ${poss(firstName(L))} was ${nameOf(bl.id)} with ${f1(bl.pts)}.` : '',
      also, odds([W, L]),
    ].filter(Boolean).join(' '),
    tick: { hook: stamp, line: `${firstName(W)} beats ${firstName(L)} by ${f1(m)}.` },
  };
}
// one waiver move in words: who came in, who went out, and the net consensus value
function moveSaid(f) {
  const s = f.sides[0], t = team(s.rid);
  if (!t) return '';
  const said = (ps) => listOf(ps.map((a) => `${nameOf(a.id)} (${f1(valueOf(a.id))})`));
  const add = s.adds.length ? `adds ${said(s.adds)}` : '', drop = s.drops.length ? `drops ${said(s.drops)}` : '';
  return `${firstName(t)} ${[add, drop].filter(Boolean).join(' and ')}, ${s.net >= 0 ? 'up' : 'down'} ${f1(Math.abs(s.net))} in consensus value.`;
}

// ---------- wire ----------
const signed = (x) => `${x > 0 ? '+' : ''}${f1(x)}`;

// ---------- trade lab ----------
// the Lab's Trades picker sets your team for the whole site
function setMyTeam(rid) {
  myTeam = team(Number(rid)) ? Number(rid) : null;
  labState.team = myTeam;
  store.set('ph-my-team', myTeam ? String(myTeam) : null);
  $('#my-team').value = myTeam ? String(myTeam) : '';
  route();
  presenceNow(); // the others see your face light up without waiting for the next beat
}
// ---------- nerd lab ----------
// Return visits open your own dashboard; browsing rivals never changes your identity.
const dashTeam = () => (myTeam && team(myTeam) ? myTeam : team(labState.team) ? labState.team : DATA.teams[0].rid);
// formatting and names for the React pages, so they read exactly like the rest of the site
const reactHelpers = () => ({
  f1, pct, ordinal, short, record, nfl, groupSaid, pctW, nameOf, posOf, faceSrc, first: firstName, teams: DATA.teams,
  american, half, signed, isChamp, champSeason: CHAMPION?.season, bull: bullInfo, moneyWeek: MONEY_WEEK && { target: MONEY_WEEK.target, prize: money(MONEY_WEEK.prize) },
  shortName: (id) => shortName(DATA.helpers.player(id) || { name: nameOf(id) }),
});

// ---------- the pages ----------
// what each tab mounts: the page component and its props (D, me and h are added to every page by route). Filters and
// picks a page keeps when you leave it live in the state objects above (wireState, tradeState, labState).
const PAGES = {
  live: () => [LivePage, liveProps()],
  rankings: () => [RankingsPage, rankingsProps()],
  wire: () => [WirePage, { state: wireState, onState: (x) => Object.assign(wireState, x), since: wireSeen(DATA.now) }],
  matchups: () => [GamesPage, { calm: calm(), lite: lite() }],
  admin: () => [AdminShell, {
    home: liveHome() ? '#live' : '#rankings', demo: !!RAW.isDemo,
    draft: draftFor, draftPlayers, draftGames, weekPlayers, weekGames, preview: (list) => postedStories(list).map(withTrade), tradeStyles: TRADE_STYLES,
    weeks: { scored: pointWeeks().filter((w) => w <= DATA.meta.lastScored).slice(0, 4), live: DATA.live ? DATA.meta.lastScored + 1 : null, ahead: DATA.previews[0]?.week ?? null }, order: () => carouselProps({ all: true })?.stories || [], groups: GROUPS, groupOf, week: headlineWeek(), now: AT ? +AT : Date.now(),
    date: new Date(AT || DATA.now).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric' }),
  }],
  lab: () => [Lab, {
    sub: labState.sub, raw: DATA.raw, ros: RAW.ros?.values || {}, calm: calm(), demo: !!RAW.isDemo, team: dashTeam(), onTeam: (rid) => (labState.team = rid),
    trade: { state: tradeState, onState: (x) => Object.assign(tradeState, x), onTeam: setMyTeam },
  }],
};
let showPage = null; // the React root on #app (src/mount.jsx), made on the first route

// ---------- shell ----------
// ---------- motion ----------
// Everything here animates transform/opacity only, runs when on screen, and is skipped under reduced motion.
// each media query is parsed once; its .matches stays live as the window or the settings change
const mq = (q) => { const m = matchMedia(q); return () => m.matches; };
const calm = mq('(prefers-reduced-motion: reduce)');
// phones and touch screens get the light set: no page morphs or scroll reveals, which cost the most on mobile GPUs
const lite = mq('(max-width: 760px), (pointer: coarse)');
const morphs = () => !!document.startViewTransition && !calm() && !lite();
const ORDER = ['live', 'rankings', 'wire', 'matchups', 'lab', 'admin'];
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

// You (phones): the bar is gone, so the team picker and the theme switch live in a glass circle beside the tab dock,
// your face in it. A tap opens the panel out of the circle (so does a tap on an empty you card, [data-open-me]); a tap outside, Escape, picking a team or scrolling away
// closes it. On desktop .me and its panel are display: contents, so none of this shows and the bar is as it was.
const phone = mq('(max-width: 760px)');
function initMe() {
  const me = $('#me'), btn = $('#me-btn'), panel = $('#me-panel');
  if (!me || !btn || !panel) return;
  let y0 = 0;
  const set = (on) => {
    if (on === me.classList.contains('open')) return;
    me.classList.toggle('open', on);
    btn.setAttribute('aria-expanded', String(on));
    if (on) y0 = scrollY;
  };
  btn.addEventListener('click', () => {
    const on = !me.classList.contains('open');
    set(on);
    if (on && !lite()) $('#my-team')?.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', (e) => { if (me.classList.contains('open') && !me.contains(e.target)) set(false); }, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && me.classList.contains('open')) { set(false); btn.focus(); } });
  addEventListener('scroll', () => { if (me.classList.contains('open') && Math.abs(scrollY - y0) > 80) set(false); }, { passive: true });
  $('#my-team')?.addEventListener('change', () => setTimeout(() => set(false), 250));
  addEventListener('hashchange', () => set(false));
  // the empty you cards point at the circle; on a phone a tap on one opens it
  document.addEventListener('click', (e) => { if (phone() && e.target.closest?.('[data-open-me]')) set(true); });
  matchMedia('(max-width: 760px)').addEventListener?.('change', () => phone() || set(false));
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
    // 2.1: cards below the first screen rise in as they arrive (.rv in styles.css: opacity and transform only, so
    // nothing below them moves), their bars and lines draw once they're in, and their numbers count up then
    io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, k) => {
        const el = e.target;
        io.unobserve(el);
        countAll([...el.querySelectorAll(COUNT)].filter((c) => !c.closest('.rank')));
        el.style.setProperty('--d', `${Math.min(k, 4) * 50}ms`);
        el.classList.add('rv-in');
        el.addEventListener('animationend', function done(ev) {
          if (ev.target !== el) return;
          el.classList.remove('rv', 'rv-in');
          el.removeEventListener('animationend', done);
        });
      });
    }, { rootMargin: '0px 0px -4% 0px' });
    root.querySelectorAll(REVEAL).forEach((el) => { if (el.getBoundingClientRect().top >= innerHeight * 0.94) { el.classList.add('rv'); io.observe(el); } });
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

function route({ fresh = false } = {}) {
  // while a week is being played the Live tab is the front page; it only exists then
  const home = liveHome() ? 'live' : 'rankings';
  let [v, sub] = (location.hash || `#${home}`).slice(1).split('/');
  if (v === 'trades') [v, sub] = ['lab', 'trades']; // the Trade lab's old address
  const key = PAGES[v] && (v !== 'live' || DATA.liveMode || DATA.after) ? v : home;
  if (key === 'lab') {
    if (SECTIONS.includes(sub)) labState.sub = sub;
    // the address always names the section, without a history entry (no hashchange either)
    if (location.hash !== `#lab/${labState.sub}`) history.replaceState(null, '', `#lab/${labState.sub}`);
  }
  const dir = !currentView || key === currentView ? 'same' : ORDER.indexOf(key) > ORDER.indexOf(currentView) ? 'fwd' : 'back';
  const render = () => {
    // the headline desk is its own flat workspace: no site header, sky, field or footer (styles.css, html.admin-mode)
    document.documentElement.classList.toggle('admin-mode', key === 'admin');
    // the Lab's League section holds the scenario builder and its sticky bar: no back-to-top button over it (Nov 17)
    document.documentElement.classList.toggle('on-scenarios', key === 'lab' && labState.sub === 'league');
    document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    placeInk();
    paintMe();
    const app = $('#app'), [Page, props] = PAGES[key]();
    showPage ||= pageRoot(app);
    // buzz: the stories rail's streak count and the clock its "how long ago" reads (src/buzz)
    showPage(Page, { D: DATA, me: myTeam, h: reactHelpers(), buzz: { streak: streak(), now: DATA.now }, ...props });
    paintWireBadge();
    if (fresh) { app.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
    reveal(app);
    shine(app); // 2.0: light crosses each glass card once as it comes on screen (src/touch.js)
    if (currentView && key !== currentView) pageIn(dir === 'back' ? -1 : 1); // 2.1, phones: the page slides in
    currentView = key;
  };
  document.documentElement.dataset.dir = dir;
  if (currentView && morphs()) document.startViewTransition(render);
  else render();
}

// the Live tab exists while a week is on, and reads "Final" once the week is (before and after the reveal)
function paintTabs() {
  const a = $('.tabs a[data-view="live"]'), fin = DATA.finalCall || DATA.after;
  a.hidden = !DATA.liveMode && !DATA.after;
  a.querySelector('.tn').textContent = fin ? 'Final' : 'Live';
  $('.brand').setAttribute('href', liveHome() ? '#live' : '#rankings');
  placeInk({ settle: true });
}

// the Wire tab's count of moves since this device last opened it (src/buzz/seen.js), like an app's unread badge;
// opening the Wire clears it
function paintWireBadge() {
  const a = $('.tabs a[data-view="wire"]');
  if (!a) return;
  const n = wireNew(DATA, myTeam, DATA.now);
  let b = a.querySelector('.bz-badge');
  appBadge(n); // on the Home Screen icon too, where the site runs as an installed app (src/buzz/install.js)
  if (!n) { b?.remove(); a.removeAttribute('aria-description'); return; }
  if (!b) { b = document.createElement('b'); b.className = 'bz-badge'; b.setAttribute('aria-hidden', 'true'); a.append(b); }
  b.textContent = n > 9 ? '9+' : String(n);
  a.setAttribute('aria-description', `${n} new move${n === 1 ? '' : 's'}`);
}

// your own face next to the team picker once you have chosen a team, and in the phone's circle (a figure until then)
function paintMe() {
  const src = myTeam ? faceSrc(team(myTeam)) : null;
  for (const img of [$('#my-face'), $('.me-btn-face')]) {
    if (!img) continue;
    img.hidden = !src;
    if (src && img.getAttribute('src') !== src) img.src = src;
  }
  $('#me')?.classList.toggle('has-face', !!src);
  const t = myTeam && team(myTeam);
  $('#me-btn')?.setAttribute('aria-label', t ? `${t.name}: your team and the theme` : 'Pick your team, and the theme');
}

function initTeamPicker() {
  const sel = $('#my-team');
  sel.innerHTML = '<option value="">Your team</option>' + [...DATA.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => `<option value="${t.rid}" ${t.rid === myTeam ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  sel.addEventListener('change', () => {
    setMyTeam(Number(sel.value));
  });
}

function initTooltips() {
  const tip = $('#tip');
  // the tip is measured only when it gets new text, and follows the mouse with a transform, so moving costs no layout
  let shownFor = null, w = 0, h = 0;
  // on a mouse the first tip waits a beat, so passing over a chart doesn't flash one; once a tip is up (or was a moment
  // ago) the next shows at once, so scanning across marks stays quick
  const FIRST = 350, WARM = 500;
  let warmUntil = 0, wait = 0, waitFor = null;
  const show = (el, x, y, now = false) => {
    if (!now && tip.hidden && performance.now() > warmUntil) {
      if (waitFor !== el) { clearTimeout(wait); waitFor = el; wait = setTimeout(() => { waitFor = null; show(el, lastX, lastY, true); }, FIRST); }
      return;
    }
    if (el !== shownFor || tip.hidden) {
      tip.textContent = el.dataset.tip;
      tip.hidden = false;
      shownFor = el;
      ({ width: w, height: h } = tip.getBoundingClientRect());
    }
    const left = Math.min(innerWidth - w - 8, Math.max(8, x + 14)), top = Math.min(innerHeight - h - 8, y + 16);
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  };
  const hide = () => { clearTimeout(wait); waitFor = null; if (!tip.hidden) { tip.hidden = true; shownFor = null; warmUntil = performance.now() + WARM; } };
  let lastX = 0, lastY = 0;
  let touch = false, moved = null;
  document.addEventListener('pointerdown', (e) => (touch = e.pointerType !== 'mouse'), { passive: true });
  // at most one update per frame, however fast the mouse reports
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // a finger dragging over marks would flash tips mid-scroll
    if (!moved) requestAnimationFrame(() => {
      const { target, x, y } = moved;
      moved = null; lastX = x; lastY = y;
      const el = target.closest?.('[data-tip]');
      if (el && el.dataset.tip) show(el, x, y); else hide();
    });
    moved = { target: e.target, x: e.clientX, y: e.clientY };
  }, { passive: true });
  // touch: tap a mark to see its numbers, tap anywhere else (or scroll) to dismiss
  document.addEventListener('click', (e) => {
    if (!touch) return;
    const el = e.target.closest?.('[data-tip]');
    if (el && el.dataset.tip && !el.closest('button')) show(el, e.clientX, e.clientY, true); else hide();
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

// The week used for headline overrides, reactions and the editor's running order.
// the week the desk keys its headlines by (w{week}:{type}, storyKeys): the same week the carousel uses. It turns over at the
// final call, when the headlines change, and Sleeper scoring the week on Tuesday morning doesn't move it, so Dan's edits,
// hides and running order, and everyone's reactions, last as long as the headlines they're on.
const headlineWeek = () => DATA.meta.lastScored + 1;

async function main() {
  initAvatarFallback();
  initTheme();
  initMe();
  initTooltips();
  const touch = initTouch({ placeInk }); // 2.0: press, the dock's slide, the top pill (src/touch.js)
  initLiquid(); // 2.3: the chrome's lens, its light and the scroll edges (src/liquid.js)
  const loader = startLoader();
  // 2.4: the browser's install offer can come at any moment, so the listener starts first; the sheet waits for a
  // device's second day (src/buzz/install.js)
  { const s = streak(); initInstall({ returning: s.n >= 2 || s.best >= 2 || !s.fresh }); }
  // Dan's posted headlines come with the data; a slow answer doesn't hold the page (they're added when they land)
  const posted = new URLSearchParams(location.search).has('demo') || window.__DEMO__ ? null : loadPosts();
  let postedLate = false;
  try {
    await load();
    if (posted) postedLate = !(await Promise.race([posted.then(() => true), new Promise((r) => setTimeout(r, 1200, false))]));
    await loader.done();
  } catch (e) {
    await loader.done();
    (showPage ||= pageRoot($('#app')))(LoadError, { message: String(e.message || e) });
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
  loadVotes({ week: DATA.previews[0]?.week, demo: RAW.isDemo });
  let lastWidth = innerWidth;
  window.addEventListener('resize', () => {
    if (innerWidth === lastWidth) return; // height-only resizes are the browser toolbar, ignore them
    lastWidth = innerWidth;
    placeInk({ settle: true });
  }, { passive: true });
  route();
  setTimeout(touch.hello, 2400); // once per device, after the page has settled
  if (currentView !== 'admin') {
    streakNote(); // once a day: the streak island drops in (src/buzz/streak.js)
    recapNote(myTeam && team(myTeam), { week: DATA.meta.lastScored, pct }); // then what moved for your team since last time
  }
  // who's here now (src/buzz/presence.js) and what the tab says while you're away (src/buzz/away.js)
  if (!RAW.isDemo || window.__PRESENCE_TEST__) startPresence({ team: () => myTeam }); // the demo stays offline; tests set the flag
  initAway({
    key: () => (RAW.isDemo ? 'demo' : leagueKey()),
    title: () => {
      const n = wireNew(DATA, myTeam, DATA.now);
      if (n) return `(${n}) New on the Wire`;
      if (DATA.finalCall) return 'Final scores are in';
      if (DATA.liveMode) return `Week ${DATA.meta.lastScored + 1} is live, come back`;
      return null;
    },
  });
  if (postedLate) posted.then((p) => { if (p.list.length && ['rankings', 'live'].includes(currentView)) route(); });
  // the first route can measure the tabs before the stylesheet or the fonts have applied (fast or cached data)
  const settle = () => placeInk({ settle: true });
  if (document.readyState !== 'complete') window.addEventListener('load', settle, { once: true });
  document.fonts?.ready.then(settle);
}
main();
