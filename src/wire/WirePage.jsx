// The Wire (#wire): trades up top, adds and drops below grouped by day and team, with the consensus rest-of-season value
// each move gained or gave up; best free agents, busiest managers and the trade ledger on the side. The filters are
// plain React state, kept in app.js's wireState so they survive leaving the page.
import { useState } from 'react';
import { TZ } from '../../lib/newsclock.js';
import { Headshot, PosTag, TeamAvatar } from '../shared.jsx';

function dayLabel(ts) {
  const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const today = fmt(new Date()), yest = fmt(new Date(Date.now() - 864e5)), d = fmt(new Date(ts));
  if (d === today) return 'Today';
  if (d === yest) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long', month: 'short', day: 'numeric' });
}
const timeLabel = (ts) => new Date(ts).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const tone = (x, d = 0.4) => (x > d ? 'plus' : x < -d ? 'minus' : 'flat');

export function WirePage({ D, me, h, state, onState }) {
  const [s, setS] = useState(state);
  const set = (patch) => setS((x) => { const n = { ...x, ...patch }; onState?.(n); return n; });
  const { f1, short } = h, team = (rid) => D.byRid[rid], hasRos = D.meta.hasRos;
  const signed = (x) => `${x > 0 ? '+' : ''}${f1(x)}`;

  const mine = (f) => !(s.mine && me) || f.sides.some((x) => x.rid === me);
  const trades = D.feed.filter((f) => f.type === 'trade' && mine(f));
  const moves = D.feed.filter((f) => f.type !== 'trade' && mine(f));
  const showTrades = s.type !== 'waiver', showMoves = s.type !== 'trade';

  // adds and drops: day, then team (most recent first), then transactions
  const shown = moves.slice(0, s.limit);
  const days = [];
  for (const it of shown) {
    const lbl = dayLabel(it.ts);
    if (!days.length || days[days.length - 1].lbl !== lbl) days.push({ lbl, teams: new Map() });
    const rid = it.sides[0].rid, tm = days[days.length - 1].teams;
    if (!tm.has(rid)) tm.set(rid, []);
    tm.get(rid).push(it);
  }

  // in uneven trades the side receiving fewer players gets a credit for the roster spot it frees up
  const spotNote = (sides) => {
    const r = D.meta.replacement, freed = sides.filter((x) => x.spots < 0);
    if (!r || !freed.length) return '';
    return ` Includes ${freed.map((x) => `${f1(r * -x.spots)} for the ${-x.spots === 1 ? 'roster spot' : `${-x.spots} roster spots`} ${team(x.rid).name} frees up`).join(' and ')}, valued at the best few free agents (${f1(r)} each).`;
  };
  // the people who shook on it, in the corner of each trade card
  const dealFaces = (sides) => {
    const ts = sides.map((x) => team(x.rid)).filter((t) => h.faceSrc(t));
    if (ts.length < 2) return null;
    const names = ts.map(h.first);
    return <span className="deal"><span className="deal-faces">{ts.map((t) => <Headshot key={t.rid} t={t} cls="deal-face" h={h} />)}</span><span>{`${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} shook on it`}</span></span>;
  };
  const tradeCard = (item) => {
    const sides = item.sides, best = Math.max(...sides.map((x) => x.net));
    const winner = sides.length === 2 && Math.abs(sides[0].net - sides[1].net) >= 3 ? sides.find((x) => x.net === best) : null;
    return (
      <li key={item.id} className="trade glass rim">
        <div className="trade-head">{dealFaces(sides)}<span className="when">{`${dayLabel(item.ts)}, ${timeLabel(item.ts)}, week ${item.week}`}</span></div>
        <div className="trade-sides">{sides.map((x) => (
          <div key={x.rid} className={`trade-side ${winner && winner.rid === x.rid ? 'won' : ''} ${x.rid === me ? 'mine' : ''}`}>
            <h3><TeamAvatar t={team(x.rid)} /><span className="tn">{team(x.rid).name}</span>{hasRos ? <span className={winner ? tone(x.net, 0) : 'flat'}>{signed(x.net)}</span> : null}</h3>
            <p className="gets">Receives</p>
            <ul>
              {x.adds.map((p) => <li key={p.id}><PosTag pos={h.posOf(p.id)} />{h.nameOf(p.id)}{hasRos ? <span className="pv">{f1(p.v)}</span> : null}</li>)}
              {x.picks.filter((p) => p.dir === 'in').map((p, i) => <li key={`pick${i}`}>{`${p.season} round ${p.round} pick`}</li>)}
              {x.faabIn ? <li>{`$${x.faabIn} FAAB`}</li> : null}
            </ul>
          </div>
        ))}</div>
        {hasRos ? <p className="verdict">{winner
          ? <>{'By consensus ROS value, '}<b>{team(winner.rid).name}</b>{` came out ahead by ${f1(Math.abs(sides[0].net - sides[1].net))}.${spotNote(sides)}`}</>
          : `By consensus ROS value this one is close to even.${spotNote(sides)}`}</p> : null}
      </li>
    );
  };
  // one row per transaction: adds and drops on their own lines, net value on the right
  const wireRow = (item) => {
    const x = item.sides[0];
    const line = (p, add) => <div key={`${add ? 'a' : 'd'}${p.id}`} className={add ? 'add' : 'drop'}><span className="sign" aria-label={add ? 'Added' : 'Dropped'}>{add ? '+' : '−'}</span><PosTag pos={h.posOf(p.id)} /><span className="pl">{h.nameOf(p.id)}</span></div>;
    const how = item.type === 'waiver' ? `Waiver${item.bid ? ` $${item.bid}` : ''}` : item.type === 'commissioner' ? 'Commish' : '';
    return (
      <li key={item.id}>
        <span className="t">{timeLabel(item.ts)}{how ? <small>{how}</small> : null}</span>
        <div className="lines">{x.adds.map((p) => line(p, true))}{x.drops.map((p) => line(p, false))}</div>
        {hasRos ? <span className={`net ${tone(x.net)}`} data-tip="Change in consensus ROS value from this move">{signed(x.net)}</span> : null}
      </li>
    );
  };
  const teamCard = (rid, items) => {
    const t = team(rid), net = items.reduce((a, it) => a + it.sides[0].net, 0);
    return (
      <li key={rid} className={`wire-team glass ${rid === me ? 'mine' : ''}`}>
        <div className="wt-head"><TeamAvatar t={t} /><div><b>{t.name}</b><small>{`${items.length} move${items.length === 1 ? '' : 's'}`}</small></div>
          {hasRos ? <span className={`net ${tone(net)}`} data-tip="Net consensus ROS value from these moves">{signed(net)}<small>net value</small></span> : null}</div>
        <ul className="wt-rows">{items.map(wireRow)}</ul>
      </li>
    );
  };

  const btn = (k, label) => <button type="button" aria-pressed={s.type === k} onClick={() => set({ type: k, limit: 50 })}>{label}</button>;
  const fa = D.freeAgents.slice(0, 10);
  const mm = Object.values(D.managerMoves).sort((a, b) => b.moves - a.moves);
  const traders = Object.values(D.managerMoves).filter((m) => m.tradeNet !== 0).sort((a, b) => b.tradeNet - a.tradeNet);
  const today = D.feed.filter((f) => dayLabel(f.ts) === 'Today').length;
  const wk = D.meta.lastScored + 1;
  const thisWeek = D.feed.filter((f) => f.week === wk);
  const active = {};
  thisWeek.forEach((f) => f.sides.forEach((x) => (active[x.rid] = (active[x.rid] || 0) + 1)));
  const busiest = Object.entries(active).sort((a, b) => b[1] - a[1])[0];
  const stat = (v, l, face = null) => <div className={face ? 'has-face' : undefined}>{face}<span><b>{v}</b><small>{l}</small></span></div>;
  const busy = busiest && team(busiest[0]), busyFace = busy && h.faceSrc(busy);

  return <>
    <section className="view-head">
      <div>
        <h1><span className="wk">{today ? `${today} move${today === 1 ? '' : 's'} today` : 'Quiet day so far'}</span>The Wire</h1>
        <p>Trades up top, adds and drops below, grouped by day and team. Numbers are the consensus rest-of-season value a move gained or gave up.</p>
      </div>
    </section>
    <div className="wire-stats glass">
      {stat(today, 'moves today')}
      {stat(thisWeek.filter((f) => f.type !== 'trade').length, `adds and drops in week ${wk}`)}
      {stat(thisWeek.filter((f) => f.type === 'trade').length, `trades in week ${wk}`)}
      {busy ? stat(busyFace ? h.first(busy) : short(busy.name, 18), `busiest this week, ${busiest[1]} moves${busyFace ? ` for ${short(busy.name, 18)}` : ''}`, busyFace ? <Headshot t={busy} cls="stat-face" h={h} /> : null) : null}
    </div>
    <div className="two-col">
      <div>
        <div className="filters" role="group" aria-label="Filter moves">
          {btn('all', 'Everything')}{btn('trade', `Trades (${trades.length})`)}{btn('waiver', `Adds and drops (${moves.length})`)}
          {me ? <button type="button" aria-pressed={s.mine} onClick={() => set({ mine: !s.mine })}>Only my team</button> : null}
        </div>
        {showTrades ? <section className="wire-sec">
          <h2 className="sec-title"><span>Trades</span><small>{`${trades.length} this season`}</small></h2>
          {trades.length ? <ul className="moves">{trades.slice(0, s.trades).map(tradeCard)}</ul> : <p className="empty glass panel">No trades yet.</p>}
          {trades.length > s.trades ? <div className="filters"><button type="button" onClick={() => set({ trades: Infinity })}>{`Show all ${trades.length} trades`}</button></div> : null}
        </section> : null}
        {showMoves ? <section className="wire-sec">
          <h2 className="sec-title"><span>Adds and drops</span><small>{`${moves.length} this season`}</small></h2>
          {days.length ? days.map((d) => <section key={d.lbl} className="day"><h3>{d.lbl}</h3><ul className="moves">{[...d.teams].map(([rid, items]) => teamCard(rid, items))}</ul></section>) : <p className="empty glass panel">No moves match these filters yet.</p>}
          {moves.length > shown.length ? <div className="filters"><button type="button" onClick={() => set({ limit: s.limit + 50 })}>{`Show older moves (${moves.length - shown.length} more)`}</button></div> : null}
        </section> : null}
      </div>
      <aside>
        {hasRos ? <section className="panel glass"><h2>Best available</h2><p className="sub">Highest consensus ROS value not on a roster right now.</p>
          <ol className="fa-list">{fa.length ? fa.map((p, i) => (
            <li key={p.id}><span className="n">{i + 1}</span><span><PosTag pos={h.posOf(p.id)} />{`${h.nameOf(p.id)} `}<span className="when">{`${p.pos}${p.prk}`}</span></span><span className="v" data-tip={`Consensus value ${f1(p.v)}, ${f1(p.wk)} proj pts/wk`}>{f1(p.v)}</span></li>
          )) : <li>Nothing notable on waivers.</li>}</ol></section> : null}
        <section className="panel glass"><h2>Busiest managers</h2><p className="sub">Completed moves this season, with net ROS value added.</p>
          {mm.map((m) => <div key={m.rid} className="leader"><span><TeamAvatar t={team(m.rid)} cls="avatar xs" />{team(m.rid).name}</span><span>{hasRos ? <>{`${m.moves} `}<span className={m.net >= 0 ? 'plus' : 'minus'}>{signed(m.net)}</span></> : m.moves}</span></div>)}
        </section>
        {traders.length && hasRos ? <section className="panel glass"><h2>Trade ledger</h2><p className="sub">{`Net ROS value from trades at today's consensus. In uneven trades, each roster spot freed up counts as one top free agent (${f1(D.meta.replacement)}).`}</p>
          {traders.map((m) => <div key={m.rid} className="leader"><span><TeamAvatar t={team(m.rid)} cls="avatar xs" />{team(m.rid).name}</span><span className={m.tradeNet >= 0 ? 'plus' : 'minus'}>{signed(m.tradeNet)}</span></div>)}</section> : null}
      </aside>
    </div>
  </>;
}
