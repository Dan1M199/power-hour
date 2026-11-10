import { useSwipe } from '../swipe.js';
import { useState } from 'react';

// Every dot is a real league team; tapping a metric exposes the full comparison.
export function SeasonPortrait({ D, t, me, h }) {
  const [metric, setMetric] = useState('pfPerGame');
  const metrics = [['pfPerGame', 'Scoring', 'pts / game'], ['efficiency', 'Lineup efficiency', '%'], ['playoffPct', 'Playoff odds', '%']];
  const swipe = useSwipe((d) => setMetric((key) => metrics[(metrics.findIndex(([id]) => id === key) + d + metrics.length) % metrics.length][0]));
  const [, label, unit] = metrics.find(([key]) => key === metric);
  const rows = D.teams.filter((x) => Number.isFinite(x[metric])).sort((a, b) => b[metric] - a[metric]);
  const max = metric === 'pfPerGame' ? Math.max(1, ...rows.map((x) => x[metric])) : 1;
  const value = (v) => metric === 'pfPerGame' ? h.f1(v) : h.pct(v);
  return <section className="season-portrait" aria-label={`${t.name} season comparison`}>
    <div className="season-portrait-head"><h3>{t.rid === me ? 'Where you stand' : 'Around the league'}</h3><span>{`Through week ${D.meta.lastScored}`}</span></div>
    <div className="portrait-tabs" role="group" aria-label="Compare a season metric">{metrics.map(([key, name]) => <button type="button" key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>{name}</button>)}</div>
    <p className="swipe-hint">Swipe the chart to compare another stat</p>
    <div {...swipe} className="portrait-chart swipe-surface" role="img" aria-label={`${label}: ${Number.isFinite(t[metric]) ? value(t[metric]) : 'not available'} for ${t.name}. Each dot is a team.`}>
      <div className="portrait-axis"><span>0</span><span>{`${value(max)} ${unit === '%' ? '' : unit}`}</span></div>
      {rows.map((x) => <div key={x.rid} className={`portrait-row${x.rid === t.rid ? ' own' : ''}`}><span>{x.rid === me ? 'You' : h.first(x)}</span><div className="portrait-track"><i style={{ left: `${x[metric] / max * 100}%` }} /></div><b>{value(x[metric])}</b></div>)}
      {!rows.length ? <p>No completed games to compare yet.</p> : null}
    </div>
    <div className="portrait-form"><span>Recent form</span><ol>{(t.weeks || []).slice(-5).map((w) => <li key={w.week} data-result={w.result} title={`Week ${w.week}: ${h.f1(w.pts)} points`}><small>{`W${w.week}`}</small><b>{w.result || '—'}</b><small>{h.f1(w.pts)}</small></li>)}</ol>{!t.weeks?.length ? <span>Your season starts here.</span> : null}</div>
  </section>;
}
