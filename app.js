import { computeLeague, WEIGHTS } from './lib/engine.js';
import { bumpChart, scatter, radar, weeklyBars, divergingBars, heatTable, TEAM_COLORS } from './lib/charts.js';

// ---------- config ----------
const LEAGUE_ID = '1312001652454088704';
const TZ = 'America/Chicago';
const SLEEPER = 'https://api.sleeper.app/v1';
const SOURCE_NAMES = { fp: 'FantasyPros', ds: 'DraftSharks', ll: 'LeagueLogs' };

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = (x) => (x == null || Number.isNaN(x) ? '–' : Number(x).toFixed(1));
const pct = (x) => `${Math.round((x || 0) * 100)}%`;
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

let DATA = null; // computed league
let RAW = null;
let myTeam = Number(store.get('ph-my-team')) || null;
const wireState = { type: 'all', mine: false, limit: 50 };

// ---------- data ----------
const getJSON = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} from ${url}`);
  return r.json();
};
const chicagoDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function loadLive() {
  const [state, league, users, rosters] = await Promise.all([
    getJSON(`${SLEEPER}/state/nfl`),
    getJSON(`${SLEEPER}/league/${LEAGUE_ID}`),
    getJSON(`${SLEEPER}/league/${LEAGUE_ID}/users`),
    getJSON(`${SLEEPER}/league/${LEAGUE_ID}/rosters`),
  ]);
  const s = league.settings || {};
  const regEnd = (s.playoff_week_start || 15) - 1;
  const weeks = Array.from({ length: regEnd }, (_, i) => i + 1);
  const txWeeks = Array.from({ length: Math.max(1, Math.min(18, state.leg || state.week || 1)) }, (_, i) => i + 1);
  const [mus, txs, ros] = await Promise.all([
    Promise.all(weeks.map((w) => getJSON(`${SLEEPER}/league/${LEAGUE_ID}/matchups/${w}`).catch(() => []))),
    Promise.all(txWeeks.map((w) => getJSON(`${SLEEPER}/league/${LEAGUE_ID}/transactions/${w}`).catch(() => []))),
    getJSON(`/api/ros?d=${chicagoDate()}`).catch((e) => ({ error: String(e.message || e) })),
  ]);
  return {
    state, league, users, rosters,
    matchups: Object.fromEntries(weeks.map((w, i) => [w, mus[i]])),
    transactions: txs.flat(),
    ros,
  };
}

async function load() {
  const demo = new URLSearchParams(location.search).has('demo') || window.__DEMO__;
  RAW = window.__DEMO__ || (demo ? await getJSON('demo/demo.json') : await loadLive());
  RAW.isDemo = !!demo;
  const ros = RAW.ros && !RAW.ros.error ? RAW.ros : null;
  DATA = computeLeague({
    league: RAW.league,
    users: RAW.users,
    rosters: RAW.rosters,
    matchups: RAW.matchups,
    transactions: RAW.transactions,
    players: ros ? ros.players : {},
    ros: ros ? ros.values : {},
    currentWeek: RAW.state.week,
    lastScored: RAW.league.settings?.last_scored_leg,
  });
  DATA.rosMeta = ros;
  DATA.rosError = RAW.ros && RAW.ros.error;
  // stable team colours by roster id
  DATA.color = Object.fromEntries([...DATA.teams].sort((a, b) => a.rid - b.rid).map((t, i) => [t.rid, TEAM_COLORS[i % TEAM_COLORS.length]]));
}

// ---------- shared bits ----------
const team = (rid) => DATA.byRid[rid];
const short = (name, n = 15) => (name.length > n ? name.slice(0, n - 1) + '…' : name);
const nameOf = (id) => DATA.helpers.nameOf(id);
const posOf = (id) => DATA.helpers.posOf(id);
const posTag = (id) => { const p = posOf(id); return p ? `<span class="pos ${p}">${p}</span>` : ''; };
function avatar(t, cls = 'avatar') {
  const initials = esc(t.name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?');
  if (!t.avatar) return `<span class="${cls} ph" aria-hidden="true">${initials}</span>`;
  return `<img class="${cls}" src="https://sleepercdn.com/avatars/thumbs/${esc(t.avatar)}" alt="" loading="lazy" data-initials="${initials}">`;
}
function fixAvatars(root) {
  root.querySelectorAll('img.avatar').forEach((img) => {
    img.addEventListener('error', () => {
      const s = document.createElement('span');
      s.className = img.className + ' ph';
      s.textContent = img.dataset.initials;
      s.setAttribute('aria-hidden', 'true');
      img.replaceWith(s);
    }, { once: true });
  });
}
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
    <section class="view-head">
      <div>
        <h1><span class="wk">Week ${m.lastScored + 1}</span>Power Rankings</h1>
        <p>Half rest-of-season roster strength, half what's already happened. Tap any team to see why it sits where it does.</p>
      </div>
      <div class="sources">${chips}${updatedText() ? `<span class="chip">${esc(updatedText())}</span>` : ''}</div>
    </section>
    ${notice}
    <ol class="ranks enter">${items}</ol>
    <section class="panel glass" style="margin-top:26px">
      <h2>How the score works</h2>
      <div class="method">
        <p><b>Rest-of-season roster (${Math.round((WEIGHTS.rosProj + WEIGHTS.depth) * 100)}%).</b> Every player gets a consensus value from FantasyPros, DraftSharks and LeagueLogs half-PPR ROS rankings (LeagueLogs counts half, since it tracks the FantasyPros consensus closely). We build each team's best possible starting lineup from DraftSharks' weekly projections, discounted for games a player is expected to miss, then add the value of the top four bench pieces.</p>
        <p><b>Results so far (${Math.round((WEIGHTS.allPlay + WEIGHTS.pfPerGame + WEIGHTS.winPct + WEIGHTS.form) * 100)}%).</b> All-play win rate (your record if you played every team every week) carries the most weight because it strips out schedule luck. Points per game, actual record and the last three weeks round it out.</p>
        <p><b>Scale.</b> Each input is compared to the rest of the league, so 50 is a dead-average team. The two bars under each score show the roster half and the results half separately.</p>
        <p><b>Playoff odds.</b> 10,000 simulations of the remaining regular-season schedule, using each team's projected lineup blended with its actual scoring. Ties in the standings go to points for, like Sleeper.</p>
      </div>
    </section>`;
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
          <div class="team-name"><span class="sr-only">Rank ${t.powerRank}:</span><span class="name">${esc(t.name)}</span>${mv}${mine ? '<span class="you">You</span>' : ''}</div>
          <div class="team-meta"><span><b>${record(t)}</b></span><span class="owner">${esc(t.owner)}</span><span>${f1(t.pfPerGame)} pts/gm</span><span class="tier ${t.tier.key}">${t.tier.label}</span></div>
        </div>
        <div class="meter">
          <div class="meter-top"><span class="score">${t.score.toFixed(1)}</span><small>power score</small></div>
          <div class="split">${ros}<div class="split-row"><span>Results</span><span class="track"><i class="res" style="width:${t.resultsScore}%"></i></span><span>${Math.round(t.resultsScore)}</span></div></div>
        </div>
        <div class="odds"><b>${pct(t.playoffPct)}</b><small>playoffs</small><svg class="chev" width="14" height="9" viewBox="0 0 14 9" aria-hidden="true"><path d="M1 1l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none"/></svg></div>
      </button>
      <div class="detail" id="d-${t.rid}"><div></div></div>
    </div>
  </li>`;
}

function rankDetail(t) {
  const n = DATA.teams.length;
  const why = t.why.map((w) => `<li class="${w.tone}"><b>${esc(w.title)}</b><span>${esc(w.text)}</span></li>`).join('');
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
      <ul class="why">${why}</ul>
      <div class="detail-side">
        ${rad ? `<div class="mini"><h4>Position groups vs the league</h4><div class="mini-row">${rad}<div>${lineup}</div></div></div>` : ''}
        <div class="mini"><h4>Weekly points (green = win, dashed = league average)</h4>${weeklyBars({ weeks: t.weeks, avg, width: 560, height: 150 })}</div>
        <div class="mini"><h4>Where they finish in 10,000 simulations (seed 1 → ${seeds.length})</h4>
          <div class="seeds" style="--n:${seeds.length}">${seeds.map((p, i) => `<i class="${i < pt ? 'in' : ''}" style="height:${(p / maxSeed) * 100}%" data-tip="Seed ${i + 1}: ${(p * 100).toFixed(1)}%"></i>`).join('')}</div>
          <div class="seed-axis" style="--n:${seeds.length}">${seeds.map((_, i) => `<span>${i + 1}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
}

// ---------- wire ----------
const TYPE_LABEL = { waiver: 'Waiver claim', free_agent: 'Free agent', trade: 'Trade', commissioner: 'Commissioner move' };
function dayLabel(ts) {
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const today = fmt(new Date()), yest = fmt(new Date(Date.now() - 864e5)), d = fmt(new Date(ts));
  if (d === today) return 'Today';
  if (d === yest) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' });
}
const timeLabel = (ts) => new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

function deltaBadge(net) {
  if (!DATA.meta.hasRos) return '';
  const cls = net > 0.4 ? 'pos-d' : net < -0.4 ? 'neg-d' : 'zero';
  return `<div class="delta ${cls}" data-tip="Change in consensus ROS value from this move">${net > 0 ? '+' : ''}${f1(net)}<small>ROS value</small></div>`;
}
const plist = (arr) => arr.map((p) => `${posTag(p.id)}${esc(nameOf(p.id))}`).join(', ');

function moveItem(item) {
  if (item.type === 'trade') {
    const sides = item.sides;
    const best = Math.max(...sides.map((s) => s.net));
    const winner = sides.length === 2 && Math.abs(sides[0].net - sides[1].net) >= 3 ? sides.find((s) => s.net === best) : null;
    const pick = (p) => `${p.season} round ${p.round} pick`;
    return `<li class="trade glass rim">
      <div class="trade-head"><h3>Trade</h3><span class="when">week ${item.week}, ${timeLabel(item.ts)}</span></div>
      <div class="trade-sides">${sides.map((s) => `
        <div class="trade-side ${winner && winner.rid === s.rid ? 'won' : ''}">
          <h4><span>${esc(team(s.rid).name)}</span>${DATA.meta.hasRos ? `<span class="${s.net >= 0 ? 'plus' : 'minus'}">${s.net > 0 ? '+' : ''}${f1(s.net)}</span>` : ''}</h4>
          <ul>${s.adds.map((p) => `<li>Gets ${posTag(p.id)}${esc(nameOf(p.id))}</li>`).join('')}${s.picks.filter((p) => p.dir === 'in').map((p) => `<li>Gets ${pick(p)}</li>`).join('')}${s.faabIn ? `<li>Gets $${s.faabIn} FAAB</li>` : ''}</ul>
        </div>`).join('')}</div>
      ${DATA.meta.hasRos ? `<p class="verdict">${winner ? `By consensus ROS value, <b>${esc(team(winner.rid).name)}</b> came out ahead by ${f1(Math.abs(sides[0].net - sides[1].net))}.` : 'By consensus ROS value this one is close to even.'}</p>` : ''}
    </li>`;
  }
  const s = item.sides[0];
  const t = team(s.rid);
  const parts = [];
  if (s.adds.length) parts.push(`<span class="plus">Added</span> ${plist(s.adds)}`);
  if (s.drops.length) parts.push(`<span class="minus">${s.adds.length ? 'dropped' : 'Dropped'}</span> ${plist(s.drops)}`);
  return `<li class="move-item glass">
    ${avatar(t)}
    <div><div><span class="who">${esc(t.name)}</span> <span class="when">${TYPE_LABEL[item.type] || item.type}${item.bid != null ? ` ($${item.bid})` : ''} at ${timeLabel(item.ts)}</span></div>
    <div class="what">${parts.join(', ') || 'Roster move'}</div></div>
    ${deltaBadge(s.net)}
  </li>`;
}

function viewWire() {
  let feed = DATA.feed;
  if (wireState.type !== 'all') feed = feed.filter((f) => (wireState.type === 'waiver' ? f.type === 'waiver' || f.type === 'free_agent' : f.type === wireState.type));
  if (wireState.mine && myTeam) feed = feed.filter((f) => f.sides.some((s) => s.rid === myTeam));
  const shown = feed.slice(0, wireState.limit);
  const groups = [];
  for (const it of shown) {
    const lbl = dayLabel(it.ts);
    if (!groups.length || groups[groups.length - 1].lbl !== lbl) groups.push({ lbl, items: [] });
    groups[groups.length - 1].items.push(it);
  }
  const btn = (k, label) => `<button type="button" data-type="${k}" aria-pressed="${wireState.type === k}">${label}</button>`;
  const fa = DATA.freeAgents.slice(0, 10);
  const mm = Object.values(DATA.managerMoves).sort((a, b) => b.moves - a.moves);
  const traders = Object.values(DATA.managerMoves).filter((m) => m.tradeNet !== 0).sort((a, b) => b.tradeNet - a.tradeNet);
  const today = DATA.feed.filter((f) => dayLabel(f.ts) === 'Today').length;
  return `
    <section class="view-head">
      <div>
        <h1><span class="wk">${today ? `${today} move${today === 1 ? '' : 's'} today` : 'Quiet day so far'}</span>The Wire</h1>
        <p>Every add, drop and trade, newest first. The badge is how much consensus rest-of-season value the move gained or gave up.</p>
      </div>
    </section>
    <div class="two-col">
      <div>
        <div class="filters" role="group" aria-label="Filter moves">
          ${btn('all', 'Everything')}${btn('waiver', 'Adds and drops')}${btn('trade', 'Trades')}
          ${myTeam ? `<button type="button" data-mine aria-pressed="${wireState.mine}">Only my team</button>` : ''}
        </div>
        ${groups.length ? groups.map((g) => `<section class="day"><h3>${esc(g.lbl)}</h3><ul class="moves">${g.items.map(moveItem).join('')}</ul></section>`).join('') : '<p class="empty glass panel">No moves match these filters yet.</p>'}
        ${feed.length > shown.length ? `<div class="filters"><button type="button" data-more>Show older moves (${feed.length - shown.length} more)</button></div>` : ''}
      </div>
      <aside>
        ${DATA.meta.hasRos ? `<section class="panel glass"><h2>Best available</h2><p class="sub">Highest consensus ROS value not on a roster right now.</p>
          <ol class="fa-list">${fa.map((p, i) => `<li><span class="n">${i + 1}</span><span>${posTag(p.id)}${esc(nameOf(p.id))} <span class="when">${p.pos}${p.prk}</span></span><span class="v" data-tip="Consensus value ${f1(p.v)}, ${f1(p.wk)} proj pts/wk">${f1(p.v)}</span></li>`).join('') || '<li>Nothing notable on waivers.</li>'}</ol></section>` : ''}
        <section class="panel glass"><h2>Busiest managers</h2><p class="sub">Completed moves this season, with net ROS value added.</p>
          ${mm.map((m) => `<div class="leader"><span>${esc(team(m.rid).name)}</span><span>${m.moves}${DATA.meta.hasRos ? ` <span class="${m.net >= 0 ? 'plus' : 'minus'}">${m.net > 0 ? '+' : ''}${f1(m.net)}</span>` : ''}</span></div>`).join('')}
        </section>
        ${traders.length && DATA.meta.hasRos ? `<section class="panel glass"><h2>Trade ledger</h2><p class="sub">Net ROS value from trades, valued at today's consensus.</p>
          ${traders.map((m) => `<div class="leader"><span>${esc(team(m.rid).name)}</span><span class="${m.tradeNet >= 0 ? 'plus' : 'minus'}">${m.tradeNet > 0 ? '+' : ''}${f1(m.tradeNet)}</span></div>`).join('')}</section>` : ''}
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
        <p>Projections use each team's best healthy lineup for the week, blended with how they've actually been scoring. Win odds assume a typical week-to-week swing of about ${Math.round(DATA.meta.sd)} points.</p>
      </div>
    </section>
    ${pv.length ? `<div class="matchups">${pv.map((p) => {
      const a = team(p.a), b = team(p.b);
      const fav = p.winA >= 0.5 ? a : b, fp = Math.max(p.winA, 1 - p.winA);
      const swing = fp >= 0.7 ? `A mismatch on paper. ${esc(fav.name)} is a heavy favorite.` : fp < 0.56 ? 'Coin flip. Lineup decisions decide this one.' : `${esc(fav.name)} has the edge.`;
      return `<article class="mu glass ${p.a === myTeam || p.b === myTeam ? 'rim' : ''}">
        <div class="mu-teams">
          <div class="mu-team">${avatar(a)}<span class="tn">${esc(a.name)}</span><small>#${a.powerRank} power, ${record(a)}</small><span class="pr">${f1(p.projA)}</span></div>
          <span class="vs">vs</span>
          <div class="mu-team right">${avatar(b)}<span class="tn">${esc(b.name)}</span><small>#${b.powerRank} power, ${record(b)}</small><span class="pr">${f1(p.projB)}</span></div>
        </div>
        <div class="wp"><div class="wp-bar" role="img" aria-label="${esc(a.name)} ${pct(p.winA)}, ${esc(b.name)} ${pct(1 - p.winA)}"><i style="width:${p.winA * 100}%"></i><i style="width:${(1 - p.winA) * 100}%"></i></div>
          <div class="wp-labels"><span>${pct(p.winA)}</span><span>${pct(1 - p.winA)}</span></div></div>
        <p class="mu-note">${swing}</p>
      </article>`;
    }).join('')}</div>` : '<p class="empty glass panel">No regular-season matchups left to preview.</p>'}`;
}

// ---------- nerd lab ----------
function viewLab() {
  const teams = DATA.teams;
  const n = teams.length;
  const weeks = DATA.history.map((h) => h.week);
  const focus = myTeam || null;
  const bump = bumpChart({
    series: teams.map((t) => ({ id: t.rid, label: t.name, short: short(t.name, 14), color: DATA.color[t.rid], values: t.rankHistory })),
    weeks, n, focus,
  });
  const luckRows = [...teams].sort((a, b) => b.luck - a.luck).map((t) => ({
    label: short(t.name, 20), value: t.luck,
    tip: `${t.name}: ${record(t)} actual vs ${f1(t.expectedWins)} expected wins from a ${t.allPlayW.toFixed(0)}-${t.allPlayL.toFixed(0)} all-play record`,
  }));
  const avgPf = teams.reduce((a, t) => a + t.pfPerGame, 0) / n;
  const sc = scatter({
    points: teams.map((t) => ({ id: t.rid, x: t.pfPerGame, y: t.pa / Math.max(1, t.games), color: DATA.color[t.rid], label: t.name, short: short(t.name, 12), tip: `${t.name}: ${f1(t.pfPerGame)} for, ${f1(t.pa / Math.max(1, t.games))} against per game` })),
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
      <section class="panel glass span-12"><h2>Weekly finishes</h2><p class="sub">Each cell is that week's score; green finished near the top of the league, red near the bottom.</p>${weeklyHeat}</section>
      ${posHeat ? `<section class="panel glass span-7"><h2>Position group ranks</h2><p class="sub">League rank of each team's projected rest-of-season starters by position, flex spots included.</p>${posHeat}</section>` : ''}
      <section class="panel glass ${posHeat ? 'span-5' : 'span-12'}"><h2>Playoff odds</h2><p class="sub">From 10,000 simulated finishes to the regular season, top ${DATA.meta.playoffTeams} get in.</p>
        <table class="table"><thead><tr><th>Team</th><th class="num">Playoffs</th><th class="num">Bye</th><th class="num">Proj W</th><th class="num">Last</th></tr></thead><tbody>
        ${oddsRows.map((t) => `<tr${t.rid === myTeam ? ' style="color:var(--cyan)"' : ''}><td>${esc(short(t.name, 20))}</td><td class="num"><b>${pct(t.playoffPct)}</b></td><td class="num">${pct(t.byePct)}</td><td class="num">${f1(t.projWins)}</td><td class="num">${pct(t.lastPct)}</td></tr>`).join('')}
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
      ${DATA.meta.hasRos ? `<section class="panel glass span-6"><h2>Waiver and trade ROI</h2><p class="sub">Consensus ROS value added through moves, valued at today's rankings.</p>
        ${divergingBars({ rows: Object.values(DATA.managerMoves).sort((a, b) => b.net - a.net).map((m) => ({ label: short(team(m.rid).name, 20), value: m.net, tip: `${team(m.rid).name}: ${f1(m.waiverNet)} from adds and drops, ${f1(m.tradeNet)} from trades over ${m.moves} moves` })) })}</section>` : ''}
    </div>`;
}

// ---------- shell ----------
const VIEWS = { rankings: viewRankings, wire: viewWire, matchups: viewMatchups, lab: viewLab };
function route() {
  const v = (location.hash || '#rankings').slice(1);
  const key = VIEWS[v] ? v : 'rankings';
  document.querySelectorAll('.tabs a').forEach((a) => (a.dataset.view === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const app = $('#app');
  app.innerHTML = VIEWS[key]();
  fixAvatars(app);
  bind(key);
}

function bind(key) {
  if (key === 'rankings') {
    document.querySelectorAll('.rank-btn').forEach((b) =>
      b.addEventListener('click', () => {
        const li = b.closest('.rank');
        const open = !li.classList.contains('open');
        const holder = li.querySelector('.detail > div');
        if (open && !holder.innerHTML) holder.innerHTML = rankDetail(team(Number(li.dataset.rid)));
        li.classList.toggle('open', open);
        b.setAttribute('aria-expanded', open);
      })
    );
    setTimeout(() => $('.ranks')?.classList.remove('enter'), 1400);
  }
  if (key === 'wire') {
    document.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { wireState.type = b.dataset.type; wireState.limit = 50; route(); }));
    $('[data-mine]')?.addEventListener('click', () => { wireState.mine = !wireState.mine; route(); });
    $('[data-more]')?.addEventListener('click', () => { wireState.limit += 50; route(); });
  }
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
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (el && el.dataset.tip) show(el, e.clientX, e.clientY); else tip.hidden = true;
  });
  document.addEventListener('pointerleave', () => (tip.hidden = true));
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
  $('#footer-meta').textContent = `${RAW.isDemo ? 'Demo snapshot. ' : ''}Through week ${DATA.meta.lastScored}. ${updatedText()}`;
  initTeamPicker();
  window.addEventListener('hashchange', () => { route(); $('#app').focus({ preventScroll: true }); window.scrollTo({ top: 0 }); });
  route();
}
main();
