// The power rankings (#rankings): a row per team that opens into its scouting report, with your rank in a strip up
// top, the fan poll, championship futures and how the score works. The hero (headline carousel, page head and league
// desk) is still built and bound by app.js, which shares it with the Live page; it sits here as given.
import { useRef, useState } from 'react';
import { ChampTag, Headshot, TeamAvatar, Xp } from '../shared.jsx';
import { Futures } from './Futures.jsx';
import { Poll } from './Poll.jsx';
import { Report } from './Report.jsx';

const seen = () => { try { return !!localStorage.getItem('ph-opened-rank'); } catch { return false; } };
const learn = () => { try { localStorage.setItem('ph-opened-rank', '1'); } catch { /* fine */ } };

const MoveTag = ({ t }) => (t.movement > 0 ? <span className="move up" title={`Up ${t.movement} since last week`}>{`▲${t.movement}`}</span>
  : t.movement < 0 ? <span className="move down" title={`Down ${-t.movement} since last week`}>{`▼${-t.movement}`}</span>
  : <span className="move flat" title="No change since last week">–</span>);

function RankRow({ D, t, me, h, open, nudge, onToggle, onClose, rowRef, btnRef }) {
  const { f1, pct, ordinal } = h, mine = t.rid === me;
  const built = useRef(false); // the report is built the first time it opens, then kept (for the fold)
  if (open) built.current = true;
  // the four parts of the score, in order of weight: standing, scoring, schedule, roster
  const sw = `${t.schedWins >= 0 ? '+' : ''}${t.schedWins.toFixed(2)}`;
  const parts = [
    ['standing', 'Standing', 'res', `${t.name}: ${ordinal(t.seed)} in the standings at ${h.record(t)}`],
    ['scoring', 'Scoring', 'pts', `${t.name}: ${f1(t.pfPerGame)} points per game, ${f1(t.form)} over the last three weeks`],
    ['schedule', 'Schedule', 'sos', `${t.name}: ${sw} wins from the remaining schedule vs an average one`],
    ['roster', 'Roster', 'ros', `${t.name}: best rest-of-season lineup projects ${f1(t.rosProj)} a week`],
  ].filter(([k]) => t.parts?.[k] != null);
  return (
    <li ref={rowRef} className={`rank ${mine ? 'mine' : ''}${nudge ? ' nudge' : ''}${open ? ' open' : ''}`} data-rid={t.rid}>
      <span className="jersey" aria-hidden="true">{t.powerRank}</span>
      <div className={`rank-card glass ${t.powerRank <= 3 ? 'rim' : ''}`}>
        <button ref={btnRef} className="rank-btn" aria-expanded={open} aria-controls={`d-${t.rid}`} onClick={onToggle}>
          <TeamAvatar t={t} />
          <div className="team-line">
            <div className="team-name"><span className="sr-only">{`Rank ${t.powerRank}:`}</span><span className="name">{t.name}</span><ChampTag t={t} h={h} /><MoveTag t={t} />{mine ? <span className="you">You</span> : null}</div>
            <div className="team-meta"><span><b>{h.record(t)}</b></span><span className="owner" title={`${t.owner} on Sleeper`}>{h.first(t)}</span><span>{`${f1(t.pfPerGame)} pts/gm`}</span><span className={`tier ${t.tier.key}`}>{t.tier.label}</span></div>
          </div>
          <div className="meter">
            <div className="meter-top"><span className="score">{t.score.toFixed(1)}</span><small>power score</small></div>
            <div className="split">{parts.map(([k, label, cls, tip]) => <div key={k} className="split-row" data-tip={tip}><span>{label}</span><span className="track"><i className={cls} style={{ width: `${t.parts[k]}%` }} /></span><span>{Math.round(t.parts[k])}</span></div>)}</div>
          </div>
          <div className="odds"><b>{pct(t.playoffPct)}</b><small>playoffs</small></div>
          <span className="pull" aria-hidden="true"><span className="pull-t">Scouting report</span><span className="pull-n">Tap for the scouting report</span><span className="pull-x">Hide report</span><Xp /></span>
        </button>
        <div className="detail" id={`d-${t.rid}`}><div>{built.current ? <>
          <Report D={D} t={t} h={h} />
          <button type="button" className="odds-more detail-close" onClick={onClose}><span>Close</span><Xp /></button>
        </> : null}</div></div>
      </div>
    </li>
  );
}

const METHOD = (pctW) => <>
  <p><b>{`Standing (${pctW('standing')}%).`}</b> Your place in the real standings, wins first and points for as the tiebreaker, like Sleeper's table, plus the record itself so a two-game lead counts for more than a tiebreak.</p>
  <p><b>{`Scoring (${pctW('scoring')}%).`}</b> Points per game carries most of it. All-play win rate (your record if you played every team every week) and the last three weeks add a little.</p>
  <p><b>{`Schedule left (${pctW('schedule')}%).`}</b> Priced in wins: each team's expected wins against its actual remaining opponents, minus what it would expect against an average opponent. An easier road scores higher. Opponent strength uses the same projection as the playoff odds (about two-thirds projected lineup, one-third points per game so far).</p>
  <p><b>{`Rest-of-season roster (${pctW('roster')}%).`}</b> Every player gets a consensus value from FantasyPros, DraftSharks and LeagueLogs half-PPR ROS rankings (LeagueLogs counts half, since it tracks the FantasyPros consensus closely). We build each team's best possible starting lineup from DraftSharks' weekly projections, discounted for games a player is expected to miss, then add a little for the bench.</p>
  <p><b>Scale.</b> Each input is compared to the rest of the league, so 50 is a dead-average team. The bars under each score show the four parts separately.</p>
  <p><b>Playoff odds.</b> 10,000 simulations of the remaining regular-season schedule, using each team's projected lineup blended with its actual scoring. Ties in the standings go to points for, like Sleeper.</p>
</>;

/**
 * held: a week is being played, so the ranks are on hold (no hero); hero: the hero's HTML from app.js (carousel, head,
 * desk), or null when held; head: the page head's inner HTML for the held page; rosError: why the ROS rankings are
 * missing; calm: reduced motion; poll: { on, question, store, onPick }.
 */
export function RankingsPage({ D, me, h, held, hero, head, rosError, calm, poll }) {
  const [open, setOpen] = useState(() => new Set());
  const [nudged, setNudged] = useState(() => !seen());
  const rows = useRef(new Map()), btns = useRef(new Map()), unpin = useRef(new Map());
  const wk = D.meta.lastScored + 1;

  const toggle = (rid, force) => {
    const li = rows.current.get(rid);
    const now = force ?? !open.has(rid);
    if (!li || now === open.has(rid)) return;
    // The jersey number is centred on the row. Pin it at its current pixel spot while the row is open so it neither
    // jumps nor drifts as the row grows; release the pin once the row has finished closing.
    const jersey = li.querySelector('.jersey');
    clearTimeout(unpin.current.get(rid));
    if (now) {
      jersey.style.top = `${jersey.getBoundingClientRect().top - li.getBoundingClientRect().top}px`;
      jersey.style.transform = 'none';
    } else {
      unpin.current.set(rid, setTimeout(() => { if (!li.classList.contains('open')) jersey.style.top = jersey.style.transform = ''; }, 450));
    }
    setOpen((s) => { const n = new Set(s); if (now) n.add(rid); else n.delete(rid); return n; });
    // the first open teaches it: the #1 row's amber pull goes quiet for good on this device
    if (now && nudged) { learn(); setNudged(false); }
  };
  const close = (rid) => {
    const li = rows.current.get(rid);
    toggle(rid, false);
    if (li && li.getBoundingClientRect().top < 0) li.scrollIntoView({ block: 'start' });
    btns.current.get(rid)?.focus({ preventScroll: true });
  };
  // your rank, right under the page head, so a phone doesn't scroll three screens to find you
  const mine = !held && me != null ? D.teams.find((t) => t.rid === me) : null;
  const jump = () => {
    const li = rows.current.get(mine.rid);
    if (!li) return;
    li.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    toggle(mine.rid, true);
  };

  return <>
    {held ? <section className="view-head" dangerouslySetInnerHTML={{ __html: head }} /> : <div className="hero" dangerouslySetInnerHTML={{ __html: hero }} />}
    {held ? <div className="notice glass hold"><span><strong>Power rankings are on hold.</strong>{` Week ${wk} is being played, so these are the ranks going into the week. They update as soon as every game is final. For how this week is going, see the `}<a href="#live">Live</a> tab.</span></div> : null}
    {rosError ? <div className="notice glass"><strong>Results-only mode.</strong>{` The rest-of-season rankings couldn't be loaded (${rosError}), so these ranks use this season's results alone until they come back.`}</div> : null}
    {mine ? <button type="button" className="you-strip glass" aria-label={`Jump to your team, ${mine.name}, ranked ${mine.powerRank}`} onClick={jump}>
      <Headshot t={mine} cls="strip-face" h={h} />
      <span className="ys-rank"><small>You're</small><b>{`No. ${mine.powerRank}`}</b></span>
      <span className="ys-body"><b>{mine.name}</b><span className="ys-tags"><span className={`tier ${mine.tier.key}`}>{mine.tier.label}</span><MoveTag t={mine} /></span></span>
      <span className="ys-odds"><b>{h.pct(mine.playoffPct)}</b><small>playoffs</small></span><Xp />
    </button> : null}
    <div id="poll-slot"><Poll D={D} h={h} poll={poll} /></div>
    <ol className="ranks">{D.teams.map((t) => (
      <RankRow key={t.rid} D={D} t={t} me={me} h={h} open={open.has(t.rid)} nudge={t.powerRank === 1 && nudged}
        onToggle={() => toggle(t.rid)} onClose={() => close(t.rid)}
        rowRef={(el) => { if (el) rows.current.set(t.rid, el); else rows.current.delete(t.rid); }}
        btnRef={(el) => { if (el) btns.current.set(t.rid, el); else btns.current.delete(t.rid); }} />
    ))}</ol>
    <Futures D={D} me={me} h={h} />
    <details className="panel glass method-box">
      <summary><h2>How the score works</h2><Xp /></summary>
      <div className="method">{METHOD(h.pctW)}</div>
    </details>
  </>;
}
