// The power rankings (#rankings): one board, a row per team grouped by tier, each opening into its scouting report;
// your rank and the week's movers beside the headlines, then the fan poll, how the score works and the futures. The hero (headline carousel and page head) is
// shared with the Live page.
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { closeDrawer, openDrawer, slides, sliding } from './drawer.js';
import { ChampTag, Headshot, TeamAvatar, Xp, ScenariosLink, Ring } from '../shared.jsx';
import { Hero } from '../hero/Hero.jsx';
import { Futures } from './Futures.jsx';
import { Poll } from './Poll.jsx';
import { Report } from './Report.jsx';
import { usePosts } from '../admin/posts.js';
import { Lockout } from './Lockout.jsx';

// Dan's way into the headline desk (#admin), shown only while he's signed in
function DeskLink() {
  const p = usePosts();
  return p.admin ? <a className="chip rank-pdf" href="#admin">Headline desk</a> : null;
}

// the page head: the title with the week beside it, one line on what the ranks weigh, and the page's actions (playoff
// scenarios, Dan's desk, the important message's replay once its file is known to be there). The ROS sources moved to
// the foot of the board, where the numbers they feed are.
function RankHead({ wk, held, message }) {
  const [again, setAgain] = useState(false);
  useEffect(() => { message?.ready().then((ok) => setAgain(!!ok)); }, []);
  return <div>
    <h2 className="page-title">Power Rankings<span className="wk">{held ? `On hold, week ${wk}` : `Week ${wk}`}</span></h2>
    <p>Standings first, then scoring, the schedule left and the roster. Tap a team for its scouting report.</p>
    <div className="rk-actions">
      <ScenariosLink />
      <DeskLink />
      {message ? <button type="button" className="chip to-again" data-message hidden={!again} onClick={message.play}>Watch the important message again</button> : null}
    </div>
  </div>;
}

// where the rest-of-season numbers come from and when they were refreshed
const Sources = ({ sources, updated }) => (
  <div className="sources">
    {sources
      ? sources.map((s) => <span key={s.name} className={`chip ${s.ok ? '' : 'off'}`} title={s.title}><span className="dot" />{s.name}</span>)
      : <span className="chip off"><span className="dot" />ROS rankings unavailable</span>}
    {updated ? <span className="chip">{updated}</span> : null}
  </div>
);

const seen = () => { try { return !!localStorage.getItem('ph-opened-rank'); } catch { return false; } };
const learn = () => { try { localStorage.setItem('ph-opened-rank', '1'); } catch { /* fine */ } };

const MoveTag = ({ t }) => (t.movement > 0 ? <span className="move up" title={`Up ${t.movement} since last week`}>{`▲${t.movement}`}</span>
  : t.movement < 0 ? <span className="move down" title={`Down ${-t.movement} since last week`}>{`▼${-t.movement}`}</span>
  : <span className="move flat" title="No change since last week">–</span>);

// the four parts of the score, in order of weight; each is a column of the board
const PARTS = [['standing', 'Standing', 'res'], ['scoring', 'Scoring', 'pts'], ['schedule', 'Schedule', 'sos'], ['roster', 'Roster', 'ros']];
const partTip = (t, k, h) => {
  const sw = `${t.schedWins >= 0 ? '+' : ''}${t.schedWins.toFixed(2)}`;
  return k === 'standing' ? `${t.name}: ${h.ordinal(t.seed)} in the standings at ${h.record(t)}`
    : k === 'scoring' ? `${t.name}: ${h.f1(t.pfPerGame)} points per game, ${h.f1(t.form)} over the last three weeks`
    : k === 'schedule' ? `${t.name}: ${sw} wins from the remaining schedule vs an average one`
    : `${t.name}: best rest-of-season lineup projects ${h.f1(t.rosProj)} a week`;
};

// One row of the board. Wide screens read it as a table (record, points, the four parts, the score, the odds); narrow
// ones keep rank, team, score and odds, and the four parts move to the top of the opened report.
function RankRow({ D, t, me, h, open, nudge, onToggle, onClose, rowRef, btnRef }) {
  const { f1, pct } = h, mine = t.rid === me, lead = t.powerRank === 1;
  const built = useRef(false); // the report is built the first time it opens, then kept (for the fold)
  if (open) built.current = true;
  const has = (k) => t.parts?.[k] != null;
  return (
    <li ref={rowRef} className={`rank lb-row${mine ? ' mine' : ''}${lead ? ' lead' : ''}${t.powerRank <= 3 ? ' top' : ''}${open ? ' open' : ''}`} data-rid={t.rid}>
      <button ref={btnRef} className="lb-btn" aria-expanded={open} aria-controls={`d-${t.rid}`} onClick={onToggle}>
        <span className="lb-rank" aria-hidden="true">{t.powerRank}</span>
        {lead ? <Headshot t={t} cls="lb-face" h={h} /> : <TeamAvatar t={t} />}
        <span className="lb-team">
          <span className="lb-name"><span className="sr-only">{`Rank ${t.powerRank}:`}</span><span className="name">{t.name}</span><ChampTag t={t} h={h} label={lead} /><MoveTag t={t} />{mine ? <span className="you">You</span> : null}</span>
          <span className="lb-meta"><b className="lb-meta-rec">{h.record(t)}</b><span title={`${t.owner} on Sleeper`}>{h.first(t)}</span><span className="lb-meta-ppg">{`${f1(t.pfPerGame)} pts/gm`}</span>{nudge ? <span className="lb-hint">Tap for the scouting report</span> : null}</span>
        </span>
        <span className="lb-num lb-rec">{h.record(t)}</span>
        <span className="lb-num lb-ppg">{f1(t.pfPerGame)}</span>
        {PARTS.map(([k, , cls]) => (has(k)
          ? <span key={k} className="lb-part" data-tip={partTip(t, k, h)}><b>{Math.round(t.parts[k])}</b><span className="track"><i className={cls} style={{ width: `${t.parts[k]}%` }} /></span></span>
          : <span key={k} className="lb-part none">–</span>))}
        <span className="lb-score"><span className="score">{t.score.toFixed(1)}</span></span>
        <span className="lb-odds"><Ring v={t.playoffPct} mine={mine}><b>{pct(t.playoffPct)}</b></Ring></span>
        <Xp />
      </button>
      <div className="detail" id={`d-${t.rid}`}><div>{built.current ? <div className="detail-body">
        <div className="lb-parts">{PARTS.filter(([k]) => has(k)).map(([k, label, cls]) => (
          <div key={k} className="split-row" data-tip={partTip(t, k, h)}><span>{label}</span><span className="track"><i className={cls} style={{ width: `${t.parts[k]}%` }} /></span><span>{Math.round(t.parts[k])}</span></div>
        ))}</div>
        <Report D={D} t={t} h={h} />
        <button type="button" className="odds-more detail-close" onClick={onClose}><span>Close</span><Xp /></button>
      </div> : null}</div></div>
    </li>
  );
}

// The week's movers, beside the headlines: the biggest climbs and drops since last week. Tapping one jumps to its row.
function Movers({ D, h, onJump }) {
  const moved = D.teams.filter((t) => t.movement);
  if (!moved.length) return null;
  const up = moved.filter((t) => t.movement > 0).sort((a, b) => b.movement - a.movement).slice(0, 3);
  const down = moved.filter((t) => t.movement < 0).sort((a, b) => a.movement - b.movement).slice(0, 3);
  const col = (title, list) => (list.length ? <div className="mv-col">
    <h3>{title}</h3>
    <ul>{list.map((t) => <li key={t.rid}><button type="button" onClick={() => onJump(t.rid)} aria-label={`${t.name}, ${t.movement > 0 ? 'up' : 'down'} ${Math.abs(t.movement)} to No. ${t.powerRank}. Jump to the row.`}>
      <TeamAvatar t={t} /><span className="mv-name">{t.name}</span><MoveTag t={t} /><span className="mv-to">{`No. ${t.powerRank}`}</span>
    </button></li>)}</ul>
  </div> : null);
  return <section className="movers glass" aria-label="Movers since last week">{col('Climbing', up)}{col('Sliding', down)}</section>;
}

const METHOD = (pctW) => <>
  <p><b>{`Standing (${pctW('standing')}%).`}</b> Your place in the real standings, wins first and points for as the tiebreaker, like Sleeper's table, plus the record itself so a two-game lead counts for more than a tiebreak.</p>
  <p><b>{`Scoring (${pctW('scoring')}%).`}</b> Points per game carries most of it. All-play win rate (your record if you played every team every week) and the last three weeks add a little.</p>
  <p><b>{`Schedule left (${pctW('schedule')}%).`}</b> Priced in wins: each team's expected wins against its actual remaining opponents, minus what it would expect against an average opponent. An easier road scores higher. Opponent strength uses the same projection as the playoff odds (about two-thirds projected lineup, one-third points per game so far).</p>
  <p><b>{`Rest-of-season roster (${pctW('roster')}%).`}</b> Every player gets a consensus value from FantasyPros, DraftSharks and LeagueLogs half-PPR ROS rankings (LeagueLogs counts half, since it tracks the FantasyPros consensus closely). We build each team's best possible starting lineup from DraftSharks' weekly projections, discounted for games a player is expected to miss, then add a little for the bench.</p>
  <p><b>Scale.</b> Each input is compared to the rest of the league, so 50 is a dead-average team. The four columns beside each score show the parts separately.</p>
  <p><b>Playoff odds.</b> 10,000 simulations of the remaining regular-season schedule, using each team's projected lineup blended with its actual scoring. Ties in the standings go to points for, like Sleeper.</p>
</>;

/**
 * held: a week is being played, so the ranks are on hold (no hero); car: the headline carousel's props, or null;
 * sources: the ROS sources' chips ({ name, ok, title }), or null when they're all down; updated:
 * when they were refreshed; message: { ready, play } for the important message's replay chip, or null; rosError: why the
 * ROS rankings are missing; calm: reduced motion; poll: { on, question, store, onPick }.
 */
export function RankingsPage({ D, me, h, held, car, sources, updated, message, rosError, calm, poll }) {
  const [open, setOpen] = useState(() => new Set());
  const [nudged, setNudged] = useState(() => !seen());
  const rows = useRef(new Map()), btns = useRef(new Map());
  const wk = D.meta.lastScored + 1;

  const toggle = (rid, force, { toTop = false } = {}) => {
    const li = rows.current.get(rid);
    const now = force ?? !open.has(rid);
    if (!li || now === open.has(rid) || sliding()) return false;
    const change = () => setOpen((s) => { const n = new Set(s); if (now) n.add(rid); else n.delete(rid); return n; });
    if (!slides()) change();
    else if (now) openDrawer(li, () => flushSync(change));
    else closeDrawer(li, () => flushSync(change), { toTop });
    // the first open teaches it: the #1 row's hint goes quiet for good on this device
    if (now && nudged) { learn(); setNudged(false); }
    return true;
  };
  const close = (rid) => {
    const li = rows.current.get(rid);
    if (toggle(rid, false, { toTop: true }) && !slides() && li && li.getBoundingClientRect().top < 0) li.scrollIntoView({ block: 'start' });
    btns.current.get(rid)?.focus({ preventScroll: true });
  };
  // your rank, right under the page head, so a phone doesn't scroll three screens to find you
  const mine = !held && me != null ? D.teams.find((t) => t.rid === me) : null;
  const jumpTo = (rid) => {
    const li = rows.current.get(rid);
    if (!li) return;
    li.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    toggle(rid, true);
  };
  const jump = () => jumpTo(mine.rid);

  // a week being played: the ranks stay out of sight behind the lockout popup until every game is final
  if (held) return <div className="rk">
    <section className="view-head"><RankHead wk={wk} held /><Sources sources={sources} updated={updated} /></section>
    <Lockout wk={wk} />
  </div>;

  // your rank, a button that jumps to your row: beside the carousel on a wide screen, under the hero otherwise
  const youStrip = mine ? <button type="button" className="you-strip glass" aria-label={`Jump to your team, ${mine.name}, ranked ${mine.powerRank}`} onClick={jump}>
    <Headshot t={mine} cls="strip-face" h={h} />
    <span className="ys-rank"><small>You're</small><b>{`No. ${mine.powerRank}`}</b></span>
    <span className="ys-body"><b>{mine.name}</b><span className="ys-tags"><span className={`tier ${mine.tier.key}`}>{mine.tier.label}</span><MoveTag t={mine} /></span></span>
    <span className="ys-odds"><Ring v={mine.playoffPct} mine><b>{h.pct(mine.playoffPct)}</b></Ring><small>playoffs</small></span><Xp />
  </button> : null;

  // the board's tiers, in rank order: each is a run of rows under its own label
  const tiers = [];
  for (const t of D.teams) {
    const last = tiers[tiers.length - 1];
    if (last && last.label === t.tier.label) last.teams.push(t); else tiers.push({ key: t.tier.key, label: t.tier.label, teams: [t] });
  }

  return <div className="rk">
    <Hero D={D} h={h} car={car} head={<RankHead wk={wk} message={message} />}
      side={youStrip} hint={<p className="you-card glass empty" data-open-me>{'Pick your team '}<span className="where-d">in the top right</span><span className="where-p">in the circle at the bottom right</span>{' and this spot shows your rank, your tier and your playoff odds.'}</p>}
      more={<Movers D={D} h={h} onJump={jumpTo} />} />
    {rosError ? <div className="notice glass"><strong>Results-only mode.</strong>{` The rest-of-season rankings couldn't be loaded (${rosError}), so these ranks use this season's results alone until they come back.`}</div> : null}
    <div id="poll-slot"><Poll D={D} h={h} poll={poll} /></div>
    <section className="board glass" aria-label={`Week ${wk} power rankings`}>
      <div className="lb-cols" aria-hidden="true">
        <span>No.</span><span /><span>Team</span><span>Record</span><span>Pts/gm</span>
        {PARTS.map(([k, label]) => <span key={k}>{label}</span>)}
        <span>Power</span><span>Playoffs</span><span />
      </div>
      {tiers.map((g) => <div key={g.label} className={`lb-group ${g.key}`}>
        <h3 className="lb-tier">{g.label}</h3>
        <ol className="lb">{g.teams.map((t) => (
          <RankRow key={t.rid} D={D} t={t} me={me} h={h} open={open.has(t.rid)} nudge={t.powerRank === 1 && nudged}
            onToggle={() => toggle(t.rid)} onClose={() => close(t.rid)}
            rowRef={(el) => { if (el) rows.current.set(t.rid, el); else rows.current.delete(t.rid); }}
            btnRef={(el) => { if (el) btns.current.set(t.rid, el); else btns.current.delete(t.rid); }} />
        ))}</ol>
      </div>)}
      <div className="lb-foot">
        <p>Each part is scored against the rest of the league, so 50 is a dead-average team.</p>
        <Sources sources={sources} updated={updated} />
      </div>
    </section>
    <details className="panel glass method-box">
      <summary><h2>How the score works</h2><Xp /></summary>
      <div className="method">{METHOD(h.pctW)}</div>
    </details>
    <Futures D={D} me={me} h={h} />
  </div>;
}
