// The Live tab (#live) while a week is played: the desk's note on your week, every team's week best to worst (banked
// plus the rest projected) and the projected standings. Once every game is final it becomes Final Scores, with the
// button to the new power rankings. The hero (headline carousel, page head, league desk) is the one the power rankings
// use.
import { ChampTag, Headshot, TeamAvatar } from '../shared.jsx';
import { Hero } from '../hero/Hero.jsx';

// "Your week": a note from the desk to whoever picked a team. Winning gets congratulated, losing gets roasted, and a
// coin flip gets a pep talk if they're ahead or a reality check if they're behind. Wording rotates daily.
function YourWeek({ rows, standings, me, h, bull }) {
  if (!me) return <section className="you-card glass empty"><p>Pick your team in the top right and the desk will tell you how your week is going. No sugarcoating.</p></section>;
  const k = rows.findIndex((r) => r.t.rid === me), r = rows[k];
  if (!r) return null;
  const { f1, pct, ordinal } = h;
  const t = r.t, N = h.first(t), o = rows.find((x) => x.t === r.opp), O = r.opp ? r.opp.name : 'your opponent';
  const P = pct(r.win), margin = o ? Math.abs(r.proj - o.proj) : 0, star = r.left[0] ? r.left[0].name : '';
  const st = standings.find((x) => x.t.rid === me), mv = st ? st.was - st.seed : 0;
  const kind = r.final || r.locked ? (r.ahead ? 'won' : 'lost') : r.win >= 0.7 ? 'good' : r.win <= 0.3 ? 'bad' : r.win >= 0.5 ? 'up' : 'down';
  const lines = {
    won: [`It's over, ${N}, and you won. ${O} can't catch you${r.final ? '' : ', Monday or not'}. Take the victory lap, you earned this one.`,
      `${N}, ${O} is done. Lock it in, screenshot it, send it to the group chat.`],
    lost: [`${N}, it's done. ${O} beat you and it wasn't close. Go set next week's lineup before you embarrass yourself again.`,
      `Bad news, ${N}: ${O} already has this one in the bag. You can stop refreshing now.`,
      `${N}. Buddy. ${O} can't lose this from here. Maybe try starting players who score.`],
    good: [`Look at you, ${N}. ${P} to beat ${O}, ${f1(r.proj)} projected, ${ordinal(k + 1)} in the league. Don't get used to it.`,
      `${N}, this is what a functioning lineup looks like. ${P} to win${star ? ` with ${star} still to play` : ''}. Enjoy it.`],
    bad: [`${N}, ${P}. That's your chance against ${O}. Your lineup is a cry for help.`,
      `Bold strategy, ${N}: get outscored by ${f1(margin)} and hope ${O} forgets to show up. ${P} odds.`,
      `${N}, the model ran 10,000 simulations and you lose most of them. ${P} to beat ${O}. Thoughts and prayers.`],
    up: [`This is yours, ${N}. ${P} to win, a ${f1(margin)}-point game${star ? `, and ${star} still to play` : ''}. Lock in.`,
      `${N}, you're ${f1(margin)} up on ${O} by projection. Nobody blinks. Let's go.`],
    down: [`Don't get your hopes up, ${N}. ${P} to win and you're counting on ${star || 'a miracle'}. Brave.`,
      `${N}, it's close, and close usually means you lose. ${P} against ${O}. Start drafting the excuses.`],
  }[kind];
  const seed = [...`${h.today}${t.rid}`].reduce((x, c) => (x * 31 + c.charCodeAt(0)) | 0, 7);
  let msg = lines[Math.abs(seed) % lines.length];
  const so = r.banked > 0 ? '' : 'projected '; // before kickoff it's all projection
  if (k === rows.length - 1) msg += ` Also: ${so}dead last in the league this week. Even your bench is embarrassed.`;
  else if (k === 0 && !msg.includes('1st in the league')) msg += ` ${so ? 'Projected top' : 'Top'} score in the whole league, too.`;
  const chip = (v, cls = '') => <span className={`you-chip ${cls}`}>{v}</span>;
  const tone = kind === 'won' || kind === 'good' ? 'good' : kind === 'lost' || kind === 'bad' ? 'bad' : 'close';
  return (
    <section className={`you-card glass ${tone}`} aria-label="Your week">
      <Headshot t={t} cls="you-face" h={h} />
      <div className="you-body">
        <small>{`Your week, ${N}`}</small>
        <p className="you-msg">{msg}</p>
        <div className="you-chips">
          {chip(`${ordinal(k + 1)} this week`)}
          {chip(r.final || r.locked ? (r.ahead ? 'Won' : 'Lost') : `${P} to win`, r.win >= 0.5 ? 'up' : 'down')}
          {st ? chip(`Projected ${ordinal(st.seed)}${mv ? ` (${mv > 0 ? 'up' : 'down'} ${Math.abs(mv)})` : ''}`, mv > 0 ? 'up' : mv < 0 ? 'down' : '') : null}
          {bull ? chip(`Money week: ${bull}`) : null}
        </div>
      </div>
    </section>
  );
}

// the page head: the week live (or final), how many NFL teams have played, when the scores were pulled
function LiveHead({ fin, wk, played, fetched }) {
  return <>
    <div>
      <h2 className="page-title"><span className="wk">{fin ? `Week ${wk} final` : `Week ${wk} live`}</span>{fin ? 'Final Scores' : 'Weekly Rankings'}</h2>
      <p>{fin
        ? "Every game is in. The week, best score to worst, and the standings it leaves behind. Sleeper makes it official Tuesday; the new power rankings are ready now."
        : 'How this week is going, best to worst: everything scored so far plus the projection for everyone still to play. The power rankings are on hold until every game is final.'}</p>
    </div>
    <div className="sources">
      {fin ? <span className="chip"><span className="dot" />All games final</span> : <span className="chip"><span className="dot live" />{`${played} NFL team${played === 1 ? '' : 's'} played so far`}</span>}
      {fetched ? <span className="chip">{`Scores as of ${fetched}`}</span> : null}
    </div>
  </>;
}

export function LivePage({ D, me, h, fin, wk, rows, standings, car, desk, played, fetched, bull, onReveal }) {
  const { f1, pct, ordinal } = h, pt = D.meta.playoffTeams, n = rows.length;
  const max = Math.max(1, ...rows.map((r) => r.proj)) * 1.04;
  const status = (r) => {
    const o = r.opp ? r.opp.name : 'their opponent';
    if (r.final) return r.ahead ? <span className="st-chip won">{`Beat ${o}`}</span> : <span className="st-chip lost">{`Lost to ${o}`}</span>;
    if (r.locked) return r.ahead ? <span className="st-chip won">{`Locked up vs ${o}`}</span> : <span className="st-chip lost">{`Can't catch ${o}`}</span>;
    return <span className={`st-chip ${r.win >= 0.5 ? 'up' : 'down'}`}>{`${pct(r.win)} to beat ${o}`}</span>;
  };
  return <>
    {fin
      ? <section className="view-head"><LiveHead fin wk={wk} played={played} fetched={fetched} /></section>
      : <Hero D={D} h={h} car={car} desk={desk} head={<LiveHead wk={wk} played={played} fetched={fetched} />} />}
    {fin
      ? <div className="unveil-cta"><button type="button" className="cta" data-reveal onClick={(e) => onReveal(e.currentTarget)}>Done with Live Ranks, Show me the Power Ranking</button></div>
      : <YourWeek rows={rows} standings={standings} me={me} h={h} bull={bull} />}
    <div className="live-grid">
      <section className="panel glass live-panel wk-rank">
        <h2>{`Week ${wk}, top to bottom`}</h2>
        <p className="sub">{fin ? 'Final scores. 12th is the worst week in the league.' : 'By projected final score. Dark is banked, striped is still to come. 12th is the worst week in the league.'}</p>
        <ol className="wr-list">{rows.map((r, i) => {
          const t = r.t, rest = Math.max(0, r.proj - r.banked);
          const tip = `${t.name}: ${f1(r.banked)} scored, ${f1(rest)} more projected from ${r.left.length ? r.left.map((x) => x.name).join(', ') : 'nobody'}`;
          return (
            <li key={t.rid} className={`wr ${t.rid === me ? 'mine' : ''} ${i === n - 1 ? 'last' : ''}`}>
              <span className="wr-n">{i + 1}</span><TeamAvatar t={t} />
              <div className="wr-who"><b>{t.name}<ChampTag t={t} h={h} label={false} /></b>{status(r)}</div>
              <div className="wr-bar" data-tip={tip}><i className="bk" style={{ width: `${(r.banked / max) * 100}%` }} /><i className="rs" style={{ width: `${(rest / max) * 100}%` }} /></div>
              <div className="wr-num"><b>{f1(r.proj)}</b><small>{fin ? 'Final' : `${f1(r.banked)} in, ${r.left.length ? `${r.left.length} to play` : 'all done'}`}</small></div>
            </li>
          );
        })}</ol>
      </section>
      <section className="panel glass live-panel wk-stand">
        <h2>{fin ? 'Standings after the week' : 'Projected standings'}</h2>
        <p className="sub">{`${fin ? `The table with week ${wk} counted, points added for the tiebreaker.` : `The table after week ${wk} if every game ends the way it's trending, projected points added for the tiebreaker.`} The dashed line is the playoff cut (top ${pt}).`}</p>
        <div className="heat-wrap"><table className="table stand">
          <thead><tr><th className="num">Seed</th><th>Team</th><th className="num">Before</th><th className="num">After</th><th className="num">This week</th><th className="num pf">PF after</th><th className="num">Playoffs</th></tr></thead>
          <tbody>{standings.map((x) => {
            const t = x.t, r = x.r, won = r.won, mv = x.was - x.seed;
            const after = `${t.wins + (won ? 1 : 0)}-${t.losses + (won ? 0 : 1)}${t.ties ? `-${t.ties}` : ''}`;
            return (
              <tr key={t.rid} className={`${t.rid === me ? 'mine' : ''} ${x.seed === pt ? 'cut' : ''}`}>
                <td className="num seed"><b>{x.seed}</b>{mv ? <span className={`move ${mv > 0 ? 'up' : 'down'}`}>{`${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}`}</span> : null}</td>
                <td className="tm"><TeamAvatar t={t} cls="avatar xs" />{h.short(t.name, 22)}<ChampTag t={t} h={h} label={false} /></td>
                <td className="num now">{h.record(t)}<small>{` (${ordinal(x.was)})`}</small></td>
                <td className="num"><b data-tip={`${t.name}: ${after} with ${f1(x.pf)} points for after the week`}>{after}</b></td>
                <td className="num"><span className={won ? 'plus' : 'minus'} data-tip={`${t.name} wins this week in ${pct(r.win)} of outcomes`}>{r.final || r.locked ? (won ? 'W' : 'L') : pct(r.win)}</span></td>
                <td className="num pf">{f1(x.pf)}</td>
                <td className="num"><b>{pct(t.playoffPct)}</b></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        <p className="sub stand-note">{`Playoff odds are from 10,000 simulations of the season with this week's ${fin ? 'final' : 'live'} scores in.`}</p>
      </section>
    </div>
  </>;
}
