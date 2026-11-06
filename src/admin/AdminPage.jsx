// The admin portal (#admin), Dan's own headline desk: tick the transactions to write about, start from a draft worked
// out of the numbers (draftFor in app.js), rewrite it with the real carousel slide as the preview, and post it. Posted
// headlines lead the carousel on the rankings and Live pages (carouselProps in app.js) until they run out or he takes
// them down. Signing in is the league desk's: his #join= link or TALK_ADMIN_KEY, through api/talk.js. Everyone else
// who opens #admin only gets the sign-in box, and api/headlines.js refuses any write that isn't his.
import { useMemo, useRef, useState } from 'react';
import { TZ } from '../../lib/newsclock.js';
import { Carousel } from '../hero/Carousel.jsx';
import { talkCall, loadTalk } from '../hero/talk.js';
import { usePosts, loadPosts, postCall } from './posts.js';

const TONES = [['trade', 'Trade (red)'], ['good', 'Good news (green)'], ['bad', 'Bad news'], ['neutral', 'Plain']];
const when = (ts) => new Date(ts).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
// the next Tuesday 6am Central, when the week turns over and the new headlines come in
function weekTurns(now) {
  const parts = (t) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(t).map((p) => [p.type, p.value]));
  let t = Math.ceil(now / 36e5) * 36e5;
  for (let i = 0; i < 24 * 8; i++, t += 36e5) { const p = parts(t); if (p.weekday === 'Tue' && Number(p.hour) === 6) return t; }
  return now + 7 * 864e5;
}
const RUNS = [['week', 'Until the week turns (Tuesday 6am)'], ['day', 'For 24 hours'], ['3days', 'For 3 days'], ['forever', 'Until I take it down']];
const untilFor = (run, now) => ({ week: weekTurns(now), day: now + 864e5, '3days': now + 3 * 864e5 }[run] ?? null);

const EMPTY = { kicker: 'From the desk', stamp: '', tone: 'neutral', group: '', breaking: false, headline: '', deck: '', hook: '', line: '', rids: [], player: '', marks: '', tx: [], run: 'week' };
// the portal's form from a story (a draft or a post), and back
const formOf = (s, run = 'week') => ({
  ...EMPTY, ...s, stamp: s.stamp || '', group: s.group || '', hook: s.tick?.hook || '', line: s.tick?.line || '',
  player: s.player?.id || '', marks: (s.mark || []).join(', '), tx: s.tx || [], run,
});

function SignIn() {
  const [key, setKey] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true); setMsg('');
    try {
      const r = await talkCall({ action: 'claim', token: key.trim() });
      if (!r.admin) setMsg("That key works, but it isn't Dan's.");
      await Promise.all([loadPosts(), loadTalk()]);
    } catch (x) { setMsg(x.message); }
    setBusy(false); setKey('');
  };
  return (
    <form className="adm-card glass adm-signin" onSubmit={go}>
      <h2 className="sec-title">Sign in</h2>
      <p>Open your personal league desk link on this device, or paste the admin key here.</p>
      <label className="adm-field"><span>Admin key</span>
        <input type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <div className="adm-row"><button type="submit" className="talk-btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></div>
      {msg ? <p className="adm-msg" role="status">{msg}</p> : null}
    </form>
  );
}

// one transaction as a tickable row: when, and what each side got and gave up
function TxRow({ f, D, h, on, toggle }) {
  const name = (rid) => D.byRid[rid]?.name || `Team ${rid}`;
  const said = (ps) => ps.map((a) => `${h.nameOf(a.id)} (${h.f1(a.v)})`).join(', ');
  return (
    <li className={`adm-tx${on ? ' on' : ''}`}>
      <label>
        <input type="checkbox" checked={on} onChange={toggle} />
        <span className="adm-tx-body">
          <span className="adm-tx-head"><b>{f.type === 'trade' ? 'Trade' : f.type === 'free_agent' ? 'Free agent' : 'Waiver'}</b><small>{`${when(f.ts)}, week ${f.week}`}</small></span>
          {f.sides.map((x) => (
            <span key={x.rid} className="adm-tx-side">
              <b>{name(x.rid)}</b>
              {x.adds.length ? <span className="plus">{`+ ${said(x.adds)}`}</span> : null}
              {x.drops.length && f.type !== 'trade' ? <span className="minus">{`− ${said(x.drops)}`}</span> : null}
              {x.picks.filter((p) => p.dir === 'in').length ? <span className="plus">{`+ ${x.picks.filter((p) => p.dir === 'in').map((p) => `${p.season} round ${p.round} pick`).join(', ')}`}</span> : null}
              <small>{`${x.net >= 0 ? '+' : ''}${h.f1(x.net)} value`}</small>
            </span>
          ))}
        </span>
      </label>
    </li>
  );
}

export function AdminPage({ D, h, draft, preview, groups, week, now, date }) {
  const P = usePosts();
  const [range, setRange] = useState('week'), [kind, setKind] = useState('all');
  const [picked, setPicked] = useState([]);
  const [form, setForm] = useState(null), [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const nav = useRef(null);
  const set = (patch) => setForm((x) => ({ ...x, ...patch }));

  const lastWeek = Math.max(1, ...D.feed.map((f) => f.week || 0));
  const feed = D.feed.filter((f) => (kind === 'all' || (kind === 'trade') === (f.type === 'trade'))
    && (range === 'all' || f.week >= (range === 'week' ? lastWeek : lastWeek - 1))).slice(0, 80);
  const chosen = D.feed.filter((f) => picked.includes(f.id));
  // the players the card can show: everyone who moved in the ticked transactions, biggest value first
  const people = useMemo(() => {
    const ids = new Map();
    for (const f of D.feed.filter((x) => (form?.tx || picked).map(String).includes(String(x.id)))) for (const s of f.sides) for (const a of s.adds) ids.set(a.id, s.rid);
    if (form?.player && !ids.has(form.player)) ids.set(form.player, null);
    return [...ids].map(([id, rid]) => ({ id, rid, v: D.helpers.valueOf(id) })).sort((a, b) => b.v - a.v);
  }, [form?.tx, form?.player, picked, D]);

  if (P.enabled === null) return <><Head /><p className="adm-card glass">Loading the desk…</p></>;
  if (!P.enabled) return <><Head /><p className="adm-card glass">The headline store isn't set up here (it needs the Upstash env vars), so there's nothing to post to.</p></>;
  if (!P.admin) return <><Head /><SignIn /></>;

  // the form as a story: what gets posted, and what the preview draws
  const story = () => {
    if (!form) return null;
    const pl = form.player && people.find((x) => x.id === form.player), info = (pl && D.helpers.player(pl.id)) || {};
    const to = pl?.rid && D.byRid[pl.rid];
    const card = pl ? { id: pl.id, name: h.nameOf(pl.id), short: h.shortName(pl.id), line: `${info.pos || h.posOf(pl.id)}, ${h.nfl(info.team)}`, pin: to ? { rid: to.rid, label: `To ${h.first(to)}` } : null } : null;
    return {
      kicker: form.kicker, stamp: form.stamp, tone: form.tone, group: form.group || null, breaking: form.breaking,
      headline: form.headline, deck: form.deck, tick: form.hook && form.line ? { hook: form.hook, line: form.line } : null,
      rids: form.rids, player: card, mark: form.marks.split(',').map((x) => x.trim()).filter(Boolean), tx: form.tx, week,
      until: untilFor(form.run, now),
    };
  };
  const st = story();
  const shown = st && st.headline.trim() ? preview([{ ...st, id: 'draft', until: null }]) : [];

  const start = (from) => { setForm(from ? formOf(from) : { ...EMPTY }); setEditing(null); setMsg(''); requestAnimationFrame(() => document.querySelector('.adm-write')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const edit = (p) => {
    setForm(formOf(p, p.until ? 'keep' : 'forever'));
    setEditing(p); setMsg('');
    requestAnimationFrame(() => document.querySelector('.adm-write')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const call = async (body, done) => {
    setBusy(true); setMsg('');
    let ok = false;
    try { await postCall(body); ok = true; if (done) setMsg(done); } catch (x) { setMsg(x.message); }
    setBusy(false);
    return ok;
  };
  const submit = async (e) => {
    e.preventDefault();
    const s = story();
    if (!s.headline.trim()) { setMsg('Write a headline first.'); return; }
    if (form.run === 'keep') s.until = editing.until;
    const ok = await call(editing ? { action: 'edit', id: editing.id, story: s } : { action: 'post', story: s }, editing ? 'Saved. The carousel has the new words.' : 'Posted. It leads the carousel now.');
    if (ok) { setForm(null); setEditing(null); setPicked([]); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const move = (i, d) => {
    const ids = P.list.map((p) => p.id), j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    call({ action: 'order', ids });
  };
  const runSaid = (p) => (p.until ? `Up until ${when(p.until)}` : 'Up until you take it down');

  return (
    <>
      <Head live={P.list.length} />
      {msg ? <p className="adm-flash" role="status">{msg}</p> : null}

      <section className="adm-sec">
        <h2 className="sec-title">Up now<small>{P.list.length ? 'First one leads the carousel' : 'Nothing posted'}</small></h2>
        {P.list.length ? (
          <ol className="adm-posts">{P.list.map((p, i) => (
            <li key={p.id} className="adm-card glass">
              <div className="adm-post-text"><small>{`${p.kicker}${p.stamp ? `, ${p.stamp}` : ''}`}</small><b>{p.headline}</b><small>{`${runSaid(p)}. Posted ${when(p.ts)}.`}</small></div>
              <div className="adm-row">
                <button type="button" className="talk-btn" onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label="Move up">Up</button>
                <button type="button" className="talk-btn" onClick={() => move(i, 1)} disabled={busy || i === P.list.length - 1} aria-label="Move down">Down</button>
                <button type="button" className="talk-btn" onClick={() => edit(p)} disabled={busy}>Edit</button>
                <button type="button" className="talk-btn" onClick={() => call({ action: 'remove', id: p.id }, 'Taken down.')} disabled={busy}>Take down</button>
              </div>
            </li>
          ))}</ol>
        ) : null}
        {P.old.length ? (
          <details className="adm-old">
            <summary>{`Taken down or run out (${P.old.length})`}</summary>
            <ol className="adm-posts">{P.old.map((p) => (
              <li key={p.id} className="adm-card glass">
                <div className="adm-post-text"><b>{p.headline}</b><small>{p.down ? `Taken down ${when(p.down)}` : `Ran out ${when(p.until)}`}</small></div>
                <div className="adm-row"><button type="button" className="talk-btn" onClick={() => call({ action: 'restore', id: p.id }, 'Back up.')} disabled={busy}>Put back up</button></div>
              </li>
            ))}</ol>
          </details>
        ) : null}
      </section>

      <section className="adm-sec">
        <h2 className="sec-title">Pick transactions<small>{picked.length ? `${picked.length} ticked` : 'Tick the ones to write about'}</small></h2>
        <div className="filters">
          {[['week', `Week ${lastWeek}`], ['two', 'Last two weeks'], ['all', 'All season']].map(([k, l]) => <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}
          {[['all', 'Everything'], ['trade', 'Trades'], ['wire', 'Wire']].map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        {feed.length
          ? <ul className="adm-txs adm-card glass">{feed.map((f) => <TxRow key={f.id} f={f} D={D} h={h} on={picked.includes(f.id)} toggle={() => setPicked((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))} />)}</ul>
          : <p className="adm-card glass">No transactions here.</p>}
        <div className="adm-row adm-start">
          <button type="button" className="talk-btn primary" disabled={!picked.length} onClick={() => start(draft(chosen))}>{picked.length ? `Draft a headline from ${picked.length === 1 ? 'this one' : `these ${picked.length}`}` : 'Tick a transaction to draft from'}</button>
          <button type="button" className="talk-btn" onClick={() => start(null)}>Start from scratch</button>
        </div>
      </section>

      {form ? (
        <section className="adm-sec adm-write">
          <h2 className="sec-title">{editing ? 'Edit the headline' : 'Write the headline'}<small>The preview is the real slide</small></h2>
          <div className="hero adm-hero">
            {shown.length ? <Carousel D={D} h={h} stories={shown} date={date} hold={null} night={false} groups={groups} nav={nav} /> : <div className="adm-card glass adm-empty">Start typing a headline and the slide shows here.</div>}
            <form className="adm-card glass adm-form" onSubmit={submit}>
              <label className="adm-field"><span>Headline</span><textarea rows="3" value={form.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={220} required /></label>
              <label className="adm-field"><span>Deck, the paragraph under it</span><textarea rows="6" value={form.deck} onChange={(e) => set({ deck: e.target.value })} maxLength={1200} /></label>
              <div className="adm-pair">
                <label className="adm-field"><span>Kicker</span><input value={form.kicker} onChange={(e) => set({ kicker: e.target.value })} maxLength={40} /></label>
                <label className="adm-field"><span>Photo stamp</span><input value={form.stamp} onChange={(e) => set({ stamp: e.target.value })} maxLength={24} placeholder="Done deal" /></label>
              </div>
              <div className="adm-pair">
                <label className="adm-field"><span>Ticker hook</span><input value={form.hook} onChange={(e) => set({ hook: e.target.value })} maxLength={24} /></label>
                <label className="adm-field"><span>Ticker line</span><input value={form.line} onChange={(e) => set({ line: e.target.value })} maxLength={160} /></label>
              </div>
              <div className="adm-pair">
                <label className="adm-field"><span>Colour</span><select value={form.tone} onChange={(e) => set({ tone: e.target.value })}>{TONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label className="adm-field"><span>Section</span><select value={form.group} onChange={(e) => set({ group: e.target.value })}><option value="">None</option>{Object.entries(groups).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              </div>
              <div className="adm-pair">
                <label className="adm-field"><span>Player card</span><select value={form.player} onChange={(e) => set({ player: e.target.value })}>
                  <option value="">None, show the managers</option>
                  {people.map((x) => <option key={x.id} value={x.id}>{`${h.nameOf(x.id)} (${h.f1(x.v)})`}</option>)}
                </select></label>
                <label className="adm-field"><span>Names in yellow, commas between</span><input value={form.marks} onChange={(e) => set({ marks: e.target.value })} /></label>
              </div>
              <fieldset className="adm-field adm-teams"><legend>Managers in the story (the first two get photos)</legend>
                <div>{[...D.teams].sort((a, b) => h.first(a).localeCompare(h.first(b))).map((t) => (
                  <label key={t.rid} className={form.rids.includes(t.rid) ? 'on' : ''}><input type="checkbox" checked={form.rids.includes(t.rid)} onChange={() => set({ rids: form.rids.includes(t.rid) ? form.rids.filter((r) => r !== t.rid) : [...form.rids, t.rid] })} />{h.first(t)}</label>
                ))}</div>
              </fieldset>
              <div className="adm-pair">
                <label className="adm-field"><span>How long it runs</span><select value={form.run} onChange={(e) => set({ run: e.target.value })}>
                  {editing?.until ? <option value="keep">{`Keep: until ${when(editing.until)}`}</option> : null}
                  {RUNS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
                <label className="adm-check"><input type="checkbox" checked={form.breaking} onChange={(e) => set({ breaking: e.target.checked })} />Breaking</label>
              </div>
              <div className="adm-row">
                <button type="submit" className="talk-btn primary" disabled={busy}>{busy ? 'Posting…' : editing ? 'Save changes' : 'Post it'}</button>
                <button type="button" className="talk-btn" onClick={() => { setForm(null); setEditing(null); }} disabled={busy}>Cancel</button>
              </div>
            </form>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Head({ live }) {
  return (
    <section className="view-head">
      <div>
        <h1><span className="wk">{live ? `${live} headline${live === 1 ? '' : 's'} up` : 'Editor only'}</span>Headline desk</h1>
        <p>Pick the moves worth a headline, write it, and post it. Posted headlines lead the carousel on the rankings and Live pages, ahead of the ones the site writes itself.</p>
      </div>
    </section>
  );
}
