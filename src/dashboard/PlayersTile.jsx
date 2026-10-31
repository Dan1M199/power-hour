// 2. Key players, as the music player: one star at a time, a cover each (two styles taking turns), his last five weeks
// as the equaliser, season and per-game points and his weekly projection, and this week's projection against his
// ceiling (or his final score) as the progress bar. Prev and next slide the next cover in over the old one while the
// words dip and change; play/pause runs a new player every 6 s while the dashboard is on screen.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFrame } from './clock.js';
import { TL, back, clamp, inOut, out, seg } from './motion.js';
import { Label, Next, Pause, Play, Prev, Tile } from './parts.jsx';

const POS_WORD = { QB: 'Quarterback', RB: 'Running back', WR: 'Receiver', TE: 'Tight end' };
const SWAP_MS = 600, EVERY_MS = 6000;
const initials = (name) => name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('');

// a cover: ultramarine with a peach sun, or paper with a black disc, by the player's place in the list
function Cover({ p, i, coverRef }) {
  const mark = `${p.pos}—${String(p.prk ?? '–').padStart(2, '0')}`;
  return i % 2 === 0
    ? <div className="art a" ref={coverRef}><span className="disc" /><span className="rule" /><span className="mark">{mark}</span><span className="init">{initials(p.name)}</span></div>
    : <div className="art b" ref={coverRef}><span className="disc" /><span className="sq" /><span className="mark">{mark}</span><span className="init">{initials(p.name)}</span></div>;
}

// this week, for the bar: his final score if he's played, else his projection, against his ceiling
const weekShare = (p) => { const w = p.week, v = w.played ? w.now : w.pre; return w.bye || w.out ? 0 : clamp(v / Math.max(w.ceil || 0, v, 1)); };

export function PlayersTile({ m, h, calm }) {
  if (!m.stars.length) return <Tile index={1} className="pp-player" wide><Label>Key players</Label><div className="pp-empty">No player projections yet.</div></Tile>;
  return <Players stars={m.stars} h={h} calm={calm} />;
}

function Players({ stars, h, calm }) {
  const [shown, setShown] = useState(0); // the player in the words, the stats and the bar
  const [layers, setLayers] = useState([{ id: 0, i: 0, dir: 1 }]); // cover layers, the newest on top
  const [playing, setPlaying] = useState(!calm && stars.length > 1);
  const [nudge, setNudge] = useState(0); // a manual step restarts the 6 s wait
  const tile = useRef(null), words = useRef([]), bars = useRef([]), stats = useRef([]), covers = useRef(new Map());
  const shownRef = useRef(0), busy = useRef(false), settled = useRef(calm);

  // the bar, the equaliser and the three stats for the player in the words; kBar and kStats say how far they've grown
  const paint = useCallback((kBar, kStats) => {
    const p = stars[shownRef.current];
    tile.current?.style.setProperty('--f', String(weekShare(p) * kBar));
    const eq = p.last5.map((x) => x.pts), peak = Math.max(...eq, 1);
    bars.current.forEach((bar, i) => {
      if (!bar) return;
      const v = eq[i - (5 - eq.length)];
      bar.style.height = `${v == null ? 2 : 2 + 12 * (v / peak) * seg(kBar, i * 0.1, 0.6 + i * 0.1, back)}px`;
    });
    [p.season, p.avg, p.perWeek].forEach((v, i) => { if (stats.current[i]) stats.current[i].textContent = v == null ? '–' : h.f1(v * kStats); });
  }, [stars, h]);

  useFrame(useCallback((t) => {
    if (busy.current) return;
    paint(seg(t, TL.progress[0], TL.progress[1]), seg(t, TL.stats[0], TL.stats[1], out));
    if (t >= TL.end) settled.current = true;
  }, [paint]));

  const step = (d) => {
    if (busy.current || stars.length < 2) return;
    busy.current = true;
    setLayers((ls) => {
      const top = ls[ls.length - 1];
      return [top, { id: top.id + 1, i: (top.i + d + stars.length) % stars.length, dir: d > 0 ? 1 : -1 }];
    });
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  // the swap: the old cover drifts aside, shrinks and fades as the new one slides in; the words dip out, change, come back
  useLayoutEffect(() => {
    if (layers.length < 2) return;
    const [was, now] = layers, old = covers.current.get(was.id), fresh = covers.current.get(now.id), dir = now.dir;
    if (!old || !fresh) return;
    fresh.style.transform = `translateX(${dir * 248}px)`;
    const dur = calm ? 1 : SWAP_MS, t0 = performance.now();
    let changed = false, raf = 0;
    const tick = (time) => {
      const x = clamp((time - t0) / dur), k = inOut(x);
      old.style.transform = `translateX(${-40 * dir * k}px) scale(${1 - 0.06 * k})`;
      old.style.opacity = String(1 - 0.9 * k);
      fresh.style.transform = `translateX(${dir * (1 - k) * 248}px)`;
      const dip = String(1 - seg(x, 0.15, 0.35) * (1 - seg(x, 0.35, 0.75)));
      words.current.forEach((w) => w && (w.style.opacity = dip));
      if (!changed && x >= 0.35) { changed = true; shownRef.current = now.i; setShown(now.i); }
      paint(seg(x, 0.3, 1), seg(x, 0.3, 1, out));
      if (x < 1) raf = requestAnimationFrame(tick);
      else { busy.current = false; setLayers([now]); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layers, calm, paint]);

  // a new player every 6 s, once the intro is over, while the tile is on screen and the tab is visible
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const r = tile.current?.getBoundingClientRect();
      if (settled.current && document.visibilityState === 'visible' && r && r.bottom > 0 && r.top < innerHeight) stepRef.current(1);
    }, EVERY_MS);
    return () => clearInterval(id);
  }, [playing, nudge]);

  const p = stars[shown], w = p.week, value = w.played ? w.now : w.pre;
  const click = (d) => { step(d); setNudge((n) => n + 1); };
  return (
    <Tile index={1} className="pp-player" wide tileRef={tile}>
      <div className="pp-cover" aria-hidden="true">
        <div className="pp-cover-in">
          {layers.map((l) => <Cover key={l.id} p={stars[l.i]} i={l.i} coverRef={(el) => { if (el) covers.current.set(l.id, el); else covers.current.delete(l.id); }} />)}
        </div>
      </div>
      <Label>Key players</Label>
      <div className="pp-eq" aria-hidden="true" data-tip={p.last5.length ? `Last ${p.last5.length} weeks: ${p.last5.map((x) => h.f1(x.pts)).join(', ')}` : 'No games with this team yet'}>
        {[0, 1, 2, 3, 4].map((i) => <i key={i} ref={(b) => { bars.current[i] = b; }} style={{ '--i': i }} />)}
      </div>
      <div className="pp-title" ref={(el) => { words.current[0] = el; }}>{p.name}</div>
      <div className="pp-artist" ref={(el) => { words.current[1] = el; }}>{`${POS_WORD[p.pos] || p.pos}, ${h.nfl(p.nfl)}`}</div>
      <div className="pp-stats">
        <div><b ref={(el) => { stats.current[0] = el; }} /><small>Season pts</small></div>
        <div><b ref={(el) => { stats.current[1] = el; }} /><small>Per game</small></div>
        <div><b ref={(el) => { stats.current[2] = el; }} /><small>Proj a week</small></div>
      </div>
      <div className="pp-progress"><i /></div><div className="pp-knob" />
      <div className="pp-ptime elapsed">{w.bye ? 'Bye this week' : w.out ? 'Out this week' : `${h.f1(value)} ${w.played ? 'final' : 'this week'}`}</div>
      <div className="pp-ptime length">{w.ceil != null && !w.bye && !w.out ? `${h.f1(Math.max(w.ceil || 0, value, 1))} ceiling` : ''}</div>
      <button type="button" className="pp-btn prev" aria-label="Previous player" onClick={() => click(-1)}><Prev /></button>
      <button type="button" className="pp-play" aria-label={playing ? 'Pause' : 'Play through the players'} aria-pressed={!playing} onClick={() => { setPlaying((x) => !x); setNudge((n) => n + 1); }}>
        {playing ? <Pause /> : <Play />}
      </button>
      <button type="button" className="pp-btn next" aria-label="Next player" onClick={() => click(1)}><Next /></button>
      <span className="pp-count">{`${shown + 1} of ${stars.length}`}</span>
    </Tile>
  );
}
