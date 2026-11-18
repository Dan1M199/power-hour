// "What needs to happen": one team's road to the playoffs, read off 20,000 simulated rest-of-seasons (restOfSeason and
// playoffPath in lib/labmodels.js). The odds with next week's floor and ceiling, your games by how much each one moves
// you (the critical weeks), the other games to watch and who to root for, who needs to lose and when, the most
// realistic way in, a long shot and the most common ending. Every game is pickable: pick a winner and everything is
// read again from only the seasons where that happened, so you can build your own scenario. The scenario builder (Dan's
// request Nov 17) lists every remaining game week by week as two team buttons, a first visit points at one ("Tap a
// team", until this device has picked once: ph-pth-picked), and a sticky bar carries the picks and the odds they moved.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { restOfSeason, playoffPath } from '../../lib/labmodels.js';
import { TeamAvatar } from '../shared.jsx';
import { scenarioFiles } from './scenarioCard.js';
import { shareFile, canShareFiles } from '../dashboard/share.js';

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
  const [bw, setBw] = useState(null); // the builder's week
  const [wdir, setWdir] = useState(''); // which way the last week change went, so the games slide in from that side
  const [taught, setTaught] = useState(() => { try { return localStorage.getItem('ph-pth-picked') === '1'; } catch { return false; } });
  const rid = pickRid ?? me ?? bubble;
  // a tap paints its pressed button at once; the seasons are read again in a render React can drop if another tap comes
  const dRid = useDeferredValue(rid), dPicks = useDeferredValue(picks);
  const stale = dRid !== rid || dPicks !== picks;
  const base = useMemo(() => S && playoffPath(S, D, dRid), [S, D, dRid]);
  const P = useMemo(() => S && (Object.keys(dPicks).length ? playoffPath(S, D, dRid, { picks: dPicks }) : base), [S, D, dRid, dPicks, base]);
  // the scenario receipt: drawn a beat after the picks settle, as a JPEG and a PDF made ahead of the tap (Safari only
  // opens the share sheet within a few seconds of it)
  const [files, setFiles] = useState(null), [said, setSaid] = useState('');
  useEffect(() => {
    if (!S || !P || !base || !Object.keys(dPicks).length || !P.matches) { setFiles(null); return undefined; }
    let live = true;
    const id = setTimeout(() => {
      scenarioFiles({ D, base, P, picks: dPicks, rid: dRid, games: S.games, sims: S.sims, weeks: S.weeks, spots: S.P })
        .then((f) => { if (live) setFiles(f); else URL.revokeObjectURL(f.url); }).catch(() => { if (live) setFiles(null); });
    }, 250);
    return () => { live = false; clearTimeout(id); };
  }, [S, D, P, base, dPicks, dRid]);
  useEffect(() => () => { if (files) URL.revokeObjectURL(files.url); }, [files]);
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
  const pick = (i, v) => {
    setPicks((cur) => { const next = { ...cur }; if (next[i] === v) delete next[i]; else next[i] = v; return next; });
    if (!taught) { setTaught(true); try { localStorage.setItem('ph-pth-picked', '1'); } catch { /* private mode */ } }
  };
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

  // the lists hold still while you pick: which games and rivals show comes from the read without your picks, the
  // numbers from the current one, so a tapped row stays where it was and turns into its result
  // in week order (the biggest swing first within a week)
  const byWeek = (a, b) => a.week - b.week || b.swing - a.swing;
  // this week's game to watch: the result outside your own game that moves your odds most
  const wk0 = S.weeks[0];
  const spot = base.games.filter((x) => x.week === wk0 && x.ra !== dRid && x.rb !== dRid && x.swing >= 0.005).sort((a, b) => b.swing - a.swing)[0] || null;
  // your odds if a given team wins game i, read now (so it follows your picks), and the move from where you stand
  const oddsIf = (i, winner) => { const g = P.games[i]; return g ? (winner === g.ra ? g.oA : g.oB) : null; };
  const move = (x) => (x == null || P.odds == null ? null : x - P.odds);
  const signed = (d) => (d == null ? '–' : `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%`);
  // who needs to lose: every rival loss that helps, the biggest dozen, in week order
  const losses = base.rivals.flatMap((r) => r.weeks.map((w) => ({ ...w, rid: r.rid }))).sort((a, b) => b.swing - a.swing).slice(0, 12).sort(byWeek);
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
      {nPicks ? null : (
        <button type="button" className="pth-invite" onClick={() => document.getElementById('pth-build')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })}>
          <span className="pth-invite-dots" aria-hidden="true"><i /><i /><i /></span>
          <span><b>Build your own scenario</b><small>Tap a team in any game to make them win, and watch every number on this card follow.</small></span>
          <span className="pth-invite-go" aria-hidden="true">Start</span>
        </button>
      )}

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

      {(() => {
        const wk = bw ?? S.weeks[0];
        const swingOf = (i) => base.games[i]?.swing ?? 0;
        const others = P.games.filter((g) => g.week === wk && g.ra !== dRid && g.rb !== dRid).sort((a, b) => swingOf(b.i) - swingOf(a.i));
        const inWeek = (w) => Object.keys(picks).filter((i) => { const g = game(Number(i)); return g.week === w && g.ra !== dRid && g.rb !== dRid; }).length;
        const impact = (i) => { const w = swingOf(i); return w >= 0.05 ? ['big', 'Big for you'] : w >= 0.015 ? ['some', 'Matters'] : ['low', 'Barely moves you']; };
        const side = (g, r) => {
          const a = r === g.ra, v = a ? 1 : 0, on = picks[g.i] === v, off = g.i in picks && !on;
          const win = a ? g.pA : 1 - g.pA, yours = a ? g.oA : g.oB, d = move(yours), root = base.games[g.i]?.root === r && swingOf(g.i) >= 0.015;
          return (
            <button type="button" className={`pth-side${on ? ' on' : ''}${off ? ' off' : ''}`} aria-pressed={on} onClick={() => pick(g.i, v)}
              aria-label={`${team(r).name} win week ${g.week}${yours != null ? `: your odds ${p0(yours)}` : ''}`}>
              <TeamAvatar t={team(r)} cls="avatar xs" />
              <span className="pth-side-name"><b>{team(r).name}</b><small>{on ? 'Wins in your scenario' : off ? 'Loses in your scenario' : root ? 'Root for them' : `Wins ${p0(win)} of the time`}</small></span>
              {off ? null : <span className={`pth-side-odds${d == null ? '' : d > 0.004 ? ' up' : d < -0.004 ? ' down' : ''}`}><b>{p0(yours)}</b><small>{d == null || Math.abs(d) < 0.005 ? 'your odds' : signed(d)}</small></span>}
            </button>
          );
        };
        // your own games: win or lose, and your odds either way
        const wl = (x, win) => {
          const v = winnerSide(game(x.i), win ? dRid : x.opp), on = picks[x.i] === v, off = x.i in picks && !on;
          const o = P.games[x.i] ? (v === 1 ? P.games[x.i].oA : P.games[x.i].oB) : null, d = move(o);
          return (
            <button type="button" className={`pth-wl ${win ? 'win' : 'loss'}${on ? ' on' : ''}${off ? ' off' : ''}`} aria-pressed={on} onClick={() => pick(x.i, v)}
              aria-label={`${win ? 'Win' : 'Lose'} week ${x.week} against ${team(x.opp).name}${o != null ? `: your odds ${p0(o)}` : ''}`}>
              <b>{win ? 'Win' : 'Lose'}</b>
              {off ? null : <span><b>{p0(o)}</b><small>{d == null || Math.abs(d) < 0.005 ? 'your odds' : signed(d)}</small></span>}
            </button>
          );
        };
        return (
          <section className="pth-build" id="pth-build" aria-labelledby="pth-build-t">
            <header className="pth-build-top">
              <h3 id="pth-build-t">Build your scenario</h3>
              <p className="pth-cap">{`Pick results and every number on this card is read again from only the seasons where they happen. Start with ${first}'s games, then the rest of the league.`}</p>
            </header>

            <div className="pth-part">
              <div className="pth-part-head">
                <h4>{`${first}'s games`}</h4>
                <p className="pth-cap">Win or lose each one. The two that swing your odds the most are marked.</p>
              </div>
              <ul className="pth-mine">{P.yours.map((x, k) => (
                <li key={x.i} className={`${crit.has(x.i) ? 'crit' : ''}${x.i in picks ? ' picked' : ''}`.trim() || undefined}>
                  <span className="pth-mine-who">
                    <span className="pth-wk">{`Wk ${x.week}`}</span>
                    <TeamAvatar t={team(x.opp)} cls="avatar xs" />
                    <span className="pth-mine-name"><b>{`vs ${nm(x.opp, 20)}`}</b><small>{`You win it ${p0(x.pGood)} of the time`}</small></span>
                    {crit.has(x.i) ? <em className="pth-flag">Critical</em> : null}
                  </span>
                  <span className="pth-wl-pair">{wl(x, true)}{wl(x, false)}</span>
                  {!taught && k === 0 ? <span className="pth-coach" aria-hidden="true">Tap to pick a result</span> : null}
                </li>
              ))}</ul>
            </div>

            <div className="pth-part">
              <div className="pth-part-head">
                <div>
                  <h4>The rest of the league</h4>
                  <p className="pth-cap">{`Biggest effect on ${first} first. Tap the team you want to win; the number beside it is your odds if they do.`}</p>
                </div>
                <div className="pth-weeks" role="tablist" aria-label="Week">
                  {S.weeks.map((w) => (
                    <button key={w} type="button" role="tab" aria-selected={w === wk} onClick={(e) => {
                      if (w !== wk) setWdir(w > wk ? 'go-next' : 'go-prev');
                      setBw(w);
                      // bring the tapped week to the middle of the tray, so the weeks either side of it can be reached
                      const b = e.currentTarget, tray = b.parentElement;
                      tray.scrollTo({ left: b.offsetLeft - (tray.clientWidth - b.offsetWidth) / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
                    }}>
                      {`Wk ${w}`}{inWeek(w) ? <i className="pth-wcount">{inWeek(w)}</i> : null}
                    </button>
                  ))}
                </div>
              </div>
              <ul key={wk} className={`pth-games${wdir ? ` ${wdir}` : ''}`}>{others.map((g) => {
                const [lvl, said] = impact(g.i);
                return (
                  <li key={g.i} className={`imp-${lvl}${g.i in picks ? ' picked' : ''}`}>
                    <span className={`pth-imp ${lvl}`}>{spot && g.i === spot.i ? 'Biggest this week' : said}</span>
                    {side(g, g.ra)}
                    <span className="pth-vs" aria-hidden="true">vs</span>
                    {side(g, g.rb)}
                  </li>
                );
              })}</ul>
            </div>
          </section>
        );
      })()}

      {nPicks ? (
        <section className="pth-receipt" aria-labelledby="pth-receipt-t">
          <div className="pth-receipt-text">
            <h3 id="pth-receipt-t">Your scenario receipt</h3>
            <p className="pth-cap">{`Everything ${first} needs, and where the odds go if it all happens. Share it to the group chat.`}</p>
            <div className="pth-receipt-acts">
              <button type="button" className="pth-share" disabled={!files} onClick={async () => { try { setSaid(await shareFile(files.jpg, `power-hour-scenario-${dRid}.jpg`, 'Playoff scenario') === 'saved' ? 'Saved' : ''); } catch { setSaid('Could not share it'); } }}>
                {canShareFiles() ? 'Share image' : 'Save image'}
              </button>
              <button type="button" className="pth-share alt" disabled={!files} onClick={async () => { try { setSaid(await shareFile(files.pdf, `power-hour-scenario-${dRid}.pdf`, 'Playoff scenario') === 'saved' ? 'Saved' : ''); } catch { setSaid('Could not share it'); } }}>
                {canShareFiles() ? 'Share PDF' : 'Save PDF'}
              </button>
              {said ? <span className="pth-said" role="status">{said}</span> : null}
            </div>
          </div>
          <div className="pth-receipt-img">{files ? <img src={files.url} alt={`The scenario receipt for ${t.name}: playoff odds ${p0(base.odds)} today, ${p0(P.odds)} in this scenario`} /> : <span className="pth-spin" aria-hidden="true" />}</div>
        </section>
      ) : null}

      <div className="pth-box">
        <h3>Shortcuts: who needs to lose</h3>
        <p className="pth-cap">The rival losses that help you most, in week order, with what each one does to your playoff odds. Tap one to pick it.</p>
        {losses.length ? <ul className="pth-lose">{losses.map((w) => {
          const side = winnerSide(game(w.i), w.vs), on = picks[w.i] === side, other = w.i in picks && !on;
          const d = move(oddsIf(w.i, w.vs));
          return (
            <li key={w.i}>
              <button type="button" aria-pressed={on} onClick={() => pick(w.i, side)}
                data-tip={`If ${team(w.rid).name} lose to ${team(w.vs).name} in week ${w.week}, your playoff odds go to ${p0(oddsIf(w.i, w.vs))}`}>
                <span className="pth-wk">{`Wk ${w.week}`}</span>
                <span className="pth-who"><TeamAvatar t={team(w.rid)} cls="avatar xs" /><span><b>{nm(w.rid, 16)}</b>{` lose to ${h.first(team(w.vs))}`}</span></span>
                <span className={`pth-boost${on ? ' on' : ''}`}>{on ? 'Picked' : other ? 'Other way' : <><b>{signed(d)}</b><small>your odds</small></>}</span>
              </button>
            </li>
          );
        })}</ul> : <p className="pth-cap">Nobody: it's all in your hands.</p>}
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
      {nPicks ? (
        <div className={`pth-bar${thin ? ' thin' : ''}`} role="status">
          <div className="pth-bar-odds">
            <small>Your scenario</small>
            <b>{p0(P.odds)}</b>
            <span className={P.odds >= base.odds ? 'up' : 'down'}>{`${P.odds >= base.odds ? '+' : '−'}${Math.abs(Math.round((P.odds - base.odds) * 100))} from ${p0(base.odds)}`}</span>
          </div>
          <ul className="pth-bar-picks">{Object.keys(picks).map(Number).sort((a, b) => game(a).week - game(b).week).map((i) => {
            const g = game(i), w = picks[i] ? g.ra : g.rb;
            return <li key={i}><button type="button" onClick={() => pick(i, picks[i])} aria-label={`Take back: ${team(w).name} win week ${g.week}`}>{`Wk ${g.week}: ${nm(w, 14)} win`}<span aria-hidden="true" className="pth-x" /></button></li>;
          })}</ul>
          <div className="pth-bar-end">
            <small>{`${P.matches.toLocaleString('en-US')} of ${S.sims.toLocaleString('en-US')} seasons${thin ? ', thin sample' : ''}`}</small>
            <span className="pth-bar-btns">
              <button type="button" className="chip pth-bar-share" disabled={!files} onClick={() => document.querySelector('.pth-receipt')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })}>Receipt</button>
              <button type="button" className="chip" onClick={() => setPicks({})}>Clear</button>
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
