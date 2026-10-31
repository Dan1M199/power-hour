// A team's scouting report, opened from its ranking row: the manager's card, the reasons it sits where it does, its
// position groups against the league, the schedule left, its weekly points and where it finishes in the simulations.
import { radar, weeklyBars } from '../../lib/charts.js';
import { Chart, ChampBadge, Headshot, PosTag } from '../shared.jsx';

// the league-wide superlatives a manager owns, at most three
function superlatives(D, t, h) {
  const ts = D.teams, mv = (x) => D.managerMoves[x.rid] || { moves: 0, tradeNet: 0 }, { f1, pct, signed } = h;
  const top = (f, dir = 1) => { const ok = ts.filter((x) => f(x) != null); return ok.length ? ok.reduce((a, b) => (dir * (f(b) - f(a)) > 0 ? b : a)) : null; };
  const best = (x) => Math.max(0, ...x.weeks.map((w) => w.pts || 0));
  const out = [];
  const add = (cond, label, tip, tone = 'good') => { if (cond && out.length < 3) out.push({ label, tip, tone }); };
  add(h.isChamp(t), 'Defending champion', `Won the ${h.champSeason} title. Everyone else is chasing that trophy.`, 'champ');
  add(top(best) === t, 'Season high', `Highest single-week score in the league: ${f1(best(t))}`);
  add(top((x) => x.pfPerGame) === t, 'Points machine', `Most points per game in the league (${f1(t.pfPerGame)})`);
  add(top((x) => x.efficiency) === t, 'Lineup sniper', `Best lineup efficiency in the league (${pct(t.efficiency)} of optimal)`);
  add(top((x) => x.efficiency, -1) === t, 'Bench is loaded', `Worst lineup efficiency in the league (${pct(t.efficiency)} of optimal)`, 'bad');
  add(top((x) => x.luck) === t && t.luck > 0.5, 'Horseshoe', `Luckiest record in the league: ${signed(t.luck)} wins over all-play expectation`, 'bad');
  add(top((x) => x.luck, -1) === t && t.luck < -0.5, 'Snakebitten', `Unluckiest record in the league: ${signed(t.luck)} wins against all-play expectation`);
  add(top((x) => mv(x).moves) === t && mv(t).moves > 0, 'Lives on the wire', `Most completed moves in the league (${mv(t).moves})`, 'neutral');
  add(D.meta.hasRos && top((x) => mv(x).tradeNet) === t && mv(t).tradeNet > 1, 'Trade shark', `Best trade ledger in the league (${signed(mv(t).tradeNet)} ROS value)`);
  add(D.meta.hasRos && top((x) => mv(x).tradeNet, -1) === t && mv(t).tradeNet < -1, 'Got fleeced', `Worst trade ledger in the league (${signed(mv(t).tradeNet)} ROS value)`, 'bad');
  return out;
}
const bestWeek = (t) => t.weeks.reduce((a, w) => (!a || (w.pts || 0) > a.pts ? w : a), null);

// the manager's trading card: photo, a stat line toned by league rank, and any superlatives
function ManagerCard({ D, t, h }) {
  const { f1, pct, ordinal, signed } = h;
  const bestWk = bestWeek(t), moves = D.managerMoves[t.rid]?.moves || 0;
  // where a team's number sits in the league: top third reads good, bottom third bad, the middle stays plain
  const tone = (val) => {
    const all = D.teams.map(val).filter((v) => v != null), mine = val(t);
    if (mine == null || all.length < 3) return { tone: '', place: '' };
    const k = all.filter((v) => v > mine).length, third = all.length / 3;
    return { tone: k < third ? 'good' : k >= all.length - third ? 'bad' : '', place: `${ordinal(k + 1)} of ${all.length} in the league` };
  };
  const stat = (v, l, tip, val) => {
    const x = val ? tone(val) : { tone: '', place: '' }, full = [tip, x.place].filter(Boolean).join('. ');
    return <div className={x.tone || undefined} data-tip={full || undefined}><b>{v}</b><small>{l}</small></div>;
  };
  const sup = superlatives(D, t, h);
  return (
    <div className="mgr">
      <span className="mgr-ph"><Headshot t={t} cls={`mgr-face${t.tier.key === 'stinks' ? ' drained' : ''}`} h={h} /><ChampBadge t={t} h={h} /></span>
      <div className="mgr-id"><small>Manager</small><b>{h.first(t)}</b><span>{`@${t.owner}`}</span></div>
      <div className="mgr-stats">
        {stat(h.record(t), 'record', '', (x) => (x.wins + 0.5 * (x.ties || 0)) / Math.max(1, x.wins + x.losses + (x.ties || 0)))}
        {bestWk ? stat(f1(bestWk.pts), `best, week ${bestWk.week}`, '', (x) => bestWeek(x)?.pts) : null}
        {t.efficiency != null ? stat(pct(t.efficiency), 'lineup IQ', `Started ${(t.efficiency * 100).toFixed(1)}% of their best possible lineup`, (x) => x.efficiency) : null}
        {stat(signed(t.luck), 'luck (wins)', `${h.record(t)} actual vs ${f1(t.expectedWins)} expected wins from all-play`, (x) => x.luck)}
        {stat(moves, moves === 1 ? 'move' : 'moves')}
      </div>
      {sup.length ? <div className="mgr-sup">{sup.map((s) => <span key={s.label} className={`sup ${s.tone}`} data-tip={s.tip}>{s.label}</span>)}</div> : null}
    </div>
  );
}

export function Report({ D, t, h }) {
  const { f1, pct, ordinal } = h, n = D.teams.length;
  const axes = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const rad = D.meta.hasRos
    ? radar({ axes, values: axes.map((p) => 1 - (t.posRanks[p] - 1) / (n - 1)), color: D.color[t.rid], tips: axes.map((p) => `${p}: ${ordinal(t.posRanks[p])} of ${n} (${h.groupSaid(t, p)})`) })
    : '';
  const avg = t.weeks.map((w) => {
    const all = D.weekly.find((x) => x.week === w.week), vals = all ? Object.values(all.scores) : [];
    return vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
  });
  const seeds = t.seedDist || [], pt = D.meta.playoffTeams, maxSeed = Math.max(...seeds, 0.01);
  return (
    <div className="detail-inner">
      <ManagerCard D={D} t={t} h={h} />
      <ul className="why">{t.why.map((w, k) => <li key={k} className={w.tone} style={{ '--k': k }}><b>{w.title}</b><span>{w.text}</span></li>)}</ul>
      <div className="detail-side">
        {rad ? <div className="mini"><h4>Position groups vs the league</h4><div className="mini-row"><Chart html={rad} /><div>
          <ul className="lineup">{t.rosLineup.filter(Boolean).map((l, i) => <li key={i}><span className="slot">{l.slot === 'FLEX' ? 'FLX' : l.slot}</span><span className="pl"><PosTag pos={h.posOf(l.id)} />{h.nameOf(l.id)}</span><span className="pt">{f1(l.pts)}</span></li>)}</ul>
        </div></div></div> : null}
        {t.schedule.length ? <div className="mini"><h4>Remaining schedule (opponent power rank, colored by win chance)</h4>
          <div className="sched">{t.schedule.map((g) => {
            const o = D.byRid[g.rid];
            return <span key={g.week} className="g" style={{ '--p': Math.max(0, Math.min(1, (g.pWin - 0.3) / 0.4)).toFixed(3) }} data-tip={`Week ${g.week} vs ${o.name}: No. ${o.powerRank} power, ${f1(g.proj)} proj pts/wk, ${pct(g.pWin)} win chance`}><small>{`W${g.week}`}</small><b>{o.powerRank}</b></span>;
          })}</div>
          <p className="sched-sum">{`${t.schedWins >= 0 ? '+' : ''}${t.schedWins.toFixed(2)} wins vs an average slate, ${t.ranks.schedWins === n ? 'the toughest' : `${ordinal(n + 1 - t.ranks.schedWins)}-toughest`} in the league.`}</p></div> : null}
        <div className="mini"><h4>Weekly points (green = win, dashed = league average)</h4><Chart html={weeklyBars({ weeks: t.weeks, avg, width: 560, height: 150 })} /></div>
        <div className="mini"><h4>{`Where they finish in 10,000 simulations (seed 1 → ${seeds.length})`}</h4>
          <div className="seeds" style={{ '--n': seeds.length }}>{seeds.map((p, i) => <i key={i} className={i < pt ? 'in' : ''} style={{ height: `${(p / maxSeed) * 100}%` }} data-tip={`Seed ${i + 1}: ${(p * 100).toFixed(1)}%`} />)}</div>
          <div className="seed-axis" style={{ '--n': seeds.length }}>{seeds.map((_, i) => <span key={i}>{i + 1}</span>)}</div>
        </div>
      </div>
    </div>
  );
}
