// What would have happened (the Lab's What if section, #lab/whatif; Dan's requests Nov 20): tap a player on your
// roster and a tray slides out with the players you could have had instead (anyone still on the board at that pick, or
// anyone at all), each with the record he'd have given you. Pick one and every week is replayed; swap as many players
// as you like (each row crossed out with its X to undo, Clear changes over the list). On a phone the tray is a
// sheet from the bottom of the screen (transform only, swipe it down to close); from 761px it opens under the row.
// The numbers are lib/whatif.js; the draft board and the waiver-week points come from /api/history
// (src/lab/history.js), fetched when the section opens.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { seasonBook, draftBoard, whatIf, bestSwaps, candidatePool, swapRow, everRostered, recordWith } from '../../lib/whatif.js';
import { historyStore, loadHistory } from './history.js';
import { PosTag, TeamAvatar } from '../shared.jsx';

const ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };
const keep = {}; // per team, for the visit: { swaps: [{out, inn}], modes: {out: mode} }
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

  const saved = (keep[me] ||= { modes: {}, swaps: [] });
  const ownPick = (id) => (board?.byId[id]?.rid === me ? board.byId[id] : null);
  const [modes, setModes] = useState(saved.modes);
  const modeOf = (id) => (ownPick(id) ? modes[id] || 'board' : 'any');

  // your changes: any number of swaps at once, one per player of yours
  const [swaps, setSwapsRaw] = useState(saved.swaps);
  const setSwaps = (x) => { saved.swaps = x; setSwapsRaw(x); };
  const swapOf = (id) => swaps.find((x) => x.out === id) || null;
  const othersOf = (id) => swaps.filter((x) => x.out !== id);
  const sig = (list) => list.map((x) => `${x.out}>${x.inn}`).sort().join(',');
  // each player's alternatives, on top of your other changes, cached by player, mode and those changes
  const keyOf = (id, mode = modeOf(id)) => `${me}|${id}|${mode}|${sig(othersOf(id))}`;
  const bestFor = (id, mode = modeOf(id)) => {
    const k = keyOf(id, mode);
    if (!cache.best.has(k)) cache.best.set(k, bestSwaps(book, { rid: me, out: id, board, beforePick: mode === 'board' ? ownPick(id)?.no : null, limit: 8, others: othersOf(id) }));
    return cache.best.get(k);
  };
  const ready = (id) => cache.best.has(keyOf(id));

  // with no changes yet, the page shows your first player's best alternative, labelled as a preview
  const preview = useMemo(() => {
    if (swaps.length || !mine[0]) return null;
    const b = bestFor(mine[0].id).list[0];
    return b ? [{ out: mine[0].id, inn: b.id }] : null;
  }, [swaps.length, mine]);
  const shown = swaps.length ? swaps : preview;
  const res = useMemo(() => (shown ? whatIf(book, { rid: me, swaps: shown }) : null), [book, me, sig(shown || [])]);
  // what each change adds on its own, against the rest of them
  const worth = useMemo(() => {
    const out = {};
    if (!res || !swaps.length) return out;
    const total = res.after.w + res.after.t / 2;
    for (const x of swaps) { const r = recordWith(book, { rid: me, others: othersOf(x.out) }); out[x.out] = total - (r.w + r.t / 2); }
    return out;
  }, [res, swaps]);

  // each row's best alternative, worked out a player at a time while the page is idle (again after every change)
  const [, bump] = useState(0);
  useEffect(() => {
    const todo = mine.map((x) => x.id).filter((id) => !swapOf(id) && !ready(id));
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
  }, [mine, modes, sig(swaps)]);

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
  const pickFor = (out, inn) => setSwaps([...swaps.filter((x) => x.out !== out), { out, inn }]);
  const undo = (out) => setSwaps(swaps.filter((x) => x.out !== out));

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
      picked={swapOf(id)?.inn || null} others={othersOf(id)} res={swaps.length ? res : null} n={swaps.length}
      onPick={(inn) => pickFor(id, inn)} onResult={toResult} whereFrom={whereFrom} />
  );

  const missing = hs.error ? `The draft board and waiver-week stats didn't load (${hs.error}), so this runs on the league snapshot alone: a player only scores in weeks someone rostered him.`
    : hs.demo && !hs.body ? 'The demo snapshot has no draft board or waiver-week stats: a player only scores in weeks someone rostered him, and benches aren\'t saved.'
    : hs.body?.errors?.length ? `Some of Sleeper's data is missing for now (${hs.body.errors.join('; ')}). It's retried within the hour.` : null;
  const ch = swaps.length && res ? res.after.w + res.after.t / 2 - (res.before.w + res.before.t / 2) : 0;

  return <>
    {missing ? <div className="notice glass span-12 wi-note">{missing}</div> : null}
    <section className="panel glass wi-list">
      {swaps.length && res ? (
        <div className="wi-changes" role="status">
          <p><b>{`${swaps.length} ${swaps.length === 1 ? 'change' : 'changes'}`}</b>{`: ${rec(res.before)} to ${rec(res.after)}`}<em className={ch > 0 ? 'up' : ch < 0 ? 'down' : ''}>{winsSaid(ch)}</em></p>
          <button type="button" className="wi-clear" onClick={() => { setSwaps([]); close(); }}>{'Clear changes'}</button>
        </div>
      ) : null}
      <h2>{'Your players'}</h2>
      <p className="sub">{board ? 'Tap a player to see who you could have drafted with that pick instead. Swap as many as you like.' : 'Tap a player to see who you could have had instead. Swap as many as you like.'}</p>
      <ul className="wi-rows">
        {mine.filter((x) => all || x.pick || x.now || swapOf(x.id)).map((x) => {
          const sw = swapOf(x.id), isOpen = open === x.id;
          const b = !sw && ready(x.id) ? bestFor(x.id).list[0] : null;
          const shownId = sw ? sw.inn : x.id, dw = sw ? worth[x.id] ?? 0 : b?.dw;
          return (
            <li key={x.id} className={`${isOpen ? 'open' : ''}${sw ? ' swapped' : ''}`}>
              <button type="button" className="wi-row" ref={(el) => (rowRefs.current[x.id] = el)} aria-expanded={isOpen} aria-controls={phone ? undefined : `wi-tray-${x.id}`} onClick={() => toggle(x.id)}
                aria-label={sw ? `${name(sw.inn)} in place of ${name(x.id)}. Change the pick` : undefined}>
                <span className="wi-row-face"><Face id={shownId} />{sw ? <Face id={x.id} cls="wi-face was" /> : null}</span>
                <span className="wi-row-who">
                  <b>{name(shownId)}</b>
                  <small>{sw ? <><PosTag pos={pos(sw.inn)} /><s>{name(x.id)}</s>{x.pick ? `, ${ordinal(x.pick.no)} pick` : ''}</>
                    : <><PosTag pos={pos(x.id)} />{`${x.pick ? `Round ${x.pick.round}, ${ordinal(x.pick.no)}` : 'Picked up'}${x.now ? '' : ', gone'}`}</>}</small>
                </span>
                <span className={`wi-row-best${sw || b ? '' : ' wait'}`}>
                  {sw ? <><small>{'This change'}</small><em className={dw > 0 ? 'up' : dw < 0 ? 'down' : ''}>{winsSaid(dw)}</em></>
                    : b ? <><small>{'Best instead'}</small><b>{lastName(b.id)}</b><em className={b.dw > 0 ? 'up' : b.dw < 0 ? 'down' : ''}>{winsSaid(b.dw)}</em></>
                    : <i aria-hidden="true" />}
                </span>
                <span className="wi-chev" aria-hidden="true"><svg width="14" height="9" viewBox="0 0 14 9"><path d="M1.5 1.5l5.5 5.5 5.5-5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              </button>
              {sw ? (
                <button type="button" className="wi-x" onClick={() => undo(x.id)} aria-label={`Undo: put ${name(x.id)} back`}>
                  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
                </button>
              ) : null}
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
    {res ? <Summary D={D} book={book} res={res} h={h} auto={!swaps.length} pick={ownPick(res.out)} mode={modeOf(res.out)} />
      : <section className="panel glass wi-res" id="wi-result"><h2>{'Your replay shows up here'}</h2><p className="sub">{'Tap a player, then pick someone to put in his place.'}</p></section>}
    {res ? <Detail D={D} book={book} res={res} h={h} /> : null}
    {phone ? <Sheet open={open != null} onClose={close} returnTo={() => rowRefs.current[sheetFor]} label={sheetFor ? `Instead of ${name(sheetFor)}` : ''}>
      {sheetFor ? tray(sheetFor) : null}
    </Sheet> : null}
  </>;
}

// the tray's contents: who you'd swap out, the two ways to look, the best three (eight with More, with the search on
// top), and once one is picked, the verdict and the way to the full replay. In Anyone mode a player you drafted shows
// who was still on the board at that pick: a green wash and "Was available", or a red one and "Was not available".
function Tray({ id, pick, mode, best, book, board, me, h, phone, onMode, picked, others, res, n, onPick, onResult, whereFrom }) {
  const { f1, ordinal } = h;
  const name = book.nameOf, pos = book.posOf;
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  const taken = others.map((x) => x.inn);
  const pool = useMemo(() => (more ? candidatePool(book, { rid: me, out: id, board, beforePick: mode === 'board' ? pick?.no : null, taken }) : []), [more, mode]);
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return null;
    return pool.filter((x) => name(x.id).toLowerCase().includes(s)).slice(0, 5).map((x) => swapRow(book, { rid: me, out: id, inn: x.id, others, base: best.base }));
  }, [q, pool]);
  const list = found || best.list.slice(0, more ? 8 : 3);
  const games = book.games(id);
  const avail = (x) => {
    if (!pick || mode !== 'any') return null;
    const p = board?.byId[x];
    return p && p.no < pick.no ? 'na' : 'av';
  };

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
      {more ? (
        <label className="wi-search"><span className="sr-only">{'Find a player'}</span>
          <svg className="wi-search-icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="2" fill="none" /><path d="M12 12l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input type="search" placeholder={mode === 'board' ? 'Find anyone still on the board' : 'Find any player'} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
        </label>
      ) : null}
      {list.length ? (
        <ul className="wi-alts" aria-label={`Players you could have had instead of ${name(id)}`}>
          {list.map((x) => {
            const a = avail(x.id);
            return (
              <li key={x.id}>
                <button type="button" className={`wi-alt${a ? ` ${a}` : ''}`} aria-pressed={x.id === picked} onClick={() => onPick(x.id)}>
                  <Face id={x.id} />
                  <span className="wi-alt-who">
                    <b>{name(x.id)}</b>
                    <small><PosTag pos={pos(x.id)} />{whereFrom(x.id)}</small>
                    {a ? <span className="wi-avail">{a === 'av' ? `Was available at ${ordinal(pick.no)}` : 'Was not available'}</span> : null}
                  </span>
                  <span className="wi-alt-rec">
                    <b>{rec(x.after)}</b>
                    <em className={x.dw > 0 ? 'up' : x.dw < 0 ? 'down' : ''}>{winsSaid(x.dw)}</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="wi-none">{found ? (mode === 'board' ? 'Nobody by that name was still on the board, or he never played.' : 'No player by that name scored this season.') : 'Nobody here scored this season.'}</p>}
      {!more && best.list.length > 3 ? <button type="button" className="wi-more" onClick={() => setMore(true)}>{'More players, or search'}</button> : null}
      {picked && res ? (
        <div className="wi-tray-foot" aria-live="polite">
          <p>{`With ${name(picked)}${n > 1 ? ' and your other changes' : ''} you'd be `}<b>{`${rec(res.after)} and ${ordinal(res.after.seed)}`}</b>{`, instead of ${rec(res.before)} and ${ordinal(res.before.seed)}.`}</p>
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

const STARTS = ['swap', 'start', 'nofit-start'];

// the replay at a glance: who for whom, the record before and after, what moved, and each week's score real and what if
function Summary({ D, book, res, h, auto, pick, mode }) {
  const { f1, ordinal } = h;
  const name = book.nameOf, team = (rid) => D.byRid[rid];
  const b = res.before, a = res.after, n = res.swaps.length;
  const dw = a.w + a.t / 2 - (b.w + b.t / 2), dpf = a.pf - b.pf, dseed = (b.seed || 0) - (a.seed || 0);
  const steps = res.weeks.flatMap((x) => x.steps);
  const used = steps.filter((x) => STARTS.includes(x.how));
  const inPts = used.reduce((s, x) => s + (x.inPts || 0), 0);
  const hurt = res.weeks.filter((x) => x.hitOpp).length;
  const cut = D.meta.playoffTeams;
  const X = name(res.out), Y = name(res.inn);
  const lead = n > 1 ? `With these ${n} changes` : pick && mode === 'board' ? `Draft ${Y} instead of ${X} with the ${ordinal(pick.no)} pick` : `Swap ${X} for ${Y} all season`;
  const verdict = `${lead}${n > 1 ? '' : ' and'} you'd be ${rec(a)} and ${ordinal(a.seed)}${a.seed <= cut && b.seed > cut ? ', in the playoff spots' : a.seed > cut && b.seed <= cut ? ', out of the playoff spots' : ''}, instead of ${rec(b)} and ${ordinal(b.seed)}.`;
  const more = [
    n > 1 ? `Your swapped-in players would have filled ${used.length} lineup spots over ${res.weeks.length} weeks, ${f1(inPts)} points.`
      : used.length ? `${Y} would have started ${used.length} of ${res.weeks.length} weeks for you, ${f1(inPts)} points in your lineup.` : `${Y} would never have cracked your lineup.`,
    hurt ? `${hurt === 1 ? 'Once' : `${hurt} times`} you'd have played a team that lost one of them.` : '',
  ].filter(Boolean).join(' ');

  // the chart: per week your real score (pale) beside the what if (charcoal, red when it's a loss), their score as a
  // tick across both, weeks that changed lit, flipped results on butter with the old and new result over them
  const [figRef, figW] = useWidth(640);
  const W = Math.max(280, figW), H = W < 500 ? 210 : 240, padT = 28, padB = 26;
  const ms = res.weeks.filter((x) => x.opp != null);
  const top = Math.max(50, ...ms.flatMap((x) => [x.was[0], x.now[0], x.was[1], x.now[1]])) * 1.06;
  const Y0 = (v) => padT + (1 - Math.max(0, v) / top) * (H - padT - padB);
  const bw = W / Math.max(1, ms.length), bar = Math.max(5, Math.min(18, bw * 0.28));
  const grid = [50, 100, 150, 200].filter((v) => v < top);

  return (
    <section className="panel glass wi-res" id="wi-result">
      {auto ? <p className="wi-auto">{'A preview with your first pick. Tap any player to make your own changes.'}</p> : null}
      <ul className="wi-swaps">
        {res.swaps.map((s) => (
          <li key={s.out}>
            <span className="wi-p out"><Face id={s.out} /><small>{name(s.out)}</small></span>
            <svg className="wi-arrow" width="28" height="14" viewBox="0 0 34 16" aria-hidden="true"><path d="M2 8h28M24 3l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="wi-p in"><Face id={s.inn} /><small>{name(s.inn)}</small></span>
          </li>
        ))}
      </ul>
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
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Your score each week, real and what if, with your opponent's">
          <rect x="0" y="0" width={W} height={H - padB + 6} rx="16" className="wi-plate" />
          {ms.map((x, i) => {
            // the weeks that changed, lit first so the grid and the bars draw over them
            const flip = x.res[0] !== x.res[1], moved = x.now[0] !== x.was[0] || x.now[1] !== x.was[1];
            return moved ? <rect key={x.w} x={i * bw + 3} y="4" width={bw - 6} height={H - padB - 2} rx="12" className={flip ? 'wi-band flip' : 'wi-band'} /> : null;
          })}
          {grid.map((v) => <g key={v}><line x1="8" x2={W - 8} y1={Y0(v)} y2={Y0(v)} className="wi-grid" /><text x="12" y={Y0(v) - 4} className="wi-gl">{v}</text></g>)}
          {ms.map((x, i) => {
            const cx = i * bw + bw / 2, o = team(x.opp);
            const flip = x.res[0] !== x.res[1], moved = x.now[0] !== x.was[0] || x.now[1] !== x.was[1];
            const tip = `Week ${x.w} vs ${o.name}: ${f1(x.was[0])}–${f1(x.was[1])} (${x.res[0]}) for real, ${f1(x.now[0])}–${f1(x.now[1])} (${x.res[1]}) what if`;
            const base = Y0(0);
            return <g key={x.w} data-tip={tip} className={`${flip ? 'flip' : ''}${moved ? ' moved' : ''}`}>
              <rect x={cx - bw / 2} y="0" width={bw} height={H} fill="transparent" />
              <rect x={cx - bar - 1} y={Y0(x.was[0])} width={bar} height={Math.max(1, base - Y0(x.was[0]))} rx="3" className="wi-bar-was" />
              <rect x={cx + 1} y={Y0(x.now[0])} width={bar} height={Math.max(1, base - Y0(x.now[0]))} rx="3" className={`wi-bar-now${x.res[1] === 'L' ? ' loss' : ''}`} />
              <line x1={cx - bar - 4} x2={cx + bar + 4} y1={Y0(x.now[1])} y2={Y0(x.now[1])} className="wi-opp" />
              {flip ? <text x={cx} y="18" textAnchor="middle" className="wi-fl">{`${x.res[0]}→${x.res[1]}`}</text> : null}
              <text x={cx} y={H - 7} textAnchor="middle" className="wi-axis">{x.w}</text>
            </g>;
          })}
        </svg>
        <ul className="wi-legend">
          <li><i className="k-was" />{'Your real score'}</li>
          <li><i className="k-now" />{'What if'}</li>
          <li><i className="k-loss" />{'What if, a loss'}</li>
          <li><i className="k-opp" />{'Their score'}</li>
          <li><i className="k-moved" />{'Score changed'}</li>
          <li><i className="k-flip" />{'Result flips'}</li>
        </ul>
        <figcaption>{'Each week, your real score beside the what if. Tap a week for the scores.'}</figcaption>
      </figure>
    </section>
  );
}

// week by week (one line per change), the standings what if, and how it works
function Detail({ D, book, res, h }) {
  const { f1, short } = h;
  const name = book.nameOf, team = (rid) => D.byRid[rid];
  const n = res.swaps.length;
  const said = (x, s) => {
    const p = (id) => f1(book.pts(x.w, id));
    const X = name(s.out), Y = name(s.inn), opp = x.opp != null ? team(x.opp) : null;
    const lostTxt = s.hitOpp && s.lost ? ` ${short(opp.name, 22)} would have played without him: ${s.lost.filler ? `${name(s.lost.filler)} (${f1(s.lost.pts)})` : 'an empty slot'} in place of his ${f1(s.inPts ?? 0)}.` : '';
    switch (s.how) {
      case 'had': return `${Y} was already yours this week.`;
      case 'swap': return `${Y} scores ${f1(s.inPts)} in ${X}'s spot (${X} had ${f1(s.outPts)}).${lostTxt}`;
      case 'off': return `${Y} didn't play. ${s.filler ? `${name(s.filler)} (${p(s.filler)}) fills ${X}'s spot` : `${X}'s spot sits empty`} (${X} had ${f1(s.outPts)}).${lostTxt}`;
      case 'nofit': return `${Y} can't play ${X}'s ${s.slot} spot: ${s.filler ? `${name(s.filler)} (${p(s.filler)}) fills it` : 'it sits empty'} (${X} had ${f1(s.outPts)}), and ${Y} sits.${lostTxt}`;
      case 'nofit-start': return `${Y} can't play ${X}'s ${s.slot} spot, so ${s.filler ? `${name(s.filler)} (${p(s.filler)}) fills it` : 'it sits empty'} (${X} had ${f1(s.outPts)}), but ${Y} (${f1(s.inPts)}) starts ${s.benched ? `over ${name(s.benched)} (${p(s.benched)})` : 'in an empty slot'}.${lostTxt}`;
      case 'start': return `${X} ${s.outPts == null && !book.rows[x.w][res.rid].players.has(s.out) ? "isn't on your roster" : 'sits'}; ${Y} (${f1(s.inPts)}) starts ${s.benched ? `over ${name(s.benched)} (${p(s.benched)})` : 'in an empty slot'}.${lostTxt}`;
      case 'bench': return book.avg(x.w, s.inn) == null
        ? `${Y} (${f1(s.inPts)}) sits on your bench: no games yet to start him on.${lostTxt}`
        : `${Y} (${f1(s.inPts)}) sits on your bench: his average so far doesn't beat your starters.${lostTxt}`;
      case 'idle': return `${Y} didn't play.${lostTxt}`;
      default: return lostTxt.trim() || '';
    }
  };
  const Ys = res.swaps.map((s) => name(s.inn));
  const who = n > 1 ? 'your swapped-in players' : Ys[0];
  return <>
    <section className="panel glass wi-weeks">
      <h2>{'Week by week'}</h2>
      <ol>
        {res.weeks.map((x) => {
          const o = x.opp != null ? team(x.opp) : null, flip = x.res[0] !== x.res[1];
          const moved = flip || x.now[0] !== x.was[0] || x.now[1] !== x.was[1];
          const lines = x.steps.map((s) => said(x, s)).filter(Boolean);
          return <li key={x.w} className={flip ? 'flip' : moved ? 'moved' : ''}>
            <div className="wi-wk-top">
              <span className="wi-wk">{`Week ${x.w}`}</span>
              <span className="wi-vs">{o ? `vs ${short(o.name, 20)}` : ''}</span>
              {flip ? <span className="wi-flip-tag">{x.res[1] === 'W' ? 'Now a win' : x.res[1] === 'L' ? 'Now a loss' : 'Now a tie'}</span> : null}
            </div>
            <div className="wi-sc">
              <span className={`r ${x.res[0]}`}>{`${x.res[0] || ''} ${f1(x.was[0])}–${f1(x.was[1])}`}</span>
              {moved ? <><span className="to" aria-label="becomes">{'→'}</span><span className={`r ${x.res[1]} now`}>{`${x.res[1] || ''} ${f1(x.now[0])}–${f1(x.now[1])}`}</span></> : null}
            </div>
            {lines.map((l, i) => <p key={i}>{l}</p>)}
          </li>;
        })}
      </ol>
    </section>
    <section className="panel glass wi-table">
      <h2>{'The standings, what if'}</h2>
      <p className="sub">{`Everyone's record with ${n > 1 ? 'your changes' : `${Ys[0]} on your team`} all season. Top ${D.meta.playoffTeams} make the playoffs.`}</p>
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
        <li>{`In every week your player started, ${who === Ys[0] ? who : 'the player you swapped in'} takes his spot (trading places with a starter when he plays another position). If he was on a bye or hurt, your best benched player who fits fills in.`}</li>
        <li>{'In the other weeks he\'s on your bench, and starts over your weakest starter at his position when his average so far beats that starter\'s.'}</li>
        <li>{'Whoever really had him plays without him: their best benched player who fits takes his spot. So when you\'d have faced them, they\'re weaker too. The player you gave up stays wherever he went, and everyone else\'s lineups are as they were.'}</li>
        <li>{'Bench calls use only the weeks before (points per game played), never that week\'s points. Points are the league\'s own scoring; weeks a player sat on waivers use Sleeper\'s half-PPR stats. Standings are wins, then points for.'}</li>
      </ul>
    </section>
  </>;
}
