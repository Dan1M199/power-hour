// "What needs to happen": one team's road to the playoffs, read off 20,000 simulated rest-of-seasons (restOfSeason and
// playoffPath in lib/labmodels.js). The odds with next week's floor and ceiling, your games by how much each one moves
// you (the critical weeks), the other games to watch and who to root for, who needs to lose and when, the most
// realistic way in, a long shot and the most common ending. Every game is pickable: pick a winner and everything is
// read again from only the seasons where that happened, so you can build your own scenario.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { restOfSeason, playoffPath } from '../../lib/labmodels.js';
import { TeamAvatar } from '../shared.jsx';

const p0 = (x) => (x == null ? '–' : x > 0 && x < 0.005 ? '<1%' : x < 1 && x > 0.995 ? '>99%' : `${Math.round(x * 100)}%`);
const pts = (x) => `${Math.round(x * 100)}%`;

// the simulation takes a few hundred ms on a phone, so it runs after the tab has painted (idle time where the browser
// has it; iPhone Safari doesn't, so a timeout), once per league
const later = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 300 }) : setTimeout(fn, 60));

export function PlayoffPath({ D, me, h }) {
  const [S, setS] = useState(() => D._ros20k || null);
  useEffect(() => {
    if (S) return undefined;
    let live = true;
    later(() => { if (live) setS(D._ros20k ||= restOfSeason(D)); });
    return () => { live = false; };
  }, [D, S]);
  // arriving from the front page's Playoff scenarios button: bring the card up once it has its numbers (the loading
  // card is too short for the page to scroll that far) and after the route's own scroll to the top
  const box = useRef(null), go = useRef(!!window.__toPaths);
  window.__toPaths = false;
  useEffect(() => {
    if (!go.current || !S) return undefined;
    go.current = false;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const to = (behavior) => box.current?.scrollIntoView({ behavior, block: 'start' });
    // the Lab's entrance can still be settling the content above while it glides, so a second look puts it right
    const ids = [setTimeout(() => to(smooth ? 'smooth' : 'auto'), 60), setTimeout(() => {
      const el = box.current; if (!el) return;
      const want = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
      if (Math.abs(el.getBoundingClientRect().top - want) > 12) to(smooth ? 'smooth' : 'auto');
    }, 900)];
    return () => ids.forEach(clearTimeout);
  }, [S]);
  const bubble = useMemo(() => [...D.teams].sort((a, b) => Math.abs(a.playoffPct - 0.5) - Math.abs(b.playoffPct - 0.5))[0]?.rid, [D]);
  const [pickRid, setRid] = useState(null);
  const [picks, setPicks] = useState({});
  const rid = pickRid ?? me ?? bubble;
  // a tap paints its pressed button at once; the seasons are read again in a render React can drop if another tap comes
  const dRid = useDeferredValue(rid), dPicks = useDeferredValue(picks);
  const stale = dRid !== rid || dPicks !== picks;
  const base = useMemo(() => S && playoffPath(S, D, dRid), [S, D, dRid]);
  const P = useMemo(() => S && (Object.keys(dPicks).length ? playoffPath(S, D, dRid, { picks: dPicks }) : base), [S, D, dRid, dPicks, base]);
  if (!S || !P) return (
    <section ref={box} id="playoff-scenarios" className="panel glass span-12 pth pth-wait" aria-busy="true">
      <h2>What needs to happen</h2>
      <p className="sub">Playing out the rest of the season 20,000 times.</p>
      <span className="pth-spin" aria-hidden="true" />
    </section>
  );

  const team = (r) => D.byRid[r], t = team(dRid), first = h.first(t);
  const nm = (r, k = 16) => h.short(team(r).name, k);
  const nPicks = Object.keys(picks).length;
  const thin = P.matches < 400;
  const pick = (i, v) => setPicks((cur) => { const next = { ...cur }; if (next[i] === v) delete next[i]; else next[i] = v; return next; });
  const game = (i) => S.games[i];
  const winnerSide = (x, r) => (r === x.ra ? 1 : 0);

  // the desk's read, in one breath
  const big = [...P.yours].filter((x) => !x.picked && x.ifGood != null && x.ifBad != null).sort((a, b) => b.swing - a.swing)[0];
  let lede;
  if (P.matches === 0) lede = 'No simulated season matches all of those picks. Take one back.';
  else if (P.odds >= 0.995) lede = `${first}, you're in. ${p0(P.odds)} of ${nPicks ? 'the matching' : 'the'} simulated seasons end with you in the top ${S.P}${P.need === 0 ? ', even if you lose out' : ''}.`;
  else if (P.odds <= 0.005) lede = `${first}, it would take a miracle: you miss the playoffs in ${p0(1 - P.odds)} of ${nPicks ? 'the matching' : 'the'} simulated seasons.`;
  else {
    lede = `${first}, you're in ${p0(P.odds)} of the time.`;
    if (big) lede += ` The game that matters most is week ${big.week} against ${h.first(team(big.opp))}: win it and you're at ${p0(big.ifGood)}, lose it and you're at ${p0(big.ifBad)}.`;
    if (P.rivals[0]) lede += ` Your best friend is anyone playing ${h.first(team(P.rivals[0].rid))}.`;
  }

  const Bar = ({ lo, hi, cls = '' }) => (
    <span className={`pth-db ${cls}`} aria-hidden="true">
      <i className="pth-db-span" style={{ left: `${lo * 100}%`, width: `${Math.max(0, hi - lo) * 100}%` }} />
      <i className="pth-db-lo" style={{ left: `${lo * 100}%` }} />
      <i className="pth-db-hi" style={{ left: `${hi * 100}%` }} />
    </span>
  );
  const Pick = ({ x, a, b, labelA, labelB }) => {
    const v = picks[x.i];
    return (
      <span className="pth-pick" role="group" aria-label={`Pick the winner, week ${x.week}`}>
        <button type="button" aria-pressed={v === winnerSide(x, a)} onClick={() => pick(x.i, winnerSide(x, a))}>{labelA}</button>
        <button type="button" aria-pressed={v === winnerSide(x, b)} onClick={() => pick(x.i, winnerSide(x, b))}>{labelB}</button>
      </span>
    );
  };
  // a game you've already decided reads back as a result, with the odds it was worth
  const pickedBadge = (x) => <span className="pth-done">{`${nm(picks[x.i] ? x.ra : x.rb, 14)} win`}</span>;

  // the lists hold still while you pick: which games and rivals show comes from the read without your picks, the
  // numbers from the current one, so a tapped row stays where it was and turns into its result
  const watchRows = base.watch.map((x) => ({ x: { ...x, picked: x.i in dPicks }, b: P.games[x.i] }));
  const shown = new Set([...P.yours.map((x) => x.i), ...base.watch.map((x) => x.i)]);
  const floor = P.floor, ceil = P.ceiling;
  const fcTip = (b, word) => b && `${word} for week ${b.week}: ${b.results.map((r) => `${team(r.winner).name} win`).join(', ')}. Your odds by Tuesday: ${p0(b.odds)}.`;
  const crit = new Set([...P.yours].filter((x) => !x.picked).sort((a, b) => b.swing - a.swing).slice(0, 2).map((x) => x.i));

  const Path = ({ title, path, note, cls }) => (
    <article className={`pth-card ${cls}`}>
      <h3>{title}</h3>
      {path ? <>
        <p className="pth-rec"><b>{path.record}</b><span>{`${path.wins} of ${P.left} from here`}</span></p>
        <ol className="pth-strip" style={{ '--n': path.results.length }}>{path.results.map((r) => (
          <li key={r.week} className={r.win ? 'w' : 'l'} data-tip={`Week ${r.week} vs ${team(r.opp).name}: on this path you win it ${p0(r.share)} of the time`}>
            <b>{r.win ? 'W' : 'L'}</b><small><span className="pth-wkw">Wk </span>{r.week}</small>
          </li>
        ))}</ol>
        <p className="pth-note">{note(path)}</p>
        {path.helps.length ? <ul className="pth-helps">{path.helps.map((x) => (
          <li key={x.i}>{`${nm(x.root)} beat ${nm(x.against)} in week ${x.week}`}<small>{`${p0(x.share)} on this path, ${p0(x.pGood)} usually`}</small></li>
        ))}</ul> : <p className="pth-note muted">No help needed from anyone else.</p>}
      </> : <p className="pth-note">{cls === 'long' ? 'No shortcut: every way in runs through the same record.' : 'None of the matching seasons get you in.'}</p>}
    </article>
  );

  const end = P.ending;
  const seedMax = Math.max(...P.seeds.map((s) => s.share), 0.01);

  return (
    <section ref={box} id="playoff-scenarios" className={`panel glass span-12 pth${stale ? ' stale' : ''}`}>
      <div className="pth-top">
        <div>
          <h2>What needs to happen</h2>
          <p className="sub">{`${S.sims.toLocaleString('en-US')} simulated finishes to the regular season, the same model as the playoff odds. Pick a winner in any game below and every number is read again from only the seasons where it happened.`}</p>
        </div>
        <label className="trade-pick pth-team"><span>Path for</span>
          <select value={String(rid)} onChange={(e) => setRid(Number(e.target.value))}>
            {[...D.teams].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.rid} value={x.rid}>{x.name}</option>)}
          </select>
        </label>
      </div>
      <p className="lab-lede">{lede}</p>
      {nPicks ? (
        <p className={`pth-scn${thin ? ' thin' : ''}`}>
          <span>{`Your scenario: ${nPicks} ${nPicks === 1 ? 'result' : 'results'} picked, ${P.matches.toLocaleString('en-US')} of ${S.sims.toLocaleString('en-US')} seasons match${thin ? '. Thin sample, read loosely' : ''}. Odds were ${p0(base.odds)}.`}</span>
          <button type="button" className="chip" onClick={() => setPicks({})}>Clear picks</button>
        </p>
      ) : null}

      <div className="pth-stats">
        <div className="pth-stat main"><small>Playoff odds</small><b>{p0(P.odds)}</b><span>{nPicks ? `${P.odds >= base.odds ? '+' : ''}${Math.round((P.odds - base.odds) * 100)} from your picks` : `top ${S.P} of ${D.teams.length}`}</span></div>
        <div className="pth-stat range">
          <small>{floor || ceil ? `Floor and ceiling after week ${(floor || ceil).week}` : 'Floor and ceiling'}</small>
          <span className="pth-fc">
            <span data-tip={fcTip(floor, 'Worst case')}><em>Floor</em><b>{p0(floor?.odds)}</b></span>
            {Bar({ lo: floor?.odds ?? P.odds, hi: ceil?.odds ?? P.odds, cls: "big" })}
            <span data-tip={fcTip(ceil, 'Best case')}><em>Ceiling</em><b>{p0(ceil?.odds)}</b></span>
          </span>
          <span>Your result plus the week's other games going all wrong, or all right</span>
        </div>
        <div className="pth-stat"><small>Wins you need</small><b>{P.need == null ? 'Help' : P.need === 0 ? 'None' : `${P.need} of ${P.left}`}</b><span>{P.need == null ? 'no win total is 90% safe' : 'for 9 in 10 to get in'}</span></div>
      </div>

      <div className="pth-cols">
        <div className="pth-box">
          <h3>Critical weeks to win</h3>
          <p className="pth-cap">Your games in order. The bar runs from your odds if you lose to your odds if you win.</p>
          <ul className="pth-list">{P.yours.map((x) => (
            <li key={x.i} className={crit.has(x.i) ? 'crit' : undefined}>
              <span className="pth-wk">{`Wk ${x.week}`}</span>
              <span className="pth-who"><TeamAvatar t={team(x.opp)} cls="avatar xs" /><span>{`vs ${nm(x.opp)}`}</span>{crit.has(x.i) ? <em className="pth-flag">Critical</em> : null}</span>
              {x.picked ? pickedBadge(x) : <span className="pth-sw" data-tip={`Week ${x.week} vs ${team(x.opp).name}: ${p0(x.ifGood)} if you win, ${p0(x.ifBad)} if you lose. You win it ${p0(x.pGood)} of the time.`}>
                {Bar({ lo: x.ifBad ?? 0, hi: x.ifGood ?? 0 })}<b>{`+${pts(x.swing)}`}</b>
              </span>}
              {Pick({ x: x, a: dRid, b: x.opp, labelA: "W", labelB: "L" })}
            </li>
          ))}</ul>
        </div>
        <div className="pth-box">
          <h3>Matchups to watch</h3>
          <p className="pth-cap">Other games that move your odds most. Root for the first team.</p>
          {watchRows.length ? <ul className="pth-list">{watchRows.map(({ x, b }) => (
            <li key={x.i} className={x.picked ? 'done' : undefined}>
              <span className="pth-wk">{`Wk ${x.week}`}</span>
              <span className="pth-who"><TeamAvatar t={team(x.root)} cls="avatar xs" /><span><b>{nm(x.root, 13)}</b>{` over ${nm(x.against, 13)}`}</span></span>
              {x.picked ? pickedBadge(x) : <span className="pth-sw" data-tip={`Week ${x.week}: ${p0(b.ifGood)} if ${team(x.root).name} win, ${p0(b.ifBad)} if ${team(x.against).name} do. ${team(x.root).name} win it ${p0(b.pGood)} of the time.`}>
                {Bar({ lo: b.ifBad ?? 0, hi: b.ifGood ?? 0 })}<b>{`+${pts(b.swing)}`}</b>
              </span>}
              {Pick({ x: x, a: x.root, b: x.against, labelA: h.first(team(x.root)), labelB: h.first(team(x.against)) })}
            </li>
          ))}</ul> : <p className="pth-cap">Nobody else's games move you by much.</p>}
          {Object.keys(picks).filter((i) => !shown.has(Number(i))).map((i) => {
            const g = game(Number(i));
            return <p key={i} className="pth-picked">{`Picked: week ${g.week}, ${nm(picks[i] ? g.ra : g.rb)} beat ${nm(picks[i] ? g.rb : g.ra)}`}<button type="button" className="chip" onClick={() => pick(Number(i), picks[i])}>Undo</button></p>;
          })}
        </div>
      </div>

      <div className="pth-box">
        <h3>Who needs to lose</h3>
        <p className="pth-cap">The rivals whose losses help you most, and the weeks they help. Bigger chips matter more; tap one to pick it.</p>
        {base.rivals.length ? <div className="pth-rivals">{base.rivals.map((r) => (
          <div key={r.rid} className="pth-rival">
            <span className="pth-rv"><TeamAvatar t={team(r.rid)} cls="avatar xs" /><b>{nm(r.rid, 18)}</b><small>{`${h.record(team(r.rid))}, ${p0(team(r.rid).playoffPct)} now`}</small></span>
            <span className="pth-wks">{r.weeks.map((w) => (
              <button key={w.week} type="button" className={`pth-wkchip${w.swing >= 0.04 ? ' big' : ''}`} aria-pressed={picks[w.i] === winnerSide(game(w.i), w.vs)}
                onClick={() => pick(w.i, winnerSide(game(w.i), w.vs))} data-tip={`A ${team(r.rid).name} loss to ${team(w.vs).name} in week ${w.week} is worth ${pts(w.swing)} on your playoff odds`}>
                {`Wk ${w.week} vs ${h.first(team(w.vs))}`}
              </button>
            ))}</span>
          </div>
        ))}</div> : <p className="pth-cap">Nobody: it's all in your hands.</p>}
      </div>

      <div className="pth-paths">
        {Path({ title: "Most realistic way in", cls: "real", path: P.realistic, note: (p) => `The likeliest way you get in: ${p0(p.chance)} of seasons go this way. At ${p.record} you're in ${p0(p.oddsIf)} of the time.` })}
        {Path({ title: "The long shot", cls: "long", path: P.longshot, note: (p) => `The fewest wins that still get you in: ${p.record} works ${p0(p.oddsIf)} of the time, about 1 season in ${Math.max(1, Math.round(1 / Math.max(p.chance, 1e-6))).toLocaleString('en-US')}.` })}
        <article className="pth-card end">
          <h3>Most common ending</h3>
          {end ? <>
            <p className="pth-rec"><b>{end.record}</b><span>{`${h.ordinal(end.seed)} seed, ${p0(end.share)} of seasons`}</span></p>
            <div className="pth-seeds" role="img" aria-label="How often each final seed comes up">{P.seeds.map((s) => (
              <span key={s.seed} className={`${s.seed <= S.P ? 'in' : ''}${s.seed === end.seed ? ' top' : ''}`} data-tip={`${h.ordinal(s.seed)} seed: ${p0(s.share)} of seasons`}>
                <i style={{ height: `${Math.max(2, (s.share / seedMax) * 100)}%` }} /><small>{s.seed}</small>
              </span>
            ))}</div>
            <p className="pth-note">{end.inPlayoffs ? `Green seeds make the playoffs. The usual finish gets you in.` : `Green seeds make the playoffs. The usual finish leaves you out, so the paths beside this one are the plan.`}</p>
          </> : null}
        </article>
      </div>
    </section>
  );
}
