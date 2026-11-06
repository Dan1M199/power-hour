// The admin portal (#admin), Dan's own headline desk: tick the transactions to write about, start from a draft worked
// out of the numbers (draftFor in app.js), rewrite it with the real carousel slide as the preview, and post it. Posted
// headlines lead the carousel on the rankings and Live pages (carouselProps in app.js) until they run out or he takes
// them down. Signing in is the league desk's: his #join= link or TALK_ADMIN_KEY, through api/talk.js. Everyone else
// who opens #admin only gets the sign-in box, and api/headlines.js refuses any write that isn't his.
//
// The page is one desk, top to bottom: the running order (what the carousel shows, in order: his headlines, numbered
// like yard numbers, then the site's own, greyed), then the work. The work is either the moves to pick from, or, once a
// draft is open, the writing: the real slide on the left (sticky), the form on the right, the post button docked at
// the bottom of the form.
import { useEffect, useMemo, useRef, useState } from 'react';
import { TZ } from '../../lib/newsclock.js';
import { Carousel } from '../hero/Carousel.jsx';
import { talkCall, loadTalk } from '../hero/talk.js';
import { PosTag, TeamAvatar } from '../shared.jsx';
import { usePosts, loadPosts, postCall } from './posts.js';

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

const EMPTY = { kicker: 'From the desk', stamp: '', tone: 'neutral', group: '', breaking: false, headline: '', deck: '', hook: '', line: '', rids: [], player: '', marks: '', tx: [], run: 'week' };
// the portal's form from a story (a draft or a post), and back
const formOf = (s, run = 'week') => ({
  ...EMPTY, ...s, stamp: s.stamp || '', group: s.group || '', hook: s.tick?.hook || '', line: s.tick?.line || '',
  player: s.player?.id || '', marks: (s.mark || []).join(', '), tx: s.tx || [], run,
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

const Arrow = ({ up }) => (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d={up ? 'M3 8.5 7 4.5l4 4' : 'M3 5.5l4 4 4-4'} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Check = () => (
  <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 7.4 5.8 10 11 4.2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function SignIn() {
  const [key, setKey] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await talkCall({ action: 'claim', token: key.trim() });
      if (!r.admin) setMsg('That key signs in a manager, not the editor. Use the admin key.');
      await Promise.all([loadPosts(), loadTalk()]);
    } catch (x) { setMsg(x.message); }
    setBusy(false); setKey('');
  };
  return (
    <form className="adm-signin glass" onSubmit={go}>
      <h2>Sign in to post</h2>
      <p>Open your league desk link on this device, or paste the admin key.</p>
      <label className="adm-field"><span>Admin key</span>
        <input type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <button type="submit" className="talk-btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
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

// the week pills over the players and the matchups: the week being played (or ahead), then the scored ones
function WeekPills({ weeks, w, setW, ahead }) {
  const first = ahead ? weeks.ahead : weeks.live;
  const list = [...(first != null ? [[first, ahead ? `Week ${first}${weeks.live === first ? ', live' : ', ahead'}` : `Week ${first} so far`]] : []),
    ...weeks.scored.filter((x) => x !== first).map((x) => [x, `Week ${x}`])];
  return list.map(([k, l]) => <button key={k} type="button" aria-pressed={w === k} onClick={() => setW(k)}>{l}</button>);
}
const SHOWN = 40;
// a week's box score: every rostered player by points, tickable
function Players({ D, h, weeks, w, setW, kind, setKind, rows, picked, toggle }) {
  const list = rows.filter((r) => kind === 'all' || (kind === 'started') === r.started).slice(0, SHOWN);
  return <>
    <div className="filters adm-filters" role="group" aria-label="Which players">
      <WeekPills weeks={weeks} w={w} setW={setW} />
      <span className="adm-gap" />
      {[['all', 'Everyone'], ['started', 'Started'], ['bench', 'Bench']].map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
    </div>
    {list.length ? <ul className="adm-players">{list.map((r) => {
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
    })}</ul> : <p className="adm-note glass">No points on the board for this week yet.</p>}
  </>;
}
// a week's games: scores once played, projections and win odds while ahead or live
function Games({ D, h, weeks, w, setW, games, picked, toggle }) {
  return <>
    <div className="filters adm-filters" role="group" aria-label="Which week"><WeekPills weeks={weeks} w={w} setW={setW} ahead /></div>
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
    })}</ul> : <p className="adm-note glass">No games for this week.</p>}
  </>;
}
const pct0 = (x) => `${Math.round((x || 0) * 100)}%`;

// a field's character count, shown once it gets close to the limit
const Count = ({ v, max }) => (v.length > max * 0.7 ? <small className={`adm-count${v.length >= max ? ' full' : ''}`}>{`${v.length} of ${max}`}</small> : null);

const SOURCES = [['moves', 'Moves'], ['players', 'Players'], ['games', 'Matchups']];
const tog = (set, k) => set((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]));

export function AdminPage({ D, h, draft, draftPlayers, draftGames, weekPlayers, weekGames, weeks, preview, order, groups, groupOf, week, now, date }) {
  const P = usePosts();
  const [source, setSource] = useState('moves');
  const [range, setRange] = useState('week'), [kind, setKind] = useState('all');
  const [picked, setPicked] = useState([]);
  // players: a week's box score; matchups: a week's games (the week ahead, or one already played)
  const [pw, setPw] = useState(weeks.live ?? weeks.scored[0] ?? null), [pkind, setPkind] = useState('all'), [pPicked, setPPicked] = useState([]);
  const [gw, setGw] = useState(weeks.ahead ?? weeks.scored[0] ?? null), [gPicked, setGPicked] = useState([]);
  const [form, setForm] = useState(null), [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // the post just made, lit up in the running order
  const nav = useRef(null);
  const set = (patch) => setForm((x) => ({ ...x, ...patch }));
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);

  const lastWeek = Math.max(1, ...D.feed.map((f) => f.week || 0));
  const feed = D.feed.filter((f) => (kind === 'all' || (kind === 'trade') === (f.type === 'trade'))
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

  if (P.enabled === null) return <Head />;
  if (!P.enabled) return <><Head /><p className="adm-note glass">Posting needs the headline store, which isn't connected here. It works on the live site.</p></>;
  if (!P.admin) return <><Head /><SignIn /></>;

  // the form as a story: what gets posted, and what the preview draws
  const story = () => {
    const pl = form.player && people.find((x) => x.id === form.player), info = (pl && D.helpers.player(pl.id)) || {};
    const to = pl?.rid && D.byRid[pl.rid];
    const label = pl && pl.id === form.player0 && to?.rid === form.pinRid && form.pinLabel ? form.pinLabel : to && `To ${h.first(to)}`;
    const card = pl ? { id: pl.id, name: h.nameOf(pl.id), short: h.shortName(pl.id), line: `${info.pos || h.posOf(pl.id)}, ${h.nfl(info.team)}`, pin: to ? { rid: to.rid, label } : null } : null;
    return {
      kicker: form.kicker, stamp: form.stamp, tone: form.tone, group: form.group || null, breaking: form.breaking,
      headline: form.headline, deck: form.deck, tick: form.hook && form.line ? { hook: form.hook, line: form.line } : null,
      rids: form.rids, player: card, mark: form.marks.split(',').map((x) => x.trim()).filter(Boolean), tx: form.tx, week,
      until: form.run === 'keep' ? editing.until : untilFor(form.run, now),
    };
  };
  // a site headline being rewritten keeps what the form doesn't cover (its scoreboard, its clip)
  const shown = form && form.headline.trim() ? preview([{ ...story(), id: 'draft', until: null }]).map((st) => (editing?.site ? { ...editing.site, ...st, type: editing.site.type } : st)) : [];
  const siteEdit = !!editing?.site;

  const open = (f, p = null) => { setForm(f); setEditing(p); setErr(''); scrollTo('.adm-work'); };
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
    setForm(null); setEditing(null); setPicked([]); setPPicked([]); setGPicked([]);
    scrollTo('.adm-order-sec');
  };
  const move = (i, d) => {
    const ids = P.list.map((p) => p.id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setFresh(ids[j]);
    call({ action: 'order', ids });
  };
  const toggleRid = (rid) => set({ rids: form.rids.includes(rid) ? form.rids.filter((r) => r !== rid) : [...form.rids, rid] });
  const teams = [...D.teams].sort((a, b) => h.first(a).localeCompare(h.first(b)));

  return (
    <>
      <Head live={P.list.length} />

      <section className="adm-order-sec" aria-labelledby="adm-order-t">
        <h2 className="sec-title" id="adm-order-t">Running order<small>What the carousel shows, first to last</small></h2>
        <ol className="adm-order">
          {!P.list.length ? <li className="adm-slot adm-none"><p className="adm-slot-card">Nothing of yours is up. The site's own headlines are running.</p></li> : null}
          {(() => {
            let n = 0;
            return order().map((st, i, all) => {
              const own = st.type.startsWith('p-'), p = own && P.list.find((x) => `p-${x.id}` === st.type);
              const at = p ? P.list.indexOf(p) : -1, id = own ? p?.id : st.key;
              const head = st.group !== all[i - 1]?.group ? <li key={`g-${st.group}`} className={`adm-group g-${st.group}`} aria-hidden="true"><span>{groups[st.group]}</span></li> : null;
              const num = st.hidden ? null : ++n;
              return [head, (
                <li key={own ? st.type : st.key} className={`adm-slot${own ? '' : ' site'}${st.hidden ? ' hidden' : ''}${fresh === id ? ' fresh' : ''}${(editing?.id ?? editing?.site?.key) === id ? ' editing' : ''}`}>
                  <span className="adm-num" aria-hidden="true">{num ?? ''}</span>
                  <div className={`adm-slot-card${own ? ' glass' : ''}`}>
                    <div className="adm-slot-text">
                      <span className="adm-slot-meta">
                        <span className={`adm-kick t-${st.tone || 'neutral'}`}>{st.kicker}</span>
                        {st.breaking ? <span className="adm-brk">Breaking</span> : null}
                        {(editing?.id ?? editing?.site?.key) === id ? <span className="adm-brk editing">Editing</span> : null}
                        {own ? null : <span className="adm-by">{st.hidden ? 'Hidden from the carousel' : st.edited ? 'Written by the site, edited by you' : 'Written by the site'}</span>}
                      </span>
                      <b>{st.headline}</b>
                      {p ? <small>{`${p.until ? `Runs until ${when(p.until)}` : 'Runs until you take it down'}. Posted ${ago(p.ts, now)}.`}</small> : null}
                    </div>
                    <div className="adm-slot-acts">
                      {p ? <>
                        <span className="adm-updown">
                          <button type="button" className="adm-icon" onClick={() => move(at, -1)} disabled={busy || at === 0} aria-label={`Move "${p.headline}" up`}><Arrow up /></button>
                          <button type="button" className="adm-icon" onClick={() => move(at, 1)} disabled={busy || at === P.list.length - 1} aria-label={`Move "${p.headline}" down`}><Arrow /></button>
                        </span>
                        <button type="button" className="talk-btn" onClick={() => open(formOf(p, p.until ? 'keep' : 'forever'), p)} disabled={busy}>Edit</button>
                        <button type="button" className="talk-btn adm-down" onClick={() => call({ action: 'remove', id: p.id }, 'Taken down')} disabled={busy}>Take down</button>
                      </> : st.hidden ? (
                        <button type="button" className="talk-btn" onClick={() => call({ action: 'site-reset', key: st.key }, 'Back on the carousel')} disabled={busy}>Show again</button>
                      ) : <>
                        <button type="button" className="talk-btn" onClick={() => open(formOf(st), { site: st })} disabled={busy}>Edit</button>
                        {st.edited ? <button type="button" className="talk-btn" onClick={() => call({ action: 'site-reset', key: st.key }, 'Back to the site\'s words')} disabled={busy}>Undo edit</button> : null}
                        <button type="button" className="talk-btn adm-down" onClick={() => call({ action: 'site-hide', key: st.key }, 'Hidden')} disabled={busy}>Hide</button>
                      </>}
                    </div>
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
                <button type="button" className="talk-btn" onClick={() => call({ action: 'restore', id: p.id }, 'Back up')} disabled={busy}>Put back up</button>
              </li>
            ))}</ul>
          </details>
        ) : null}
      </section>

      <section className="adm-work" aria-labelledby="adm-work-t">
        {!form ? <>
          <h2 className="sec-title" id="adm-work-t">Write about<small>Tick one or more, then draft a headline</small></h2>
          <div className="adm-sources" role="group" aria-label="What to write about">
            {SOURCES.map(([k, l]) => <button key={k} type="button" aria-pressed={source === k} onClick={() => setSource(k)}>{l}</button>)}
          </div>
          {source === 'moves' ? <>
          <div className="filters adm-filters" role="group" aria-label="Which moves">
            {[['week', `Week ${lastWeek}`], ['two', 'Last two weeks'], ['all', 'All season']].map(([k, l]) => <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}
            <span className="adm-gap" />
            {[['all', 'Everything'], ['trade', 'Trades'], ['wire', 'Wire']].map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          {feed.length
            ? <ul className="adm-moves">{feed.map((f) => <Move key={f.id} f={f} D={D} h={h} on={picked.includes(f.id)} toggle={() => setPicked((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} />)}</ul>
            : <p className="adm-note glass">No moves in this stretch. Try a longer one.</p>}
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
              <div className="adm-dock glass">
                <span className="adm-dock-say">{n ? `${n} ${word} picked` : 'Nothing picked yet'}</span>
                {n ? <button type="button" className="talk-btn" onClick={() => clear([])}>Clear</button> : null}
                <button type="button" className="talk-btn" onClick={() => open({ ...EMPTY })}>Write from scratch</button>
                <button type="button" className="talk-btn primary" disabled={!n} onClick={() => { const d = make(); if (d) open(formOf(d)); }}>Draft a headline</button>
              </div>
            );
          })()}
        </> : <>
          <h2 className="sec-title" id="adm-work-t">{siteEdit ? "Edit the site's headline" : editing ? 'Edit the headline' : 'Write the headline'}<small>The slide is exactly what goes up</small></h2>
          <div className="adm-compose">
            <div className="adm-preview" ref={pinPreview}>
              {shown.length
                ? <div className="hero adm-hero"><Carousel D={D} h={h} stories={shown} date={date} hold={null} night={false} groups={groups} nav={nav} /></div>
                : <div className="adm-blank"><p>Start typing a headline and the slide shows up here.</p></div>}
            </div>
            <form className="adm-form glass" onSubmit={submit}>
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

              <fieldset>
                <legend>Look</legend>
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
              </fieldset>

              <fieldset>
                <legend>Who's pictured</legend>
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
              </fieldset>

              <fieldset>
                <legend>Ticker</legend>
                <p className="adm-hint">The strip that runs across the top once the carousel scrolls away. Left empty, it uses the stamp and the headline's first sentence.</p>
                <div className="adm-pair adm-tick-pair">
                  <label className="adm-field"><span>Hook</span><input value={form.hook} onChange={(e) => set({ hook: e.target.value })} maxLength={24} placeholder="Done deal" /></label>
                  <label className="adm-field"><span>Line<Count v={form.line} max={160} /></span><input value={form.line} onChange={(e) => set({ line: e.target.value })} maxLength={160} /></label>
                </div>
              </fieldset>

              <div className="adm-send">
                {siteEdit ? <p className="adm-hint">{`Your words replace the site's on this headline for week ${week}. Undo edit puts the site's back.`}</p> : <div className="adm-field" role="group" aria-labelledby="adm-run"><span id="adm-run">{form.run === 'week' ? `Runs until ${when(weekTurns(now))}` : 'How long it runs'}</span>
                  <div className="adm-pills">
                    {editing?.until ? <button type="button" className="adm-pill" aria-pressed={form.run === 'keep'} onClick={() => set({ run: 'keep' })}>{`As is, until ${when(editing.until)}`}</button> : null}
                    {RUNS.map(([k, l]) => <button key={k} type="button" className="adm-pill" aria-pressed={form.run === k} onClick={() => set({ run: k })}>{l}</button>)}
                  </div>
                </div>}
                {err ? <p className="adm-err" role="alert">{err}</p> : null}
                <div className="adm-send-row">
                  <button type="button" className="talk-btn" onClick={() => { setForm(null); setEditing(null); setErr(''); }} disabled={busy}>{editing ? 'Cancel' : 'Discard'}</button>
                  <button type="submit" className="cta adm-post" disabled={busy}>{busy ? (editing ? 'Saving…' : 'Posting…') : editing ? 'Save changes' : 'Post headline'}</button>
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

function Head({ live }) {
  return (
    <section className="view-head">
      <div>
        <h1><span className="wk">{live == null ? 'Editor' : live ? `${live} of yours up now` : 'Nothing of yours up'}</span>Headline desk</h1>
        <p>Pick the moves worth a headline, write it and post it. Your headlines lead the carousel on the rankings and Live pages.</p>
      </div>
    </section>
  );
}
