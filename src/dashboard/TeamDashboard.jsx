// The team dashboard (Nerd lab, #lab/team): one team's season on eight paper widgets in the Paper Widgets style. The
// numbers come from dashData (lib/dashboard.js, pure and tested); the look is .paper in styles.css. Picking another
// team remounts the sheet, so its intro plays again.
import { useLayoutEffect, useMemo, useState } from 'react';
import { dashData } from '../../lib/dashboard.js';
import { ClockContext, createClock } from './clock.js';
import { TL } from './motion.js';
import { OddsTile } from './OddsTile.jsx';
import { PlayersTile } from './PlayersTile.jsx';
import { EfficiencyTile } from './EfficiencyTile.jsx';
import { ScoringTile } from './ScoringTile.jsx';
import { GroupsTile } from './GroupsTile.jsx';
import { ScheduleTile } from './ScheduleTile.jsx';
import { LuckTile } from './LuckTile.jsx';
import { FaceOffTile } from './FaceOffTile.jsx';

/**
 * D: the computed league; raw: the Sleeper snapshot (matchups for player points); ros: consensus values by player id;
 * rid: the team to open on; h: the page's helpers (f1, pct, ordinal, record, first, shortName, nfl, groupSaid,
 * faceSrc, teams); calm: reduced motion; onTeam(rid): told when another team is picked.
 */
export function TeamDashboard({ D, raw, ros, rid: start, h, calm, onTeam }) {
  const [rid, setRid] = useState(start);
  const m = useMemo(() => dashData(D, rid, { raw, ros }), [D, rid, raw, ros]);
  if (!m) return null;
  const t = m.t;
  return (
    <section className="paper" data-paper aria-label={`Team dashboard for ${t.name}`}>
      <header className="pp-head">
        <span className="pp-face"><Face t={t} h={h} /></span>
        <div className="pp-id">
          <p>Team dashboard</p>
          <h2>{t.name}</h2>
          <p className="pp-sub">{`${h.first(t)}, ${h.record(t)}, ${h.ordinal(t.seed)} in the standings, No. ${t.powerRank} power`}</p>
        </div>
        <label className="pp-pick">
          <span>Team</span>
          <select id="dash-team" value={rid} onChange={(e) => { const r = Number(e.target.value); setRid(r); onTeam?.(r); }}>
            {[...h.teams].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.rid} value={x.rid}>{x.name}</option>)}
          </select>
        </label>
      </header>
      <Sheet key={rid} m={m} h={h} calm={calm} />
    </section>
  );
}

// the eight tiles and the clock that plays their intro (about 3 s, then it stops; reduced motion draws the end at once)
function Sheet({ m, h, calm }) {
  const clock = useMemo(createClock, []);
  useLayoutEffect(() => {
    if (calm) { clock.draw(TL.end + 1); return undefined; }
    clock.draw(0);
    let raf = 0, t0 = null;
    const frame = (now) => {
      if (t0 === null) t0 = now;
      const s = (now - t0) / 1000;
      clock.draw(Math.min(s, TL.end));
      if (s < TL.end) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [clock, calm]);
  return (
    <ClockContext.Provider value={clock}>
      <div className="pp-grid">
        <OddsTile m={m} h={h} />
        <PlayersTile m={m} h={h} calm={calm} />
        <EfficiencyTile m={m} h={h} />
        <ScoringTile m={m} h={h} />
        <GroupsTile m={m} h={h} />
        <ScheduleTile m={m} h={h} calm={calm} />
        <LuckTile m={m} h={h} calm={calm} />
        <FaceOffTile m={m} h={h} calm={calm} />
      </div>
    </ClockContext.Provider>
  );
}

// the manager's photo, or their initials when there's no photo or it fails to load
function Face({ t, h }) {
  const src = h.faceSrc(t), [failed, setFailed] = useState(false), first = h.first(t);
  useLayoutEffect(() => setFailed(false), [src]);
  return src && !failed
    ? <img className="pp-face-img" src={src} alt={first} decoding="async" onError={() => setFailed(true)} />
    : <span className="ph">{(first || '?')[0]}</span>;
}
