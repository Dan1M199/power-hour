// The team dashboard (Nerd lab, #lab/team): one team's season on seven paper widgets, in the "Paper Widgets" style
// (warm paper tiles, thin Geist numerals, mono captions, one ultramarine accent). Three parts:
// - dashData(D, rid, {raw, ros}) gathers the numbers. Pure, like the engine, and tested by scripts/test-dashboard.mjs.
// - paperDash(m, h) renders the tiles as HTML. h carries the page's helpers (escaping, names, faces).
// - playPaper(root, m) runs the intro (tiles rise in, numbers count up, the sun climbs, ticks light) and the interactions
//   (flip through key players, pick a game on the schedule, flip the all-play switch). It returns a stop function.
// Sizes are the tiles' own pixels (296 square, wide ones 612); styles.css lays them out as 3, 2 or 1 columns.

const SKILL = ['QB', 'RB', 'WR', 'TE'];

// ---------- the numbers ----------
export function dashData(D, rid, { raw = D.raw, ros = {} } = {}) {
  const t = D.byRid[rid];
  if (!t) return null;
  const n = D.teams.length, H = D.helpers, last = D.meta.lastScored || 0;
  const matchups = raw?.matchups || {};
  const rowOf = (w) => (matchups[w] || []).find((m) => m.roster_id === rid);

  // a player's scored weeks on this roster (bench weeks included: it's what he did, not what was started). Sleeper
  // gives every rostered player's points; a snapshot that only kept the starters' falls back to those.
  const weeksOf = (id) => {
    const out = [];
    for (let w = 1; w <= last; w++) {
      const r = rowOf(w);
      if (r?.players?.includes(id)) out.push({ week: w, pts: weekPts(r, id) });
    }
    return out;
  };
  const stars = (t.rosLineup || []).filter((l) => l && SKILL.includes(H.posOf(l.id)))
    .map((l) => l.id).sort((a, b) => H.valueOf(b) - H.valueOf(a)).slice(0, 6)
    .map((id) => {
      const info = H.player(id) || {}, wk = weeksOf(id), season = wk.reduce((a, x) => a + x.pts, 0);
      return {
        id, name: H.nameOf(id), pos: info.pos, nfl: info.team, prk: ros[id]?.prk ?? null, value: H.valueOf(id),
        perWeek: H.effWeekly(id), season, games: wk.length, avg: wk.length ? season / wk.length : null, last5: wk.slice(-5),
        week: { pre: info.pre ?? 0, now: info.proj ?? 0, played: !!info.played, floor: info.floor, ceil: info.ceil, bye: !!info.bye, out: !!info.out },
      };
    });

  // this week's game, from the previews
  const p = (D.previews || []).find((x) => x.a === rid || x.b === rid);
  const game = p ? { opp: D.byRid[p.a === rid ? p.b : p.a], win: p.a === rid ? p.winA : 1 - p.winA, week: p.week } : null;

  const effs = D.teams.filter((x) => x.efficiency != null).map((x) => x.efficiency).sort((a, b) => b - a);
  const scores = (D.weekly || []).flatMap((w) => Object.values(w.scores));
  const avgPpg = D.teams.reduce((a, x) => a + (x.pfPerGame || 0), 0) / n;

  return {
    t, n, game,
    odds: { playoff: t.playoffPct ?? 0, bye: t.byePct ?? 0, champ: t.champPct ?? 0, ifWin: t.playoffIfWin ?? null, ifLoss: t.playoffIfLoss ?? null },
    stars,
    efficiency: t.efficiency == null ? null : { eff: t.efficiency, left: t.leftOnBench ?? 0, rank: effs.indexOf(t.efficiency) + 1, of: effs.length },
    scoring: {
      ppg: t.pfPerGame || 0, avg: avgPpg, max: scores.length ? Math.max(...scores) : 1,
      best: t.best?.pts ?? null,
      weeks: (t.weeks || []).slice(-7).map((w) => ({ week: w.week, pts: w.pts, result: w.result, rank: w.rank, opp: D.byRid[w.opp] || null, oppPts: w.oppPts })),
    },
    groups: SKILL.map((pos) => ({ pos, rank: t.posRanks?.[pos] ?? null, top: (t.rosLineup || []).find((l) => l && H.posOf(l.id) === pos)?.id ?? null })),
    schedule: (t.schedule || []).map((g) => ({ week: g.week, opp: D.byRid[g.rid], win: g.pWin, proj: g.proj })),
    luck: {
      record: { w: t.wins, l: t.losses, tie: t.ties || 0 },
      allPlay: { w: Math.round(t.allPlayW || 0), l: Math.round(t.allPlayL || 0) },
      expected: t.expectedWins ?? 0, luck: t.luck ?? 0,
    },
  };
}

// a player's points in one week's matchup row
export const weekPts = (r, id) => r.players_points?.[id] ?? (r.starters || []).reduce((a, x, i) => (x === id ? r.starters_points?.[i] ?? 0 : a), 0);

// ---------- motion helpers (the style's easings) ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const inOut = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const out = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const back = (x) => { x = clamp(x); const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const seg = (t, a, b, f = inOut) => f((t - a) / (b - a));

// every motion number, in seconds from the moment the dashboard opens
const TL = {
  enter: [0.1, 0.75], stagger: 0.08, rise: 22, scale: 0.955,
  count: [1.0, 2.2], sun: [1.2, 2.8], sunShow: [1.2, 1.4], marks: [2.6, 3.0],
  progress: [1.1, 1.6], eq: [1.2, 1.8], eqStagger: 0.06, stats: [1.3, 2.3],
  ticksIn: [0.9, 1.6], tickFade: 60, tickLag: 0.6, lit: [1.4, 2.8],
  steps: [1.3, 2.7], bars: [1.4, 2.0], barStagger: 0.08,
  fill: [1.5, 2.5], fillStagger: 0.12,
  rows: [1.5, 2.1], rowStagger: 0.1, rowRise: 12, chip: [2.2, 2.5],
  end: 3.1,
};
const ARC = 'M8 76 C 60 -14, 188 -14, 240 76';
const DIAL = 200, TICK_IN = 86, TICK_OUT = 96, TICK_OUT_MAJOR = 99;
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2 - Math.PI / 2, r2 = i % 5 ? TICK_OUT : TICK_OUT_MAJOR, c = DIAL / 2;
  return { x1: c + Math.cos(a) * TICK_IN, y1: c + Math.sin(a) * TICK_IN, x2: c + Math.cos(a) * r2, y2: c + Math.sin(a) * r2, w: i % 5 ? 1.4 : 2 };
});

// ---------- icons (24-unit grid, currentColor) ----------
const solid = (size, d) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
const ICON = {
  prev: solid(20, 'M7 6h2v12H7zM20 6v12l-9-6z'),
  pause: solid(20, 'M7 5h4v14H7zM13 5h4v14h-4z'),
  play: solid(20, 'M8 5.5v13l10.5-6.5z'),
  next: solid(20, 'M15 6h2v12h-2zM4 6v12l9-6z'),
  bolt: solid(13, 'M13 2 4 14h7l-1 8 9-12h-7z'),
  dice: '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="1.6"/><g fill="currentColor"><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/></g></svg>',
};

// ---------- the tiles ----------
const POS_WORD = { QB: 'Quarterback', RB: 'Running back', WR: 'Receiver', TE: 'Tight end' };
const rec = (r) => `${r.w}-${r.l}${r.tie ? `-${r.tie}` : ''}`;

export function paperDash(m, h) {
  const { esc, f1, pct, ordinal } = h, t = m.t;
  const label = (word) => `<div class="pp-label"><i></i>${esc(word)}</div>`;
  const tile = (cls, i, inner, wide = false) => `<article class="pp-tile ${cls}${wide ? ' wide' : ''}" style="--i:${i}">${inner}</article>`;

  // 1. playoff odds on the sun's arc
  const g = m.game, o = m.odds;
  const odds = tile('pp-odds', 0, `${label('Playoff odds')}
    <div class="pp-range">Bye ${pct(o.bye)}, title ${pct(o.champ)}</div>
    <div class="pp-big" data-odds>0%</div>
    <div class="pp-sky">${g && o.ifWin != null ? (pct(o.ifWin) === pct(o.ifLoss) ? `${pct(o.ifWin)} win or lose this week` : `${pct(o.ifWin)} with a win, ${pct(o.ifLoss)} with a loss`) : esc(t.tier?.label || '')}</div>
    <svg class="pp-arc" width="248" height="86" viewBox="0 0 248 86" aria-hidden="true">
      <path class="dotted" d="${ARC}" stroke-width="1.2" stroke-dasharray="2 4"/>
      <line class="horizon" x1="0" x2="248" y1="76" y2="76"/>
      <path class="lit" d="${ARC}" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
      ${g && o.ifWin != null ? `<circle class="mk" r="4.5" data-share="${o.ifLoss}" data-tip="${esc(`Lose to ${g.opp.name} in week ${g.week}: ${pct(o.ifLoss)}`)}"/><circle class="mk" r="4.5" data-share="${o.ifWin}" data-tip="${esc(`Beat ${g.opp.name} in week ${g.week}: ${pct(o.ifWin)}`)}"/>` : ''}
      <circle class="glow" r="14" opacity="0"/><circle class="sun" r="6" opacity="0" data-tip="${esc(`Playoff odds today: ${pct(o.playoff)}, from 10,000 simulated seasons`)}"/>
    </svg>
    <div class="pp-time left">Out</div><div class="pp-time right">In</div>`);

  // 2. key players, one at a time, like a music player
  const players = m.stars.length ? tile('pp-player', 1, `
    <div class="pp-cover" aria-hidden="true"><div class="pp-cover-in">${coverArt(m.stars[0], 0, h)}<div class="art spare" aria-hidden="true"></div></div></div>
    ${label('Key players')}
    <div class="pp-eq" aria-hidden="true">${[0, 1, 2, 3, 4].map((i) => `<i style="--i:${i}"></i>`).join('')}</div>
    <div class="pp-title"></div><div class="pp-artist"></div>
    <div class="pp-stats">
      <div><b data-stat="season"></b><small>Season pts</small></div>
      <div><b data-stat="avg"></b><small>Per game</small></div>
      <div><b data-stat="ros"></b><small>Proj a week</small></div>
    </div>
    <div class="pp-progress"><i></i></div><div class="pp-knob"></div>
    <div class="pp-ptime elapsed"></div><div class="pp-ptime length"></div>
    <button type="button" class="pp-btn prev" data-step="-1" aria-label="Previous player">${ICON.prev}</button>
    <button type="button" class="pp-play" aria-label="Pause" aria-pressed="false">${ICON.pause}</button>
    <button type="button" class="pp-btn next" data-step="1" aria-label="Next player">${ICON.next}</button>
    <span class="pp-count"></span>`, true) : tile('pp-player', 1, `${label('Key players')}<div class="pp-empty">No player projections yet.</div>`, true);

  // 3. lineup efficiency on a ring of 60 ticks
  const e = m.efficiency;
  const eff = tile('pp-eff', 2, `${label('Lineup efficiency')}
    ${e ? `<div class="pp-range">${ordinal(e.rank)} of ${e.of}</div>` : ''}
    <svg class="pp-dial" width="200" height="200" viewBox="0 0 200 200" ${e ? `data-tip="${esc(`Started ${(e.eff * 100).toFixed(1)}% of the best possible lineup, ${f1(e.left)} pts a week left on the bench`)}"` : 'aria-hidden="true"'}>
      ${TICKS.map((k) => `<line class="tick" x1="${k.x1.toFixed(2)}" y1="${k.y1.toFixed(2)}" x2="${k.x2.toFixed(2)}" y2="${k.y2.toFixed(2)}" stroke-width="${k.w}" opacity="0"/>`).join('')}
    </svg>
    <div class="pp-digits">${e ? '0.0%' : '–'}</div>
    <div class="pp-caption">${e ? 'of the best lineup' : 'No games scored yet'}</div>`);

  // 4. weekly scores, the last seven, like a week of steps
  const s = m.scoring, diff = s.avg ? (s.ppg - s.avg) / s.avg : 0;
  const steps = tile('pp-steps', 3, `${label('Scoring')}
    ${s.best != null ? `<div class="pp-range">Best ${f1(s.best)}</div>` : ''}
    <div class="pp-count-big">0.0</div>
    <div class="pp-goal">a game, ${Math.abs(diff) < 0.005 ? 'level with' : `${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? 'over' : 'under'}`} the league</div>
    ${s.weeks.map((w, i) => `<div class="pp-day" style="--i:${i}" data-tip="${esc(`Week ${w.week}: ${f1(w.pts)} pts, ${ordinal(w.rank)} of ${m.n}${w.opp ? `, ${w.result === 'W' ? 'beat' : w.result === 'L' ? 'lost to' : 'tied'} ${w.opp.name} (${f1(w.oppPts)})` : ''}`)}">
      <div class="empty"></div><div class="bar${i === s.weeks.length - 1 ? ' today' : ''}${w.result === 'L' ? ' loss' : ''}"></div>
      <div class="letter${i === s.weeks.length - 1 ? ' today' : ''}">${esc(w.result || '–')}</div></div>`).join('')}`);

  // 5. position groups, charged like batteries
  const best = Math.min(...m.groups.map((x) => x.rank ?? 99));
  const groups = tile('pp-groups', 4, `${label('Position groups')}
    ${m.groups.map((x, i) => `<div class="pp-row" style="--i:${i}" data-tip="${esc(`${POS_WORD[x.pos]}s: ${x.rank ? `${ordinal(x.rank)} of ${m.n}` : 'no rank'}${h.groupSaid ? ` (${h.groupSaid(t, x.pos)})` : ''}`)}">
      <div class="well">${x.pos}</div>
      <div class="name">${esc(x.top ? h.shortName(x.top) : 'Nobody')}</div>
      <div class="level"></div>
      <div class="track"><div class="fill${x.rank === best ? ' charging' : ''}">${x.rank === best ? '<div class="shimmer"></div>' : ''}</div></div>
      ${x.rank === best ? `<div class="bolt">${ICON.bolt}</div>` : ''}
    </div>`).join('')}`);

  // 6. the schedule, the next game in front
  const games = m.schedule;
  const sched = tile('pp-cal', 5, `${label(games.length ? 'Schedule' : 'Season')}
    <div class="pp-date">${games.length ? games[0].week : '–'}</div>
    <div class="pp-month"></div><div class="pp-summary"></div>
    <div class="pp-divider"></div>
    <div class="pp-list" role="listbox" aria-label="Games left">
      ${games.length ? games.map((x, i) => `<button type="button" class="pp-ev" role="option" aria-selected="${i === 0}" style="--i:${i}" data-k="${i}">
        <span class="time">Wk ${x.week}</span><span class="marker"></span>
        <span class="ev-text"><span class="ev-title">${esc(x.opp.name)}</span><span class="ev-detail">No. ${x.opp.powerRank} power, ${esc(h.record(x.opp))}</span></span>
        <span class="chip">${pct(x.win)}</span>
      </button>`).join('') : '<p class="pp-empty">The regular season is over.</p>'}
    </div>`, true);

  // 7. luck: the real record, or flip the switch for the all-play one
  const L = m.luck, lucky = L.luck;
  const luck = tile('pp-luck', 6, `<div class="face">
    <div class="dark"></div>
    ${label('Luck')}
    <div class="moon">${ICON.dice}</div>
    <div class="state">${rec(L.record)}</div>
    <div class="caption">${Math.abs(lucky) < 0.25 ? 'Right where the scores say' : `${f1(Math.abs(lucky))} wins ${lucky > 0 ? 'luckier' : 'unluckier'} than the scores`}</div>
    <button type="button" class="toggle" role="switch" aria-checked="false" aria-label="Show the all-play record" data-tip="${esc(`All-play: ${L.allPlay.w}-${L.allPlay.l} playing every team every week, worth ${f1(L.expected)} wins against ${L.record.w} real ones`)}"><span class="knob"></span></button>
    <span class="toggle-word">All-play</span>
  </div>`);

  const others = [...h.teams].sort((a, b) => a.name.localeCompare(b.name));
  return `<section class="paper" data-paper aria-label="Team dashboard for ${esc(t.name)}">
    <header class="pp-head">
      <span class="pp-face">${h.face(t)}</span>
      <div class="pp-id"><p>Team dashboard</p><h2>${esc(t.name)}</h2><p class="pp-sub">${esc(h.first(t))}, ${esc(h.record(t))}, ${ordinal(t.seed)} in the standings, No. ${t.powerRank} power</p></div>
      <label class="pp-pick"><span>Team</span><select id="dash-team">${others.map((x) => `<option value="${x.rid}"${x.rid === t.rid ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    </header>
    <div class="pp-grid">${odds}${players}${eff}${steps}${groups}${sched}${luck}</div>
  </section>`;
}

// a cover for a player: two styles taking turns, ultramarine with a peach sun, or paper with a black disc
function coverArt(p, i, h) {
  const mark = `${p.pos}—${String(p.prk ?? '–').padStart(2, '0')}`;
  return i % 2 === 0
    ? `<div class="art a front"><span class="disc"></span><span class="rule"></span><span class="mark">${h.esc(mark)}</span><span class="init">${h.esc(initials(p.name))}</span></div>`
    : `<div class="art b front"><span class="disc"></span><span class="sq"></span><span class="mark">${h.esc(mark)}</span><span class="init">${h.esc(initials(p.name))}</span></div>`;
}
const initials = (name) => name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('');

// ---------- motion and interactions ----------
export function playPaper(root, m, { calm = false, h } = {}) {
  if (!root) return () => {};
  const $ = (s) => root.querySelector(s), $$ = (s) => [...root.querySelectorAll(s)];
  const tiles = $$('.pp-tile');
  let raf = 0, timer = 0, stopped = false;

  // --- the player: one star at a time ---
  const P = { i: 0, playing: !calm && m.stars.length > 1, k: 1 };
  const showPlayer = (p) => {
    $('.pp-title').textContent = p.name;
    $('.pp-artist').textContent = `${POS_WORD[p.pos] || p.pos}, ${h.nfl(p.nfl)}`;
    const w = p.week, value = w.played ? w.now : w.pre, top = Math.max(w.ceil || 0, value, 1);
    P.share = w.bye || w.out ? 0 : clamp(value / top);
    $('.pp-ptime.elapsed').textContent = w.bye ? 'Bye this week' : w.out ? 'Out this week' : `${h.f1(value)} ${w.played ? 'final' : 'this week'}`;
    $('.pp-ptime.length').textContent = w.ceil != null && !w.bye && !w.out ? `${h.f1(top)} ceiling` : '';
    P.season = p.season; P.avg = p.avg; P.ros = p.perWeek;
    P.eq = p.last5.map((x) => x.pts);
    const eq = $('.pp-eq');
    eq.dataset.tip = p.last5.length ? `Last ${p.last5.length} weeks: ${p.last5.map((x) => h.f1(x.pts)).join(', ')}` : 'No games with this team yet';
    $('.pp-count').textContent = `${P.i + 1} of ${m.stars.length}`;
  };
  // the progress track and its knob read --f, so the same write works on the wide tile and the phone layout
  const drawPlayer = (k = 1) => {
    const tile = $('.pp-player');
    if (!tile) return;
    tile.style.setProperty('--f', String(P.share * k));
    const peak = Math.max(...P.eq, 1);
    $$('.pp-eq i').forEach((bar, i) => {
      const v = P.eq[i - (5 - P.eq.length)];
      bar.style.height = `${v == null ? 2 : 2 + 12 * (v / peak) * seg(k, i * 0.1, 0.6 + i * 0.1, back)}px`;
    });
  };
  const statText = (k = 1) => {
    const set = (key, v) => { const el = $(`[data-stat="${key}"]`); if (el) el.textContent = v == null ? '–' : h.f1(v * k); };
    set('season', P.season); set('avg', P.avg); set('ros', P.ros);
  };

  // --- the schedule: one game picked ---
  const pickGame = (i) => {
    const x = m.schedule[i];
    if (!x) return;
    $$('.pp-ev').forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    $('.pp-date').textContent = x.week;
    $('.pp-month').textContent = `vs ${h.first(x.opp)}`;
    $('.pp-summary').textContent = `${h.pct(x.win)} to win, they project ${h.f1(x.proj)}`;
  };

  // --- the intro: a pure function of time since opening ---
  const sunPath = $('.pp-arc .dotted'), arcLen = sunPath ? sunPath.getTotalLength() : 0;
  const at = (share) => sunPath.getPointAtLength(arcLen * clamp(share));
  $$('.pp-arc .mk').forEach((c) => { const p = at(Number(c.dataset.share)); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); });
  const e = m.efficiency, lit = e ? Math.round(e.eff * 60) : 0;
  const draw = (t) => {
    tiles.forEach((el, i) => {
      const k = seg(t, TL.enter[0] + i * TL.stagger, TL.enter[1] + i * TL.stagger, out);
      el.style.opacity = String(k);
      el.style.transform = `translateY(${(1 - k) * TL.rise}px) scale(${TL.scale + (1 - TL.scale) * k})`;
    });
    // playoff odds
    if (sunPath) {
      $('[data-odds]').textContent = `${Math.round(100 * m.odds.playoff * seg(t, TL.count[0], TL.count[1], out))}%`;
      const k = m.odds.playoff * seg(t, TL.sun[0], TL.sun[1]), p = at(k), show = String(seg(t, TL.sunShow[0], TL.sunShow[1]));
      $('.pp-arc .lit').setAttribute('stroke-dashoffset', String(1 - k));
      for (const c of [$('.pp-arc .sun'), $('.pp-arc .glow')]) { c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('opacity', show); }
      $$('.pp-arc .mk').forEach((c) => c.setAttribute('opacity', String(seg(t, TL.marks[0], TL.marks[1]))));
    }
    // key players
    if (m.stars.length) { drawPlayer(seg(t, TL.progress[0], TL.progress[1])); statText(seg(t, TL.stats[0], TL.stats[1], out)); }
    // efficiency
    const intro = seg(t, TL.ticksIn[0], TL.ticksIn[1]), on = Math.round(lit * seg(t, TL.lit[0], TL.lit[1], out));
    $$('.pp-dial .tick').forEach((line, i) => {
      line.setAttribute('opacity', String(clamp(intro * TL.tickFade - i * TL.tickLag)));
      line.classList.toggle('lit', i < on);
    });
    if (e) $('.pp-digits').textContent = `${(e.eff * 100 * seg(t, TL.lit[0], TL.lit[1], out)).toFixed(1)}%`;
    // scoring
    $('.pp-count-big').textContent = h.f1(m.scoring.ppg * seg(t, TL.steps[0], TL.steps[1], out));
    $$('.pp-day .bar').forEach((bar, i) => {
      const w = m.scoring.weeks[i], gk = seg(t, TL.bars[0] + i * TL.barStagger, TL.bars[1] + i * TL.barStagger, back);
      bar.style.transform = `scaleY(${(w.pts / m.scoring.max) * gk})`;
    });
    // position groups
    $$('.pp-row').forEach((row, i) => {
      const x = m.groups[i], k = seg(t, TL.fill[0] + i * TL.fillStagger, TL.fill[1] + i * TL.fillStagger, out);
      const share = x.rank ? (m.n - x.rank + 1) / m.n : 0;
      row.querySelector('.fill').style.width = `${share * k * 100}%`;
      row.querySelector('.level').textContent = x.rank ? h.ordinal(Math.max(x.rank, Math.round(m.n - (m.n - x.rank) * k))) : '–';
    });
    // schedule
    $$('.pp-ev').forEach((row, i) => {
      const k = seg(t, TL.rows[0] + i * TL.rowStagger, TL.rows[1] + i * TL.rowStagger, out);
      row.style.opacity = String(k);
      row.style.transform = `translateY(${(1 - k) * TL.rowRise}px)`;
    });
    root.style.setProperty('--chip', String(seg(t, TL.chip[0], TL.chip[1])));
    root.classList.toggle('settled', t >= TL.end);
  };

  // --- wiring ---
  if (m.stars.length) showPlayer(m.stars[0]);
  if (m.schedule.length) pickGame(0);

  // flip to another player: the old cover drifts left and fades as the new one slides in, the words dip
  let swapping = false;
  const step = (d) => {
    if (swapping || m.stars.length < 2) return;
    swapping = true;
    P.i = (P.i + d + m.stars.length) % m.stars.length;
    const p = m.stars[P.i], cover = $('.pp-cover-in'), old = cover.querySelector('.art.front'), spare = cover.querySelector('.art.spare');
    spare.outerHTML = coverArt(p, P.i, h).replace('front', 'incoming');
    const fresh = cover.querySelector('.art.incoming'), words = [$('.pp-title'), $('.pp-artist')];
    const dir = d > 0 ? 1 : -1, dur = calm ? 1 : 600, t0 = performance.now();
    let changed = false;
    const tick = (now) => {
      if (!root.isConnected) return;
      const x = clamp((now - t0) / dur), k = inOut(x);
      old.style.transform = `translateX(${-40 * dir * k}px) scale(${1 - 0.06 * k})`;
      old.style.opacity = String(1 - 0.9 * k);
      fresh.style.transform = `translateX(${dir * (1 - k) * 248}px)`;
      const dip = 1 - seg(x, 0.15, 0.35) * (1 - seg(x, 0.35, 0.75));
      words.forEach((w) => (w.style.opacity = String(dip)));
      if (!changed && x >= 0.35) { changed = true; showPlayer(p); }
      drawPlayer(seg(x, 0.3, 1)); statText(seg(x, 0.3, 1, out));
      if (x < 1) { requestAnimationFrame(tick); return; }
      old.className = 'art spare'; old.removeAttribute('style'); old.innerHTML = '';
      fresh.classList.replace('incoming', 'front');
      cover.appendChild(old);
      swapping = false;
    };
    requestAnimationFrame(tick);
  };
  root.querySelectorAll('.pp-btn').forEach((b) => b.addEventListener('click', () => { step(Number(b.dataset.step)); restart(); }));
  const play = $('.pp-play');
  const paintPlay = () => {
    if (!play) return;
    play.innerHTML = P.playing ? ICON.pause : ICON.play;
    play.setAttribute('aria-label', P.playing ? 'Pause' : 'Play through the players');
    play.setAttribute('aria-pressed', String(!P.playing));
  };
  play?.addEventListener('click', () => { P.playing = !P.playing; paintPlay(); restart(); });
  // the players take turns every 6 seconds while the dashboard is on screen and nobody paused it
  const restart = () => {
    clearInterval(timer);
    if (!P.playing || stopped) return;
    timer = setInterval(() => {
      if (!root.isConnected) return stop();
      if (document.visibilityState === 'visible' && root.getBoundingClientRect().bottom > 0 && root.getBoundingClientRect().top < innerHeight) step(1);
    }, 6000);
  };
  paintPlay();

  root.querySelector('.pp-list')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('.pp-ev');
    if (!b) return;
    const box = root.querySelector('.pp-cal');
    box.classList.add('dip');
    setTimeout(() => { pickGame(Number(b.dataset.k)); box.classList.remove('dip'); }, calm ? 0 : 140);
  });

  // the luck switch: the tile goes dark and shows the all-play record (the words change halfway through the fade)
  const luck = root.querySelector('.pp-luck'), sw = luck?.querySelector('.toggle');
  sw?.addEventListener('click', () => {
    const on = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', String(on));
    luck.classList.toggle('flipping', on);
    setTimeout(() => {
      luck.classList.toggle('on', on);
      const L = m.luck;
      luck.querySelector('.state').textContent = on ? `${L.allPlay.w}-${L.allPlay.l}` : rec(L.record);
      luck.querySelector('.caption').textContent = on
        ? 'All-play: every team, every week'
        : Math.abs(L.luck) < 0.25 ? 'Right where the scores say' : `${h.f1(Math.abs(L.luck))} wins ${L.luck > 0 ? 'luckier' : 'unluckier'} than the scores`;
    }, calm ? 0 : 225);
  });

  const stop = () => { stopped = true; cancelAnimationFrame(raf); clearInterval(timer); };
  if (calm) { draw(TL.end + 1); return stop; }
  draw(0);
  const t0 = performance.now();
  const frame = (now) => {
    if (!root.isConnected) return stop();
    const s = (now - t0) / 1000;
    draw(Math.min(s, TL.end));
    if (s < TL.end) raf = requestAnimationFrame(frame);
    else restart();
  };
  raf = requestAnimationFrame(frame);
  return stop;
}
