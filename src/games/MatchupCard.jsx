// One game's card on the Games page: the two teams with their projections, the win odds and the moneyline, the rest
// of the book behind "More odds", fan picks, and the lineup breakdown behind its own button (the page opens and
// closes it, so the grid can glide).
import { useState } from 'react';
import { ChampTag, TeamAvatar, Xp } from '../shared.jsx';
import { Breakdown } from './Breakdown.jsx';
import { castVote, pairKey } from './votes.js';

// the bottom two playing each other (by standings or by power rank) get a "Toilet Time" tag on their card, by Dan's
// request: the tooltip rubs it in with the records
function toiletBowl(a, b, n, h) {
  const low = (t, k) => t[k] >= n - 1;
  const by = ['seed', 'powerRank'].find((k) => low(a, k) && low(b, k));
  if (!by) return '';
  const [lo, hi] = [a, b].sort((x, y) => y[by] - x[by]);
  return `${by === 'seed' ? 'Last and second-to-last in the standings' : 'The bottom two in the power rankings'}: ${h.first(hi)} (${h.record(hi)}) vs ${h.first(lo)} (${h.record(lo)}). Somebody gets flushed.`;
}
const Toilet = () => <svg width="13" height="14" viewBox="0 0 13 14" aria-hidden="true"><path d="M2 1h4v5H2zM1 6h11c0 3-2 5-4 5l1 2H4l1-2C3 11 1 9 1 6z" fill="currentColor" /></svg>;

// normal CDF (Abramowitz-Stegun), for the prop odds
function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2);
  const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - q : q;
}

// sportsbook-style line from the projections: the moneyline stays on the card, everything else sits behind "More odds"
function BetLine({ D, p, a, b, i, stakes, h, open, onToggle }) {
  const { f1, pct, american, half } = h;
  const fav = p.projA >= p.projB ? a : b, margin = Math.abs(p.projA - p.projB), even = margin < 0.25;
  // the margin is normal with the two teams' week spreads combined, the same model as the win odds
  const sdOf = (t) => t.sdWeek?.[p.week] ?? D.meta.sd, sd = Math.hypot(sdOf(a), sdOf(b));
  const within = (x) => phi((x - (p.projA - p.projB)) / sd) - phi((-x - (p.projA - p.projB)) / sd);
  const close = within(5), blowout = 1 - within(20);
  const B = D.bull && D.bull.state !== 'final' && D.bull.rows.length ? D.bull : null;
  const bull = (rid) => B.rows.find((r) => r.rid === rid)?.pWin ?? 0;
  const tile = (label, val, sub = '', tip = '') => <span data-tip={tip || undefined}><small>{label}</small><b>{val}</b>{sub ? <small className="who">{sub}</small> : null}</span>;
  const pair = (label, va, vb, tip) => <span className="pair" data-tip={tip}><small>{label}</small><b className="a">{va}</b><b className="b">{vb}</b></span>;
  return <>
    <div className="ml" data-tip="Fair moneyline from the win odds: minus is the favourite (bet that much to win 100), plus is the underdog (what 100 wins).">
      <b className="a">{american(p.winA)}</b><small>Moneyline</small><b className="b">{american(1 - p.winA)}</b>
    </div>
    <button type="button" className="odds-more" aria-expanded={open} aria-controls={`odds-${i}`} onClick={onToggle}><span>More odds</span><Xp /></button>
    <div className="detail odds-detail" id={`odds-${i}`}><div>
      <div className="line">
        {tile('Spread', even ? 'Pick' : `-${half(margin)}`, even ? '' : fav.name, 'From the projected margin')}
        {tile('Total', half(p.projA + p.projB), 'combined points', 'Projected combined score')}
        {pair('Team totals', f1(p.projA), f1(p.projB), `${a.name} ${f1(p.projA)}, ${b.name} ${f1(p.projB)} projected`)}
        {tile('Nail-biter', american(close), 'margin under 5', `${pct(close)} chance the final margin is under 5 points`)}
        {tile('Blowout', american(blowout), 'margin 20+', `${pct(blowout)} chance the final margin is 20 points or more`)}
        {B ? pair(`Closest to ${B.target}`, american(bull(p.a)), american(bull(p.b)), `Money week: odds each team lands closest to ${B.target} of all twelve and takes ${h.moneyWeek.prize}`) : null}
      </div>
      {stakes ? <p className="mu-note">{stakes}</p> : null}
    </div></div>
  </>;
}

// fan picks: pick a side; the split stays hidden until you've picked, so nobody just follows the crowd
function Fans({ D, p, votes, error, h }) {
  if (!votes || votes.week !== p.week) return null;
  const pair = pairKey(p), c = votes.counts[pair] || {}, mine = votes.mine?.[pair];
  const na = c[p.a] || 0, nb = c[p.b] || 0, n = na + nb, fa = n ? na / n : 0.5;
  const A = D.byRid[p.a], B = D.byRid[p.b];
  const pick = (t) => <button type="button" className={`pick ${String(t.rid) === mine ? 'on' : ''}`} aria-pressed={String(t.rid) === mine} onClick={() => castVote(pair, String(t.rid))}>{h.short(t.name, 18)}</button>;
  const reveal = n > 0 && (mine || !votes.open);
  const head = !votes.open ? 'Fan picks (voting closed)' : mine ? 'Your pick is in. Tap the other side to switch.' : 'Who wins? Cast your pick';
  return <>
    <div className="fan">
      <div className="fan-head"><span>{head}</span><small>{`${n} fan vote${n === 1 ? '' : 's'}`}</small></div>
      {votes.open ? <div className="picks">{pick(A)}{pick(B)}</div> : null}
      {reveal ? <>
        <div className="wp-bar fan-bar" role="img" aria-label={`Fans: ${h.pct(fa)} ${A.name}, ${h.pct(1 - fa)} ${B.name}`}><i style={{ width: `${fa * 100}%` }} /><i style={{ width: `${(1 - fa) * 100}%` }} /></div>
        <div className="wp-labels"><span>{`Fans ${h.pct(fa)}`}</span><span>{h.pct(1 - fa)}</span></div>
      </> : null}
    </div>
    {error && error.pair === pair ? <p className="fan-err">{error.msg}</p> : null}
  </>;
}

// points already on the board this week (games played so far); the big number is that plus the rest projected
const Live = ({ pts, h }) => (pts == null ? null : <small className="live" data-tip="Points scored in games already played. The big number adds the projection for everyone still to play.">{`${h.f1(pts)} scored so far`}</small>);
// money week: how far this team projects from the target
const Bull = ({ rid, h }) => { const x = h.bull(rid); return x ? <small className={`bull-tag${x.lead ? ' lead' : ''}`} data-tip={x.tip}>{x.text}</small> : null; };

export function MatchupCard({ D, p, i, me, h, votes, error, open, opened, onOpen, cardRef }) {
  const [odds, setOdds] = useState(false);
  const a = D.byRid[p.a], b = D.byRid[p.b], isKey = D.key && D.key.i === i;
  const swing = (t) => (t.playoffIfWin != null && t.playoffIfLoss != null ? Math.round((t.playoffIfWin - t.playoffIfLoss) * 100) : null);
  const sa = swing(a), sb = swing(b);
  const stakes = sa != null && sb != null ? `Playoff odds on the line: ${sa} pts for ${a.name}, ${sb} for ${b.name}.` : '';
  const toilet = toiletBowl(a, b, D.teams.length, h);
  const side = (t, pr, live, right) => (
    <div className={`mu-team${right ? ' right' : ''}`}><TeamAvatar t={t} /><span className="tn">{t.name}<ChampTag t={t} h={h} label={false} /></span><small>{`#${t.powerRank} power, ${h.record(t)}`}</small><Live pts={live} h={h} /><span className="pr">{h.f1(pr)}</span><Bull rid={t.rid} h={h} /></div>
  );
  const cls = ['mu glass', p.a === me || p.b === me ? 'rim' : '', isKey ? 'key' : '', toilet ? 'toilet' : '', open ? 'open' : '', odds ? 'odds-open' : ''].join(' ');
  return (
    <article ref={cardRef} className={cls} id={`mu-${i}`} data-i={i}>
      {isKey ? <span className="key-tag">Game of the week</span> : null}
      {toilet ? <span className="toilet-tag" data-tip={toilet}><Toilet />Toilet Time</span> : null}
      <p className="mu-quip">{D.quips[i]}</p>
      <div className="mu-teams">
        {side(a, p.projA, p.liveA, false)}
        <span className="vs" aria-hidden="true">vs</span>
        {side(b, p.projB, p.liveB, true)}
      </div>
      <div className="wp"><div className="wp-bar" role="img" aria-label={`${a.name} ${h.pct(p.winA)}, ${b.name} ${h.pct(1 - p.winA)}`}><i style={{ width: `${p.winA * 100}%` }} /><i style={{ width: `${(1 - p.winA) * 100}%` }} /></div>
        <div className="wp-labels odds"><span className="a">{h.pct(p.winA)}<small>to win</small></span><span className="b">{h.pct(1 - p.winA)}<small>to win</small></span></div></div>
      <BetLine D={D} p={p} a={a} b={b} i={i} stakes={stakes} h={h} open={odds} onToggle={() => setOdds((x) => !x)} />
      <div className="fan-slot" data-i={i}><Fans D={D} p={p} votes={votes} error={error} h={h} /></div>
      <button type="button" className="mu-more" aria-expanded={open} aria-controls={`mud-${i}`} onClick={onOpen}><span>Lineup breakdown</span><Xp /></button>
      <div className="detail mu-detail" id={`mud-${i}`}><div>{opened ? <Breakdown D={D} pv={p} h={h} /> : null}</div></div>
    </article>
  );
}
