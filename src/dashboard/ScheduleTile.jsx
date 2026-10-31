// 6. The schedule, as the calendar: the picked game's week in big numerals with the opponent and the odds, and the
// games left as a list to pick from. Every game is graded by its win odds (LEVELS: easy from 60%, hard at 40% or
// less, a toss-up between), which colours its marker and odds chip, the slate of blocks beside the label (the whole
// run at a glance, the picked game outlined) and the word under the big week.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from './clock.js';
import { TL, out, seg } from './motion.js';
import { Label, Tile } from './parts.jsx';

export const LEVELS = { easy: 'Easy', toss: 'Toss-up', hard: 'Hard' };
export const levelOf = (win) => (win >= 0.6 ? 'easy' : win <= 0.4 ? 'hard' : 'toss');

export function ScheduleTile({ m, h, calm }) {
  const games = m.schedule;
  const [sel, setSel] = useState(0);
  const [dip, setDip] = useState(false);
  const rows = useRef([]), list = useRef(null), timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  useFrame(useCallback((t) => {
    rows.current.forEach((row, i) => {
      if (!row) return;
      const k = seg(t, TL.rows[0] + i * TL.rowStagger, TL.rows[1] + i * TL.rowStagger, out);
      row.style.opacity = String(k);
      row.style.transform = `translateY(${(1 - k) * TL.rowRise}px)`;
    });
    list.current?.style.setProperty('--chip', String(seg(t, TL.chip[0], TL.chip[1])));
  }, []));

  // the left side fades out, changes and fades back in
  const pick = (i) => {
    setDip(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setSel(i); setDip(false); }, calm ? 0 : 140);
  };
  const x = games[sel];
  return (
    <Tile index={5} className={`pp-cal${dip ? ' dip' : ''}`} wide>
      <Label>{games.length ? 'Schedule' : 'Season'}</Label>
      {games.length ? (
        <div className="pp-slate" aria-hidden="true">
          {games.map((g, i) => <i key={g.week} className={`${levelOf(g.win)}${i === sel ? ' on' : ''}`} data-tip={`Week ${g.week} vs ${g.opp.name}: ${LEVELS[levelOf(g.win)].toLowerCase()}, ${h.pct(g.win)} to win`} />)}
        </div>
      ) : null}
      <div className="pp-date">{x ? x.week : '–'}</div>
      <div className="pp-month">{x ? <><span className={`pp-lvl ${levelOf(x.win)}`}>{LEVELS[levelOf(x.win)]}</span>{` vs ${h.first(x.opp)}`}</> : ''}</div>
      <div className="pp-summary">{x ? `${h.pct(x.win)} to win, they project ${h.f1(x.proj)}` : ''}</div>
      <div className="pp-divider" />
      <div className="pp-list" role="listbox" aria-label="Games left" ref={list}>
        {games.length ? games.map((g, i) => (
          <button key={g.week} type="button" className={`pp-ev ${levelOf(g.win)}`} role="option" aria-selected={i === sel} style={{ '--i': i }}
            ref={(r) => { rows.current[i] = r; }} onClick={() => pick(i)}>
            <span className="time">{`Wk ${g.week}`}</span><span className="marker" />
            <span className="ev-text"><span className="ev-title">{g.opp.name}</span><span className="ev-detail">{`No. ${g.opp.powerRank} power, ${h.record(g.opp)}`}</span></span>
            <span className="chip" aria-label={`${LEVELS[levelOf(g.win)]}, ${h.pct(g.win)} to win`}>{h.pct(g.win)}</span>
          </button>
        )) : <p className="pp-empty">The regular season is over.</p>}
      </div>
    </Tile>
  );
}
