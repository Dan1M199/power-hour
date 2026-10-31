// The team dashboard (the Lab's Your team section, #lab/team): one team's season on eight paper widgets in the Paper Widgets style. The
// numbers come from dashData (lib/dashboard.js, pure and tested); the look is .paper in styles.css. Picking another
// team remounts the sheet, so its intro plays again. Share draws the sheet as a picture (share.js) and opens a preview
// with Share image and Share PDF, which hand the file to the phone's share sheet.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { canShareFiles, captureSheet, pdfOf, pngOf, shareFile } from './share.js';

/**
 * D: the computed league; raw: the Sleeper snapshot (matchups for player points); ros: consensus values by player id;
 * rid: the team to open on; h: the page's helpers (f1, pct, ordinal, record, first, shortName, nfl, groupSaid,
 * faceSrc, teams); calm: reduced motion; onTeam(rid): told when another team is picked.
 */
export function TeamDashboard({ D, raw, ros, rid: start, h, calm, onTeam }) {
  const [rid, setRid] = useState(start);
  const paper = useRef(null), intro = useRef(null); // intro.current(): jumps the sheet's intro to its end
  const [share, setShare] = useState(null); // the preview: { name, title } while open
  const m = useMemo(() => dashData(D, rid, { raw, ros }), [D, rid, raw, ros]);
  if (!m) return null;
  const t = m.t;
  const head = { title: `${t.name} on The Power Hour`, line: `${raw?.league?.name || 'Team dashboard'}, through week ${D.meta.lastScored || 0}` };
  return (
    <section className="paper" data-paper ref={paper} aria-label={`Team dashboard for ${t.name}`}>
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
        <button type="button" className="pp-share" onClick={() => { intro.current?.(); setShare({ name: fileName(t.name, D.meta.lastScored), title: head.title, head }); }}>
          <ShareIcon />Share
        </button>
      </header>
      <Sheet key={rid} m={m} h={h} calm={calm} finish={intro} />
      {share ? createPortal(<ShareSheet paper={paper.current} {...share} onClose={() => setShare(null)} />, document.body) : null}
    </section>
  );
}

// the eight tiles and the clock that plays their intro (about 3 s, then it stops; reduced motion draws the end at once)
// finish: a ref that gets a function jumping the intro to its end (Share calls it, so the picture has the final numbers)
function Sheet({ m, h, calm, finish }) {
  const clock = useMemo(createClock, []);
  useLayoutEffect(() => {
    if (calm) { clock.draw(TL.end + 1); return undefined; }
    clock.draw(0);
    let raf = 0, t0 = null;
    if (finish) finish.current = () => { cancelAnimationFrame(raf); clock.draw(TL.end + 1); };
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

const fileName = (name, week) => `power-hour-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'team'}-week-${week || 0}`;

// The share preview: the sheet is drawn as soon as it opens (a moment on a phone), then shown with its two buttons.
// The share sheet needs a fresh tap to open (Safari allows about 5 s between the tap and navigator.share), which is why
// sharing is a second step, and why both files are made while the preview opens: the tap only hands one over.
function ShareSheet({ paper, name, title, head, onClose }) {
  const [shot, setShot] = useState(null); // { png, pdf, url }
  const [state, setState] = useState('drawing'); // drawing, ready, busy, failed
  const [note, setNote] = useState('');
  const files = useMemo(canShareFiles, []);
  const close = useRef(null);
  useEffect(() => {
    let alive = true, url = null;
    document.documentElement.classList.add('locked');
    captureSheet(paper, head).then(async (canvas) => {
      const [png, pdf] = await Promise.all([pngOf(canvas), pdfOf(canvas)]);
      url = URL.createObjectURL(png);
      if (alive) { setShot({ png, pdf, url }); setState('ready'); }
    }).catch(() => alive && setState('failed'));
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', key);
    close.current?.focus();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); removeEventListener('keydown', key); document.documentElement.classList.remove('locked'); };
  }, [paper]);

  const send = async (kind) => {
    if (!shot) return;
    setState('busy'); setNote('');
    try {
      const done = await shareFile(shot[kind], `${name}.${kind}`, title);
      setNote(done === 'saved' ? `Saved the ${kind === 'pdf' ? 'PDF' : 'picture'} to your downloads.` : '');
    } catch {
      setNote('Sharing didn\'t go through. Try again, or press and hold the picture to save it.');
    }
    setState('ready');
  };

  return (
    <div className="share-sheet" role="dialog" aria-modal="true" aria-label="Share the team dashboard" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="share-card glass">
        <header><b>Share this dashboard</b><button type="button" className="share-x" ref={close} aria-label="Close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button></header>
        <div className="share-shot">
          {shot ? <img src={shot.url} alt={`The team dashboard for ${title.replace(' on The Power Hour', '')}`} />
            : <p>{state === 'failed' ? 'The picture couldn\'t be made on this device. A screenshot still works.' : 'Drawing the dashboard…'}</p>}
        </div>
        <div className="share-go">
          <button type="button" className="cta" disabled={!shot || state === 'busy'} onClick={() => send('png')}><ShareIcon />{files ? 'Share image' : 'Save image'}</button>
          <button type="button" className="share-pdf" disabled={!shot || state === 'busy'} onClick={() => send('pdf')}>{files ? 'Share PDF' : 'Save PDF'}</button>
        </div>
        <p className="share-note" aria-live="polite">{note || (files ? 'Opens your phone\'s share sheet: send it to the group chat, or Save Image to keep it.' : 'Saves the file to your downloads.')}</p>
      </div>
    </div>
  );
}

// the iPhone's share mark: a box with an arrow out of the top
const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1" />
  </svg>
);
