// The trade graphic under a trade headline (Dan's request Nov 6), in place of the team rows: who got which players,
// drawn three ways, the one shown picked per headline at the headline desk (tradeStyle). The data is st.trade, built
// in app.js (withTrade) from the snapshot's feed: each side's incoming players with consensus values, the roster spots
// a side taking more bodies has to clear, and each side's net over replacement, the same numbers as the trade ledger.
//   handoff  each side a lane of the players it gets, arrows across the middle (any number of teams)
//   seesaw   the players as trading cards on each end of a plank that tips toward whoever won on value (two teams)
//   receipt  an itemized trade slip stapled to the board, with a verdict stamp
import { useState } from 'react';
import { Headshot } from '../shared.jsx';

const f1 = (x) => (x == null || Number.isNaN(x) ? '–' : Number(x).toFixed(1));
const total = (s) => s.gets.reduce((a, p) => a + (p.v || 0), 0);
// the two sides that matter for a verdict: the best and worst net
const ends = (sides) => { const o = [...sides].sort((a, b) => b.net - a.net); return [o[0], o[o.length - 1]]; };

// a player's Sleeper headshot, or his initials (team defenses have no picture)
function Mug({ p, cls = 'tg-mug' }) {
  const [failed, setFailed] = useState(false);
  const initials = p.name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return failed
    ? <span className={`${cls} ph`} aria-hidden="true">{initials}</span>
    : <img className={cls} src={`https://sleepercdn.com/content/nfl/players/thumb/${p.id}.jpg`} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
// two arrows passing each other, the swap between the lanes
const Swap = () => (
  <svg viewBox="0 0 28 36" width="28" height="36"><path d="M24 9H5m0 0 5-5M5 9l5 5M4 27h19m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Pos = ({ pos }) => (pos ? <span className={`pos ${pos}`}>{pos}</span> : null);
const MAX = 4;

function Handoff({ trade, D, h }) {
  const two = trade.sides.length === 2;
  const lane = (s) => {
    const t = D.byRid[s.rid], more = s.gets.length - MAX;
    return (
      <div className="tg-lane" key={s.rid}>
        <div className="tg-who">{t ? <Headshot t={t} cls="tg-face" h={h} /> : null}<span><b>{`${s.first} gets`}</b><small>{`value ${f1(total(s))}`}</small></span></div>
        <ul>
          {s.gets.slice(0, MAX).map((p) => <li key={p.id}><Pos pos={p.pos} /><span className="tg-n">{p.short}</span><em>{f1(p.v)}</em></li>)}
          {more > 0 ? <li className="tg-more">{`and ${more} more`}</li> : null}
          {s.picks.map((x) => <li key={x} className="tg-pick"><span className="tg-n">{x}</span></li>)}
          {!s.gets.length && !s.picks.length ? <li className="tg-more">Nothing back</li> : null}
        </ul>
      </div>
    );
  };
  return (
    <div className={`tg tg-handoff${two ? ' two' : ''}`} style={{ '--n': trade.sides.length }}>
      {two ? <>{lane(trade.sides[0])}<div className="tg-arrows" aria-hidden="true"><Swap /></div>{lane(trade.sides[1])}</> : trade.sides.map(lane)}
    </div>
  );
}

function Seesaw({ trade, D, h }) {
  const [a, b] = trade.sides;
  const gap = Math.abs(a.net - b.net), even = gap < 1, left = a.net >= b.net;
  // the plank tips down on the winner's end, a degree for every two points of value, up to eight
  const tilt = even ? 0 : Math.max(-8, Math.min(8, (b.net - a.net) / 2));
  // each stack rides its end of the plank: up on the loser's end, down on the winner's
  const ride = (side) => ({ transform: `translateY(${(side === 'l' ? -tilt : tilt) * 2.2}px)` });
  const cards = (s, side) => {
    const shown = s.gets.slice(0, 3);
    return (
      <div className={`tg-cards ${side} n${shown.length}`} style={ride(side)}>
        {shown.map((p, i) => (
          <span className="tg-card" key={p.id} style={{ '--i': i - (shown.length - 1) / 2 }}>
            <Mug p={p} /><Pos pos={p.pos} /><b>{p.short}</b>
          </span>
        ))}
        {s.gets.length > 3 ? <span className="tg-plus">{`+${s.gets.length - 3}`}</span> : null}
        {!shown.length ? <span className="tg-none">{s.picks[0] || 'Nothing back'}</span> : null}
      </div>
    );
  };
  const who = (s, side) => {
    const t = D.byRid[s.rid];
    return <div className={`tg-who ${side}`}>{t ? <Headshot t={t} cls="tg-face" h={h} /> : null}<span><b>{s.first}</b><small>{`value ${f1(total(s))}`}</small></span></div>;
  };
  return (
    <div className="tg tg-seesaw">
      <div className="tg-ends">{cards(a, 'l')}{cards(b, 'r')}</div>
      <div className="tg-plank" aria-hidden="true"><i style={{ transform: `rotate(${tilt}deg)` }} /><b /></div>
      <div className="tg-names">{who(a, 'l')}<p className="tg-says">{even ? 'Dead level on value' : `Tips toward ${left ? a.first : b.first} by ${f1(gap)}`}</p>{who(b, 'r')}</div>
    </div>
  );
}

function Receipt({ trade }) {
  const [w, l] = ends(trade.sides), gap = w.net - l.net;
  const stamp = gap < 4 ? 'Fair deal' : gap < 15 ? `${w.first} wins` : 'Fleeced';
  return (
    <div className="tg tg-receipt">
      <div className="tg-slip" style={{ '--n': trade.sides.length }}>
        <p className="tg-slip-head">Power Hour trade desk</p>
        <div className="tg-cols">
          {trade.sides.map((s) => (
            <div key={s.rid}>
              <p className="tg-slip-who">{`${s.first} receives`}</p>
              {s.gets.slice(0, MAX).map((p) => <p key={p.id}><span>{`${p.pos || ''} ${p.short}`.trim()}</span><span>{f1(p.v)}</span></p>)}
              {s.gets.length > MAX ? <p><span>{`${s.gets.length - MAX} more`}</span><span>{f1(s.gets.slice(MAX).reduce((x, p) => x + (p.v || 0), 0))}</span></p> : null}
              {s.picks.map((x) => <p key={x}><span>{x}</span><span /></p>)}
              {s.cost ? <p><span>{`Roster spot${s.spots === 1 ? '' : 's'}`}</span><span>{`-${f1(s.cost)}`}</span></p> : null}
              <p className="tg-net"><span>Net</span><span>{`${s.net >= 0 ? '+' : ''}${f1(s.net)}`}</span></p>
            </div>
          ))}
        </div>
        <em className={`tg-stamp${gap < 4 ? ' even' : ''}`}>{stamp}</em>
      </div>
    </div>
  );
}

/** trade: st.trade from app.js ({ style, sides }); D, h: the league and the helpers, for the managers' faces */
export function TradeGraphic({ trade, D, h }) {
  const style = trade.style === 'seesaw' && trade.sides.length !== 2 ? 'handoff' : trade.style;
  const said = trade.sides.map((s) => `${s.first} gets ${s.gets.map((p) => p.name).join(', ') || 'nothing'}`).join('; ');
  return (
    <figure className="tg-fig" aria-label={`The trade: ${said}`}>
      {style === 'seesaw' ? <Seesaw trade={trade} D={D} h={h} /> : style === 'receipt' ? <Receipt trade={trade} /> : <Handoff trade={trade} D={D} h={h} />}
    </figure>
  );
}
