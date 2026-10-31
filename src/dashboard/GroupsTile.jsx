// 5. Position groups, as batteries: each bar is the group's league rank, the best group charging in the accent.
import { useCallback, useRef } from 'react';
import { useFrame } from './clock.js';
import { TL, out, seg } from './motion.js';
import { Bolt, Label, Tile } from './parts.jsx';

const POS_WORD = { QB: 'Quarterback', RB: 'Running back', WR: 'Receiver', TE: 'Tight end' };

export function GroupsTile({ m, h }) {
  const best = Math.min(...m.groups.map((x) => x.rank ?? 99));
  const fills = useRef([]), levels = useRef([]);
  useFrame(useCallback((t) => {
    m.groups.forEach((x, i) => {
      const fill = fills.current[i], level = levels.current[i];
      if (!fill || !level) return;
      const k = seg(t, TL.fill[0] + i * TL.fillStagger, TL.fill[1] + i * TL.fillStagger, out);
      fill.style.width = `${(x.rank ? (m.n - x.rank + 1) / m.n : 0) * k * 100}%`;
      level.textContent = x.rank ? h.ordinal(Math.max(x.rank, Math.round(m.n - (m.n - x.rank) * k))) : '–';
    });
  }, [m, h]));

  return (
    <Tile index={4} className="pp-groups">
      <Label>Position groups</Label>
      {m.groups.map((x, i) => (
        <div key={x.pos} className="pp-row" style={{ '--i': i }}
          data-tip={`${POS_WORD[x.pos]}s: ${x.rank ? `${h.ordinal(x.rank)} of ${m.n}` : 'no rank'}${h.groupSaid ? ` (${h.groupSaid(m.t, x.pos)})` : ''}`}>
          <div className="well">{x.pos}</div>
          <div className="name">{x.top ? h.shortName(x.top) : 'Nobody'}</div>
          <div className="level" ref={(l) => { levels.current[i] = l; }} />
          <div className="track">
            <div ref={(f) => { fills.current[i] = f; }} className={`fill${x.rank === best ? ' charging' : ''}`}>{x.rank === best ? <div className="shimmer" /> : null}</div>
          </div>
          {x.rank === best ? <div className="bolt"><Bolt /></div> : null}
        </div>
      ))}
    </Tile>
  );
}
