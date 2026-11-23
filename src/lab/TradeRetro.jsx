// The trade retrospective (Dan's request Nov 23; the Lab's Trades section, #lab/retro): every trade with four or more
// weeks of games, judged on the points it put into each team's starting lineups (lib/retro.js), never on rest of season
// rankings. A report card per team, then a card per trade (biggest swing first) with the winner and loser, why, the
// record each team would have without it and the numbers behind it, the trades still too young to call, and for any team
// with more than one trade a panel that undoes any or all of them and shows the record and lineup it would have.
// Waiver-week points come from /api/history (src/lab/history.js), the same as What if.
import { useEffect, useMemo, useState } from 'react';
import { seasonBook } from '../../lib/whatif.js';
import { retrospective, tradesOf, undoTeam, withFlips, MIN_WEEKS } from '../../lib/retro.js';
import { historyStore, loadHistory } from './history.js';
import { Headshot, PosTag, TeamAvatar } from '../shared.jsx';

const keep = { open: null, undo: null, picked: {} }; // for the visit: the opened card, the undo panel's team and picks
const rec = (x) => `${x.w}-${x.l}${x.t ? `-${x.t}` : ''}`;
const signed = (x, f) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${f(Math.abs(x))}`;
const and = (a) => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const winsSaid = (n) => `${n % 1 ? n.toFixed(1) : n} ${Math.abs(n) === 1 ? 'win' : 'wins'}`;
const dateOf = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
const pickSaid = (p) => `${p.season} round ${p.round} pick`;
const stop = (x) => (/[.!?]$/.test(x) ? x : `${x}.`); // end a sentence once, after names like Jr.

// the book is shared with What if when it's there (same league, same history)
function retroFor(D, raw, body) {
  const c = D._retro;
  if (c && c.body === body) return c;
  const book = D._whatif?.body === body ? D._whatif.book : seasonBook(D, raw, body);
  return (D._retro = { body, book, R: retrospective(book, raw) });
}

export function TradeRetro({ D, raw, me, h, demo }) {
  const hs = historyStore.use();
  useEffect(() => { loadHistory({ demo }); }, [demo]);
  if (!hs) return <section className="panel glass span-12 wi-wait" aria-busy="true"><span className="wi-spin" aria-hidden="true" /><p>{'Getting every week of stats to replay the trades.'}</p></section>;
  return <Retro D={D} raw={raw} me={me} h={h} body={hs.body} />;
}

function Retro({ D, raw, me, h, body }) {
  const { book, R } = retroFor(D, raw, body);
  const [open, setOpenRaw] = useState(keep.open ?? R.judged[0]?.id ?? null);
  const setOpen = (id) => { keep.open = id; setOpenRaw(id); };
  const many = (rid) => tradesOf(R.all, rid).length >= 2;
  const firstUndo = keep.undo ?? (me && many(me) ? me : [...D.teams].filter((t) => many(t.rid)).sort((a, b) => tradesOf(R.all, b.rid).length - tradesOf(R.all, a.rid).length)[0]?.rid ?? null);
  const [undoRid, setUndoRaw] = useState(firstUndo);
  const setUndo = (rid, all = false) => {
    keep.undo = rid;
    if (all) keep.picked[rid] = tradesOf(R.all, rid).map((t) => t.id);
    setUndoRaw(rid);
  };
  const [bump, setBump] = useState(0); // a fresh "undo all" from a card re-reads the picks
  const undoAll = (rid) => {
    setUndo(rid, true);
    setBump((x) => x + 1);
    requestAnimationFrame(() => document.getElementById('rt-undo')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  if (!R.all.length) return <section className="panel glass span-12"><h2>{'No trades yet'}</h2><p className="sub">{'Once a trade goes through and four weeks of games are played, it gets its verdict here.'}</p></section>;
  return <>
    {R.judged.length ? <ReportCard R={R} D={D} h={h} me={me} many={many} onUndo={undoAll} /> : (
      <section className="panel glass span-12 rt-none">
        <h2>{'Too soon to call any of them'}</h2>
        <p className="sub">{`A trade needs ${MIN_WEEKS} weeks of games before it gets a verdict. The first one is judged after week ${Math.min(...R.waiting.map((t) => t.after))}.`}</p>
      </section>
    )}
    {R.judged.map((t, i) => (
      <RetroCard key={t.id} t={t} k={i} D={D} h={h} book={book} me={me} open={open === t.id} onToggle={() => setOpen(open === t.id ? '' : t.id)} many={many} onUndo={undoAll} />
    ))}
    {R.waiting.length ? <Waiting R={R} D={D} h={h} book={book} me={me} /> : null}
    {undoRid != null ? <TeamUndo key={`${undoRid}:${bump}`} R={R} D={D} h={h} book={book} me={me} rid={undoRid} many={many} onTeam={(rid) => setUndo(rid)} /> : null}
    <RetroHow />
  </>;
}

// ---------- the report card ----------

function ReportCard({ R, D, h, me, many, onUndo }) {
  const { f1, short } = h;
  const max = Math.max(1, ...R.teams.map((c) => Math.abs(c.net)));
  return (
    <section className="panel glass span-12 rt-board">
      <h2>{'Trade report card'}</h2>
      <p className="sub">{`Every judged trade added up: the points each team's trades put into its starting lineups, and how many it won and lost. ${R.judged.length} ${R.judged.length === 1 ? 'trade has' : 'trades have'} ${MIN_WEEKS}+ weeks of games.`}</p>
      <ol className="rt-teams">
        {R.teams.map((c) => {
          const t = D.byRid[c.rid], w = (Math.abs(c.net) / max) * 50;
          const n = tradesOf(R.all, c.rid).length;
          return (
            <li key={c.rid} className={c.rid === me ? 'mine' : ''}>
              <span className="rt-tm"><TeamAvatar t={t} cls="avatar xs" /><b>{short(t.name, 22)}</b></span>
              <span className="rt-wl" data-tip={`${c.won} won, ${c.lost} lost${c.trades - c.won - c.lost ? `, ${c.trades - c.won - c.lost} in the middle of a three-way` : ''}`}>{`${c.won}-${c.lost}`}<small>{' in trades'}</small></span>
              <span className="rt-track" data-tip={`${signed(c.net, f1)} points in ${t.name}'s lineups from ${c.trades} judged ${c.trades === 1 ? 'trade' : 'trades'}${c.dw ? `, ${signed(c.dw, winsSaid)}` : ''}`}>
                <i className="mid" />
                <span className={`bar ${c.net >= 0 ? 'pos' : 'neg'}`} style={c.net >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }} />
              </span>
              <b className={`rt-net ${c.net > 0.05 ? 'up' : c.net < -0.05 ? 'down' : ''}`}>{signed(c.net, f1)}</b>
              {many(c.rid) ? <button type="button" className="rt-undo-btn" onClick={() => onUndo(c.rid)}>{`Undo all ${n}`}</button> : <span className="rt-undo-btn ghost" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ---------- one trade ----------

// why, in a few sentences, straight from the numbers
function why(t, D, h, book) {
  const { f1 } = h, name = book.nameOf, tn = (rid) => D.byRid[rid].name;
  const W = t.sides[0], L = t.sides[t.sides.length - 1];
  const lines = [];
  const who = (list) => and([...list.slice(0, 3).map((x) => `${name(x.id)}${x.pickup ? ' (a free agent pickup)' : ''}`), ...(list.length > 3 ? [`${list.length - 3} more`] : [])]);
  for (const s of [W, L]) {
    const d = s.diff, tm = tn(s.rid);
    if (!d.with.length && !d.without.length) { lines.push(`${tm}'s lineup comes out the same either way: nobody the trade moved would have started. Net: ${signed(0, f1)}.`); continue; }
    const got = d.with.length ? `With the trade, ${tm}'s lineup got ${f1(d.withPts)} from ${who(d.with)} in the spots it changed` : `${tm} never started anyone the trade changed`;
    const alt = d.without.length ? `without it, ${who(d.without)} would have put up ${f1(d.withoutPts)} there` : 'without it, those spots would have sat empty: nobody on the bench or the waiver wire fit';
    lines.push(`${got}; ${alt}. Net: ${signed(s.net, f1)}.`);
  }
  const rw = t.sides.filter((s) => s.dw);
  if (rw.length) lines.push(rw.map((s) => `${s.dw > 0 ? `It's worth ${winsSaid(s.dw)} to ${tn(s.rid)}` : `It cost ${tn(s.rid)} ${winsSaid(-s.dw)}`}: ${rec(s.real)} with it, ${rec(s.without)} without`).join('. ') + '.');
  else lines.push(`No game turned on it: ${t.sides.length === 2 ? 'both' : 'all'} records are the same either way.`);
  for (const s of t.sides) {
    for (const o of s.onward) lines.push(`${tn(s.rid)} then sent ${name(o.via)} on to ${and(o.partners.map(tn))}${o.got.length ? ` for ${and(o.got.map((g) => name(g.id)))}` : ''}, so that deal is undone here too.`);
  }
  return lines;
}

function verdictOf(t, D, h) {
  const { f1 } = h, tn = (rid) => D.byRid[rid].name;
  const W = t.sides[0], L = t.sides[t.sides.length - 1];
  const big = t.margin >= 40 ? 'and it wasn\'t close' : t.margin < 8 ? 'by a hair' : '';
  const kicker = W.net > 0 && L.net > 0 ? `Both teams gained, ${tn(W.rid)} more` : W.net < 0 && L.net < 0 ? `Both teams lost points, ${tn(L.rid)} more` : `${signed(W.net, f1)} for ${tn(W.rid)}, ${signed(L.net, f1)} for ${tn(L.rid)}`;
  return { head: `${tn(W.rid)} won this trade${big ? `, ${big}` : ''}`, kicker, sub: `by ${f1(t.margin)} points over ${t.weeks.length} weeks` };
}

function RetroCard({ t, k, D, h, book, me, open, onToggle, many, onUndo }) {
  const { f1, short, ordinal } = h, name = book.nameOf, team = (rid) => D.byRid[rid];
  const W = t.sides[0], L = t.sides[t.sides.length - 1];
  const v = verdictOf(t, D, h);
  const mine = t.sides.some((s) => s.rid === me);
  const roleOf = (s, i) => (i === 0 ? 'Winner' : i === t.sides.length - 1 ? 'Loser' : 'Middle');
  const playerRow = (x, extra) => (
    <li key={x.id}>
      <PosTag pos={book.posOf(x.id)} />
      <span className="pl">{name(x.id)}</span>
      <span className="rt-pts">{extra}</span>
    </li>
  );
  return (
    <article className={`panel glass span-12 rt-card${k === 0 ? ' rim' : ''}${mine ? ' mine' : ''}`} id={`rt-${t.id}`}>
      <header className="rt-top">
        <span>{`${dateOf(t.ts)}, first played week ${t.start}`}</span>
        <span>{`${t.weeks.length} weeks of games`}</span>
      </header>
      <div className="rt-verdict">
        <span className="rt-faces">
          <Headshot t={team(W.rid)} cls="rt-face win" h={h} />
          <Headshot t={team(L.rid)} cls="rt-face lose drained" h={h} />
        </span>
        <div>
          <h2>{v.head}</h2>
          <p><b>{v.sub}</b>{`. ${v.kicker}.`}</p>
        </div>
      </div>
      <div className={`rt-sides n${t.sides.length}`}>
        {t.sides.map((s, i) => (
          <section key={s.rid} className={`rt-side s${i} ${roleOf(s, i).toLowerCase()}${s.rid === me ? ' you' : ''}`}>
            <div className="rt-side-head">
              <TeamAvatar t={team(s.rid)} cls="avatar" />
              <div><b>{short(team(s.rid).name, 24)}</b><span className="rt-role">{roleOf(s, i)}</span></div>
              <b className={`rt-big ${s.net > 0.05 ? 'up' : s.net < -0.05 ? 'down' : ''}`} data-tip={`Points the trade put into ${team(s.rid).name}'s starting lineups over ${t.weeks.length} weeks`}>{signed(s.net, f1)}<small>{'pts'}</small></b>
            </div>
            <div className="rt-recs">
              <div><small>{'With the trade'}</small><b>{rec(s.real)}</b><em>{ordinal(s.real.seed)}</em></div>
              <div className="was"><small>{'Without it'}</small><b>{rec(s.without)}</b><em>{ordinal(s.without.seed)}</em></div>
            </div>
            <h4>{'Got'}</h4>
            <ul className="rt-players">
              {s.gets.map((x) => playerRow(x, x.starts ? `${f1(x.pts)} in ${x.starts} ${x.starts === 1 ? 'start' : 'starts'}` : x.weeks ? 'never started' : 'gone before a game'))}
              {s.picksIn.map((p, j) => <li key={`p${j}`}><span className="pos PK">{'PK'}</span><span className="pl">{pickSaid(p)}</span><span className="rt-pts">{'not played yet'}</span></li>)}
              {s.faabIn ? <li><span className="pos PK">{'$'}</span><span className="pl">{`$${s.faabIn} of waiver budget`}</span><span className="rt-pts" /></li> : null}
            </ul>
            <h4>{'Gave'}</h4>
            <ul className="rt-players gave">
              {s.gave.map((x) => playerRow(x, x.cut ? `cut to make room${x.starts ? `, then ${f1(x.pts)} for others` : ''}` : x.starts ? `${f1(x.pts)} for ${x.teams.length === 1 ? short(team(x.teams[0]).name, 16) : 'others'}` : x.weeks ? 'never started since' : 'unrostered since'))}
              {s.picksOut.map((p, j) => <li key={`p${j}`}><span className="pos PK">{'PK'}</span><span className="pl">{pickSaid(p)}</span><span className="rt-pts" /></li>)}
            </ul>
            {s.onward.map((o) => (
              <p key={o.id} className="rt-onward">{stop(`Then flipped ${name(o.via)} to ${and(o.partners.map((r) => short(team(r).name, 16)))} for ${o.got.length ? and(o.got.map((g) => `${name(g.id)} (${g.starts ? `${f1(g.pts)} in ${g.starts}` : 'no starts'})`)) : 'nothing on the field'}`)}</p>
            ))}
            {s.swung.length ? <ul className="rt-swung">{s.swung.map((g) => <li key={g.w} className={g.res[0]} data-tip={`Week ${g.w} vs ${team(g.opp).name}: ${f1(g.was[0])}–${f1(g.was[1])} with the trade, ${f1(g.now[0])}–${f1(g.now[1])} without`}>{`Wk ${g.w}: ${g.res[1]} → ${g.res[0]}`}</li>)}</ul> : null}
            {many(s.rid) ? <button type="button" className="rt-link" onClick={() => onUndo(s.rid)}>{`Undo all of ${short(team(s.rid).name, 18)}'s trades`}</button> : null}
          </section>
        ))}
      </div>
      <div className="rt-why">{why(t, D, h, book).map((l, i) => <p key={i}>{l}</p>)}</div>
      <ul className="wi-chips rt-chips">
        <li>{`${f1(t.margin)}-point gap`}</li>
        <li>{`${t.sides.reduce((a, s) => a + s.swung.length, 0)} ${t.sides.reduce((a, s) => a + s.swung.length, 0) === 1 ? 'game' : 'games'} turned`}</li>
        {t.ripple.length ? <li data-tip={t.ripple.map((r) => team(r).name).join(', ')}>{`${t.ripple.length} other ${t.ripple.length === 1 ? 'record changes' : 'records change'}`}</li> : null}
        {t.later.length ? <li>{`${t.later.length} later ${t.later.length === 1 ? 'deal' : 'deals'} undone with it`}</li> : null}
      </ul>
      <button type="button" className={`rt-more${open ? ' on' : ''}`} aria-expanded={open} onClick={onToggle}>
        <span>{open ? 'Hide the numbers' : 'See week by week'}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open ? <div className="rt-fold">
        <Race t={t} D={D} h={h} />
        <Weeks t={t} D={D} h={h} book={book} />
      </div> : null}
    </article>
  );
}

// the running total of each side's points from the trade, week by week (lines in SVG, dots and labels in HTML so
// they keep their size on a phone)
function Race({ t, D, h }) {
  const { f1, short } = h;
  const pts = t.sides.map((s) => { let run = 0; return [{ w: t.start - 1, v: 0 }, ...s.added.map((a) => ({ w: a.w, v: (run += a.pts), d: a.pts }))]; });
  const all = pts.flat().map((p) => p.v);
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all), span = Math.max(10, hi - lo) * 1.12;
  const top = hi + (span - (hi - lo)) / 2;
  const X = (i, n) => (n <= 1 ? 50 : (i / (n - 1)) * 100), Y = (v) => ((top - v) / span) * 100;
  const n = pts[0].length;
  return (
    <figure className="rt-race">
      <figcaption><b>{'The race'}</b>{' Running points from the trade, from the week before it to now. Tap a dot for the week.'}</figcaption>
      <div className="rt-race-plot" role="img" aria-label={`Running points from the trade: ${t.sides.map((s) => `${D.byRid[s.rid].name} ${signed(s.net, f1)}`).join(', ')}`}>
        <span className="zero" style={{ top: `${Y(0)}%` }}><small>{'0'}</small></span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {pts.map((line, k) => { const d = line.map((p, i) => `${X(i, n)},${Y(p.v)}`).join(' '); return <g key={k}><polyline className="case" points={d} vectorEffect="non-scaling-stroke" /><polyline className={`s${k}`} points={d} vectorEffect="non-scaling-stroke" /></g>; })}
        </svg>
        {pts.map((line, k) => line.slice(1).map((p, i) => (
          <i key={`${k}:${p.w}`} className={`dot s${k}`} style={{ left: `${X(i + 1, n)}%`, top: `${Y(p.v)}%` }}
            data-tip={`Week ${p.w}, ${D.byRid[t.sides[k].rid].name}: ${signed(p.d, f1)} that week, ${signed(p.v, f1)} so far`} />
        )))}
      </div>
      <div className="rt-race-x" aria-hidden="true">{pts[0].map((p, i) => <span key={p.w} style={{ left: `${X(i, n)}%` }}>{i === 0 ? 'Before' : `Wk ${p.w}`}</span>)}</div>
      <ul className="rt-race-key">{t.sides.map((s, k) => <li key={s.rid}><i className={`s${k}`} />{`${short(D.byRid[s.rid].name, 20)} ${signed(s.net, f1)}`}</li>)}</ul>
    </figure>
  );
}

// each week: what every side's lineup had with the trade and would have had without it
function Weeks({ t, D, h, book }) {
  const { f1, short } = h, name = book.nameOf;
  const swap = (L, w) => {
    if (!L?.cf) return null;
    const inn = L.real.filter((id) => id && id !== '0' && !L.cf.includes(id));
    const out = L.cf.filter((id) => id && id !== '0' && !L.real.includes(id));
    if (!inn.length && !out.length) return null;
    const said = (ids) => (ids.length ? ids.map((id) => `${name(id)} ${f1(book.pts(w, id))}${L.pickups?.includes(id) ? ' (pickup)' : ''}`).join(', ') : 'an empty slot');
    return `${said(inn)} instead of ${said(out)}`;
  };
  return (
    <section className="rt-weeks">
      <h3>{'Week by week'}</h3>
      <ol>
        {t.weeks.map((w, i) => (
          <li key={w}>
            <span className="wi-wk">{`Week ${w}`}</span>
            <div>
              {t.sides.map((s, k) => {
                const a = s.added[i].pts, g = s.games.find((x) => x.w === w), turned = g && g.res[0] !== g.res[1];
                const line = swap(s.lineup[i], w);
                return (
                  <p key={s.rid} className={turned ? 'turned' : ''}>
                    <i className={`key s${k}`} aria-hidden="true" />
                    <b>{`${short(D.byRid[s.rid].name, 18)} ${signed(a, f1)}`}</b>
                    {line ? `: ${line}` : ': same lineup either way'}
                    {g ? ` (${g.res[0]} ${f1(g.was[0])}–${f1(g.was[1])}${turned ? `, a ${g.res[1] === 'W' ? 'win' : g.res[1] === 'L' ? 'loss' : 'tie'} without it` : ''})` : ''}
                  </p>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- too soon to call ----------

function Waiting({ R, D, h, book, me }) {
  const { short } = h, name = book.nameOf;
  return (
    <section className="panel glass span-12 rt-wait">
      <h2>{'Too soon to call'}</h2>
      <p className="sub">{`Trades with fewer than ${MIN_WEEKS} weeks of games. Each gets its verdict once the week shown is scored.`}</p>
      <ul>
        {[...R.waiting].reverse().map((t) => (
          <li key={t.id} className={t.sides.some((s) => s.rid === me) ? 'mine' : ''}>
            <span className="rt-when"><b>{`After week ${t.after}`}</b><small>{`${dateOf(t.ts)}, ${t.weeks.length} of ${MIN_WEEKS} weeks`}</small></span>
            <span className="rt-deal">{t.sides.map((s) => (
              <span key={s.rid}><TeamAvatar t={D.byRid[s.rid]} cls="avatar xs" /><b>{short(D.byRid[s.rid].name, 18)}</b>{` gets ${s.gets.length ? and(s.gets.map(name)) : s.picksIn.length ? and(s.picksIn.map(pickSaid)) : 'nothing on the field'}`}</span>
            ))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- a team's trades, undone ----------

function TeamUndo({ R, D, h, book, me, rid, many, onTeam }) {
  const { f1, short, ordinal } = h, name = book.nameOf, team = (r) => D.byRid[r];
  const mine = tradesOf(R.all, rid);
  const judged = Object.fromEntries(R.judged.map((t) => [t.id, t]));
  const [picked, setPickedRaw] = useState(() => keep.picked[rid] || mine.map((t) => t.id));
  const setPicked = (next) => setPickedRaw((cur) => { const ids = typeof next === 'function' ? next(cur) : next; keep.picked[rid] = ids; return ids; });
  const chosen = mine.filter((t) => picked.includes(t.id));
  const { forced } = withFlips(R.all, chosen);
  const res = useMemo(() => (chosen.length ? undoTeam(book, rid, chosen, R.all) : null), [book, rid, picked.join()]);
  const t = team(rid), cut = D.meta.playoffTeams;
  const toggle = (id) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allOn = picked.length === mine.length;
  const partnerOf = (x) => and(x.sides.filter((s) => s.rid !== rid).map((s) => short(team(s.rid).name, 18)));
  const sideOf = (x) => x.sides.find((s) => s.rid === rid);
  const teams = [...D.teams].filter((x) => many(x.rid)).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="panel glass span-12 rt-undo" id="rt-undo">
      <div className="rt-undo-head">
        <div>
          <h2>{'Undo the trades'}</h2>
          <p className="sub">{'Pick a team that has made more than one trade, switch any of its trades off, and the season is replayed as if they never happened: the record, the standings and the lineup it would have today.'}</p>
        </div>
        <label className="trade-pick"><span>{'Team'}</span>
          <select value={String(rid)} onChange={(e) => onTeam(Number(e.target.value))}>
            {teams.map((x) => <option key={x.rid} value={x.rid}>{`${x.name} (${tradesOf(R.all, x.rid).length} trades)`}</option>)}
          </select>
        </label>
      </div>
      <div className="filters rt-all">
        <button type="button" aria-pressed={allOn} onClick={() => setPicked(allOn ? [] : mine.map((x) => x.id))}>{allOn ? `Put all ${mine.length} back` : `Undo all ${mine.length} trades`}</button>
      </div>
      <ul className="rt-toggles">
        {mine.map((x) => {
          const on = picked.includes(x.id), dragged = !on && forced[x.id];
          const s = sideOf(x), j = judged[x.id], js = j?.sides.find((y) => y.rid === rid);
          return (
            <li key={x.id}>
              <button type="button" role="switch" aria-checked={on || !!dragged} disabled={!!dragged} className={`rt-toggle${on ? ' on' : ''}${dragged ? ' dragged' : ''}`} onClick={() => toggle(x.id)}>
                <span className="rt-sw" aria-hidden="true"><i /></span>
                <span className="rt-tg-what">
                  <b>{`Got ${s.gets.length ? and(s.gets.map(name)) : s.picksIn.length ? and(s.picksIn.map(pickSaid)) : 'nothing on the field'}`}</b>
                  <small>{`${stop(`Gave ${[...s.gave, ...s.cut].length ? and([...s.gave, ...s.cut].map(name)) : s.picksOut.length ? and(s.picksOut.map(pickSaid)) : 'nothing on the field'}`)} ${dateOf(x.ts)} with ${stop(`${partnerOf(x)}${dragged ? `. Undone anyway: they paid with ${name(forced[x.id])}` : x.start == null ? '. No games yet' : ''}`)}`}</small>
                </span>
                <span className={`rt-tg-net ${js ? (js.net > 0.05 ? 'up' : js.net < -0.05 ? 'down' : '') : ''}`} data-tip={js ? `Points this trade put into ${t.name}'s lineups` : `Judged after ${MIN_WEEKS} weeks of games`}>{js ? signed(js.net, f1) : x.weeks.length ? `${x.weeks.length} of ${MIN_WEEKS} wks` : 'New'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {!res ? <p className="rt-empty">{`Switch a trade on to see ${t.name} without it.`}</p> : <UndoResult res={res} D={D} h={h} book={book} t={t} cut={cut} n={chosen.length + Object.keys(forced).length} />}
    </section>
  );
}

function UndoResult({ res, D, h, book, t, cut, n }) {
  const { f1, short, ordinal } = h, name = book.nameOf, team = (r) => D.byRid[r];
  const b = res.real, a = res.without;
  const ms = res.games;
  const top = Math.max(50, ...ms.flatMap((x) => [x.was[0], x.now[0], x.now[1]])) * 1.04;
  const at = (v) => `${(Math.max(0, v) / top) * 100}%`;
  const grid = [50, 100, 150, 200].filter((v) => v < top);
  const playoff = a.seed <= cut && b.seed > cut ? `, in the playoff spots` : a.seed > cut && b.seed <= cut ? ', out of the playoff spots' : '';
  const nowL = res.roster.now.lineup, wo = res.roster.without.lineup;
  const back = new Set(res.roster.back);
  return (
    <div className="rt-res">
      <div className="wi-score">
        <div className="wi-big"><small>{'Real record'}</small><b className="was">{rec(b)}</b></div>
        <svg className="wi-arrow" width="34" height="16" viewBox="0 0 34 16" aria-hidden="true"><path d="M2 8h28M24 3l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <div className="wi-big"><small>{n === 1 ? 'Without the trade' : `Without ${n} trades`}</small><b>{rec(a)}</b></div>
      </div>
      <ul className="wi-chips">
        <li className={res.dw < 0 ? 'up' : res.dw > 0 ? 'down' : ''}>{res.dw ? `${res.dw > 0 ? '−' : '+'}${winsSaid(Math.abs(res.dw))}` : 'Same record'}</li>
        <li className={res.dseed < 0 ? 'up' : res.dseed > 0 ? 'down' : ''}>{`${ordinal(a.seed)} in the standings${a.seed !== b.seed ? `, was ${ordinal(b.seed)}` : ''}`}</li>
        <li className={res.dpf < -0.05 ? 'up' : res.dpf > 0.05 ? 'down' : ''}>{`${signed(-res.dpf, f1)} points for`}</li>
        <li>{`${res.swung.length} ${res.swung.length === 1 ? 'game flips' : 'games flip'}`}</li>
      </ul>
      <p className="wi-verdict">
        {`Without ${n === 1 ? 'that trade' : `those ${n} trades`}, ${t.name} would ${rec(a) === rec(b) && a.seed === b.seed ? 'still ' : ''}be `}<span className="nw">{rec(a)}</span>{` and ${ordinal(a.seed)}${playoff}`}
        {rec(a) === rec(b) && a.seed === b.seed ? null : <>{', instead of '}<span className="nw">{rec(b)}</span>{` and ${ordinal(b.seed)}`}</>}
        {`. ${n === 1 ? 'The trade is' : 'The trades are'} worth ${signed(res.added, f1)} points to its lineups so far.`}
      </p>

      <div className="rt-res-grid">
        <figure className="wi-chart">
          <div className="wi-wkc" role="img" aria-label="Each week's score, real and without the trades, with the opponent's">
            <div className="wi-wkc-row wi-wkc-axis" aria-hidden="true"><span /><span className="wi-wkc-track">{grid.map((v) => <i key={v} style={{ left: at(v) }}>{v}</i>)}</span><span /></div>
            {ms.map((x) => {
              const flip = x.res[0] !== x.res[1], was = x.was[0], now = x.now[0], d = now - was, lo = Math.min(was, now);
              const tip = `Week ${x.w} vs ${team(x.opp).name}: ${f1(was)}–${f1(x.was[1])} (${x.res[0]}) for real, ${f1(now)}–${f1(x.now[1])} (${x.res[1]}) without the trades`;
              return (
                <div key={x.w} className={`wi-wkc-row${flip ? ' flip' : ''}`} data-tip={tip}>
                  <span className="wi-wkc-n">{x.w}</span>
                  <span className="wi-wkc-track">
                    {grid.map((v) => <i key={v} className="g" style={{ left: at(v) }} />)}
                    <span className="bar base" style={{ width: at(lo) }} />
                    {d > 0.05 ? <span className="bar gain" style={{ left: at(was), width: at(d) }} /> : null}
                    {d < -0.05 ? <span className="bar lost" style={{ left: at(now), width: at(-d) }} /> : null}
                    <span className="opp" style={{ left: at(x.now[1]) }} />
                  </span>
                  <span className="wi-wkc-res"><b className={x.res[1]}>{flip ? `${x.res[0]}→${x.res[1]}` : x.res[1]}</b><small>{Math.abs(d) > 0.05 ? signed(d, f1) : 'Same'}</small></span>
                </div>
              );
            })}
          </div>
          <ul className="wi-legend">
            <li><i className="k-was" />{'Score kept'}</li>
            <li><i className="k-gain" />{'More without the trades'}</li>
            <li><i className="k-lost" />{'Less without the trades'}</li>
            <li><i className="k-opp" />{'Their score'}</li>
            <li><i className="k-flip" />{'Result flips'}</li>
          </ul>
        </figure>
        <div className="rt-lineup">
          <h3>{'The lineup today'}</h3>
          <p className="sub">{'Best lineup from each roster by points per game this season.'}</p>
          <table>
            <thead><tr><th>{'Slot'}</th><th>{'With the trades'}</th><th>{'Without them'}</th></tr></thead>
            <tbody>
              {wo.map((l, i) => {
                const r = nowL[i]?.p, x = l.p, diff = r?.id !== x?.id;
                return (
                  <tr key={i} className={diff ? 'diff' : ''}>
                    <td>{l.slot === 'SUPER_FLEX' ? 'SF' : l.slot}</td>
                    <td>{r ? <><span className="pl">{name(r.id)}</span><small>{f1(r.m)}</small></> : '—'}</td>
                    <td>{x ? <><span className="pl">{name(x.id)}</span><small>{f1(x.m)}</small>{back.has(x.id) ? <em>{'back'}</em> : null}</> : <small className="rt-open">{'Open: a waiver pickup'}</small>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {res.roster.back.length || res.roster.gone.length ? <p className="rt-roster">
            {res.roster.back.length ? <><b>{'Would still have: '}</b>{`${stop(and(res.roster.back.map(name)))} `}</> : null}
            {res.roster.gone.length ? <><b>{'Wouldn\'t have: '}</b>{stop(and(res.roster.gone.map(name)))}</> : null}
          </p> : null}
        </div>
      </div>
      <details className="rt-table wi-table">
        <summary>{'The standings without them'}</summary>
        <table>
          <thead><tr><th>{'#'}</th><th>{'Team'}</th><th>{'Record'}</th><th>{'Real'}</th></tr></thead>
          <tbody>
            {res.table.map((x) => {
              const tm = team(x.rid), mv = x.was.seed - x.seed;
              return <tr key={x.rid} className={`${x.rid === res.rid ? 'mine' : ''}${x.seed === cut ? ' cut' : ''}`}>
                <td>{x.seed}</td>
                <td><span className="wi-tm"><TeamAvatar t={tm} cls="avatar xs" />{short(tm.name, 20)}</span></td>
                <td>{rec(x)}</td>
                <td><span className={mv > 0 ? 'up' : mv < 0 ? 'down' : ''}>{`${rec(x.was)}${mv ? ` (${mv > 0 ? '+' : '−'}${Math.abs(mv)})` : ''}`}</span></td>
              </tr>;
            })}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// how the verdicts are worked out, under the page
function RetroHow() {
  return (
    <section className="panel glass span-12 wi-how">
      <h2>{'How it works'}</h2>
      <ul>
        <li>{`Only points count. For every week since a trade went through, the season is replayed with the players back where they came from, and each team's real lineup total is compared with the one it would have had. The team the trade gave the most points wins it. Rest of season rankings play no part.`}</li>
        <li>{'Without the trade, a player a team got back takes the slot of the one it lost (best average so far first); if none fits, its best benched player who fits does. A player it got back who didn\'t take a slot starts over its weakest starter at his position when his average so far beats that starter\'s.'}</li>
        <li>{'Whoever really had a player later, the team that got him or someone he was flipped or dropped to, plays without him. A later trade paid with a player from this one couldn\'t have happened, so it\'s undone too. Everything else, waiver pickups included, happened as it did.'}</li>
        <li>{`A trade needs ${MIN_WEEKS} weeks of games for a verdict. Records are recomputed for the whole league: wins, ties half, then points for. Points are the league's own scoring; weeks a player sat on waivers use Sleeper's half-PPR stats. Draft picks and waiver budget can't score, so they're listed but not counted.`}</li>
      </ul>
    </section>
  );
}
