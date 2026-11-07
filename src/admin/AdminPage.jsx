// The admin portal (#admin), Dan's own headline desk: tick the transactions to write about, start from a draft worked
// out of the numbers (draftFor in app.js), rewrite it with the real carousel slide as the preview, and post it. Posted
// headlines lead the carousel on the rankings and Live pages (carouselProps in app.js) until they run out or he takes
// them down. Dan signs in with the headline desk password or admin key. Everyone else
// who opens #admin only gets the sign-in box, and api/headlines.js refuses any write that isn't his.
//
// The page is one desk, top to bottom: the running order (what the carousel shows, in order: his headlines, numbered
// like yard numbers, then the site's own, greyed), then the work. The work is either the moves to pick from, or, once a
// draft is open, the writing: the real slide on the left (sticky), the form on the right, the post button docked at
// the bottom of the form.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { TZ } from '../../lib/newsclock.js';
import { Carousel } from '../hero/Carousel.jsx';
import { PosTag, TeamAvatar } from '../shared.jsx';
import { usePosts, loadPosts, postCall, adminAuthCall } from './posts.js';

const TONES = [['trade', 'Trade'], ['good', 'Good news'], ['bad', 'Bad news'], ['neutral', 'Plain']];
const when = (ts) => new Date(ts).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ago = (ts, now) => {
  const m = Math.round((now - ts) / 6e4);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return when(ts);
};
// the next Tuesday 6am Central, when the week turns over and the new headlines come in
function weekTurns(now) {
  const parts = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(t).map((p) => [p.type, p.value]));
  let t = Math.ceil(now / 36e5) * 36e5;
  for (let i = 0; i < 24 * 8; i++, t += 36e5) { const p = parts(t); if (p.weekday === 'Tue' && Number(p.hour) === 6) return t; }
  return now + 7 * 864e5;
}
const RUNS = [['week', 'Until Tuesday'], ['day', '24 hours'], ['3days', '3 days'], ['forever', 'Until I take it down']];
const untilFor = (run, now) => ({ week: weekTurns(now), day: now + 864e5, '3days': now + 3 * 864e5 }[run] ?? null);

const EMPTY = { kicker: 'From the desk', stamp: '', tone: 'neutral', group: '', tradeStyle: '', breaking: false, headline: '', deck: '', hook: '', line: '', rids: [], player: '', marks: '', tx: [], run: 'week' };
// the portal's form from a story (a draft or a post), and back
const formOf = (s, run = 'week') => ({
  ...EMPTY, ...s, stamp: s.stamp || '', group: s.group || '', hook: s.tick?.hook || '', line: s.tick?.line || '',
  player: s.player?.id || '', marks: (s.mark || []).join(', '), tx: s.tx || [], run, tradeStyle: s.tradeStyle || '',
  // the card's pinned manager and its words, kept while the same player stays on the card
  player0: s.player?.id || '', pinRid: s.player?.pin?.team?.rid ?? s.player?.pin?.rid ?? null, pinLabel: s.player?.pin?.label || '',
});
const KIND = { trade: 'Trade', waiver: 'Waiver claim', free_agent: 'Free agent' };
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// the slide stays in view while the form scrolls: pinned under the header, or, when it's taller than the window, by
// its bottom edge (a callback ref, so it follows the slide's height as the words change)
let stick = null;
function pinPreview(el) {
  stick?.disconnect(); stick = null;
  if (!el) return;
  const place = () => { el.style.top = `${Math.min(96, innerHeight - el.offsetHeight - 16)}px`; };
  stick = new ResizeObserver(place); stick.observe(el);
  place();
}
const scrollTo = (sel) => requestAnimationFrame(() => document.querySelector(sel)?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' }));

// phones get their own arrangement of the same desk (Dan's request Nov 6): compact rows with their actions one tap away,
// the form first with the slide as a full-screen preview, and the less-used parts of the form folded to a summary line
const PHONE = '(max-width: 760px)';
const usePhone = () => useSyncExternalStore((f) => { const m = matchMedia(PHONE); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, () => matchMedia(PHONE).matches);
const Dots = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><circle cx="4.5" cy="10" r="2" fill="currentColor" /><circle cx="10" cy="10" r="2" fill="currentColor" /><circle cx="15.5" cy="10" r="2" fill="currentColor" /></svg>
);
const Chevron = () => (
  <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
// a part of the form: always open on a wide screen; on a phone it folds to its title and a line saying what's set
function Fold({ title, summary, phone, open, toggle, children }) {
  if (!phone) return <fieldset><legend>{title}</legend>{children}</fieldset>;
  return (
    <fieldset className={open ? 'open' : 'folded'}>
      <legend>
        <button type="button" className="adm-fold" aria-expanded={open} onClick={toggle}>
          <span>{title}</span>{open ? null : <small>{summary}</small>}<Chevron />
        </button>
      </legend>
      {open ? children : null}
    </fieldset>
  );
}

const Arrow = ({ up }) => (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d={up ? 'M3 8.5 7 4.5l4 4' : 'M3 5.5l4 4 4-4'} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Check = () => (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 7.4 5.8 10 11 4.2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// the gate on #admin: the admin password or key signs this device in as Dan for a year.
function SignIn() {
  const [pw, setPw] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    const v = pw.trim();
    if (!v) return;
    setBusy(true); setMsg('');
    try {
      await adminAuthCall({ password: v });
      await loadPosts();
    } catch (x) { setMsg(x.message); setPw(''); }
    setBusy(false);
  };
  return (
    <form className="adm-signin adm-panel" onSubmit={go}>
      <h2>Editor sign-in</h2>
      <p>The headline desk is password protected. Sign in once and this device stays signed in.</p>
      <label className="adm-field"><span>Password</span>
        <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </label>
      <button type="submit" className="adm-btn primary" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
      {msg ? <p className="adm-err" role="alert">{msg}</p> : null}
    </form>
  );
}

// one transaction as a card you tick: each side's team, what it got and gave up, and the value it gained
function Move({ f, D, h, on, toggle }) {
  const signed = (x) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${h.f1(Math.abs(x))}`;
  const player = (a, dir) => (
    <li key={`${dir}${a.id}`} className={dir}><span className="adm-sign" aria-hidden="true">{dir === 'in' ? '+' : '−'}</span><PosTag pos={a.pos} />{`${h.nameOf(a.id)} `}<small>{h.f1(a.v)}</small></li>
  );
  return (
    <li>
      <button type="button" className={`adm-move${on ? ' on' : ''}`} aria-pressed={on} onClick={toggle}>
        <span className="adm-move-head"><b>{KIND[f.type] || 'Move'}</b><small>{`${when(f.ts)}, week ${f.week}`}</small><span className="adm-tick" aria-hidden="true">{on ? <Check /> : null}</span></span>
        {f.sides.map((x) => {
          const t = D.byRid[x.rid];
          if (!t) return null;
          const picks = x.picks.filter((p) => p.dir === 'in');
          return (
            <span key={x.rid} className="adm-side">
              <span className="adm-side-head"><TeamAvatar t={t} /><b>{t.name}</b><em className={x.net > 0.4 ? 'up' : x.net < -0.4 ? 'down' : ''}>{signed(x.net)}</em></span>
              <ul>
                {x.adds.map((a) => player(a, 'in'))}
                {picks.map((p) => <li key={`p${p.season}${p.round}`} className="in"><span className="adm-sign" aria-hidden="true">+</span>{`${p.season} round ${p.round} pick`}</li>)}
                {f.type !== 'trade' ? x.drops.map((a) => player(a, 'out')) : null}
              </ul>
            </span>
          );
        })}
      </button>
    </li>
  );
}

// A row of filter chips that slides sideways when it doesn't fit: on a tinted tray, with the edges fading where more
// chips are hidden and a round arrow on each side that can still scroll (it pages by most of the visible width). The
// chips snap into place; keyboard users tab through them and each one scrolls itself into view.
function Scroller({ label, children }) {
  const track = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const look = () => setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    look();
    const ro = new ResizeObserver(look);
    ro.observe(el);
    el.addEventListener('scroll', look, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', look); };
  }, []);
  // the picked chip stays in view when the row is re-rendered (a week changes, the page opens on a later week)
  // (moves the row only, never the page)
  useEffect(() => {
    const el = track.current, on = el?.querySelector('[aria-pressed="true"]');
    if (on && on.offsetLeft + on.offsetWidth > el.clientWidth) el.scrollLeft = on.offsetLeft - 12;
  }, []);
  const page = (d) => { const el = track.current; el?.scrollBy({ left: d * el.clientWidth * 0.75, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  return (
    <div className={`adm-scroller${edge.l ? ' more-l' : ''}${edge.r ? ' more-r' : ''}`} role="group" aria-label={label}>
      <button type="button" className="adm-scroll-btn l" tabIndex={-1} aria-hidden="true" onClick={() => page(-1)}><Chevron /></button>
      <div className="adm-scroll-track" ref={track}>{children}</div>
      <button type="button" className="adm-scroll-btn r" tabIndex={-1} aria-hidden="true" onClick={() => page(1)}><Chevron /></button>
    </div>
  );
}

// Two-step filters (Dan's request Nov 6): what kind first; the second row (the time span) slides in once a kind is
// picked, and the list shows from then on. Each row is a labelled sliding tray.
function Step({ label, children, reveal }) {
  return (
    <div className={`adm-step${reveal ? ' late' : ''}`}>
      <span className="adm-step-label">{label}</span>
      <Scroller label={label}>{children}</Scroller>
    </div>
  );
}
const chips = (opts, value, pick) => opts.map(([k, l]) => <button key={k} type="button" className="adm-chip" aria-pressed={value === k} onClick={() => pick(k)}>{l}</button>);

// the week pills over the players and the matchups: the week being played (or ahead), then the scored ones
function WeekPills({ weeks, w, setW, ahead }) {
  const first = ahead ? weeks.ahead : weeks.live;
  const list = [...(first != null ? [[first, ahead ? `Week ${first}${weeks.live === first ? ', live' : ', ahead'}` : `Week ${first} so far`]] : []),
    ...weeks.scored.filter((x) => x !== first).map((x) => [x, `Week ${x}`])];
  return list.map(([k, l]) => <button key={k} type="button" className="adm-chip" aria-pressed={w === k} onClick={() => setW(k)}>{l}</button>);
}
const SHOWN = 40;
// a week's box score: every rostered player by points, tickable
function Players({ D, h, weeks, w, setW, kind, setKind, rows, picked, toggle }) {
  const list = kind ? rows.filter((r) => kind === 'all' || (kind === 'started') === r.started).slice(0, SHOWN) : [];
  return <>
    <Step label="Which players">{chips([['all', 'Everyone'], ['started', 'Started'], ['bench', 'Bench']], kind, setKind)}</Step>
    {kind ? <Step label="Which week" reveal><WeekPills weeks={weeks} w={w} setW={setW} /></Step> : null}
    {!kind ? <p className="adm-note">Pick which players to see.</p> : list.length ? <ul className="adm-players">{list.map((r) => {
      const t = D.byRid[r.rid], on = picked.includes(r.id);
      return (
        <li key={r.id}>
          <button type="button" className={`adm-player${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(r.id)}>
            <span className="adm-pts">{h.f1(r.pts)}</span>
            <span className="adm-pl-text"><b><PosTag pos={r.pos} />{h.nameOf(r.id)}</b><small><TeamAvatar t={t} />{`${t.name}${r.started ? '' : ', bench'}`}</small></span>
            <span className="adm-tick" aria-hidden="true">{on ? <Check /> : null}</span>
          </button>
        </li>
      );
    })}</ul> : <p className="adm-note">No points on the board for this week yet.</p>}
  </>;
}
// a week's games: scores once played, projections and win odds while ahead or live
function Games({ D, h, weeks, w, setW, games, picked, toggle }) {
  return <>
    <Step label="Which week"><WeekPills weeks={weeks} w={w} setW={setW} ahead /></Step>
    {games.length ? <ul className="adm-games">{games.map((g) => {
      const k = `${g.a}-${g.b}`, on = picked.includes(k), live = g.ahead && (g.ptsA || g.ptsB);
      const side = (rid, pts, proj, p) => {
        const t = D.byRid[rid], won = !g.ahead && pts > (rid === g.a ? g.ptsB : g.ptsA);
        return (
          <span className={`adm-gside${won ? ' won' : ''}`}>
            <TeamAvatar t={t} /><b>{h.first(t)}</b><small>{t.name}</small>
            <em>{g.ahead ? (live ? h.f1(pts) : pct0(p)) : h.f1(pts)}</em>
            {g.ahead ? <small className="adm-gsub">{`projects ${h.f1(proj)}`}</small> : null}
          </span>
        );
      };
      return (
        <li key={k}>
          <button type="button" className={`adm-game${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(k)}>
            <span className="adm-move-head"><b>{g.ahead ? (live ? 'Live' : 'Ahead') : 'Final'}</b><small>{g.ahead && g.stakes >= 0.05 ? `${Math.round(g.stakes * 100)} points of playoff odds on it` : `Week ${g.week}`}</small><span className="adm-tick" aria-hidden="true">{on ? <Check /> : null}</span></span>
            {side(g.a, g.ptsA, g.projA, g.winA)}
            {side(g.b, g.ptsB, g.projB, 1 - g.winA)}
            {g.ahead ? <span className="adm-odds" style={{ '--p': g.winA }} aria-label={`Win odds ${pct0(g.winA)} to ${pct0(1 - g.winA)}`}><i /></span> : null}
          </button>
        </li>
      );
    })}</ul> : <p className="adm-note">No games for this week.</p>}
  </>;
}
const pct0 = (x) => `${Math.round((x || 0) * 100)}%`;

// the post button's words; the narrowest phones drop the second word so the button never clips
const PostLabel = ({ editing }) => (editing ? <>Save<span className="adm-long"> changes</span></> : <>Post<span className="adm-long"> headline</span></>);

// a field's character count, shown once it gets close to the limit
const Count = ({ v, max }) => (v.length > max * 0.7 ? <small className={`adm-count${v.length >= max ? ' full' : ''}`}>{`${v.length} of ${max}`}</small> : null);

// the trade graphics to pick from: what each one is
const TRADE_LOOKS = [
  ['handoff', 'Handoff', 'A lane per team, arrows across'],
  ['seesaw', 'Seesaw', 'Trading cards that tip toward the winner'],
  ['receipt', 'Receipt', 'An itemized slip with a verdict stamp'],
  ['playbook', 'Playbook', 'Chalk routes send each player to a new team'],
  ['lockers', 'Locker room', 'Fresh jersey tags for every arrival'],
  ['none', 'None', 'The team rows, no graphic'],
];
const SOURCES = [['moves', 'Moves'], ['players', 'Players'], ['games', 'Matchups']];
const tog = (set, k) => set((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]));

export function AdminPage({ home, D, h, draft, draftPlayers, draftGames, weekPlayers, weekGames, weeks, preview, order, groups, groupOf, week, now, date, tradeStyles }) {
  const P = usePosts();
  const [source, setSource] = useState('moves');
  const [range, setRange] = useState('week'), [kind, setKind] = useState(null);
  const [picked, setPicked] = useState([]);
  // players: a week's box score; matchups: a week's games (the week ahead, or one already played)
  const [pw, setPw] = useState(weeks.live ?? weeks.scored[0] ?? null), [pkind, setPkind] = useState(null), [pPicked, setPPicked] = useState([]);
  const [gw, setGw] = useState(weeks.ahead ?? weeks.scored[0] ?? null), [gPicked, setGPicked] = useState([]);
  const [form, setForm] = useState(null), [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // the post just made, lit up in the running order
  const phone = usePhone();
  const [openRow, setOpenRow] = useState(null); // phones: the running order row showing its actions
  const [peek, setPeek] = useState(false); // phones: the slide preview over the form
  const [folds, setFolds] = useState([]); // phones: the parts of the form opened up
  const fold = (k) => setFolds((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]));
  const back = useRef(null);
  useEffect(() => {
    if (!peek) return undefined;
    document.documentElement.classList.add('adm-peeking');
    back.current?.focus();
    const esc = (e) => { if (e.key === 'Escape') setPeek(false); };
    addEventListener('keydown', esc);
    return () => { document.documentElement.classList.remove('adm-peeking'); removeEventListener('keydown', esc); };
  }, [peek]);
  const nav = useRef(null);
  const set = (patch) => setForm((x) => ({ ...x, ...patch }));
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const lastWeek = Math.max(1, ...D.feed.map((f) => f.week || 0));
  const feed = !kind ? [] : D.feed.filter((f) => (kind === 'all' || (kind === 'trade') === (f.type === 'trade'))
    && (range === 'all' || f.week >= (range === 'week' ? lastWeek : lastWeek - 1))).slice(0, 80);
  const chosen = D.feed.filter((f) => picked.includes(f.id));
  // the players the card can show: everyone who moved in the ticked transactions, biggest value first
  const people = useMemo(() => {
    const ids = new Map();
    const tx = (form?.tx?.length ? form.tx : picked).map(String);
    for (const f of D.feed.filter((x) => tx.includes(String(x.id)))) for (const s of f.sides) for (const a of s.adds) ids.set(a.id, s.rid);
    for (const id of pPicked) { const r = D.teams.find((t) => t.players.includes(id)); ids.set(id, r?.rid ?? null); }
    if (form?.player && !ids.has(form.player)) ids.set(form.player, form.pinRid ?? null);
    return [...ids].map(([id, rid]) => ({ id, rid, v: D.helpers.valueOf(id) })).sort((a, b) => b.v - a.v);
  }, [form?.tx, form?.player, form?.pinRid, picked, pPicked, D]);

  if (P.enabled === null) return <Head home={home} week={week} date={date} />;
  if (!P.enabled) return <><Head home={home} week={week} date={date} /><p className="adm-note">Posting needs the headline store, which isn't connected here. It works on the live site.</p></>;
  if (!P.admin) return <><Head home={home} week={week} date={date} /><SignIn /></>;

  // the form as a story: what gets posted, and what the preview draws
  const story = () => {
    const pl = form.player && people.find((x) => x.id === form.player), info = (pl && D.helpers.player(pl.id)) || {};
    const to = pl?.rid && D.byRid[pl.rid];
    const label = pl && pl.id === form.player0 && to?.rid === form.pinRid && form.pinLabel ? form.pinLabel : to && `To ${h.first(to)}`;
    const card = pl ? { id: pl.id, name: h.nameOf(pl.id), short: h.shortName(pl.id), line: `${info.pos || h.posOf(pl.id)}, ${h.nfl(info.team)}`, pin: to ? { rid: to.rid, label } : null } : null;
    return {
      kicker: form.kicker, stamp: form.stamp, tone: form.tone, group: form.group || null, breaking: form.breaking, tradeStyle: form.tradeStyle || null,
      headline: form.headline, deck: form.deck, tick: form.hook && form.line ? { hook: form.hook, line: form.line } : null,
      rids: form.rids, player: card, mark: form.marks.split(',').map((x) => x.trim()).filter(Boolean), tx: form.tx, week,
      until: form.run === 'keep' ? editing.until : untilFor(form.run, now),
    };
  };
  // a site headline being rewritten keeps what the form doesn't cover (its scoreboard, its clip)
  const shown = form && form.headline.trim() ? preview([{ ...story(), id: 'draft', until: null }]).map((st) => (editing?.site ? { ...editing.site, ...st, type: editing.site.type, trade: st.trade } : st)) : [];
  const siteEdit = !!editing?.site;

  const open = (f, p = null) => { setForm(f); setEditing(p); setErr(''); setOpenRow(null); setPeek(false); setFolds([]); scrollTo('.adm-work'); };
  const call = async (body, done) => {
    setBusy(true); setErr('');
    let r = null;
    try { r = await postCall(body); if (done) setToast(done); } catch (x) { setErr(x.message); setToast(null); }
    setBusy(false);
    return r;
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!form.headline.trim()) { setErr('Write a headline first.'); return; }
    const body = siteEdit ? { action: 'site-edit', key: editing.site.key, story: story() }
      : editing ? { action: 'edit', id: editing.id, story: story() } : { action: 'post', story: story() };
    const r = await call(body, editing ? 'Saved' : 'Posted. It leads the carousel now.');
    if (!r) return;
    setFresh(siteEdit ? editing.site.key : editing ? editing.id : r.id);
    setForm(null); setEditing(null); setPicked([]); setPPicked([]); setGPicked([]); setPeek(false);
    scrollTo('.adm-order-sec');
  };
  // Dan's running order (Nov 6): any headline, his or the site's, moves one place past the next one showing, whatever
  // section either is in; the whole order is saved for the week (api/headlines.js `arrange`)
  const lineup = order();
  const idOf = (st) => (st.type.startsWith('p-') ? st.type.slice(2) : st.key);
  const custom = !!P.arrange?.[`w${week}`];
  const nextShown = (i, d) => { let j = i + d; while (j >= 0 && j < lineup.length && lineup[j].hidden) j += d; return j >= 0 && j < lineup.length ? j : -1; };
  const shift = (i, d) => {
    const j = nextShown(i, d);
    if (j < 0) return;
    const keys = lineup.map((st) => st.key);
    [keys[i], keys[j]] = [keys[j], keys[i]];
    setFresh(idOf(lineup[i]));
    call({ action: 'arrange', week: `w${week}`, keys });
  };
  // how long it runs: in the send bar on wide screens, its own fold on phones
  const runs = form && (
    siteEdit ? <p className="adm-hint">{`Your words replace the site's on this headline for week ${week}. Undo edit puts the site's back.`}</p> : <div className="adm-field" role="group" aria-labelledby="adm-run"><span id="adm-run">{form.run === 'week' ? `Runs until ${when(weekTurns(now))}` : 'How long it runs'}</span>
                  <div className="adm-pills">
                    {editing?.until ? <button type="button" className="adm-pill" aria-pressed={form.run === 'keep'} onClick={() => set({ run: 'keep' })}>{`As is, until ${when(editing.until)}`}</button> : null}
                    {RUNS.map(([k, l]) => <button key={k} type="button" className="adm-pill" aria-pressed={form.run === k} onClick={() => set({ run: k })}>{l}</button>)}
                  </div>
                </div>
  );
  const slide = shown.length
    ? <div className="hero adm-hero"><Carousel D={D} h={h} stories={shown} date={date} hold={null} night={false} groups={groups} nav={nav} /></div>
    : <div className="adm-blank"><p>Start typing a headline and the slide shows up here.</p></div>;
  const toggleRid = (rid) => set({ rids: form.rids.includes(rid) ? form.rids.filter((r) => r !== rid) : [...form.rids, rid] });
  const teams = [...D.teams].sort((a, b) => h.first(a).localeCompare(h.first(b)));

  return (
    <>
      <Head live={P.list.length} home={home} week={week} date={date} />
      <Index lineup={lineup} groups={groups} />

      <section className="adm-panel adm-order-sec" aria-labelledby="adm-order-t">
        <Sec id="A" title="Running order" t="adm-order-t" note={custom ? 'In your order. Use the arrows to move any headline.' : 'Sections together. Use the arrows to move any headline on its own.'}>
          {custom ? <button type="button" className="adm-btn adm-auto" onClick={() => call({ action: 'arrange-reset', week: `w${week}` }, 'Back to the automatic order')} disabled={busy}>Automatic order</button> : null}
        </Sec>
        <ol className="adm-order">
          {!P.list.length ? <li className="adm-slot adm-none"><p className="adm-slot-card">Nothing of yours is up. The site's own headlines are running.</p></li> : null}
          {(() => {
            let n = 0;
            return lineup.map((st, i, all) => {
              const own = st.type.startsWith('p-'), p = own && P.list.find((x) => `p-${x.id}` === st.type);
              const id = idOf(st);
              const head = st.group !== all[i - 1]?.group ? <li key={`g-${i}-${st.group}`} className={`adm-group g-${st.group}`} aria-hidden="true"><span>{groups[st.group]}</span></li> : null;
              const num = st.hidden ? null : ++n;
              const updown = st.hidden ? null : (
                <span className="adm-updown">
                  <button type="button" className="adm-icon" onClick={() => shift(i, -1)} disabled={busy || nextShown(i, -1) < 0} aria-label={`Move "${st.headline}" up`}><Arrow up /></button>
                  <button type="button" className="adm-icon" onClick={() => shift(i, 1)} disabled={busy || nextShown(i, 1) < 0} aria-label={`Move "${st.headline}" down`}><Arrow /></button>
                </span>
              );
              return [head, (
                <li key={st.key} className={`adm-slot${own ? '' : ' site'}${num === 1 ? ' lead' : ''}${st.hidden ? ' hidden' : ''}${fresh === id ? ' fresh' : ''}${(editing?.id ?? editing?.site?.key) === id ? ' editing' : ''}`}>
                  <span className="adm-num" aria-hidden="true">{num ?? ''}</span>
                  <div className="adm-slot-card">
                    {phone ? <button type="button" className="adm-more" aria-expanded={openRow === id} aria-label={`Actions for "${st.headline}"`} onClick={() => setOpenRow(openRow === id ? null : id)}><Dots /></button> : null}
                    <div className="adm-slot-text">
                      <span className="adm-slot-meta">
                        <span className={`adm-kick t-${st.tone || 'neutral'}`}>{st.kicker}</span>
                        {st.breaking ? <span className="adm-brk">Breaking</span> : null}
                        {(editing?.id ?? editing?.site?.key) === id ? <span className="adm-brk editing">Editing</span> : null}
                      </span>
                      <b>{st.headline}</b>
                      <small className="adm-byline">{p ? `Posted ${ago(p.ts, now)}, ${p.until ? `runs until ${when(p.until)}` : 'runs until you take it down'}.` : st.hidden ? 'By the site. Hidden from the carousel.' : st.edited ? 'By the site, rewritten at the desk.' : 'By the site.'}</small>
                    </div>
                    {phone && openRow !== id ? null : <div className="adm-slot-acts">
                      {updown}
                      {p ? <>
                        <button type="button" className="adm-btn" onClick={() => open(formOf(p, p.until ? 'keep' : 'forever'), p)} disabled={busy}>Edit</button>
                        <button type="button" className="adm-btn adm-down" onClick={() => call({ action: 'remove', id: p.id }, 'Taken down')} disabled={busy}>Take down</button>
                      </> : st.hidden ? (
                        <button type="button" className="adm-btn" onClick={() => call({ action: 'site-reset', key: st.key }, 'Back on the carousel')} disabled={busy}>Show again</button>
                      ) : <>
                        <button type="button" className="adm-btn" onClick={() => open(formOf(st), { site: st })} disabled={busy}>Edit</button>
                        {st.edited ? <button type="button" className="adm-btn" onClick={() => call({ action: 'site-reset', key: st.key }, 'Back to the site\'s words')} disabled={busy}>Undo edit</button> : null}
                        <button type="button" className="adm-btn adm-down" onClick={() => call({ action: 'site-hide', key: st.key }, 'Hidden')} disabled={busy}>Hide</button>
                      </>}
                    </div>}
                  </div>
                </li>
              )];
            });
          })()}
        </ol>
        {P.old.length ? (
          <details className="adm-old">
            <summary>{`Taken down or run out (${P.old.length})`}</summary>
            <ul>{P.old.map((p) => (
              <li key={p.id}>
                <span><b>{p.headline}</b><small>{p.down ? `Taken down ${ago(p.down, now)}` : `Ran out ${ago(p.until, now)}`}</small></span>
                <button type="button" className="adm-btn" onClick={() => call({ action: 'restore', id: p.id }, 'Back up')} disabled={busy}>Put back up</button>
              </li>
            ))}</ul>
          </details>
        ) : null}
      </section>

      <section className="adm-panel adm-work" aria-labelledby="adm-work-t">
        {!form ? <>
          <Sec id="B" title="Write about" t="adm-work-t" note="Tick one or more, then draft a headline." />
          <div className="adm-sources" role="group" aria-label="What to write about">
            {SOURCES.map(([k, l]) => <button key={k} type="button" aria-pressed={source === k} onClick={() => setSource(k)}>{l}</button>)}
          </div>
          {source === 'moves' ? <>
          <Step label="Which moves">{chips([['all', 'Everything'], ['trade', 'Trades'], ['wire', 'Wire']], kind, setKind)}</Step>
          {kind ? <Step label="From when" reveal>{chips([['week', `Week ${lastWeek}`], ['two', 'Last two weeks'], ['all', 'All season']], range, setRange)}</Step> : null}
          {!kind ? <p className="adm-note">Pick which moves to see.</p> : feed.length
            ? <ul className="adm-moves">{feed.map((f) => <Move key={f.id} f={f} D={D} h={h} on={picked.includes(f.id)} toggle={() => setPicked((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} />)}</ul>
            : <p className="adm-note">No moves in this stretch. Try a longer one.</p>}
          </> : source === 'players' ? <Players D={D} h={h} weeks={weeks} w={pw} setW={(w) => { setPw(w); setPPicked([]); }} kind={pkind} setKind={setPkind} rows={pw ? weekPlayers(pw) : []} picked={pPicked} toggle={(id) => tog(setPPicked, id)} />
            : <Games D={D} h={h} weeks={weeks} w={gw} setW={(w) => { setGw(w); setGPicked([]); }} games={gw ? weekGames(gw) : []} picked={gPicked} toggle={(k) => tog(setGPicked, k)} />}
          {(() => {
            const n = { moves: picked.length, players: pPicked.length, games: gPicked.length }[source];
            const word = { moves: ['move', 'moves'], players: ['player', 'players'], games: ['matchup', 'matchups'] }[source][n === 1 ? 0 : 1];
            const clear = { moves: setPicked, players: setPPicked, games: setGPicked }[source];
            const make = () => (source === 'moves' ? draft(chosen)
              : source === 'players' ? draftPlayers(pPicked.map((id) => ({ id, week: pw })))
              : draftGames(gPicked.map((k) => { const [a, b] = k.split('-').map(Number); return { week: gw, a, b }; })));
            return (
              <div className="adm-dock">
                <span className="adm-dock-say">{n ? `${n} ${word} picked` : 'Nothing picked yet'}</span>
                {n ? <button type="button" className="adm-btn" onClick={() => clear([])}>Clear</button> : null}
                <button type="button" className="adm-btn" onClick={() => open({ ...EMPTY })}>Write from scratch</button>
                <button type="button" className="adm-btn primary" disabled={!n} onClick={() => { const d = make(); if (d) open(formOf(d)); }}>Draft a headline</button>
              </div>
            );
          })()}
        </> : <>
          <Sec id="B" title={siteEdit ? "Edit the site's headline" : editing ? 'Edit the headline' : 'Write the headline'} t="adm-work-t" note="The slide is exactly what goes up." />
          <div className="adm-compose">
            {phone ? null : (
              <div className="adm-preview" ref={pinPreview}>
                {slide}
              </div>
            )}
            {phone && peek ? createPortal(
              // phones: the slide over everything, on the end zone's green, with the way back and the post button at the
              // bottom (portaled to body, so nothing on the page can trap its fixed position)
              <div className="adm-sheet" role="dialog" aria-modal="true" aria-label="Preview of the slide">
                {slide}
                <div className="adm-sheet-bar">
                  <button type="button" ref={back} className="adm-btn" onClick={() => setPeek(false)}>Back to editing</button>
                  <button type="submit" form="adm-form" className="adm-btn primary adm-post" disabled={busy}>{busy ? (editing ? 'Saving…' : 'Posting…') : <PostLabel editing={editing} />}</button>
                </div>
              </div>, document.body) : null}
            <form id="adm-form" className="adm-form" onSubmit={submit}>
              <fieldset>
                <legend>Words</legend>
                <label className="adm-field adm-hed"><span>Headline<Count v={form.headline} max={220} /></span>
                  <textarea rows="3" value={form.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={220} required placeholder="Mo and Khalil shake on it" />
                </label>
                <label className="adm-field"><span>The paragraph under it<Count v={form.deck} max={1200} /></span>
                  <textarea rows="6" value={form.deck} onChange={(e) => set({ deck: e.target.value })} maxLength={1200} />
                </label>
                <label className="adm-field"><span>Names in yellow, with commas between</span><input value={form.marks} onChange={(e) => set({ marks: e.target.value })} placeholder="Jonathan Taylor" /></label>
              </fieldset>

              {(() => {
                // the trade graphic under the headline, when it's about a trade (src/hero/TradeGraphic.jsx)
                const deal = (form.tx || []).map((id) => D.feed.find((f) => String(f.id) === String(id) && f.type === 'trade')).find(Boolean);
                if (!deal) return null;
                const pick = form.tradeStyle || 'handoff', two = deal.sides.length === 2;
                return (
                  <Fold title="Trade graphic" phone={phone} open={folds.includes('trade')} toggle={() => fold('trade')}
                    summary={TRADE_LOOKS.find(([k]) => k === pick)?.[1] || 'Handoff'}>
                    <p className="adm-hint">Who got which players, drawn under the headline in place of the team rows. The slide shows the one picked.</p>
                    <div className="adm-looks" role="group" aria-label="Trade graphic">
                      {TRADE_LOOKS.filter(([k]) => k === 'none' || tradeStyles.includes(k)).map(([k, l, d]) => (
                        <button key={k} type="button" className="adm-look" aria-pressed={pick === k} disabled={k === 'seesaw' && !two} onClick={() => set({ tradeStyle: k })}>
                          <b>{l}</b><small>{k === 'seesaw' && !two ? 'Two-team deals only' : d}</small>
                        </button>
                      ))}
                    </div>
                  </Fold>
                );
              })()}

              <Fold title="Look" phone={phone} open={folds.includes('look')} toggle={() => fold('look')}
                summary={[form.kicker, form.stamp && `stamped ${form.stamp}`, TONES.find(([k]) => k === form.tone)?.[1], form.group ? groups[form.group] : 'automatic section', form.breaking && 'breaking'].filter(Boolean).join(', ')}>
                <div className="adm-pair">
                  <label className="adm-field"><span>Label beside the date</span><input value={form.kicker} onChange={(e) => set({ kicker: e.target.value })} maxLength={40} /></label>
                  <label className="adm-field"><span>Stamp on the photo</span><input value={form.stamp} onChange={(e) => set({ stamp: e.target.value })} maxLength={24} placeholder="Done deal" /></label>
                </div>
                <div className="adm-field" role="group" aria-labelledby="adm-tone"><span id="adm-tone">Colour</span>
                  <div className="adm-pills">{TONES.map(([k, l]) => <button key={k} type="button" className={`adm-pill t-${k}`} aria-pressed={form.tone === k} onClick={() => set({ tone: k })}><i aria-hidden="true" />{l}</button>)}</div>
                </div>
                <div className="adm-field" role="group" aria-labelledby="adm-group"><span id="adm-group">Section in the dots</span>
                  <div className="adm-pills">
                    <button type="button" className="adm-pill" aria-pressed={!form.group} onClick={() => set({ group: '' })}>{`Automatic${form.group ? '' : `: ${groups[groupOf({ type: editing?.site?.type || '', kicker: form.kicker })]}`}`}</button>
                    {Object.entries(groups).map(([k, l]) => <button key={k} type="button" className={`adm-pill g-${k}`} aria-pressed={form.group === k} onClick={() => set({ group: k })}><i aria-hidden="true" />{l}</button>)}
                  </div>
                </div>
                <button type="button" className="adm-pill adm-breaking" aria-pressed={form.breaking} onClick={() => set({ breaking: !form.breaking })}><i aria-hidden="true" />Breaking news</button>
              </Fold>

              <Fold title="Who's pictured" phone={phone} open={folds.includes('who')} toggle={() => fold('who')}
                summary={[form.player ? `${h.nameOf(form.player)} on the card` : 'No player card', form.rids.length ? form.rids.map((r) => D.byRid[r] && h.first(D.byRid[r])).filter(Boolean).join(', ') : 'no managers'].join(', ')}>
                <label className="adm-field"><span>Player card</span><select value={form.player} onChange={(e) => set({ player: e.target.value })}>
                  <option value="">No card, show the managers</option>
                  {people.map((x) => <option key={x.id} value={x.id}>{`${h.nameOf(x.id)}, value ${h.f1(x.v)}`}</option>)}
                </select></label>
                <div className="adm-field" role="group" aria-labelledby="adm-who"><span id="adm-who">Managers in the story. The first two get photos.</span>
                  <div className="adm-pills adm-mgrs">{teams.map((t) => {
                    const at = form.rids.indexOf(t.rid);
                    return <button key={t.rid} type="button" className="adm-pill" aria-pressed={at >= 0} onClick={() => toggleRid(t.rid)}>{at >= 0 ? <b aria-hidden="true">{at + 1}</b> : null}{h.first(t)}</button>;
                  })}</div>
                </div>
              </Fold>

              <Fold title="Ticker" phone={phone} open={folds.includes('ticker')} toggle={() => fold('ticker')}
                summary={form.hook && form.line ? `${form.hook}: ${form.line}` : 'From the stamp and the headline'}>
                <p className="adm-hint">The strip that runs across the top once the carousel scrolls away. Left empty, it uses the stamp and the headline's first sentence.</p>
                <div className="adm-pair adm-tick-pair">
                  <label className="adm-field"><span>Hook</span><input value={form.hook} onChange={(e) => set({ hook: e.target.value })} maxLength={24} placeholder="Done deal" /></label>
                  <label className="adm-field"><span>Line<Count v={form.line} max={160} /></span><input value={form.line} onChange={(e) => set({ line: e.target.value })} maxLength={160} /></label>
                </div>
              </Fold>

              {phone ? (
                siteEdit ? <p className="adm-hint adm-site-note">{`Your words replace the site's on this headline for week ${week}. Undo edit puts the site's back.`}</p>
                  : <Fold title="When it runs" phone open={folds.includes('run')} toggle={() => fold('run')}
                    summary={form.run === 'keep' ? `As is, until ${when(editing.until)}` : form.run === 'forever' ? 'Until you take it down' : `Until ${when(untilFor(form.run, now))}`}>{runs}</Fold>
              ) : null}

              <div className="adm-send">
                {phone ? null : runs}
                {err ? <p className="adm-err" role="alert">{err}</p> : null}
                <div className="adm-send-row">
                  <button type="button" className="adm-btn" onClick={() => { setForm(null); setEditing(null); setErr(''); }} disabled={busy}>{editing ? 'Cancel' : 'Discard'}</button>
                  {phone ? <button type="button" className="adm-btn adm-peek" onClick={() => setPeek(true)} disabled={!shown.length}>Preview</button> : null}
                  <button type="submit" className="adm-btn primary adm-post" disabled={busy}>{busy ? (editing ? 'Saving…' : 'Posting…') : <PostLabel editing={editing} />}</button>
                </div>
              </div>
            </form>
          </div>
        </>}
      </section>
      <p className="adm-toast" role="status" aria-live="polite" hidden={!toast}>{toast}</p>
    </>
  );
}

// The top of the desk, set like a newspaper front (Nov 6): the way home above the masthead, then the nameplate in
// blackletter between its two ears (what this copy is, and how many of Dan's headlines run), then the folio line
function Head({ live, home, week, date }) {
  return <>
    <nav className="adm-top" aria-label="Site">
      <a className="adm-home" href={home}><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M7.5 2 3.5 6l4 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>Home</a>
    </nav>
    <header className="np-mast">
      <p className="np-ear l"><b>{"The editor's copy"}</b><span>Only editors see this page</span></p>
      <div className="np-title">
        <h1 className="np-name" aria-label="The Power Hour headline desk">The Power Hour</h1>
        <p className="np-sub" aria-hidden="true">Headline desk</p>
      </div>
      <p className="np-ear r">{live == null ? <><b>Editor only</b><span>Sign in to post</span></> : <><b className="np-tally">{live}</b><span>{`desk ${live === 1 ? 'headline runs' : 'headlines run'} today`}</span></>}</p>
    </header>
    <p className="np-folio">
      {week ? <span>{`Week ${week}`}</span> : null}
      {date ? <span>{date}</span> : null}
      <span>NFL Fantasy Championship</span>
      {live != null ? <button type="button" className="np-jump" onClick={() => scrollTo('.adm-work')}>Write a headline</button> : null}
    </p>
  </>;
}

// a section of the paper: its letter, its name, a line on what's in it, and any controls on the right
function Sec({ id, title, t, note, children }) {
  return (
    <header className="np-sec">
      <span className="np-sec-id" aria-hidden="true">{id}</span>
      <div className="np-sec-text"><h2 id={t}>{title}</h2>{note ? <p>{note}</p> : null}</div>
      {children ? <div className="np-sec-acts">{children}</div> : null}
    </header>
  );
}

// the index box: what's in today's carousel by section, and what's hidden or rewritten
function Index({ lineup, groups }) {
  const shown = lineup.filter((st) => !st.hidden);
  const by = Object.keys(groups).map((g) => [groups[g], shown.filter((st) => st.group === g).length]).filter(([, n]) => n);
  const hidden = lineup.length - shown.length, edited = lineup.filter((st) => st.edited && !st.hidden).length;
  return (
    <aside className="np-index" aria-label="In this edition">
      <h2>Inside</h2>
      <ul>
        {by.map(([l, n]) => <li key={l}><span>{l}</span><b>{n}</b></li>)}
        {edited ? <li><span>Rewritten</span><b>{edited}</b></li> : null}
        {hidden ? <li><span>Hidden</span><b>{hidden}</b></li> : null}
      </ul>
    </aside>
  );
}
