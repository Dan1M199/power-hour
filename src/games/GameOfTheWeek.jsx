// The game of the week (keyMatchup in lib/stories.js), as a fight poster: both managers nose to nose, the headline, the
// projected score, and the playoff drive: each team a football on a field from 0% playoff odds to the end zone at 100%;
// pick a result and both balls move to where the simulations say it leaves them.
import { useState } from 'react';
import { ChampBadge, Headshot, Xp } from '../shared.jsx';

function Faceoff({ p, a, b, h }) {
  const favA = p.winA >= 0.5;
  const side = (t, k, win, fav) => (
    <div className={`fo-side ${k}`}>
      <span className="fo-ph"><Headshot t={t} cls="fo-face" h={h} /><ChampBadge t={t} h={h} /></span>
      <div className="fo-tag">
        {fav ? <span className="fo-fav">Favourite</span> : <span className="fo-fav dog">Underdog</span>}
        <b>{h.first(t)}</b>
        <small>{`${t.name}, ${h.record(t)}`}</small>
        <span className="fo-odds">{h.pct(win)}<small> to win</small></span>
      </div>
    </div>
  );
  return <div className="faceoff" aria-hidden="true">{side(a, 'a', p.winA, favA)}<span className="fo-vs"><i>vs</i></span>{side(b, 'b', 1 - p.winA, !favA)}</div>;
}

function Drive({ a, b, h }) {
  const [s, setS] = useState('now');
  const odds = (t, won) => (won ? t.playoffIfWin : t.playoffIfLoss) ?? t.playoffPct;
  const st = { now: [a.playoffPct, b.playoffPct], a: [odds(a, true), odds(b, false)], b: [odds(a, false), odds(b, true)] };
  const names = [a.name, b.name];
  const lane = (side, k) => {
    const v = st[s][k], pts = Math.round((v - st.now[k]) * 100);
    return (
      <div className={`lane ${side}`} style={Object.fromEntries(Object.entries(st).map(([x, w]) => [`--at-${x}`, w[k].toFixed(3)]))}>
        <span className="ghost" aria-hidden="true" />
        <span className="runner" aria-hidden="true"><span className="ball"><b className="ball-pct">{h.pct(v)}</b><small className={`ball-gain ${pts > 0 ? 'up' : 'down'}`}>{s === 'now' || !pts ? '' : `${pts > 0 ? '+' : ''}${pts}`}</small></span></span>
      </div>
    );
  };
  const move = (k) => { const pts = Math.round((st[s][k] - st.now[k]) * 100); return `${names[k]} ${pts >= 0 ? 'climbs' : 'drops'} to ${h.pct(st[s][k])} (${pts >= 0 ? '+' : ''}${pts})`; };
  const btn = (x, label) => <button type="button" aria-pressed={s === x} onClick={() => setS(x)}>{label}</button>;
  return (
    <div className="drive" data-s={s}>
      <div className="drive-head">
        <h3>The playoff drive</h3>
        <p className="drive-key"><span className="a"><Headshot t={a} cls="avatar" h={h} />{a.name}</span><span className="b"><Headshot t={b} cls="avatar" h={h} />{b.name}</span></p>
        <div className="drive-pick" role="group" aria-label="Show playoff odds after a result">{btn('now', 'Today')}{btn('a', `${h.first(a)} wins`)}{btn('b', `${h.first(b)} wins`)}</div>
      </div>
      <div className="drive-field">
        <span className="endzone" aria-hidden="true">Playoffs</span>
        {[0.25, 0.5, 0.75].map((x) => <span key={x} className="yard" style={{ '--y': x }} aria-hidden="true">{x * 100}</span>)}
        {lane('a', 0)}{lane('b', 1)}
      </div>
      <p className="drive-note" aria-live="polite">{s === 'now'
        ? `Today ${names[0]} sits at ${h.pct(st.now[0])} playoff odds and ${names[1]} at ${h.pct(st.now[1])}. Pick a result to see where it sends them.`
        : `If ${names[s === 'a' ? 0 : 1]} wins: ${move(s === 'a' ? 0 : 1)}, ${move(s === 'a' ? 1 : 0)}.`}</p>
    </div>
  );
}

export function GameOfTheWeek({ D, h, onBreakdown }) {
  const k = D.key;
  if (!k) return null;
  const { p } = k, a = D.byRid[p.a], b = D.byRid[p.b];
  return (
    <section className="gotw glass rim" aria-labelledby="gotw-hed">
      <Faceoff p={p} a={a} b={b} h={h} />
      <div className="gotw-copy">
        <p className="kicker"><span>Game of the week</span><span className="k">{`${a.name} vs ${b.name}`}</span></p>
        <h2 id="gotw-hed">{k.headline}</h2>
        <p className="lead-deck">{k.deck}</p>
        <div className="gotw-score">
          <div><span className="tn">{a.name}</span><b>{h.f1(p.projA)}</b></div>
          <div className="wp-bar" role="img" aria-label={`${a.name} ${h.pct(p.winA)}, ${b.name} ${h.pct(1 - p.winA)}`}><i style={{ width: `${p.winA * 100}%` }} /><i style={{ width: `${(1 - p.winA) * 100}%` }} /></div>
          <div className="right"><span className="tn">{b.name}</span><b>{h.f1(p.projB)}</b></div>
        </div>
        <button type="button" className="gotw-more" onClick={() => onBreakdown(k.i)}>Lineup breakdown<Xp /></button>
      </div>
      <div className="gotw-chart">
        <Drive a={a} b={b} h={h} />
        <p className="sub">{`Picked from this week's slate by stakes (${Math.round(p.stakes * 100)} combined points of playoff odds on the line, ${Math.round(k.stakesNorm * 100)}% of the week's biggest) and closeness (${Math.round(k.closeness * 100)} out of 100, where 100 is a dead-even projection).`}</p>
      </div>
    </section>
  );
}
