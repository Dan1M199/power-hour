// The week as cards (Dan's request Nov 14): one card per team, best projected final first. Each card carries a health
// bar for the week (solid is what's banked, striped is the projection still to come, the white notch is the
// opponent's projected final) and the win odds as an activity ring. A tap flips the card to the scoreboard side: both
// teams' bars, the gap, who's still to play, and a button to the opponent's own card. On phones the cards sit four to
// a page, two by two, and the pages swipe sideways (scroll snap, so the browser does the gesture; the next page peeks
// in at the edge so it's plain there's more); from 761px every card shows at once.
//
// Interaction pass (Nov 14): every card shows its flip glyph (the trigger is never only a gesture); until a device has
// flipped one card, the first card peeks over once to teach it (`ph-wc-flipped`, then never again); a flip and each page
// a swipe crosses tick the haptic; the back's "Their card" jumps to the opponent (paging over on phones) and pings it.
import { useEffect, useRef, useState } from 'react';
import { ChampTag, Ring, TeamAvatar } from '../shared.jsx';
import { haptic } from '../touch.js';

const PER = 4, LEARNED = 'ph-wc-flipped';
const learned = () => { try { return localStorage.getItem(LEARNED) === '1'; } catch { return true; } };
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// one health bar: banked solid, the rest striped, an optional notch at the rival's projected final
function Hp({ banked, proj, max, tone, notch, label, tip }) {
  const rest = Math.max(0, proj - banked), w = (x) => `${Math.min(100, (x / max) * 100)}%`;
  return (
    <span className={`hp ${tone}`} role="img" aria-label={label} data-tip={tip}>
      <i className="hp-bk" style={{ width: w(banked) }} />
      <i className="hp-rs" style={{ width: w(rest) }} />
      {notch != null ? <b className="hp-notch" style={{ left: w(notch) }} /> : null}
    </span>
  );
}

// two curved arrows: this card turns over
const Turn = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 8a6 6 0 0 1 10.6-3.2M16 12a6 6 0 0 1-10.6 3.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M15.4 1.8v3.6h-3.6M4.6 18.2v-3.6h3.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

const toneOf = (r) => (r.final || r.locked ? (r.ahead ? 'good' : 'bad') : r.win >= 0.6 ? 'good' : r.win <= 0.4 ? 'bad' : 'toss');

function Card({ r, i, n, o, me, max, fin, h, open, teach, ping, onFlip, onJump }) {
  const { f1, pct } = h, t = r.t, tone = toneOf(r), O = r.opp ? r.opp.name : 'their opponent';
  const done = r.final || r.locked;
  const word = r.final ? (r.ahead ? 'Won' : 'Lost') : r.locked ? (r.ahead ? 'Locked up' : "Can't catch up") : r.win >= 0.6 ? 'Favourite' : r.win <= 0.4 ? 'Underdog' : 'Toss-up';
  const left = r.left.length, gap = o ? r.proj - o.proj : 0;
  const hpSaid = `${f1(r.banked)} scored, ${f1(Math.max(0, r.proj - r.banked))} more projected, ${f1(r.proj)} in all${o ? `; ${O} projects ${f1(o.proj)}` : ''}`;
  const cls = ['wc', tone, t.rid === me && 'mine', i === 0 && 'top', i === n - 1 && 'last', open && 'flipped', teach && 'teach', ping && 'ping'].filter(Boolean).join(' ');
  return (
    <li className={cls} data-rid={t.rid}>
      <div className="wc-in">
        <button type="button" className="wc-face front" aria-hidden={open} tabIndex={open ? -1 : 0} aria-expanded={open} onClick={onFlip}
          aria-label={`${i + 1}. ${t.name}, ${f1(r.proj)} ${fin ? 'final' : 'projected'}, ${done ? word : `${pct(r.win)} to win`}. Show the matchup`}>
          <span className="wc-top">
            <span className="wc-n">{i + 1}</span>
            <TeamAvatar t={t} cls="avatar wc-av" />
            <Ring v={done ? (r.ahead ? 1 : 0) : r.win} mine={t.rid === me}><b>{done ? (r.ahead ? 'W' : 'L') : pct(r.win)}</b></Ring>
          </span>
          <b className="wc-name">{t.name}<ChampTag t={t} h={h} label={false} /></b>
          <span className="wc-pts"><b>{f1(r.proj)}</b><small>{fin ? 'final' : 'projected'}</small></span>
          <Hp banked={r.banked} proj={r.proj} max={max} tone={tone} notch={o && !fin ? o.proj : null} label={hpSaid} tip={`${t.name}: ${hpSaid}`} />
          <span className="wc-foot">
            <span>{fin ? `vs ${h.short(O, 14)}` : `${f1(r.banked)} in`}</span>
            <span>{fin ? word : left ? `${left} to play` : 'all done'}</span>
          </span>
          <span className="wc-tag"><span className={`wc-word ${tone}`}>{word}</span><span className="wc-turn"><Turn /></span></span>
        </button>
        <div className="wc-face back" aria-hidden={!open} onClick={onFlip}>
          <small className="wc-vs">{`${fin ? 'Final' : 'This week'} vs ${O}`}</small>
          <span className="wc-duel">
            <span className="wc-row"><em>{h.short(t.name, 13)}</em><b>{f1(r.proj)}</b></span>
            <Hp banked={r.banked} proj={r.proj} max={max} tone={tone} label={`${t.name}: ${hpSaid}`} />
            {o ? <>
              <span className="wc-row"><em>{h.short(O, 13)}</em><b>{f1(o.proj)}</b></span>
              <Hp banked={o.banked} proj={o.proj} max={max} tone="opp" label={`${O}: ${f1(o.banked)} scored, ${f1(o.proj)} in all`} />
            </> : null}
          </span>
          <span className="wc-gap">{o ? (Math.abs(gap) < 0.05 ? 'Dead level' : `${gap > 0 ? 'Up' : 'Down'} ${f1(Math.abs(gap))}${done ? '' : `, ${pct(r.win)} to win`}`) : word}</span>
          <span className="wc-left">{left
            ? `Still to play: ${r.left.slice(0, 3).map((x) => `${x.name.split(' ').slice(-1)[0]} ${f1(x.proj)}`).join(', ')}${left > 3 ? `, +${left - 3}` : ''}`
            : fin ? 'Every game is in.' : 'Nobody left to play.'}</span>
          <span className="wc-acts">
            {o ? <button type="button" className="wc-jump" tabIndex={open ? 0 : -1} onClick={(e) => { e.stopPropagation(); onJump(o.t.rid); }}>{`${h.first(o.t)}'s card`}</button> : <span />}
            <button type="button" className="wc-turn back" tabIndex={open ? 0 : -1} aria-label={`Flip ${t.name} back`} onClick={(e) => { e.stopPropagation(); onFlip(); }}><Turn /></button>
          </span>
        </div>
      </div>
    </li>
  );
}

export function WeekCards({ rows, me, h, fin }) {
  const n = rows.length, max = Math.max(1, ...rows.map((r) => r.proj)) * 1.04;
  const byRid = new Map(rows.map((r) => [r.t.rid, r]));
  const pages = [];
  for (let k = 0; k < n; k += PER) pages.push(rows.slice(k, k + PER));
  const pageOf = (rid) => Math.floor(rows.findIndex((r) => r.t.rid === rid) / PER);
  const mine = me ? pageOf(me) : -1;
  const [open, setOpen] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [teach, setTeach] = useState(() => !learned());
  const [ping, setPing] = useState(null);
  const track = useRef(null), frame = useRef(0), shown = useRef(0), pingT = useRef(0);
  useEffect(() => () => { cancelAnimationFrame(frame.current); clearTimeout(pingT.current); }, []);

  const flip = (rid) => {
    haptic();
    setOpen((s) => { const x = new Set(s); x.has(rid) ? x.delete(rid) : x.add(rid); return x; });
    if (teach) { setTeach(false); try { localStorage.setItem(LEARNED, '1'); } catch { /* private mode */ } }
  };
  // the page nearest the track's left edge (pages are narrower than the track on phones, so the next one peeks in)
  const nearest = () => {
    const el = track.current; if (!el) return 0;
    const kids = [...el.children]; let best = 0;
    kids.forEach((p, k) => { if (Math.abs(p.offsetLeft - el.scrollLeft) < Math.abs(kids[best].offsetLeft - el.scrollLeft)) best = k; });
    return best;
  };
  const onScroll = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const k = nearest();
      if (k !== shown.current) { shown.current = k; setPage(k); haptic(); } // a tick as each page passes, like a detent
    });
  };
  const go = (k) => {
    const el = track.current, p = el?.children[k]; if (!p) return;
    if (el.scrollWidth > el.clientWidth + 4) el.scrollTo({ left: p.offsetLeft, behavior: calm() ? 'auto' : 'smooth' });
  };
  // from a card's back to its opponent's card: page over to it (phones) or bring it on screen (desktop), then ping it
  const jump = (rid) => {
    const el = track.current, li = el?.querySelector(`.wc[data-rid="${rid}"]`); if (!li) return;
    setOpen((s) => { if (!s.has(rid)) return s; const x = new Set(s); x.delete(rid); return x; });
    if (el.scrollWidth > el.clientWidth + 4) go(pageOf(rid));
    else li.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' });
    setPing(rid); clearTimeout(pingT.current); pingT.current = setTimeout(() => setPing(null), 1600);
    haptic();
    li.querySelector('.wc-face.front')?.focus({ preventScroll: true });
  };

  return <>
    <div className="wc-track" ref={track} onScroll={onScroll} style={{ '--wc-cols': `repeat(${pages.length - 1}, calc(100% - 22px)) 100%` }}>
      {pages.map((p, k) => (
        <ol key={k} className="wc-page" start={k * PER + 1} aria-label={`Teams ${k * PER + 1} to ${k * PER + p.length}`}>
          {p.map((r, j) => {
            const i = k * PER + j;
            return <Card key={r.t.rid} r={r} i={i} n={n} o={r.opp ? byRid.get(r.opp.rid) : null} me={me} max={max} fin={fin} h={h}
              open={open.has(r.t.rid)} teach={teach && i === 0} ping={ping === r.t.rid} onFlip={() => flip(r.t.rid)} onJump={jump} />;
          })}
        </ol>
      ))}
    </div>
    <div className="wc-pager" role="group" aria-label="Pages of teams">
      <button type="button" className="wc-arrow" aria-label="Previous four" disabled={page <= 0} onClick={() => go(page - 1)}>‹</button>
      {pages.map((p, k) => (
        <button key={k} type="button" className={`wc-dot${k === page ? ' on' : ''}${k === mine ? ' you' : ''}`} aria-current={k === page ? 'true' : undefined}
          aria-label={`Teams ${k * PER + 1} to ${k * PER + p.length}${k === mine ? ', your team' : ''}`} onClick={() => go(k)}>{`${k * PER + 1}–${k * PER + p.length}`}</button>
      ))}
      <button type="button" className="wc-arrow" aria-label="Next four" disabled={page >= pages.length - 1} onClick={() => go(page + 1)}>›</button>
    </div>
  </>;
}
