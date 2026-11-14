// The week as cards (Dan's request Nov 14): one card per team, best projected final first. Each card carries a health
// bar for the week (dark is what's banked, striped is the projection still to come, the white notch is the opponent's
// projected final) and the win odds as an activity ring. A tap flips the card to the scoreboard side: both teams'
// bars against each other, the gap and who's still to play. On phones the cards sit four to a page, two by two, and
// the pages swipe sideways (scroll snap, so the browser does the gesture); from 761px every card shows at once.
import { useEffect, useRef, useState } from 'react';
import { ChampTag, Ring, TeamAvatar } from '../shared.jsx';

const PER = 4;

// one health bar: banked solid, the rest striped, an optional notch at the rival's projected final
function Hp({ banked, proj, max, tone, notch, label }) {
  const rest = Math.max(0, proj - banked), w = (x) => `${Math.min(100, (x / max) * 100)}%`;
  return (
    <span className={`hp ${tone}`} role="img" aria-label={label}>
      <i className="hp-bk" style={{ width: w(banked) }} />
      <i className="hp-rs" style={{ width: w(rest) }} />
      {notch != null ? <b className="hp-notch" style={{ left: w(notch) }} /> : null}
    </span>
  );
}

const toneOf = (r) => (r.final || r.locked ? (r.ahead ? 'good' : 'bad') : r.win >= 0.6 ? 'good' : r.win <= 0.4 ? 'bad' : 'toss');

function Card({ r, i, n, o, me, max, fin, h, open, onFlip }) {
  const { f1, pct } = h, t = r.t, tone = toneOf(r), O = r.opp ? r.opp.name : 'their opponent';
  const done = r.final || r.locked;
  const word = r.final ? (r.ahead ? 'Won' : 'Lost') : r.locked ? (r.ahead ? 'Locked up' : "Can't catch up") : r.win >= 0.6 ? 'Favourite' : r.win <= 0.4 ? 'Underdog' : 'Toss-up';
  const left = r.left.length, gap = o ? r.proj - o.proj : 0;
  const hpSaid = `${f1(r.banked)} scored, ${f1(Math.max(0, r.proj - r.banked))} more projected, ${f1(r.proj)} in all${o ? `; ${O} projects ${f1(o.proj)}` : ''}`;
  return (
    <li className={`wc ${tone}${t.rid === me ? ' mine' : ''}${i === 0 ? ' top' : ''}${i === n - 1 ? ' last' : ''}${open ? ' flipped' : ''}`}>
      <button type="button" className="wc-in" aria-pressed={open} onClick={onFlip}
        aria-label={`${i + 1}. ${t.name}, ${f1(r.proj)} ${fin ? 'final' : 'projected'}. ${open ? 'Showing the matchup, tap to flip back' : 'Tap for the matchup'}`}>
        <span className="wc-face front" aria-hidden={open}>
          <span className="wc-top">
            <span className="wc-n">{i + 1}</span>
            <TeamAvatar t={t} cls="avatar wc-av" />
            <Ring v={done ? (r.ahead ? 1 : 0) : r.win} mine={t.rid === me}><b>{done ? (r.ahead ? 'W' : 'L') : pct(r.win)}</b></Ring>
          </span>
          <b className="wc-name">{t.name}<ChampTag t={t} h={h} label={false} /></b>
          <span className="wc-pts"><b>{f1(r.proj)}</b><small>{fin ? 'final' : 'projected'}</small></span>
          <Hp banked={r.banked} proj={r.proj} max={max} tone={tone} notch={o && !fin ? o.proj : null} label={hpSaid} />
          <span className="wc-foot">
            <span>{fin ? `vs ${h.short(O, 14)}` : `${f1(r.banked)} in`}</span>
            <span>{fin ? word : left ? `${left} to play` : 'all done'}</span>
          </span>
          <span className={`wc-word ${tone}`}>{word}</span>
        </span>
        <span className="wc-face back" aria-hidden={!open}>
          <small className="wc-vs">{`${fin ? 'Final' : 'This week'} vs ${O}`}</small>
          <span className="wc-duel">
            <span className="wc-row"><em>{h.short(t.name, 13)}</em><b>{f1(r.proj)}</b></span>
            <Hp banked={r.banked} proj={r.proj} max={max} tone={tone} label={`${t.name}: ${hpSaid}`} />
            {o ? <>
              <span className="wc-row"><em>{h.short(O, 13)}</em><b>{f1(o.proj)}</b></span>
              <Hp banked={o.banked} proj={o.proj} max={max} tone="opp" label={`${O}: ${f1(o.banked)} scored, ${f1(o.proj)} in all`} />
            </> : null}
          </span>
          <span className="wc-gap">{o ? (Math.abs(gap) < 0.05 ? 'Dead level' : `${gap > 0 ? 'Up' : 'Down'} ${f1(Math.abs(gap))}${fin || done ? '' : `, ${pct(r.win)} to win`}`) : word}</span>
          <span className="wc-left">{left
            ? `Still to play: ${r.left.slice(0, 3).map((x) => `${x.name.split(' ').slice(-1)[0]} ${f1(x.proj)}`).join(', ')}${left > 3 ? `, +${left - 3}` : ''}`
            : fin ? 'Every game is in.' : 'Nobody left to play.'}</span>
        </span>
      </button>
    </li>
  );
}

export function WeekCards({ rows, me, h, fin }) {
  const n = rows.length, max = Math.max(1, ...rows.map((r) => r.proj)) * 1.04;
  const byRid = new Map(rows.map((r) => [r.t.rid, r]));
  const pages = [];
  for (let k = 0; k < n; k += PER) pages.push(rows.slice(k, k + PER));
  const mine = Math.floor(rows.findIndex((r) => r.t.rid === me) / PER);
  const [open, setOpen] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const track = useRef(null), frame = useRef(0);
  const flip = (rid) => setOpen((s) => { const x = new Set(s); x.has(rid) ? x.delete(rid) : x.add(rid); return x; });
  // which page is showing, read once a frame while the track scrolls
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { const el = track.current; if (el && el.clientWidth) setPage(Math.round(el.scrollLeft / el.clientWidth)); });
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const go = (k) => {
    const el = track.current; if (!el) return;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: k * el.clientWidth, behavior: calm ? 'auto' : 'smooth' });
  };
  return <>
    <div className="wc-track" ref={track} onScroll={onScroll}>
      {pages.map((p, k) => (
        <ol key={k} className="wc-page" start={k * PER + 1} aria-label={`Teams ${k * PER + 1} to ${k * PER + p.length}`}>
          {p.map((r, j) => {
            const i = k * PER + j;
            return <Card key={r.t.rid} r={r} i={i} n={n} o={r.opp ? byRid.get(r.opp.rid) : null} me={me} max={max} fin={fin} h={h}
              open={open.has(r.t.rid)} onFlip={() => flip(r.t.rid)} />;
          })}
        </ol>
      ))}
    </div>
    <div className="wc-pager" role="group" aria-label="Pages">
      <button type="button" className="wc-arrow" aria-label="Previous four" disabled={page <= 0} onClick={() => go(page - 1)}>‹</button>
      {pages.map((p, k) => (
        <button key={k} type="button" className={`wc-dot${k === page ? ' on' : ''}${k === mine ? ' you' : ''}`} aria-current={k === page ? 'true' : undefined}
          onClick={() => go(k)}>{`${k * PER + 1}–${k * PER + p.length}`}</button>
      ))}
      <button type="button" className="wc-arrow" aria-label="Next four" disabled={page >= pages.length - 1} onClick={() => go(page + 1)}>›</button>
    </div>
  </>;
}
