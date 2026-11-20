// What would have happened (the Lab's What if section, #lab/whatif; Dan's requests Nov 20): tap a player on your
// roster and a tray slides out with the players you could have had instead (anyone still on the board at that pick, or
// anyone at all), each with the record he'd have given you. Pick one and every week is replayed. On a phone the tray is a
// sheet from the bottom of the screen (transform only, swipe it down to close); from 761px it opens under the row.
// The numbers are lib/whatif.js; the draft board and the waiver-week points come from /api/history
// (src/lab/history.js), fetched when the section opens.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { seasonBook, draftBoard, whatIf, bestSwaps, candidatePool, swapRow, everRostered } from '../../lib/whatif.js';
import { historyStore, loadHistory } from './history.js';
import { PosTag, TeamAvatar } from '../shared.jsx';

const ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };
const keep = {}; // per team, for the visit: { choice: {out, inn, auto}, modes: {out: mode} }
const rec = (x) => `${x.w}-${x.l}${x.t ? `-${x.t}` : ''}`;
const signed = (x, f) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${f(Math.abs(x))}`;
const winsSaid = (dw) => (dw ? `${signed(dw, String)} ${Math.abs(dw) === 1 ? 'win' : 'wins'}` : 'Same record');
const PHONE = '(max-width: 760px)';
const usePhone = () => useSyncExternalStore((f) => { const m = matchMedia(PHONE); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, () => matchMedia(PHONE).matches);
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 40));
const unidle = (hnd) => (window.cancelIdleCallback ? cancelIdleCallback(hnd) : clearTimeout(hnd));

function Face({ id, cls = 'wi-face' }) {
  const [bad, setBad] = useState(false);
  const num = /^\d+$/.test(id);
  if (bad || !num) return <span className={`${cls} ph`} aria-hidden="true">{num ? '' : id}</span>;
  return <img className={cls} src={`https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
}

// the chart is drawn at the width it's shown, so its type and bars keep their size on a phone
function useWidth(fallback) {
  const ref = useRef(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => { const x = Math.round(e.contentRect.width); if (x > 0) setW((old) => (Math.abs(old - x) > 1 ? x : old)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// the book (every scored week, indexed) is built once per league and history, and so is each player's list of
// alternatives (`best`, by team, player and mode), so a tray that has been worked out opens at once
function cacheFor(D, raw, body) {
  const c = D._whatif;
  if (c && c.body === body) return c;
  const book = seasonBook(D, raw, body);
  return (D._whatif = { body, book, board: draftBoard(book, raw), best: new Map() });
}

export function WhatIf({ D, raw, me, h, demo }) {
  const hs = historyStore.use();
  useEffect(() => { loadHistory({ demo }); }, [demo]);
  if (!me) return <section className="panel glass span-12 wi-empty"><h2>Pick your team first</h2><p className="sub">{'Choose your team in the box above and your roster lines up here: every player you drafted or picked up this season.'}</p></section>;
  if (!hs) return <section className="panel glass span-12 wi-wait" aria-busy="true"><span className="wi-spin" aria-hidden="true" /><p>{'Getting the draft board and every week of stats.'}</p></section>;
  return <Tool D={D} raw={raw} me={me} h={h} hs={hs} />;
}

function Tool({ D, raw, me, h, hs }) {
  const cache = cacheFor(D, raw, hs.body);
  const { book, board } = cache;
  const { ordinal, short } = h;
  const t = D.byRid[me];
  const name = book.nameOf, pos = book.posOf;
  const phone = usePhone();

  // your players: your draft picks in order, then today's pickups; the ones who came and went are a tap away
  const mine = useMemo(() => {
    const ever = everRostered(book, me);
    const drafted = board ? board.picks.filter((p) => p.rid === me) : [];
    const draftedIds = new Set(drafted.map((p) => p.id));
    const rows = [
      ...drafted.map((p) => ({ id: p.id, pick: p, now: t.players.includes(p.id) })),
      ...[...ever].filter((id) => !draftedIds.has(id) && pos(id)).map((id) => ({ id, pick: null, now: t.players.includes(id) })),
    ];
    return rows.sort((a, b) => (a.pick && b.pick ? a.pick.no - b.pick.no : a.pick ? -1 : b.pick ? 1
      : (ORDER[pos(a.id)] ?? 9) - (ORDER[pos(b.id)] ?? 9) || book.total(b.id) - book.total(a.id)));
  }, [book, board, me]);
  const [all, setAll] = useState(false);
  const passing = mine.filter((x) => !x.pick && !x.now);

  const saved = (keep[me] ||= { modes: {} });
  const ownPick = (id) => (board?.byId[id]?.rid === me ? board.byId[id] : null);
  const [modes, setModes] = useState(saved.modes);
  const modeOf = (id) => (ownPick(id) ? modes[id] || 'board' : 'any');
  const bestFor = (id, mode = modeOf(id)) => {
    const k = `${me}|${id}|${mode}`;
    if (!cache.best.has(k)) cache.best.set(k, bestSwaps(book, { rid: me, out: id, board, beforePick: mode === 'board' ? ownPick(id)?.no : null, limit: 8 }));
    return cache.best.get(k);
  };
  const ready = (id) => cache.best.has(`${me}|${id}|${modeOf(id)}`);

  // the replay on show: the one you picked, or to start with your first player's best alternative
  const [choice, setChoiceRaw] = useState(() => {
    if (saved.choice) return saved.choice;
    const first = mine[0]?.id, b = first && bestFor(first).list[0];
    return b ? { out: first, inn: b.id, auto: true } : null;
  });
  const setChoice = (c) => { saved.choice = c; setChoiceRaw(c); };
  const res = useMemo(() => (choice ? whatIf(book, { rid: me, out: choice.out, inn: choice.inn }) : null), [book, me, choice?.out, choice?.inn]);

  // each row's best alternative, worked out a player at a time while the page is idle
  const [, bump] = useState(0);
  useEffect(() => {
    const todo = mine.map((x) => x.id).filter((id) => !ready(id));
    let hnd = null, alive = true;
    const next = () => {
      const id = todo.shift();
      if (!alive || !id) return;
      bestFor(id);
      bump((n) => n + 1);
      hnd = idle(next);
    };
    hnd = idle(next);
    return () => { alive = false; unidle(hnd); };
  }, [mine, modes]);

  // the tray: one open at a time. On desktop the one closing keeps its words while it folds away.
  const [open, setOpen] = useState(null);
  const [closing, setClosing] = useState(null);
  const [sheetFor, setSheetFor] = useState(null);
  const rowRefs = useRef({});
  const toggle = (id) => {
    if (open === id) { setClosing(id); setOpen(null); return; }
    setClosing(open); setOpen(id); setSheetFor(id);
  };
  const close = () => { setClosing(open); setOpen(null); };
  const toResult = () => {
    const go = () => document.getElementById('wi-result')?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
    if (phone && open) { close(); setTimeout(go, 340); } else go();
  };

  const whereFrom = (id) => {
    const p = board?.byId[id];
    if (p) return `Drafted ${ordinal(p.no)} by ${short(D.byRid[p.rid]?.name || 'someone', 16)}`;
    if (board) return 'Undrafted';
    const now = D.teams.find((x) => x.players.includes(id));
    return now ? `On ${short(now.name, 16)} now` : 'Free agent';
  };
  const lastName = (id) => { const n = name(id); return pos(id) === 'DEF' ? n.split(' ').slice(-1)[0] : n.split(' ').slice(1).join(' ') || n; };

  const tray = (id) => (
    <Tray key={`${id}|${modeOf(id)}`} id={id} pick={ownPick(id)} mode={modeOf(id)} best={bestFor(id)} book={book} board={board} me={me} h={h} phone={phone}
      onMode={(m) => { const x = { ...modes, [id]: m }; saved.modes = x; setModes(x); }}
      choice={choice} res={res} onPick={(inn) => setChoice({ out: id, inn })} onResult={toResult} whereFrom={whereFrom} />
  );

  const missing = hs.error ? `The draft board and waiver-week stats didn't load (${hs.error}), so this runs on the league snapshot alone: a player only scores in weeks someone rostered him.`
    : hs.demo && !hs.body ? 'The demo snapshot has no draft board or waiver-week stats: a player only scores in weeks someone rostered him, and benches aren\'t saved.'
    : hs.body?.errors?.length ? `Some of Sleeper's data is missing for now (${hs.body.errors.join('; ')}). It's retried within the hour.` : null;

  return <>
    {missing ? <div className="notice glass span-12 wi-note">{missing}</div> : null}
    <section className="panel glass wi-list">
      <h2>{'Your players'}</h2>
      <p className="sub">{board ? 'Tap a player to see who you could have drafted with that pick instead.' : 'Tap a player to see who you could have had instead.'}</p>
      <ul className="wi-rows">
        {mine.filter((x) => all || x.pick || x.now || x.id === choice?.out).map((x) => {
          const b = ready(x.id) ? bestFor(x.id).list[0] : null, isOpen = open === x.id, chosen = choice?.out === x.id && !choice.auto;
          const swap = chosen ? res && { id: choice.inn, dw: res.after.w + res.after.t / 2 - (res.before.w + res.before.t / 2) } : b;
          return (
            <li key={x.id} className={`${isOpen ? 'open' : ''}${chosen ? ' chosen' : ''}`}>
              <button type="button" className="wi-row" ref={(el) => (rowRefs.current[x.id] = el)} aria-expanded={isOpen} aria-controls={phone ? undefined : `wi-tray-${x.id}`} onClick={() => toggle(x.id)}>
                <Face id={x.id} />
                <span className="wi-row-who">
                  <b>{name(x.id)}</b>
                  <small><PosTag pos={pos(x.id)} />{`${x.pick ? `Round ${x.pick.round}, ${ordinal(x.pick.no)}` : 'Picked up'}${x.now ? '' : ', gone'}`}</small>
                </span>
                <span className={`wi-row-best${swap ? '' : ' wait'}`}>
                  {swap ? <>
                    <small>{chosen ? 'Replaying with' : 'Best instead'}</small>
                    <b>{lastName(swap.id)}</b>
                    <em className={swap.dw > 0 ? 'up' : swap.dw < 0 ? 'down' : ''}>{winsSaid(swap.dw)}</em>
                  </> : <i aria-hidden="true" />}
                </span>
                <span className="wi-chev" aria-hidden="true"><svg width="14" height="9" viewBox="0 0 14 9"><path d="M1.5 1.5l5.5 5.5 5.5-5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </button>
              {phone ? null : (
                <div className="wi-drawer" id={`wi-tray-${x.id}`} data-open={isOpen} onTransitionEnd={(e) => { if (e.target === e.currentTarget && closing === x.id) setClosing(null); }}>
                  <div className="wi-drawer-in">{isOpen || closing === x.id ? tray(x.id) : null}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {passing.length ? <button type="button" className="wi-more" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show fewer players' : `Show ${passing.length} more who came and went`}</button> : null}
    </section>
    {res ? <Summary D={D} book={book} res={res} h={h} auto={choice.auto} pick={ownPick(choice.out)} mode={modeOf(choice.out)} />
      : <section className="panel glass wi-res" id="wi-result"><h2>{'Your replay shows up here'}</h2><p className="sub">{'Tap a player, then pick someone to put in his place.'}</p></section>}
    {res ? <Detail D={D} book={book} res={res} h={h} /> : null}
    {phone ? <Sheet open={open != null} onClose={close} returnTo={() => rowRefs.current[sheetFor]} label={sheetFor ? `Instead of ${name(sheetFor)}` : ''}>
      {sheetFor ? tray(sheetFor) : null}
    </Sheet> : null}
  </>;
}

// the tray's contents: who you'd swap out, the two ways to look, the best three (eight with More, plus a search), and
// once one is picked, the verdict and the way to the full replay
function Tray({ id, pick, mode, best, book, board, me, h, phone, onMode, choice, res, onPick, onResult, whereFrom }) {
  const { f1, ordinal } = h;
  const name = book.nameOf, pos = book.posOf;
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  const pool = useMemo(() => (more ? candidatePool(book, { rid: me, out: id, board, beforePick: mode === 'board' ? pick?.no : null }) : []), [more, mode]);
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return null;
    return pool.filter((x) => name(x.id).toLowerCase().includes(s)).slice(0, 5).map((x) => swapRow(book, { rid: me, out: id, inn: x.id }));
  }, [q, pool]);
  const list = found || best.list.slice(0, more ? 8 : 3);
  const picked = choice?.out === id && !choice.auto ? choice.inn : null;
  const live = picked && res && res.out === id && res.inn === picked ? res : null;
  const games = book.games(id);

  return (
    <div className="wi-tray">
      <div className="wi-tray-head">
        <Face id={id} cls="wi-face out" />
        <div>
          <h3>{`Instead of ${name(id)}`}</h3>
          <p>{`${pick ? `Round ${pick.round}, ${ordinal(pick.no)} overall. ` : ''}${f1(book.total(id))} points in ${games} ${games === 1 ? 'game' : 'games'}.`}</p>
        </div>
      </div>
      {pick ? (
        <div className="wi-seg" role="group" aria-label="Who you could have had">
          <button type="button" aria-pressed={mode === 'board'} onClick={() => onMode('board')}>{`On the board at ${ordinal(pick.no)}`}</button>
          <button type="button" aria-pressed={mode === 'any'} onClick={() => onMode('any')}>{'Anyone'}</button>
        </div>
      ) : null}
      {list.length ? (
        <ul className="wi-alts" aria-label={`Players you could have had instead of ${name(id)}`}>
          {list.map((x) => (
            <li key={x.id}>
              <button type="button" className="wi-alt" aria-pressed={x.id === picked} onClick={() => onPick(x.id)}>
                <Face id={x.id} />
                <span className="wi-alt-who"><b>{name(x.id)}</b><small><PosTag pos={pos(x.id)} />{whereFrom(x.id)}</small></span>
                <span className="wi-alt-rec">
                  <b>{rec(x.after)}</b>
                  <em className={x.dw > 0 ? 'up' : x.dw < 0 ? 'down' : ''}>{winsSaid(x.dw)}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="wi-none">{found ? (mode === 'board' ? 'Nobody by that name was still on the board, or he never played.' : 'No player by that name scored this season.') : 'Nobody here scored this season.'}</p>}
      {more ? (
        <label className="wi-search"><span className="sr-only">{'Find a player'}</span>
          <input type="search" placeholder={mode === 'board' ? 'Find anyone still on the board' : 'Find any player'} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
        </label>
      ) : best.list.length > 3 ? <button type="button" className="wi-more" onClick={() => setMore(true)}>{'More players, or search'}</button> : null}
      {live ? (
        <div className="wi-tray-foot" aria-live="polite">
          <p>{`With ${name(picked)} you'd be `}<b>{`${rec(live.after)} and ${ordinal(live.after.seed)}`}</b>{`, instead of ${rec(live.before)} and ${ordinal(live.before.seed)}.`}</p>
          <button type="button" className="wi-go" onClick={onResult}>{phone ? 'See every week' : 'See week by week'}</button>
        </div>
      ) : null}
    </div>
  );
}

// a sheet from the bottom of the screen (phones): slides with a transform, the page behind dims and stops scrolling;
// swipe it down, tap the dimmed page, tap Close or press Escape to close. Focus goes in on open and back to the row.
function Sheet({ open, onClose, returnTo, label, children }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const sheet = useRef(null), drag = useRef(null);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const a = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(a);
    }
    setShown(false);
    if (calm()) setMounted(false); // no transition to wait for
    return undefined;
  }, [open]);
  useEffect(() => {
    if (!mounted) return undefined;
    document.documentElement.classList.add('locked');
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', key);
    return () => { document.documentElement.classList.remove('locked'); removeEventListener('keydown', key); };
  }, [mounted]);
  const was = useRef(false);
  useEffect(() => {
    if (shown) sheet.current?.focus({ preventScroll: true });
    else if (was.current) returnTo()?.focus({ preventScroll: true });
    was.current = shown;
  }, [shown]);

  // the drag: the sheet follows the finger down (never up past its place) and lets go past a third of its height or on
  // a quick flick. It starts from the grip, or anywhere once the sheet's own list is scrolled to the top; on a button
  // a finger has to travel 12px first, so a tap that wobbles is still a tap.
  const down = (e) => {
    const body = sheet.current.querySelector('.wi-sheet-body'), grip = e.target.closest('.wi-sheet-grip');
    if (!grip && body.scrollTop > 0) return;
    if (e.target.closest('input')) return;
    drag.current = { y: e.touches[0].clientY, t: performance.now(), dy: 0, soft: !grip && !!e.target.closest('button') };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    if (!d.on && d.dy < (d.soft ? 12 : 4)) return;
    d.on = true;
    if (e.cancelable) e.preventDefault();
    sheet.current.style.transition = 'none';
    sheet.current.style.transform = `translateY(${d.dy}px)`;
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on) return;
    const el = sheet.current, fast = d.dy / Math.max(1, performance.now() - d.t) > 0.6;
    el.style.transition = '';
    el.style.transform = '';
    if (d.dy > el.offsetHeight / 3 || (fast && d.dy > 40)) onClose();
  };
  // touchmove must be able to stop the page from scrolling while the sheet is dragged, so it's not passive
  useEffect(() => {
    const el = sheet.current;
    if (!el) return undefined;
    el.addEventListener('touchmove', move, { passive: false });
    return () => el.removeEventListener('touchmove', move);
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div className={`wi-sheet-wrap${shown ? ' in' : ''}`}>
      <div className="wi-scrim" onClick={onClose} aria-hidden="true" />
      <div className="wi-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
        onTouchStart={down} onTouchEnd={up} onTouchCancel={up}
        onTransitionEnd={(e) => { if (e.target === sheet.current && !shown) setMounted(false); }}>
        <div className="wi-sheet-grip"><span aria-hidden="true" /><button type="button" className="wi-sheet-x" onClick={onClose}>{'Close'}</button></div>
        <div className="wi-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// the replay at a glance: who for whom, the record before and after, what moved, and the margin each week
function Summary({ D, book, res, h, auto, pick, mode }) {
  const { f1, ordinal } = h;
  const name = book.nameOf, team = (rid) => D.byRid[rid];
  const X = name(res.out), Y = name(res.inn);
  const b = res.before, a = res.after;
  const dw = a.w + a.t / 2 - (b.w + b.t / 2), dpf = a.pf - b.pf, dseed = (b.seed || 0) - (a.seed || 0);
  const used = res.weeks.filter((x) => ['swap', 'start', 'nofit-start'].includes(x.how));
  const inPts = used.reduce((s, x) => s + (x.inPts || 0), 0);
  const hurt = res.weeks.filter((x) => x.hitOpp && x.lost);
  const cut = D.meta.playoffTeams;
  const lead = pick && mode === 'board' ? `Draft ${Y} instead of ${X} with the ${ordinal(pick.no)} pick` : `Swap ${X} for ${Y} all season`;
  const verdict = `${lead} and you'd be ${rec(a)} and ${ordinal(a.seed)}${a.seed <= cut && b.seed > cut ? ', in the playoff spots' : a.seed > cut && b.seed <= cut ? ', out of the playoff spots' : ''}, instead of ${rec(b)} and ${ordinal(b.seed)}.`;
  const more = [
    used.length ? `${Y} would have started ${used.length} of ${res.weeks.length} weeks for you, ${f1(inPts)} points in your lineup.` : `${Y} would never have cracked your lineup.`,
    hurt.length ? `${hurt.length === 1 ? 'Once' : `${hurt.length} times`} you'd have played the team that lost him.` : '',
  ].filter(Boolean).join(' ');

  const [figRef, figW] = useWidth(640);
  const W = Math.max(280, figW), H = W < 500 ? 170 : 200, pad = 26, mid = (H - pad) / 2 + 4;
  const ms = res.weeks.filter((x) => x.opp != null);
  const max = Math.max(10, ...ms.flatMap((x) => [Math.abs(x.was[0] - x.was[1]), Math.abs(x.now[0] - x.now[1])])) * 1.1;
  const bw = W / Math.max(1, ms.length), Y0 = (v) => mid - (v / max) * (mid - 8);

  return (
    <section className="panel glass wi-res" id="wi-result">
      {auto ? <p className="wi-auto">{'Showing your first pick to start. Tap any player to try another.'}</p> : null}
      <div className="wi-swap">
        <span className="wi-p out"><Face id={res.out} /><small>{X}</small></span>
        <svg className="wi-arrow" width="34" height="16" viewBox="0 0 34 16" aria-hidden="true"><path d="M2 8h28M24 3l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="wi-p in"><Face id={res.inn} /><small>{Y}</small></span>
      </div>
      <div className="wi-score">
        <div className="wi-big"><small>{'Real record'}</small><b className="was">{rec(b)}</b></div>
        <svg className="wi-arrow" width="34" height="16" viewBox="0 0 34 16" aria-hidden="true"><path d="M2 8h28M24 3l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div className="wi-big"><small>{'What if'}</small><b>{rec(a)}</b></div>
      </div>
      <ul className="wi-chips">
        <li className={dw > 0 ? 'up' : dw < 0 ? 'down' : ''}>{winsSaid(dw)}</li>
        <li className={dseed > 0 ? 'up' : dseed < 0 ? 'down' : ''}>{`${ordinal(a.seed)} in the standings${dseed ? `, ${dseed > 0 ? 'up' : 'down'} ${Math.abs(dseed)}` : ''}`}</li>
        <li className={dpf > 0.05 ? 'up' : dpf < -0.05 ? 'down' : ''}>{`${signed(dpf, f1)} points for`}</li>
        <li>{`${res.flips.length} ${res.flips.length === 1 ? 'game flips' : 'games flip'}`}</li>
      </ul>
      <p className="wi-verdict">{verdict}</p>
      <p className="sub">{more}</p>
      <figure className="wi-chart" ref={figRef}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your margin each week, real and what if">
          <rect x="0" y="0" width={W} height={H - pad + 8} rx="16" className="wi-plate" />
          <line x1="10" x2={W - 10} y1={mid} y2={mid} className="wi-zero" />
          {ms.map((x, i) => {
            const m0 = x.was[0] - x.was[1], m1 = x.now[0] - x.now[1], cx = i * bw + bw / 2, w1 = Math.min(30, bw * 0.42);
            const flip = x.res[0] !== x.res[1], o = team(x.opp);
            const tip = `Week ${x.w} vs ${o.name}: ${f1(x.was[0])}–${f1(x.was[1])} (${x.res[0]}) for real, ${f1(x.now[0])}–${f1(x.now[1])} (${x.res[1]}) what if`;
            const top = (m) => Math.min(Y0(m), mid), hgt = (m) => Math.max(1.5, Math.abs(Y0(m) - mid));
            return <g key={x.w} data-tip={tip} className={flip ? 'flip' : ''}>
              <rect x={cx - bw / 2} y="0" width={bw} height={H - pad + 8} fill="transparent" />
              {flip ? <rect x={cx - w1 / 2 - 7} y="6" width={w1 + 14} height={H - pad - 4} rx="12" className="wi-flipband" /> : null}
              <rect x={cx - w1 / 2} y={top(m0)} width={w1} height={hgt(m0)} rx="5" className="wi-was" />
              <rect x={cx - w1 / 2 + 5} y={top(m1)} width={Math.max(2, w1 - 10)} height={hgt(m1)} rx="4" className={m1 > 0 ? 'wi-now win' : m1 < 0 ? 'wi-now loss' : 'wi-now'} />
              <text x={cx} y={H - 6} textAnchor="middle" className="wi-axis">{x.w}</text>
            </g>;
          })}
        </svg>
        <figcaption>{'Your margin each week: the outline is what happened, the bar inside is the what if (above the line a win, below a loss). Flipped games are shaded. Tap a week for the scores.'}</figcaption>
      </figure>
    </section>
  );
}

// week by week, the standings what if, and how it works
function Detail({ D, book, res, h }) {
  const { f1, short } = h;
  const name = book.nameOf, team = (rid) => D.byRid[rid];
  const X = name(res.out), Y = name(res.inn);
  const said = (x) => {
    const p = (id) => f1(book.pts(x.w, id));
    const opp = x.opp != null ? team(x.opp) : null;
    const lostTxt = x.hitOpp && x.lost ? ` ${short(opp.name, 22)} would have played without him: ${x.lost.filler ? `${name(x.lost.filler)} (${f1(x.lost.pts)})` : 'an empty slot'} in place of his ${f1(x.inPts ?? 0)}.` : '';
    switch (x.how) {
      case 'had': return `${Y} was already yours this week.`;
      case 'swap': return `${Y} scores ${f1(x.inPts)} in ${X}'s spot (${X} had ${f1(x.outPts)}).${lostTxt}`;
      case 'off': return `${Y} didn't play. ${x.filler ? `${name(x.filler)} (${p(x.filler)}) fills ${X}'s spot` : `${X}'s spot sits empty`} (${X} had ${f1(x.outPts)}).${lostTxt}`;
      case 'nofit': return `${Y} can't play ${X}'s ${x.slot} spot: ${x.filler ? `${name(x.filler)} (${p(x.filler)}) fills it` : 'it sits empty'} (${X} had ${f1(x.outPts)}), and ${Y} sits.${lostTxt}`;
      case 'nofit-start': return `${Y} can't play ${X}'s ${x.slot} spot, so ${x.filler ? `${name(x.filler)} (${p(x.filler)}) fills it` : 'it sits empty'} (${X} had ${f1(x.outPts)}), but ${Y} (${f1(x.inPts)}) starts ${x.benched ? `over ${name(x.benched)} (${p(x.benched)})` : 'in an empty slot'}.${lostTxt}`;
      case 'start': return `${X} ${x.outPts == null && !book.rows[x.w][res.rid].players.has(res.out) ? "isn't on your roster" : 'sits'}; ${Y} (${f1(x.inPts)}) starts ${x.benched ? `over ${name(x.benched)} (${p(x.benched)})` : 'in an empty slot'}.${lostTxt}`;
      case 'bench': return book.avg(x.w, res.inn) == null
        ? `${Y} (${f1(x.inPts)}) sits on your bench: no games yet to start him on.${lostTxt}`
        : `${Y} (${f1(x.inPts)}) sits on your bench: his average so far doesn't beat your starters.${lostTxt}`;
      case 'idle': return `${Y} didn't play.${lostTxt}`;
      default: return lostTxt.trim() || 'No change.';
    }
  };
  return <>
    <section className="panel glass wi-weeks">
      <h2>{'Week by week'}</h2>
      <ol>
        {res.weeks.map((x) => {
          const o = x.opp != null ? team(x.opp) : null, flip = x.res[0] !== x.res[1];
          const moved = flip || x.now[0] !== x.was[0] || x.now[1] !== x.was[1];
          return <li key={x.w} className={flip ? 'flip' : ''}>
            <div className="wi-wk-top">
              <span className="wi-wk">{`Week ${x.w}`}</span>
              <span className="wi-vs">{o ? `vs ${short(o.name, 20)}` : ''}</span>
              {flip ? <span className="wi-flip-tag">{x.res[1] === 'W' ? 'Now a win' : x.res[1] === 'L' ? 'Now a loss' : 'Now a tie'}</span> : null}
            </div>
            <div className="wi-sc">
              <span className={`r ${x.res[0]}`}>{`${x.res[0] || ''} ${f1(x.was[0])}–${f1(x.was[1])}`}</span>
              {moved ? <><span className="to" aria-label="becomes">{'→'}</span><span className={`r ${x.res[1]} now`}>{`${x.res[1] || ''} ${f1(x.now[0])}–${f1(x.now[1])}`}</span></> : null}
            </div>
            <p>{said(x)}</p>
          </li>;
        })}
      </ol>
    </section>
    <section className="panel glass wi-table">
      <h2>{'The standings, what if'}</h2>
      <p className="sub">{`Everyone's record with ${Y} on your team all season. Top ${D.meta.playoffTeams} make the playoffs.`}</p>
      <table>
        <thead><tr><th>{'#'}</th><th>{'Team'}</th><th>{'Record'}</th><th>{'Was'}</th></tr></thead>
        <tbody>
          {res.table.map((x) => {
            const tm = team(x.rid), mv = x.was.seed - x.seed;
            return <tr key={x.rid} className={`${x.rid === res.rid ? 'mine' : ''}${x.seed === D.meta.playoffTeams ? ' cut' : ''}`}>
              <td>{x.seed}</td>
              <td><span className="wi-tm"><TeamAvatar t={tm} cls="avatar xs" />{short(tm.name, 20)}</span></td>
              <td>{rec(x)}</td>
              <td><span className={mv > 0 ? 'up' : mv < 0 ? 'down' : ''}>{`${rec(x.was)}${mv ? ` (${mv > 0 ? '+' : '−'}${Math.abs(mv)})` : ''}`}</span></td>
            </tr>;
          })}
        </tbody>
      </table>
    </section>
    <section className="panel glass wi-how">
      <h2>{'How it works'}</h2>
      <ul>
        <li>{`In every week ${X} started for you, ${Y} takes his spot (trading places with a starter when he plays another position). If ${Y} was on a bye or hurt, your best benched player who fits fills in.`}</li>
        <li>{`In the other weeks ${Y} is on your bench, and starts over your weakest starter at his position when his average so far beats that starter's.`}</li>
        <li>{`Whoever really had ${Y} plays without him: their best benched player who fits takes his spot. So when you'd have faced them, they're weaker too. ${X} stays wherever he went, and everyone else's lineups are as they were.`}</li>
        <li>{'Bench calls use only the weeks before (points per game played), never that week\'s points. Points are the league\'s own scoring; weeks a player sat on waivers use Sleeper\'s half-PPR stats. Standings are wins, then points for.'}</li>
      </ul>
    </section>
  </>;
}
