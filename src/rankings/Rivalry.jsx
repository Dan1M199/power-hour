// Bragging rights (5.0, Nov 12): the league against itself, under the board. Three views on one switcher:
// Crowns (last week's six crowns and every team's shelf), Bounties (win streaks with a price on them, skids that might
// end, giant killers) and Tale of the tape (any two teams line by line). The numbers are lib/rivalry.js.
import { useMemo, useState } from 'react';
import { CROWNS, crowns, bounties, tape, defaultPair } from '../../lib/rivalry.js';
import { TeamAvatar } from '../shared.jsx';

const ICON = {
  high: 'M4 18h16l1-10-5 4-4-7-4 7-5-4z',
  blowout: 'M13 2 5 13h6l-1 9 8-12h-6z',
  stole: 'M12 12a4 4 0 1 1-4-4 4 4 0 1 1 4-4 4 4 0 1 1 4 4 4 4 0 1 1-4 4zm0 0v9',
  robbed: 'M7 17a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 9 4 4 0 0 1 18 17zM9 20l-1 2m5-2-1 2m5-2-1 2',
  low: 'M12 4v14m-6-6 6 6 6-6',
  bench: 'M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11h18v5H3zM5 16v3m14-3v3',
};
const Icon = ({ k }) => (
  <svg className="br-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON[k]} /></svg>
);

function Crowns({ D, me, h }) {
  const C = crowns(D);
  const kinds = CROWNS.filter((c) => C.weeks.some((w) => w.crowns[c.key]));
  const latest = C.latest;
  return <>
    {latest ? <div className="br-block">
      <h3>{`Week ${latest.week} crowns`}</h3>
      <ul className="br-crowns">{kinds.map((c) => {
        const x = latest.crowns[c.key], t = x && D.byRid[x.rid];
        if (!t) return null;
        const opp = x.opp != null ? D.byRid[x.opp] : null;
        const what = c.key === 'blowout' ? `won by ${h.f1(x.value)}` : c.key === 'bench' ? `${h.f1(x.value)} left on the bench` : `${h.f1(x.value)} points`;
        return <li key={c.key} className={`br-crown ${c.kind}${t.rid === me ? ' mine' : ''}`} data-tip={`${c.says}: ${t.name}, ${what}${opp ? ` against ${opp.name}` : ''}`}>
          <span className="br-badge"><Icon k={c.key} /></span>
          <span className="br-crown-body"><small>{c.label}</small><b>{t.name}</b><span>{what}</span></span>
        </li>;
      })}</ul>
    </div> : null}
    <div className="br-block">
      <h3>The shelf</h3>
      <p className="br-sub">{`Every crown handed out over ${C.weeks.length} weeks. The good ones first, the ones nobody wants on the right.`}</p>
      <div className="br-shelf" role="table" aria-label="Crowns won by each team" style={{ '--n': kinds.length }}>
        <div className="br-row br-head" role="row">
          <span role="columnheader">Team</span>
          {kinds.map((c) => <span key={c.key} role="columnheader" className={`br-col ${c.kind}`} title={c.says}><Icon k={c.key} /><small>{c.label}</small></span>)}
        </div>
        {C.table.map((r) => {
          const t = D.byRid[r.rid];
          return <div key={r.rid} role="row" className={`br-row${t.rid === me ? ' mine' : ''}`}>
            <span role="cell" className="br-team"><TeamAvatar t={t} /><b>{t.name}</b></span>
            {kinds.map((c) => {
              const n = r.counts[c.key];
              return <span key={c.key} role="cell" className={`br-n ${c.kind}${n ? ' on' : ''}`} style={{ '--k': Math.min(n, 4) }}
                data-tip={`${t.name}: ${n} ${n === 1 ? 'week' : 'weeks'} with the ${c.label.toLowerCase()} crown`}>
                <span className="sr-only">{`${c.label}: `}</span>{n || '–'}
              </span>;
            })}
          </div>;
        })}
      </div>
    </div>
  </>;
}

function Bounties({ D, me, h }) {
  const B = bounties(D);
  const nm = (rid) => D.byRid[rid].name;
  return <>
    <div className="br-block">
      <h3>Wanted</h3>
      <p className="br-sub">Win streaks of two or more. Whoever plays them next can end it.</p>
      {B.hot.length ? <ul className="br-wanted">{B.hot.map((x) => {
        const t = D.byRid[x.rid];
        return <li key={x.rid} className={`br-poster${x.rid === me || x.next?.rid === me ? ' mine' : ''}`}>
          <TeamAvatar t={t} />
          <span className="br-poster-body">
            <b>{t.name}</b>
            <span className="br-tags"><span className="br-streak">{`${x.n} straight wins`}</span>{x.unbeaten ? <span className="br-unbeaten">Unbeaten</span> : null}</span>
            {x.next ? <span className="br-next">{`Week ${x.next.week}: `}<strong>{nm(x.next.rid)}</strong>{` has a ${h.pct(x.collect)} shot at ending it`}</span>
              : <span className="br-next">No games left to end it</span>}
          </span>
          {x.next ? <span className="br-meter" role="img" aria-label={`${h.pct(x.collect)} to end the streak`}><i style={{ width: `${Math.round(x.collect * 100)}%` }} /></span> : null}
        </li>;
      })}</ul> : <p className="br-empty">Nobody has won two straight. Be the first.</p>}
    </div>
    <div className="br-split">
      <div className="br-block">
        <h3>Due a win</h3>
        {B.cold.length ? <ul className="br-list">{B.cold.map((x) => {
          const t = D.byRid[x.rid];
          return <li key={x.rid} className={x.rid === me ? 'mine' : ''}><TeamAvatar t={t} />
            <span><b>{t.name}</b><small>{`Lost ${x.n} straight${x.winless ? ', still looking for the first' : ''}${x.next ? `. Week ${x.next.week} against ${nm(x.next.rid)}: ${h.pct(x.snap)} to snap it` : ''}`}</small></span></li>;
        })}</ul> : <p className="br-empty">No one has lost three straight.</p>}
      </div>
      <div className="br-block">
        <h3>Giant killers</h3>
        {B.killers.length ? <ul className="br-list">{B.killers.map((k) => {
          const t = D.byRid[k.rid];
          return <li key={k.rid} className={k.rid === me ? 'mine' : ''}><TeamAvatar t={t} />
            <span><b>{t.name}</b><small>{`${k.scalps.length} ${k.scalps.length === 1 ? 'win' : 'wins'} over teams ranked above them: ${k.scalps.map((s) => `${nm(s.rid)} (week ${s.week})`).join(', ')}`}</small></span></li>;
        })}</ul> : <p className="br-empty">No upsets yet.</p>}
      </div>
    </div>
  </>;
}

const fmtLine = (l, v, h, t) => (v == null ? '–' : l.fmt === 'pct' ? h.pct(v) : l.fmt === 'f1' ? h.f1(v) : l.fmt === 'rank' ? `No. ${v}` : l.fmt === 'record' ? h.record(t) : String(v));

function Tape({ D, me, h, pair, setPair }) {
  const [a, b] = pair;
  const T = useMemo(() => tape(D, a, b), [D, a, b]);
  const pick = (i) => (e) => {
    const v = Number(e.target.value), next = [...pair];
    next[i] = v;
    if (next[0] === next[1]) next[1 - i] = pair[i];
    setPair(next);
  };
  const sel = (i) => <label className="br-pick"><span className="sr-only">{i ? 'Second team' : 'First team'}</span>
    <select value={pair[i]} onChange={pick(i)}>{D.teams.map((t) => <option key={t.rid} value={t.rid}>{`${t.name}${t.rid === me ? ' (you)' : ''}`}</option>)}</select></label>;
  if (!T) return null;
  const A = T.a, B = T.b, wonA = T.lines.filter((l) => l.lead === 'a').length, wonB = T.lines.filter((l) => l.lead === 'b').length;
  const lead = T.edge === 'a' ? A : T.edge === 'b' ? B : null;
  return <>
    <div className="br-picks">{sel(0)}
      <button type="button" className="br-swap" aria-label="Swap the two teams" onClick={() => setPair([b, a])}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4m4 4H7" /></svg>
      </button>{sel(1)}</div>
    <div className="br-ring">
      <div className={`br-side a${T.edge === 'a' ? ' lead' : ''}${A.rid === me ? ' mine' : ''}`}><TeamAvatar t={A} /><b>{A.name}</b><small>{h.record(A)}</small></div>
      <div className="br-every" data-tip={`In the ${T.every.weeks.length} weeks both played, ${A.name} outscored ${B.name} ${T.every.a} times and ${B.name} won ${T.every.b}`}>
        <b>{`${T.every.a}–${T.every.b}`}</b><small>if they'd met every week</small>
      </div>
      <div className={`br-side b${T.edge === 'b' ? ' lead' : ''}${B.rid === me ? ' mine' : ''}`}><TeamAvatar t={B} /><b>{B.name}</b><small>{h.record(B)}</small></div>
    </div>
    <ul className="br-lines">{T.lines.map((l) => {
      const va = typeof l.a === 'number' ? l.a : 0, vb = typeof l.b === 'number' ? l.b : 0;
      // the share of the bar each side gets; a rank is better low, so it flips
      const sa = l.key === 'rank' ? vb : va, sb = l.key === 'rank' ? va : vb;
      const share = sa + sb > 0 ? sa / (sa + sb) : 0.5;
      return <li key={l.key} className={`br-line${l.lead ? ` lead-${l.lead}` : ''}`}>
        <span className="br-va">{fmtLine(l, l.a, h, A)}</span>
        <span className="br-mid"><small>{l.label}</small><span className="br-tug" aria-hidden="true"><i style={{ width: `${(share * 100).toFixed(1)}%` }} /></span></span>
        <span className="br-vb">{fmtLine(l, l.b, h, B)}</span>
      </li>;
    })}</ul>
    <div className="br-facts">
      <p>{T.meetings.length
        ? T.meetings.map((m) => `Week ${m.week}: ${m.a > m.b ? A.name : B.name} won ${h.f1(Math.max(m.a, m.b))} to ${h.f1(Math.min(m.a, m.b))}.`).join(' ')
        : 'They haven’t met yet this season.'}</p>
      <p>{T.nextMeet
        ? `They meet in week ${T.nextMeet.week}. ${T.nextMeet.pA >= 0.5 ? A.name : B.name} is the pick at ${h.pct(Math.max(T.nextMeet.pA, 1 - T.nextMeet.pA))}.`
        : 'Not on the regular-season schedule again, so this one gets settled in the group chat.'}</p>
      <p className="br-verdict">{lead
        ? `${lead.name} takes the tape, ${Math.max(wonA, wonB)} lines to ${Math.min(wonA, wonB)}${T.every.a !== T.every.b ? ` and ${Math.max(T.every.a, T.every.b)}–${Math.min(T.every.a, T.every.b)} on the every-week record` : ''}.`
        : 'Dead level. Settle it on the field.'}</p>
    </div>
  </>;
}

const VIEWS = [['crowns', 'Crowns', 'Who ruled each week'], ['bounties', 'Bounties', 'Streaks to end'], ['tape', 'Tale of the tape', 'Any two teams']];

export function Rivalry({ D, me, h }) {
  const [view, setView] = useState('crowns');
  const [pair, setPair] = useState(() => defaultPair(D, me));
  if (!D.teams.some((t) => t.weeks.length)) return null;
  return <section className="panel glass rivalry" aria-labelledby="br-title">
    <div className="br-top">
      <div><h2 id="br-title">Bragging rights</h2><p className="sub">Crowns, bounties and head-to-heads: the stuff the group chat argues about, settled with the numbers.</p></div>
      <div className="br-views" role="tablist" aria-label="Bragging rights">
        {VIEWS.map(([k, label, hint]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>
          <b>{label}</b><small>{hint}</small></button>)}
      </div>
    </div>
    <div className="br-body" role="tabpanel" key={view}>
      {view === 'crowns' ? <Crowns D={D} me={me} h={h} /> : view === 'bounties' ? <Bounties D={D} me={me} h={h} /> : <Tape D={D} me={me} h={h} pair={pair} setPair={setPair} />}
    </div>
  </section>;
}
