// The fan poll on top of the power rankings (api/poll.js): one vote per device, no changing it. app.js loads it and
// casts the vote (it asks first); this shows the choices, or the split once you've voted.
import { TeamAvatar } from '../shared.jsx';

export function Poll({ D, h, poll }) {
  const P = poll.store.use();
  if (!poll.on || !P?.enabled) return null;
  const opts = (P.options || D.teams.slice(-6).map((t) => t.rid)).map((rid) => D.byRid[rid]).filter(Boolean);
  const voted = P.mine != null, n = P.total || 0;
  const choice = (t) => {
    const c = P.counts?.[t.rid] || 0, share = n ? c / n : 0, mine = P.mine === t.rid;
    return voted
      ? <li key={t.rid} className={`poll-res ${mine ? 'mine' : ''}`} data-tip={`${t.name}: ${c} vote${c === 1 ? '' : 's'}`}><TeamAvatar t={t} /><span className="pn"><b>{mine ? <>{`${t.name} `}<small>Your pick</small></> : t.name}</b><span className="poll-bar"><i style={{ width: `${share * 100}%` }} /></span></span><b className="pp">{h.pct(share)}</b></li>
      : <li key={t.rid}><button type="button" className="poll-pick" onClick={() => poll.onPick(t.rid)}><TeamAvatar t={t} /><span className="pn"><b>{t.name}</b><small>{`No. ${t.powerRank} power, ${h.record(t)}, ${h.pct(t.playoffPct)} playoffs`}</small></span></button></li>;
  };
  return (
    <section className="panel glass poll" id="poll" aria-label="Fan poll">
      <h2>{poll.question}</h2>
      <p className="sub">{voted ? `${n} vote${n === 1 ? '' : 's'} so far. Your vote is locked in.` : "One vote per device, and no changing it once it's in. Choose wisely."}</p>
      <ol className={`poll-list ${voted ? 'done' : ''}`}>{opts.map(choice)}</ol>
      {P.err ? <p className="poll-err" role="alert">{P.err}</p> : null}
    </section>
  );
}
