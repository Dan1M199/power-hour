// Team stories (Dan's request Nov 14, after Instagram's stories): a rail of manager faces under the headlines, each in a
// ring that's lit while that team has something you haven't watched, grey once you have. A tap opens the story full
// screen, out of the face you tapped: a few frames built from the snapshot (where they rank and how they moved, last
// week's game, their latest move, their odds), each with a progress bar along the top that runs on its own. Tap the
// right side for the next frame and the left for the one before, hold to pause, swipe sideways for the next team,
// swipe down to close. When a team's story ends the next one starts, the way a feed keeps going.
// What "watched" means is a signature of the frames (src/buzz/seen.js), so a ring lights up again only when that
// team's story actually changes: a new week scored, a new rank, a new move.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Headshot, Ring } from '../shared.jsx';
import { markStory, storySeen } from './seen.js';

const FRAME_MS = 5000;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// how long ago, the way a feed says it
function ago(ts, now) {
  const m = Math.max(1, Math.round((now - ts) / 60000));
  if (m < 60) return `${m}m`;
  const hr = Math.round(m / 60);
  return hr < 24 ? `${hr}h` : `${Math.round(hr / 24)}d`;
}
const listOf = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** One team's story: its frames and the signature that says whether this device has watched this version. */
export function storyOf(D, t, h, now) {
  const { f1, ordinal, pct } = h, frames = [], wk = D.meta.lastScored;
  // where they rank
  const mv = t.movement || 0;
  frames.push({
    kind: 'rank', stamp: `Week ${wk + 1}`,
    big: `No. ${t.powerRank}`, tier: t.tier,
    line: mv > 0 ? `Up ${mv} spot${mv === 1 ? '' : 's'} this week` : mv < 0 ? `Down ${-mv} spot${mv === -1 ? '' : 's'} this week` : 'Held their spot this week',
    dir: mv > 0 ? 'up' : mv < 0 ? 'down' : 'flat',
    sub: `${h.record(t)}, ${ordinal(t.seed)} in the standings`,
  });
  // last week's game
  const g = t.weeks?.[t.weeks.length - 1];
  if (g && g.oppPts != null) {
    const opp = D.byRid[g.opp], won = g.result === 'W';
    frames.push({
      kind: won ? 'won' : g.result === 'T' ? 'tie' : 'lost', stamp: `Week ${g.week}`,
      head: won ? 'Took the W' : g.result === 'T' ? 'Dead even' : 'Took the L',
      score: [f1(g.pts), f1(g.oppPts)], opp,
      sub: `${ordinal(g.rank)} best score in the league that week${g.optimal && g.optimal - g.pts > 8 ? `, with ${f1(g.optimal - g.pts)} left on the bench` : ''}.`,
    });
  }
  // the latest move, if it's from the last week or so
  const move = D.feed.find((f) => f.sides.some((x) => x.rid === t.rid));
  if (move && now - move.ts < 8 * 864e5) {
    const s = move.sides.find((x) => x.rid === t.rid), trade = move.type === 'trade';
    const names = (ps) => ps.map((p) => h.nameOf(p.id));
    frames.push({
      kind: 'move', stamp: ago(move.ts, now), trade,
      head: trade ? 'Made a trade' : s.adds.length ? 'Hit the wire' : 'Made a cut',
      ins: s.adds.map((p) => ({ id: p.id, name: h.nameOf(p.id), pos: h.posOf(p.id) })),
      outs: s.drops.map((p) => ({ id: p.id, name: h.nameOf(p.id), pos: h.posOf(p.id) })),
      net: D.meta.hasRos ? s.net : null,
      sub: trade
        ? `With ${listOf(move.sides.filter((x) => x.rid !== t.rid).map((x) => h.first(D.byRid[x.rid])))}.`
        : s.adds.length && s.drops.length ? `${listOf(names(s.adds))} in, ${listOf(names(s.drops))} out.` : '',
    });
  }
  // the odds
  frames.push({
    kind: 'odds', stamp: 'Season',
    odds: t.playoffPct, champ: t.champPct,
    head: t.playoffPct >= 0.9 ? 'Booking playoff flights' : t.playoffPct >= 0.6 ? 'In the hunt' : t.playoffPct >= 0.3 ? 'On the bubble' : t.playoffPct >= 0.08 ? 'Needs a miracle run' : 'Planning for next year',
    sub: t.champPct != null ? `${pct(t.champPct)} to win it all` : '',
  });
  const sig = `${wk}|${t.powerRank}|${move?.id || ''}`;
  return { t, sig, frames };
}

// ---------- the rail ----------
export function StoryRail({ D, me, h, streak, now }) {
  // the order is set once per page (yours first, then the unwatched by rank, then the rest), so rings don't jump
  // about while you watch; the lit/grey state follows along
  const stories = useMemo(() => D.teams.map((t) => storyOf(D, t, h, now)), [D]);
  const [order] = useState(() => {
    const unseen = (s) => (storySeen(s.t.rid, s.sig) ? 1 : 0);
    return [...stories].sort((a, b) => (b.t.rid === me) - (a.t.rid === me) || unseen(a) - unseen(b) || a.t.powerRank - b.t.powerRank);
  });
  const [, redraw] = useState(0);
  const [open, setOpen] = useState(null); // { i, from: {x, y} }
  const fresh = order.filter((s) => !storySeen(s.t.rid, s.sig)).length;
  const start = (i, e) => {
    const r = e.currentTarget.querySelector('.bz-ring').getBoundingClientRect();
    setOpen({ i, from: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
  };
  return (
    <section className="bz-rail glass" aria-label="Team stories">
      <div className="bz-rail-head">
        <h2>Stories</h2>
        <span className="bz-rail-sub">{fresh ? `${fresh} new since you last looked` : "You're all caught up"}</span>
        {streak ? <StreakChip s={streak} /> : null}
      </div>
      <div className="bz-rail-row">{order.map((s, i) => {
        const seen = storySeen(s.t.rid, s.sig), mine = s.t.rid === me;
        return (
          <button type="button" key={s.t.rid} className={`bz-face${seen ? ' seen' : ''}${mine ? ' mine' : ''}`} onClick={(e) => start(i, e)}
            aria-label={`${mine ? 'Your story' : `${h.first(s.t)}'s story`}${seen ? '' : ', new'}`}>
            <span className="bz-ring"><Headshot t={s.t} cls="bz-pic" h={h} />{mine ? null : <span className="bz-no">{s.t.powerRank}</span>}</span>
            <span className="bz-name">{mine ? 'Your story' : h.first(s.t)}</span>
          </button>
        );
      })}</div>
      {open ? <StoryViewer list={order} start={open.i} from={open.from} D={D} h={h} me={me}
        onSeen={(s) => { markStory(s.t.rid, s.sig); redraw((x) => x + 1); }} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

// the daily streak, a flame and the count; it glows on a milestone day
const Flame = ({ cls = '' }) => (
  <svg className={`bz-flame ${cls}`} viewBox="0 0 24 24" aria-hidden="true">
    <path className="fl-out" d="M12 1.6c.7 3.7 6.1 6.3 6.1 12.1a6.1 6.1 0 0 1-12.2 0c0-3.1 1.7-5.2 3.3-6.5.1 2.1 1 3.3 2.1 3.8-.4-3.6-.1-6.5.7-9.4z" />
    <path className="fl-in" d="M12.2 11.4c.4 1.9 3 3.1 3 5.9a3.2 3.2 0 0 1-6.4 0c0-1.5.8-2.6 1.6-3.2.1 1 .5 1.6 1 1.9-.1-1.7.2-3.2.8-4.6z" />
  </svg>
);
export { Flame };
function StreakChip({ s }) {
  return (
    <span className={`bz-streak${s.n >= 3 ? ' hot' : ''}`} title={`${s.n} day${s.n === 1 ? '' : 's'} in a row on The Power Hour. Best run: ${s.best}.`}>
      <Flame />{s.n === 1 ? 'Day 1' : `${s.n}-day streak`}
    </span>
  );
}

// ---------- the viewer ----------
function StoryViewer({ list, start, from, D, h, me, onSeen, onClose }) {
  const [ti, setTi] = useState(start), [fi, setFi] = useState(0), [paused, setPaused] = useState(false);
  const [dir, setDir] = useState(0); // the cube turn's direction when the team changes
  const [closing, setClosing] = useState(false);
  const stage = useRef(null), press = useRef(null);
  const s = list[ti], f = s.frames[fi];
  const still = calm();

  useEffect(() => { onSeen(s); }, [ti]);
  // the page holds still under the story: no scroll, the carousel and its clip wait, the dock and circle step aside
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('locked', 'focusing');
    stage.current?.focus();
    return () => root.classList.remove('locked', 'focusing');
  }, []);

  const close = () => {
    if (still) return onClose();
    setClosing(true);
    setTimeout(onClose, 260);
  };
  const toTeam = (d) => {
    const n = ti + d;
    if (n < 0) return setFi(0);
    if (n >= list.length) return close();
    setDir(d); setTi(n); setFi(0);
  };
  const next = () => (fi < s.frames.length - 1 ? setFi(fi + 1) : toTeam(1));
  const prev = () => (fi > 0 ? setFi(fi - 1) : toTeam(-1));

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });
  // under reduced motion the bars don't run, so the frames wait for a tap
  useEffect(() => {
    if (!still || paused) return undefined;
    const id = setTimeout(next, FRAME_MS * 1.6);
    return () => clearTimeout(id);
  }, [ti, fi, paused]);

  // one finger: a tap steps (left third back, the rest forward), a hold pauses, a swipe sideways changes team, a swipe
  // down closes; the card follows a downward drag
  const down = (e) => {
    if (e.target.closest('button')) return;
    press.current = { x: e.clientX, y: e.clientY, t: performance.now(), held: false, id: setTimeout(() => { press.current && (press.current.held = true); setPaused(true); }, 220) };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    if (dy > 0 && Math.abs(dy) > Math.abs(e.clientX - p.x)) stage.current.style.setProperty('--pull', `${dy}px`);
  };
  const up = (e) => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    clearTimeout(p.id);
    stage.current.style.removeProperty('--pull');
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (p.held) return setPaused(false);
    if (dy > 90 && dy > Math.abs(dx)) return close();
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return toTeam(dx < 0 ? 1 : -1);
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const r = e.currentTarget.getBoundingClientRect();
      (e.clientX - r.left < r.width / 3 ? prev : next)();
    }
  };
  const cancel = () => { const p = press.current; if (p) { clearTimeout(p.id); press.current = null; setPaused(false); stage.current?.style.removeProperty('--pull'); } };

  const opp = f.opp;
  return createPortal(
    <div className={`bz-viewer${closing ? ' out' : ''}`} role="dialog" aria-modal="true" aria-label={`${s.t.name}'s story`}
      style={{ '--ox': `${from.x}px`, '--oy': `${from.y}px` }} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={stage} tabIndex="-1" className={`bz-stage k-${f.kind}${paused ? ' paused' : ''}`} key={ti} data-dir={dir}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onContextMenu={(e) => e.preventDefault()}>
        <div className="bz-bars">{s.frames.map((_, i) => (
          <span key={i} className={i < fi ? 'done' : i === fi ? 'on' : ''}>
            {i === fi ? <i key={`${ti}-${fi}`} style={{ animationDuration: `${FRAME_MS}ms` }} onAnimationEnd={next} /> : <i />}
          </span>
        ))}</div>
        <header className="bz-top">
          <Headshot t={s.t} cls="bz-top-pic" h={h} />
          <span className="bz-top-who"><b>{s.t.rid === me ? 'Your story' : s.t.name}</b><small>{f.stamp}</small></span>
          <button type="button" className="bz-x" aria-label="Close the story" onClick={close}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="bz-body" key={fi}>
          {f.kind === 'rank' ? <>
            <p className="bz-kick">Power rank</p>
            <p className="bz-big">{f.big}</p>
            <span className={`tier ${f.tier.key}`}>{f.tier.label}</span>
            <p className={`bz-line ${f.dir}`}>{f.dir === 'up' ? '▲ ' : f.dir === 'down' ? '▼ ' : ''}{f.line}</p>
            <p className="bz-sub">{f.sub}</p>
          </> : null}
          {f.kind === 'won' || f.kind === 'lost' || f.kind === 'tie' ? <>
            <p className="bz-kick">{f.head}</p>
            <div className="bz-score">
              <span className="bz-me"><Headshot t={s.t} cls="bz-score-pic" h={h} /><b>{f.score[0]}</b></span>
              <span className="bz-vs">vs</span>
              <span>{opp ? <Headshot t={opp} cls="bz-score-pic" h={h} /> : null}<b>{f.score[1]}</b></span>
            </div>
            <p className="bz-line">{opp ? `${f.kind === 'won' ? 'Beat' : f.kind === 'lost' ? 'Lost to' : 'Tied'} ${opp.name}` : ''}</p>
            <p className="bz-sub">{f.sub}</p>
          </> : null}
          {f.kind === 'move' ? <>
            <p className="bz-kick">{f.head}</p>
            <ul className="bz-players">
              {f.ins.map((p) => <li key={`i${p.id}`} className="in"><span className="sign">+</span><Player id={p.id} />{`${p.name} `}<small>{p.pos}</small></li>)}
              {f.outs.map((p) => <li key={`o${p.id}`} className="out"><span className="sign">−</span><Player id={p.id} />{`${p.name} `}<small>{p.pos}</small></li>)}
            </ul>
            {f.net != null ? <p className={`bz-line ${f.net >= 0 ? 'up' : 'down'}`}>{`${f.net >= 0 ? '+' : ''}${h.f1(f.net)} in consensus value`}</p> : null}
            {f.sub ? <p className="bz-sub">{f.sub}</p> : null}
          </> : null}
          {f.kind === 'odds' ? <>
            <p className="bz-kick">Playoff odds</p>
            <div className="bz-odds"><Ring v={f.odds} mine={s.t.rid === me}><b>{h.pct(f.odds)}</b></Ring></div>
            <p className="bz-line">{f.head}</p>
            {f.sub ? <p className="bz-sub">{f.sub}</p> : null}
          </> : null}
        </div>
        <p className="bz-hint" aria-hidden="true">{paused ? 'Paused' : `${ti + 1} of ${list.length}`}</p>
      </div>
    </div>,
    document.body,
  );
}

// a player's Sleeper headshot (cross-origin friendly), or nothing if it won't load
function Player({ id }) {
  const [bad, setBad] = useState(false);
  if (bad || !/^\d+$/.test(id)) return <span className="bz-pl ph" aria-hidden="true" />;
  return <img className="bz-pl" src={`https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`} alt="" loading="lazy" onError={() => setBad(true)} />;
}
