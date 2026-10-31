// The headline carousel: three headlines in one square scoreboard card (four on night-edition nights, one per story on
// the week's desk), swiped, stepped with the arrows or picked from the dots; the active dot's fill is the auto-advance
// timer. The stories themselves are written in app.js (and lib/stories.js, lib/nightdesk.js) as plain data; this draws
// them and runs the card. A video story's clip plays muted on a loop while its slide shows (useClip).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { shortName } from '../../lib/matchup.js';
import { TeamAvatar, Headshot, ChampTag, ChampBadge } from '../shared.jsx';

const asset = (p) => window.__ASSETS__?.[p] || p;
const mq = (q) => matchMedia(q).matches;
const calm = () => mq('(prefers-reduced-motion: reduce)');

// the pause button holds the headlines where they are for the rest of the visit (every page's carousel)
let pausedForVisit = false;

// the front-page photo: whoever the story is about, with a stamp on the first face saying what kind of day it was
const STAMPS = {
  trade: 'Deal', wire: 'Pickup', cut: 'Cut', flurry: 'Busy', dud: 'Benched?', star: 'Star turn', unbeaten: 'Perfect',
  winless: 'Winless', upset: 'Upset', blowout: 'Boom', nailbiter: 'Phew', explosion: 'Boom', climb: 'Rising',
  fall: 'Sliding', unlucky: 'Robbed', lucky: 'Lucky', giant: 'Giant', gotw: 'Big game',
};
function Faces({ st, D, h }) {
  const ts = st.rids.map((r) => D.byRid[r]).filter((t) => t && h.faceSrc(t)).slice(0, 2);
  if (!ts.length) return null;
  const stamp = st.stamp || (st.type === 'streak' ? (st.tone === 'good' ? 'Heater' : 'Skid') : STAMPS[st.type]);
  return (
    <div className={`lead-faces n${ts.length} ${st.tone || ''}`} aria-hidden="true">
      {ts.map((t, k) => (
        <span className="lf" key={t.rid}>
          <Headshot t={t} cls={`lead-face${st.drain === t.rid ? ' drained' : ''}`} h={h} /><ChampBadge t={t} h={h} />
          <span className="cap">{h.first(t)}</span>{k === 0 && stamp ? <em className="stamp">{stamp}</em> : null}
        </span>
      ))}
    </div>
  );
}

// the player a story is about, printed like a trading card where the headline photos go: his Sleeper headshot, name and
// position, the stamp, and the face of the manager he's headed to pinned on the corner
function PlayerPrint({ st, h }) {
  const P = st.player, to = P.pin?.team;
  const [failed, setFailed] = useState(false);
  const initials = P.name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <figure className={`player-print ${st.tone || ''}`} aria-hidden="true">
      <div className="pp-card">
        {failed ? <span className="pp-img ph">{initials}</span>
          : <img className="pp-img" src={`https://sleepercdn.com/content/nfl/players/${P.id}.jpg`} alt="" decoding="async" onError={() => setFailed(true)} />}
        <figcaption><b>{P.short}</b><small>{P.line}</small></figcaption>
      </div>
      {st.stamp ? <em className="stamp">{st.stamp}</em> : null}
      {to && h.faceSrc(to) ? <span className="lf pp-who"><Headshot t={to} cls="lead-face" h={h} /><span className="cap">{P.pin.label}</span></span> : null}
    </figure>
  );
}

const CLIP_ICONS = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  muted: <><path d="M3.5 9.5v5h3.8l4.7 4v-13l-4.7 4z" fill="currentColor" /><path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>,
  sound: <><path d="M3.5 9.5v5h3.8l4.7 4v-13l-4.7 4z" fill="currentColor" /><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></>,
};

// a video story's clip, printed like the headline photos: the stamp on its corner and the face of whoever the joke is on
function ClipPrint({ st, D, h, clip }) {
  const C = st.clip, who = D.byRid[st.face];
  const state = clip.state;
  return (
    <figure className={`clip-print ${st.tone || ''}`}>
      <div className="clip-frame">
        <video ref={clip.video} className="clip" muted playsInline loop preload="none" poster={asset(C.poster)} aria-label={C.label}><source src={asset(C.src)} type="video/mp4" /></video>
        <button type="button" ref={clip.button} className="clip-sound" data-state={state} aria-pressed={state === 'play' ? undefined : String(state === 'sound')}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">{CLIP_ICONS[state]}</svg><span>{state === 'play' ? 'Play' : 'Sound'}</span>
        </button>
      </div>
      {C.stamp ? <em className="stamp" aria-hidden="true">{C.stamp}</em> : null}
      {who && h.faceSrc(who) ? <span className="lf clip-who" aria-hidden="true"><Headshot t={who} cls="lead-face" h={h} /><span className="cap">{h.first(who)}</span></span> : null}
    </figure>
  );
}

// a story's key name in yellow, in the headline and the deck (st.mark)
function Marked({ text, marks }) {
  if (!marks?.length) return text;
  const re = new RegExp(`(${marks.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
  return text.split(re).filter(Boolean).map((part, i) => (marks.includes(part) ? <mark className="hl" key={i}>{part}</mark> : part));
}

function RankSpark({ t, D, w = 84, h: ht = 30 }) {
  const v = t.rankHistory, n = D.teams.length;
  if (v.length < 2) return null;
  const x = (i) => 3 + (i / (v.length - 1)) * (w - 6), y = (r) => 3 + ((r - 1) / (n - 1)) * (ht - 6);
  const d = v.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r).toFixed(1)}`).join('');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${ht}`} width={w} height={ht} role="img" aria-label="Power rank by week" data-tip={`${t.name} power rank by week: ${v.join(', ')}`}>
      <path d={d} stroke={D.color[t.rid]} pathLength="1" /><circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r="3" fill={D.color[t.rid]} />
    </svg>
  );
}

function Cast({ st, D, h }) {
  return (
    <div className="cast">
      {st.rids.map((r) => D.byRid[r]).filter(Boolean).map((t) => (
        <div className="cast-team" key={t.rid}>
          <TeamAvatar t={t} />
          <div className="cast-name"><b>{t.name}<ChampTag t={t} h={h} label={false} /></b><small>{`No. ${t.powerRank} power, ${h.record(t)}`}</small></div>
          <RankSpark t={t} D={D} />
          <span className="cast-odds"><b>{h.pct(t.playoffPct)}</b><small>playoffs</small></span>
        </div>
      ))}
    </div>
  );
}

// the clobber story's scoreboard: both scores, the projected finals, a win-odds bar and each side's key players
function ScoreBug({ bug: { w, l, kw, kl }, h }) {
  const score = (s, cls) => (
    <div className={`bug-side ${cls}`}>
      <span className="bug-team">{h.short(s.t.name, 20)}</span>
      <b className="bug-pts">{h.f1(s.banked)}</b>
      <small>{`Projected ${h.f1(s.proj)}`}</small>
    </div>
  );
  const row = (x, i) => {
    const d = x.played ? x.proj - x.pre : 0, tag = !x.played ? 'proj' : d >= 4 ? 'boom' : d <= -4 ? 'bust' : 'done';
    return (
      <li key={i} className={tag} data-tip={x.played ? `${x.name}: ${h.f1(x.proj)} points, projected ${h.f1(x.pre)}` : `${x.name}: projected ${h.f1(x.proj)}, still to play`}>
        <span className={`pos ${x.pos}`}>{x.pos}</span><span className="bug-pl">{shortName(x)}</span><b>{h.f1(x.proj)}</b><small>{x.played ? 'Final' : 'Proj'}</small>
      </li>
    );
  };
  const wp = Math.round(w.win * 100);
  return (
    <div className="bug">
      <div className="bug-score">{score(w, 'lead')}<span className="bug-vs">vs</span>{score(l, 'trail')}</div>
      <div className="bug-odds" role="img" aria-label={`${w.t.name} ${wp}% to win, ${l.t.name} ${100 - wp}%`}>
        <span>{`${wp}%`}</span><i style={{ '--w': `${wp}%` }} /><span>{`${100 - wp}%`}</span>
      </div>
      <div className="bug-key"><ul>{kw.map(row)}</ul><ul>{kl.map(row)}</ul></div>
    </div>
  );
}

const Brk = () => <span className="brk"><i aria-hidden="true" />Breaking</span>;
const TONIGHT = new Set(['monday', 'locked', 'tonight']);

function Slide({ st, i, n, D, h, groups, runs, date, night, clip, slideRef }) {
  const run = runs?.find((x) => x.i.includes(i));
  const breaking = st.type === 'shakeup' || st.breaking;
  const top = (
    <div className="slide-top">
      <p className="kicker">
        {breaking ? <Brk /> : null}
        <span>{i ? (TONIGHT.has(st.type) || (st.type === 'sass' && night) ? 'Tonight' : 'Also today') : date}</span>
        <span className={`k${st.group ? ` g-${st.group}` : ''}`}>{st.kicker}{run && run.i.length > 1 ? <small>{`${run.i.indexOf(i) + 1} of ${run.i.length}`}</small> : null}</span>
      </p>
      {st.clip ? null : st.player ? <PlayerPrint st={st} h={h} /> : <Faces st={st} D={D} h={h} />}
    </div>
  );
  const Hed = i ? 'h2' : 'h1';
  const hed = <Hed className={`lead-hed${st.mark ? ' marked' : ''}`}><Marked text={st.headline} marks={st.mark} /></Hed>;
  return (
    <article ref={slideRef} className={`slide${breaking ? ' breaking' : ''}${st.clip ? ' has-clip' : ''}`} id={`slide-${i}`} role="group" aria-roledescription="slide" aria-label={`Headline ${i + 1} of ${n}`}>
      {st.clip ? <><div className="clip-head">{top}{hed}</div><ClipPrint st={st} D={D} h={h} clip={clip} /></> : <>{top}{hed}</>}
      <p className="lead-deck"><Marked text={st.deck} marks={st.mark} /></p>
      {st.bug ? <ScoreBug bug={st.bug} h={h} /> : <Cast st={st} D={D} h={h} />}
    </article>
  );
}

const Arrow = ({ dir, label, d, onClick }) => (
  <button type="button" className="car-arrow" data-dir={dir} aria-label={label} onClick={onClick}>
    <svg width="9" height="14" viewBox="0 0 9 14" aria-hidden="true"><path d={d} stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </button>
);
const PauseIcon = ({ paused }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">{paused
    ? <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" />
    : <path d="M4 2.5h2.6v11H4zm5.4 0H12v11H9.4z" fill="currentColor" />}</svg>
);

/**
 * stories: the headlines, in order; date: today, for the first kicker; hold: the "games in progress" note, or null;
 * night: the night edition is on; groups: section labels by story group (the week's desk); nav: a ref the league desk
 * shares, set here to { at, go } (which slide is showing, and turning to one).
 */
export function Carousel({ D, h, stories, date, hold, night, groups, nav }) {
  const n = stories.length;
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(pausedForVisit);
  const car = useRef(null), track = useRef(null), slides = useRef([]), dots = useRef([]);
  const at = useRef(0), resize = useRef(true);
  const clipVideo = useRef(null), clipButton = useRef(null);
  const [clipState, setClipState] = useState('play');
  const clipSync = useRef(null);

  // sections: runs of slides sharing a group, when every slide has one
  const runs = stories.every((st) => groups[st.group])
    ? stories.reduce((a, st, i) => { const r = a[a.length - 1]; if (r?.g === st.group) r.i.push(i); else a.push({ g: st.group, i: [i] }); return a; }, [])
    : null;

  // on phones the card hugs the story that's showing instead of the tallest one, so short stories leave no gap
  const fit = () => {
    const tr = track.current, sl = slides.current[at.current];
    if (tr && sl) tr.style.height = mq('(max-width: 760px)') && n > 1 ? `${sl.offsetHeight}px` : '';
  };
  const steering = useRef(0);
  const go = (i) => {
    const k = (i + n) % n;
    at.current = k; resize.current = true;
    setIdx(k);
    const sl = slides.current[k];
    sl.classList.remove('enter');
    void sl.offsetWidth; // restart the animation
    sl.classList.add('enter');
    clearTimeout(steering.current);
    steering.current = setTimeout(() => (steering.current = 0), 700); // ignore scroll events from our own smooth scroll
    track.current.scrollTo({ left: k * track.current.clientWidth, behavior: calm() ? 'auto' : 'smooth' });
  };
  const goRef = useRef(go);
  goRef.current = go;

  // a slide change: resize the card (unless a finger is mid-swipe) and let the clip catch up
  useLayoutEffect(() => {
    if (resize.current) fit();
    clipSync.current?.();
  }, [idx]);

  useEffect(() => {
    const el = car.current, tr = track.current;
    if (nav) nav.current = { at: () => at.current, go: (i) => goRef.current(i) }; // for the league desk's headline chips
    // Only rotate (or play a clip) while the card is mostly on screen. A rotation changes the card's height on phones,
    // and iPhone Safari doesn't anchor scrolling, so rotating while someone reads further down would jolt the page.
    const seen = new IntersectionObserver(([e]) => { el.classList.toggle('away', e.intersectionRatio < 0.6); clipSync.current?.(); }, { threshold: [0, 0.6] });
    seen.observe(el);
    if (n < 2) return () => { seen.disconnect(); if (nav) nav.current = null; };
    fit();
    document.fonts?.ready.then(fit); // headline height changes once the display font arrives
    // re-fit on real width changes only: iPhone fires resize as its toolbar hides during every scroll
    let width = innerWidth;
    const onResize = () => { if (innerWidth !== width) { width = innerWidth; fit(); } };
    addEventListener('resize', onResize, { passive: true });
    // during a finger swipe, move the dots right away but resize only once the slide has settled
    let settle = 0;
    const onScroll = () => {
      if (steering.current) return;
      const i = Math.round(tr.scrollLeft / tr.clientWidth);
      if (i !== at.current) { at.current = i; resize.current = false; setIdx(i); }
      clearTimeout(settle);
      settle = setTimeout(fit, 140);
    };
    tr.addEventListener('scroll', onScroll, { passive: true });
    // touch has no hover, so hold the timer while a finger is down
    const down = () => el.classList.add('held'), up = () => el.classList.remove('held');
    tr.addEventListener('pointerdown', down);
    tr.addEventListener('pointerup', up);
    tr.addEventListener('pointercancel', up);
    return () => {
      seen.disconnect();
      removeEventListener('resize', onResize);
      tr.removeEventListener('scroll', onScroll);
      tr.removeEventListener('pointerdown', down);
      tr.removeEventListener('pointerup', up);
      tr.removeEventListener('pointercancel', up);
      clearTimeout(settle); clearTimeout(steering.current);
      if (nav) nav.current = null;
    };
  }, []);

  useEffect(() => { car.current.classList.toggle('paused', paused); }, [paused]);
  const togglePause = () => { pausedForVisit = !paused; setPaused(!paused); };

  useClip({ car, video: clipVideo, button: clipButton, dots, slides, at, sync: clipSync, setState: setClipState });

  const dot = (i) => (
    <button type="button" key={i} ref={(b) => (dots.current[i] = b)} className="car-dot" data-i={i} aria-label={`Show headline ${i + 1}${runs ? `, ${groups[stories[i].group]}` : ''}`} aria-controls={`slide-${i}`}
      aria-current={i === idx ? 'true' : undefined} onClick={() => go(i)}>
      <i onAnimationEnd={() => go(at.current + 1)} />
    </button>
  );
  return (
    <section ref={car} className="lead-car glass rim" aria-roledescription="carousel" aria-label="Today's headlines">
      {hold ? <p className="desk-note" role="status"><span className="live-dot" aria-hidden="true" />{hold}</p> : null}
      <div className="car-track" tabIndex="0" ref={track}>
        {stories.map((st, i) => (
          <Slide key={i} st={st} i={i} n={n} D={D} h={h} groups={groups} runs={runs} date={date} night={night}
            clip={{ video: clipVideo, button: clipButton, state: clipState }} slideRef={(s) => (slides.current[i] = s)} />
        ))}
      </div>
      {n > 1 ? (
        <div className="car-nav">
          <Arrow dir={-1} label="Previous headline" d="M7.5 1.5 2 7l5.5 5.5" onClick={() => go(at.current - 1)} />
          <div className="car-mid">
            {runs
              ? <div className="car-dots grouped">{runs.map((r) => <div className={`car-group g-${r.g}`} key={r.i[0]}><div className="cg-dots">{r.i.map(dot)}</div><span className="cg-label">{groups[r.g]}</span></div>)}</div>
              : <div className="car-dots">{stories.map((_, i) => dot(i))}</div>}
            <button type="button" className="car-pause" aria-pressed={String(paused)} aria-label={`${paused ? 'Play' : 'Pause'} the headlines`} onClick={togglePause}><PauseIcon paused={paused} /></button>
          </div>
          <Arrow dir={1} label="Next headline" d="M1.5 1.5 7 7l-5.5 5.5" onClick={() => go(at.current + 1)} />
        </div>
      ) : null}
    </section>
  );
}

// A video story's clip plays muted on a loop, and only while its slide is showing, the card is mostly on screen, the tab
// is visible and nothing covers the page (the important message and the reveal lock it with html.locked). Its dot runs
// as long as the clip and holds while the video loads, so the two finish together. A tap starts the clip over with
// sound, and the dot with it; leaving the slide mutes it again. Under reduced motion or Save-Data, or when the browser
// refuses to autoplay (iPhone Low Power Mode), it shows the still until tapped.
function useClip({ car, video, button, dots, slides, at, sync, setState }) {
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const el = car.current, slide = v.closest('.slide'), btn = button.current;
    const dot = dots.current[slides.current.indexOf(slide)];
    const auto = !calm() && !navigator.connection?.saveData;
    let blocked = false, sound = false, here = false, hold = 0;
    const paint = () => setState(v.paused ? 'play' : v.muted ? 'muted' : 'sound');
    const hush = () => { sound = false; v.muted = true; v.loop = true; };
    // the dot waits for the frames to move ('playing'), though never more than 3 s on a slow connection
    const wait = (on) => { clearTimeout(hold); el.classList.toggle('buffering', on); if (on) hold = setTimeout(() => wait(false), 3000); };
    const play = () => {
      if (v.paused) wait(true); // a clip already running (a tap for sound) just starts over; 'waiting' covers a stall
      if (!v.readyState && v.networkState !== v.NETWORK_LOADING) v.load(); // Safari won't fetch a preload="none" clip on play() alone
      // a refusal blocks autoplay from here on; a start cut short by pause() (a swipe, the takeover) doesn't
      v.play()?.catch((e) => { if (e?.name !== 'AbortError' && !sound) blocked = true; wait(false); paint(); });
    };
    const mine = () => slides.current[at.current] === slide;
    const showing = () => mine() && !el.classList.contains('away') && !document.hidden && !document.documentElement.classList.contains('locked');
    const check = () => {
      const was = here;
      here = mine();
      if (!showing()) {
        if (!v.paused) v.pause();
        wait(false);
        if (!here) hush(); // it comes back silent, from the top
        return paint();
      }
      if (!was) v.currentTime = 0;
      if (v.paused && (sound || (auto && !blocked))) play();
      paint();
    };
    const tap = () => {
      if (!v.paused && !v.muted) { // sound off: back to the silent loop, or a stop where nothing autoplays
        hush();
        if (!auto || blocked) v.pause();
        return paint();
      }
      sound = true; blocked = false;
      v.muted = false; v.loop = false; v.currentTime = 0;
      // start the dot over with the clip (it only runs on the slide that's showing)
      const fill = dot?.querySelector('i');
      if (fill) { fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = ''; }
      play();
      paint();
    };
    const onPlaying = () => { wait(false); paint(); };
    const onWaiting = () => { if (showing()) wait(true); };
    const onMeta = () => dot?.style.setProperty('--fill', `${v.duration}s`);
    // only a clip with sound ends (the silent one loops): back to the silent loop, from the top
    const onEnded = () => { hush(); v.currentTime = 0; if (auto && !blocked && showing()) play(); paint(); };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('pause', paint);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('ended', onEnded);
    btn.addEventListener('click', tap);
    v.addEventListener('click', tap);
    // it stops while the tab is hidden or an overlay locks the page (html.locked), and picks up after
    document.addEventListener('visibilitychange', check);
    const locks = new MutationObserver(check);
    locks.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    sync.current = check;
    check();
    return () => {
      sync.current = null;
      clearTimeout(hold);
      document.removeEventListener('visibilitychange', check);
      locks.disconnect();
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('pause', paint);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('click', tap);
      btn.removeEventListener('click', tap);
      v.pause();
    };
  }, []);
}
