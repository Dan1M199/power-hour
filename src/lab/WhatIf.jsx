// What would have happened (the Lab's What if section, #lab/whatif; Dan's request Nov 20): take one player off your
// roster, put someone else in his place for the whole season, and replay every week. Two ways to pick the someone
// else: anyone still on the board when you drafted him, or anyone at all. The numbers are lib/whatif.js; the draft
// board and the waiver-week points come from /api/history (src/lab/history.js), fetched when the section opens.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { seasonBook, draftBoard, whatIf, bestSwaps, candidatePool, swapRow, everRostered } from '../../lib/whatif.js';
import { historyStore, loadHistory } from './history.js';
import { PosTag, TeamAvatar } from '../shared.jsx';

const ORDER = { QB: 0, RB: 1, WR: 2, TE: 3, K: 4, DEF: 5 };
const keep = {}; // the picks, per team, for the visit: { out, mode, inn }
const rec = (x) => `${x.w}-${x.l}${x.t ? `-${x.t}` : ''}`;
const signed = (x, f) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${f(Math.abs(x))}`;

function Face({ id }) {
  const [bad, setBad] = useState(false);
  if (bad || !/^\d+$/.test(id)) return <span className="wi-face ph" aria-hidden="true">{/^\d+$/.test(id) ? '' : id}</span>;
  return <img className="wi-face" src={`https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
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

// the book (every scored week, indexed) is built once per league and history
function bookFor(D, raw, body) {
  const c = D._whatif;
  if (c && c.body === body) return c.book;
  const book = seasonBook(D, raw, body);
  D._whatif = { body, book, board: draftBoard(book, raw) };
  return book;
}

export function WhatIf({ D, raw, me, h, demo }) {
  const hs = historyStore.use();
  useEffect(() => { loadHistory({ demo }); }, [demo]);
  if (!me) return <section className="panel glass span-12 wi-empty"><h2>Pick your team first</h2><p className="sub">{'Choose your team in the box above and the tool lines up your roster: every player you drafted or picked up this season.'}</p></section>;
  if (!hs) return <section className="panel glass span-12 wi-wait" aria-busy="true"><span className="wi-spin" aria-hidden="true" /><p>{'Getting the draft board and every week of stats.'}</p></section>;
  return <Tool D={D} raw={raw} me={me} h={h} hs={hs} />;
}

function Tool({ D, raw, me, h, hs }) {
  const book = bookFor(D, raw, hs.body);
  const board = D._whatif.board;
  const { f1, ordinal, short } = h;
  const t = D.byRid[me];
  const name = book.nameOf, pos = book.posOf;
  const rosterOf = (id) => D.teams.find((x) => x.players.includes(id));

  // your players: everyone you drafted, then everyone who was ever on your roster
  const mine = useMemo(() => {
    const ever = everRostered(book, me);
    const drafted = board ? board.picks.filter((p) => p.rid === me) : [];
    const draftedIds = new Set(drafted.map((p) => p.id));
    const rows = [
      ...drafted.map((p) => ({ id: p.id, pick: p, now: t.players.includes(p.id) })),
      ...[...ever].filter((id) => !draftedIds.has(id) && pos(id)).map((id) => ({ id, pick: null, now: t.players.includes(id) })),
    ];
    const tot = (id) => book.total(id);
    return rows.sort((a, b) => (a.pick && b.pick ? a.pick.no - b.pick.no : a.pick ? -1 : b.pick ? 1 : (ORDER[pos(a.id)] ?? 9) - (ORDER[pos(b.id)] ?? 9) || tot(b.id) - tot(a.id)));
  }, [book, board, me]);

  // the list starts with your draft picks and today's roster; players who came and went are one tap away
  const [all, setAll] = useState(false);
  const passing = mine.filter((x) => !x.pick && !x.now);
  const saved = keep[me] || {};
  const [out, setOut] = useState(saved.out && mine.some((x) => x.id === saved.out) ? saved.out : mine[0]?.id);
  const outPick = board?.byId[out]?.rid === me ? board.byId[out] : null;
  const [modeWanted, setMode] = useState(saved.mode || 'board');
  const mode = outPick ? modeWanted : 'any';
  const [inn, setInn] = useState(saved.inn || null);
  const [q, setQ] = useState('');
  useEffect(() => { keep[me] = { out, mode: modeWanted, inn }; }, [me, out, modeWanted, inn]);

  const opts = { rid: me, out, board, beforePick: mode === 'board' && outPick ? outPick.no : null };
  const best = useMemo(() => (out ? bestSwaps(book, { ...opts, limit: 8 }) : null), [book, out, mode]);
  const pool = useMemo(() => (out ? candidatePool(book, opts) : []), [book, out, mode]);
  const inPool = (id) => pool.some((x) => x.id === id);
  const pick = inn && inPool(inn) ? inn : best?.list[0]?.id || null;
  const res = useMemo(() => (out && pick ? whatIf(book, { rid: me, out, inn: pick }) : null), [book, out, pick]);

  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return pool.filter((x) => name(x.id).toLowerCase().includes(s)).slice(0, 6).map((x) => swapRow(book, { rid: me, out, inn: x.id }));
  }, [q, pool]);

  const whereFrom = (id) => {
    const p = board?.byId[id];
    if (p) return `Drafted ${ordinal(p.no)} by ${short(D.byRid[p.rid]?.name || 'someone', 18)}`;
    if (board) return 'Undrafted';
    const now = rosterOf(id);
    return now ? `On ${short(now.name, 18)} now` : 'Free agent';
  };
  const choose = (id) => { setInn(id); setQ(''); };

  // called as a function, not a component: a component defined here would remount on every render
  const option = (x, i) => (
    <li key={x.id}>
      <button type="button" className="wi-opt" aria-pressed={x.id === pick} onClick={() => choose(x.id)}>
        {i != null ? <span className="wi-n">{i + 1}</span> : null}
        <Face id={x.id} />
        <span className="wi-who"><b>{name(x.id)}</b><small><PosTag pos={pos(x.id)} />{`${whereFrom(x.id)}, ${f1(x.tot)} pts in ${x.games} ${x.games === 1 ? 'game' : 'games'}`}</small></span>
        <span className="wi-rec"><b>{rec(x.after)}</b><small className={x.dw > 0 ? 'up' : x.dw < 0 ? 'down' : ''}>{x.dw ? `${signed(x.dw, (v) => String(v))} ${Math.abs(x.dw) === 1 ? 'win' : 'wins'}` : 'same record'}</small></span>
      </button>
    </li>
  );

  const missing = hs.error ? `The draft board and waiver-week stats didn't load (${hs.error}), so this runs on the league snapshot alone: a player only scores in weeks someone rostered him.`
    : hs.demo && !hs.body ? 'The demo snapshot has no draft board or waiver-week stats: a player only scores in weeks someone rostered him, and benches aren\'t saved.'
    : hs.body?.errors?.length ? `Some of Sleeper's data is missing for now (${hs.body.errors.join('; ')}). It's retried within the hour.` : null;

  return <>
    {missing ? <div className="notice glass span-12 wi-note">{missing}</div> : null}
    <section className="panel glass span-12 wi-pick">
      <div className="wi-step">
        <h2><span className="wi-num">1</span>{'Take a player off your roster'}</h2>
        <p className="sub">{board ? 'Your draft picks in order, then the players you picked up.' : 'Your roster this season.'}</p>
        <ul className="wi-roster">
          {mine.filter((x) => all || x.pick || x.now || x.id === out).map((x) => (
            <li key={x.id}>
              <button type="button" aria-pressed={x.id === out} onClick={() => { setOut(x.id); setInn(null); }}>
                <PosTag pos={pos(x.id)} />
                <b>{name(x.id)}</b>
                <small>{x.pick ? `Rd ${x.pick.round}, ${ordinal(x.pick.no)}` : 'Added'}{x.now ? '' : ', gone'}</small>
              </button>
            </li>
          ))}
          {passing.length ? <li><button type="button" className="wi-more" aria-expanded={all} onClick={() => setAll(!all)}>{all ? 'Show fewer' : `${passing.length} more who came and went`}</button></li> : null}
        </ul>
      </div>
      <div className="wi-step">
        <h2><span className="wi-num">2</span>{`Put someone in ${out ? `${name(out)}'s` : 'his'} place`}</h2>
        <div className="wi-mode" role="group" aria-label="Who you could have had">
          <button type="button" aria-pressed={mode === 'board'} disabled={!outPick} onClick={() => { setMode('board'); setInn(null); }}>
            <b>{'Still on the board'}</b><small>{outPick ? `Anyone not drafted before pick ${outPick.no}` : board ? 'Only for players you drafted' : 'Needs the draft board'}</small>
          </button>
          <button type="button" aria-pressed={mode === 'any'} onClick={() => { setMode('any'); setInn(null); }}>
            <b>{'Anyone'}</b><small>{'Any player in the league, all season'}</small>
          </button>
        </div>
        <label className="wi-search"><span className="sr-only">{'Find a player'}</span>
          <input type="search" placeholder={mode === 'board' ? 'Find anyone still on the board' : 'Find any player'} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </label>
        {q.trim().length >= 2 ? (
          found.length ? <ul className="wi-opts">{found.map((x) => option(x))}</ul>
            : <p className="wi-none">{mode === 'board' ? 'Nobody by that name was still on the board, or he never played.' : 'No player by that name scored this season.'}</p>
        ) : best?.list.length ? <>
          <h3 className="wi-h3">{mode === 'board' ? `Best you could have taken at pick ${outPick.no}` : `Best you could have had instead`}</h3>
          <ul className="wi-opts">{best.list.map((x, i) => option(x, i))}</ul>
        </> : null}
      </div>
    </section>
    {res ? <Result D={D} book={book} res={res} t={t} h={h} outPick={mode === 'board' ? outPick : null} /> : null}
  </>;
}

// the week-by-week story of one swap
function Result({ D, book, res, t, h, outPick }) {
  const { f1, ordinal, short } = h;
  const name = book.nameOf, team = (rid) => D.byRid[rid];
  const X = name(res.out), Y = name(res.inn);
  const b = res.before, a = res.after;
  const dw = a.w + a.t / 2 - (b.w + b.t / 2), dpf = a.pf - b.pf, dseed = (b.seed || 0) - (a.seed || 0);
  const used = res.weeks.filter((x) => ['swap', 'start', 'nofit-start'].includes(x.how));
  const inPts = used.reduce((s, x) => s + (x.inPts || 0), 0);
  const hurt = res.weeks.filter((x) => x.hitOpp && x.lost);
  const cut = D.meta.playoffTeams;
  const lead = outPick ? `Draft ${Y} instead of ${X} with the ${ordinal(outPick.no)} pick` : `Swap ${X} for ${Y} all season`;
  const verdict = `${lead} and you'd be ${rec(a)} and ${ordinal(a.seed)}${a.seed <= cut && b.seed > cut ? ', in the playoff spots' : a.seed > cut && b.seed <= cut ? ', out of the playoff spots' : ''}, instead of ${rec(b)} and ${ordinal(b.seed)}.`;
  const more = [
    used.length ? `${Y} would have started ${used.length} of ${res.weeks.length} weeks for you, ${f1(inPts)} points in your lineup.` : `${Y} would never have cracked your lineup.`,
    hurt.length ? `${hurt.length === 1 ? 'Once' : `${hurt.length} times`} you'd have played the team that lost him.` : '',
  ].filter(Boolean).join(' ');

  // the margin chart: each week's margin before (outline) and after (filled), the flips marked
  const [figRef, figW] = useWidth(720);
  const W = Math.max(280, figW), H = W < 500 ? 170 : 200, pad = 26, mid = (H - pad) / 2 + 4;
  const ms = res.weeks.filter((x) => x.opp != null);
  const max = Math.max(10, ...ms.flatMap((x) => [Math.abs(x.was[0] - x.was[1]), Math.abs(x.now[0] - x.now[1])])) * 1.1;
  const bw = W / Math.max(1, ms.length), Y0 = (v) => mid - (v / max) * (mid - 8);

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
    <section className="panel glass span-12 wi-res">
      <div className="wi-swap" aria-hidden="true">
        <span className="wi-p out"><Face id={res.out} /><small>{X}</small></span>
        <svg className="wi-arrow" width="34" height="16" viewBox="0 0 34 16"><path d="M2 8h28M24 3l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="wi-p in"><Face id={res.inn} /><small>{Y}</small></span>
      </div>
      <div className="wi-score">
        <div className="wi-big"><small>{'Real record'}</small><b className="was">{rec(b)}</b></div>
        <svg className="wi-arrow" width="34" height="16" viewBox="0 0 34 16" aria-hidden="true"><path d="M2 8h28M24 3l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div className="wi-big"><small>{'What if'}</small><b>{rec(a)}</b></div>
        <ul className="wi-chips">
          <li className={dw > 0 ? 'up' : dw < 0 ? 'down' : ''}>{dw ? `${signed(dw, String)} ${Math.abs(dw) === 1 ? 'win' : 'wins'}` : 'Same record'}</li>
          <li className={dseed > 0 ? 'up' : dseed < 0 ? 'down' : ''}>{`${ordinal(a.seed)} in the standings${dseed ? `, ${dseed > 0 ? 'up' : 'down'} ${Math.abs(dseed)}` : ''}`}</li>
          <li className={dpf > 0.05 ? 'up' : dpf < -0.05 ? 'down' : ''}>{`${signed(dpf, f1)} points for`}</li>
          <li>{`${res.flips.length} ${res.flips.length === 1 ? 'game flips' : 'games flip'}`}</li>
        </ul>
      </div>
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
              <rect x={cx - w1 / 2 + 5} y={top(m1)} width={w1 - 10} height={hgt(m1)} rx="4" className={m1 > 0 ? 'wi-now win' : m1 < 0 ? 'wi-now loss' : 'wi-now'} />
              <text x={cx} y={H - 6} textAnchor="middle" className="wi-axis">{x.w}</text>
            </g>;
          })}
        </svg>
        <figcaption>{'Your margin each week: the outline is what happened, the bar inside is the what if (above the line a win, below a loss). Flipped games are shaded. Hover or tap a week for the scores.'}</figcaption>
      </figure>
    </section>

    <section className="panel glass span-7 wi-weeks">
      <h2>{'Week by week'}</h2>
      <ol>
        {res.weeks.map((x) => {
          const o = x.opp != null ? team(x.opp) : null, flip = x.res[0] !== x.res[1];
          return <li key={x.w} className={flip ? 'flip' : ''}>
            <div className="wi-wk-top">
              <span className="wi-wk">{`Week ${x.w}`}</span>
              <span className="wi-vs">{o ? `vs ${short(o.name, 20)}` : ''}</span>
              <span className="wi-sc">
                <span className={`r ${x.res[0]}`}>{`${x.res[0] || ''} ${f1(x.was[0])}–${f1(x.was[1])}`}</span>
                {flip || x.now[0] !== x.was[0] || x.now[1] !== x.was[1] ? <><span className="to" aria-label="becomes">{'→'}</span><span className={`r ${x.res[1]} now`}>{`${x.res[1] || ''} ${f1(x.now[0])}–${f1(x.now[1])}`}</span></> : null}
              </span>
            </div>
            <p>{said(x)}</p>
          </li>;
        })}
      </ol>
    </section>

    <section className="panel glass span-5 wi-table">
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

    <section className="panel glass span-12 wi-how">
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
