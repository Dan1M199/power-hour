// The Trade lab (#trades): every 1-for-1, 2-for-1 and 1-for-2 swap that makes both starting lineups better at a fair
// consensus value (tradeIdeas in lib/trades.js), for your team. The shape filter is plain React state, kept in app.js's
// tradeState; picking a team here sets your team for the whole site (onTeam).
import { useMemo, useState } from 'react';
import { tradeIdeas } from '../../lib/trades.js';
import { Headshot, PosTag, TeamAvatar } from '../shared.jsx';

const SHAPES = [['all', 'All'], ['1 for 1', '1 for 1'], ['2 for 1', '2 for 1'], ['1 for 2', '1 for 2']];

export function TradesPage({ D, me, h, state, onState, onTeam }) {
  const [shape, setShape] = useState(state.shape);
  const pick = (k) => { setShape(k); onState?.({ shape: k }); };
  const { f1, short, ordinal } = h, team = (rid) => D.byRid[rid];
  // the search takes a moment, so it runs once per team per load of the league
  const all = useMemo(() => (me && D.meta.hasRos ? ((D._ideas ||= {})[me] ||= tradeIdeas(D, me)) : []), [D, me]);

  const head = (
    <section className="view-head">
      <div>
        <h1><span className="wk">{me ? team(me).name : 'Pick your team'}</span>Trade Lab</h1>
        <p>Every 1-for-1, 2-for-1 and 1-for-2 swap with the rest of the league, kept only when both starting lineups get better and the consensus values line up. Ranked by how much the deal helps you, with a bonus for deals the other side should like too.</p>
      </div>
      <div><label className="trade-pick"><span>Trade ideas for</span>
        <select id="trade-team" value={me ? String(me) : ''} onChange={(e) => onTeam(Number(e.target.value))}>
          <option value="">Choose your team</option>
          {[...D.teams].sort((a, b) => a.name.localeCompare(b.name)).map((t) => <option key={t.rid} value={t.rid}>{t.name}</option>)}
        </select></label></div>
    </section>
  );
  if (!D.meta.hasRos) return <>{head}<p className="empty glass panel">Trade ideas need the rest-of-season rankings, which are unavailable right now.</p></>;
  if (!me) return <>{head}<p className="empty glass panel">Choose your team above to see trade ideas built around its needs.</p></>;

  const mine = team(me), n = D.teams.length;
  const ideas = shape === 'all' ? all : all.filter((i) => i.shape === shape);
  const count = (k) => (k === 'all' ? all.length : all.filter((i) => i.shape === k).length);
  const maxGain = Math.max(0.5, ...all.flatMap((i) => [i.gainMe, i.gainThem]));
  const value = (id) => D.helpers.valueOf(id);
  const list = (ids) => <ul>{ids.map((id) => <li key={id}><PosTag pos={h.posOf(id)} /><span className="pl">{h.nameOf(id)}</span><span className="pv" data-tip={`Consensus value ${f1(value(id))}, ${f1(D.helpers.effWeekly(id))} proj pts/wk`}>{f1(value(id))}</span></li>)}</ul>;
  const bar = (label, v) => <div className="gain"><span>{label}</span><span className="track"><i style={{ width: `${Math.max(3, (v / maxGain) * 100)}%` }} /></span><b>{`+${f1(v)}`}</b></div>;
  const card = (i, k) => {
    const them = team(i.partner);
    const band = Math.max(6, 0.15 * (i.get.concat(i.give).reduce((a, id) => a + value(id), 0)) / 2);
    const pos = 50 + Math.max(-1, Math.min(1, i.value / band)) * 50;
    return (
      <article key={`${i.partner}:${i.give.join()}:${i.get.join()}`} className={`idea glass ${k === 0 ? 'rim' : ''}`}>
        <header className="idea-head"><TeamAvatar t={them} /><div><small>{`Idea ${k + 1}, ${i.shape}`}</small><b>{`With ${them.name}`}</b></div>
          <span className="idea-shape">{`No. ${them.powerRank} power`}</span></header>
        <div className="idea-swap">
          <div className="give"><h4>You give</h4>{list(i.give)}</div>
          <span className="swap-arrow" aria-hidden="true"><svg width="22" height="16" viewBox="0 0 22 16"><path d="M1 5h17l-4-4M21 11H4l4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div className="get"><h4>You get</h4>{list(i.get)}</div>
        </div>
        <div className="idea-impact">
          {bar('Your lineup', i.gainMe)}
          {bar(short(them.name, 16), i.gainThem)}
          <div className="balance" data-tip={i.fair}><span>Value balance</span><span className="scale"><i className="mid" /><i className="mark" style={{ left: `${pos}%` }} /></span><b>{`${i.value > 0 ? '+' : ''}${f1(i.value)}`}</b></div>
        </div>
        <ul className="idea-why">{i.why.map((w, j) => <li key={j}>{w}</li>)}<li className="fair">{i.fair}</li></ul>
        {k === 0 && h.faceSrc(them) ? <p className="pitch"><Headshot t={them} cls="pitch-face" h={h} /><span>Best pitch on the board. Time to text <b>{h.first(them)}</b>.</span></p> : null}
      </article>
    );
  };

  return <>
    {head}
    <div className="trade-bar">
      <div className="needs"><span className="lbl">Your position ranks</span>{['QB', 'RB', 'WR', 'TE'].map((p) => {
        const r = mine.posRanks[p], cls = r >= n - 3 ? 'need' : r <= 3 ? 'strong' : '';
        return <span key={p} className={`need-chip ${cls}`} data-tip={`${p}: ${ordinal(r)} of ${n} (${h.groupSaid(mine, p)})`}><b>{p}</b>{ordinal(r)}</span>;
      })}</div>
      <div className="filters" role="group" aria-label="Trade shape">{SHAPES.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={shape === k} disabled={!(count(k) || shape === k)} onClick={() => pick(k)}>{`${label} (${count(k)})`}</button>
      ))}</div>
    </div>
    <p className="sub trade-legend">Green bars are projected starting-lineup points per week gained by each side. The dot on the value balance is your side of the consensus value: right of center you come out ahead, left of center they do. Uneven trades count the cut player or the free-agent pickup they force.</p>
    {ideas.length ? <div className="ideas">{ideas.map(card)}</div>
      : <p className="empty glass panel">{all.length ? 'No ideas of this shape. Try another filter.' : 'No trade both sides should take right now. Your roster is balanced enough that every fair deal makes one lineup worse. Check back after the next round of waivers or injuries.'}</p>}
  </>;
}
