// 7. Luck, as the focus switch: the real record and how lucky it is against the scores; flip the switch and the tile
// goes dark with the all-play record (every team, every week). The words change halfway through the fade.
import { useEffect, useRef, useState } from 'react';
import { Dice, Label, Tile } from './parts.jsx';

const rec = (r) => `${r.w}-${r.l}${r.tie ? `-${r.tie}` : ''}`;

export function LuckTile({ m, h, calm }) {
  const L = m.luck;
  const [on, setOn] = useState(false); // the switch
  const [dark, setDark] = useState(false); // the words, halfway behind it
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flip = () => {
    const next = !on;
    setOn(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDark(next), calm ? 0 : 225);
  };
  const caption = dark ? 'All-play: every team, every week'
    : Math.abs(L.luck) < 0.25 ? 'Right where the scores say' : `${h.f1(Math.abs(L.luck))} wins ${L.luck > 0 ? 'luckier' : 'unluckier'} than the scores`;
  return (
    <Tile index={6} className={`pp-luck${on ? ' flipping' : ''}${dark ? ' on' : ''}`}>
      <div className="face">
        <div className="dark" />
        <Label>Luck</Label>
        <div className="moon"><Dice /></div>
        <div className="state">{dark ? `${L.allPlay.w}-${L.allPlay.l}` : rec(L.record)}</div>
        <div className="caption">{caption}</div>
        <button type="button" className="toggle" role="switch" aria-checked={on} aria-label="Show the all-play record" onClick={flip}
          data-tip={`All-play: ${L.allPlay.w}-${L.allPlay.l} playing every team every week, worth ${h.f1(L.expected)} wins against ${L.record.w} real ones`}>
          <span className="knob" />
        </button>
        <span className="toggle-word">All-play</span>
      </div>
    </Tile>
  );
}
