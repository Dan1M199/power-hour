// The league desk: one discussion thread a week, beside the headlines. Anyone can read; managers post once they've
// opened their personal link from Dan (api/talk.js). A comment can carry the headline it's about (taken from the slide
// on screen when its author starts typing), shown as a chip that turns the carousel back to that slide. Authors can edit
// for a minute; only Dan deletes. It refreshes every 25 seconds while the tab is visible, unless a comment is being
// edited. The demo and the preview bundle leave it out.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MEMBERS, GUESTS, DESK_PEOPLE } from '../../lib/members.js';
import { Headshot } from '../shared.jsx';
import { useTalk, setTalk, talk, talkCall, keepTalk, loadTalk, viewWeek, talkNow, storyKeys } from './talk.js';

const TZ = 'America/Chicago';
const ago = (ts) => {
  const s = (talkNow() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
};
const X = () => <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="m2 2 8 8m0-8-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const Plus = () => <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;

function About({ about, onTag, onUnref, h }) {
  return about
    ? <span className="talk-about-on"><span>About: <b>{h.short(about.title, 64)}</b></span><button type="button" className="tc-x" aria-label="Not about this headline" onClick={onUnref}><X /></button></span>
    : <button type="button" className="tc-tag" onClick={onTag}><Plus />Tag the headline on screen</button>;
}

function Comment({ c, D, h, keys, editing, onEdit, onCancel, onSave, onDelete, onGoto }) {
  const t = h.teams.find((x) => x.ownerId === c.uid), m = DESK_PEOPLE[c.uid];
  const mine = D.me === c.uid, left = D.editMs - (talkNow() - c.ts);
  const [text, setText] = useState(c.text);
  const i = c.ref ? keys.indexOf(c.ref.key) : -1;
  const canEdit = mine && left > 0 && !editing;
  return (
    <li className={`tc${mine ? ' mine' : ''}`} data-id={c.id}>
      {t ? <Headshot t={t} cls="tc-face" h={h} /> : m?.icon ? <img className="tc-face icon" src={m.icon} alt="" decoding="async" /> : <span className="tc-face ph">{(m?.first || '?')[0]}</span>}
      <div className="tc-body">
        <p className="tc-who"><b>{m?.first || 'Manager'}</b>{t ? <span>{t.name}</span> : GUESTS[c.uid] ? <span>Guest</span> : null}<time>{`${ago(c.ts)}${c.edited ? ', edited' : ''}`}</time></p>
        {c.ref ? (
          <button type="button" className="tc-ref" disabled={i < 0} data-tip={i < 0 ? `${c.ref.title} (no longer in the headlines)` : `Show this headline: ${c.ref.title}`}
            onClick={() => onGoto(i)}>{`On: ${h.short(c.ref.title, 56)}`}</button>
        ) : null}
        {editing ? (
          <form className="tc-edit" data-id={c.id} onSubmit={(e) => { e.preventDefault(); onSave(text.trim(), e.currentTarget); }}>
            <textarea rows="3" maxLength={D.maxLen} aria-label="Edit your comment" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <div className="talk-row"><button type="button" className="talk-btn" onClick={onCancel}>Cancel</button><button type="submit" className="talk-btn primary">Save</button></div>
          </form>
        ) : <p className="tc-text">{c.text}</p>}
        {canEdit || D.admin ? (
          <div className="tc-acts">
            {canEdit ? <button type="button" className="tc-act" aria-label={`Edit, ${Math.ceil(left / 1000)} seconds left`} onClick={onEdit}>Edit<small>{`${Math.ceil(left / 1000)}s`}</small></button> : null}
            {D.admin ? <button type="button" className="tc-act bad" onClick={onDelete}>Delete</button> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Invites({ h }) {
  const [copied, setCopied] = useState({});
  const people = [...Object.entries(MEMBERS).sort((a, b) => a[1].first.localeCompare(b[1].first)), ...Object.entries(GUESTS)];
  const make = async (uid) => {
    if (!confirm(`Make a new link for ${DESK_PEOPLE[uid]?.first}? Their old link stops working.`)) return;
    try { const r = await talkCall({ action: 'invite', uid }); setTalk({ links: { ...talk.links, [uid]: `${location.origin}${location.pathname}#join=${r.token}` } }); }
    catch (x) { setTalk({ flash: x.message }); }
  };
  const copy = async (uid, e) => {
    const input = e.currentTarget.closest('li').querySelector('input');
    try { await navigator.clipboard.writeText(talk.links[uid]); setCopied({ ...copied, [uid]: true }); } catch { input?.select(); }
  };
  return (
    <div className="talk-invites">
      <p className="talk-note">Each link signs one manager in, on as many of their devices as they like. A new link replaces the old one and signs those devices out.</p>
      <ul>{people.map(([uid, m]) => {
        const t = h.teams.find((x) => x.ownerId === uid), url = talk.links[uid];
        return (
          <li key={uid}><span><b>{m.first}</b>{t ? <small>{t.name}</small> : GUESTS[uid] ? <small>Guest</small> : null}</span>
            {url
              ? <><input readOnly value={url} aria-label={`${m.first}'s link`} /><button type="button" className="talk-btn" onClick={(e) => copy(uid, e)}>{copied[uid] ? 'Copied' : 'Copy'}</button></>
              : <button type="button" className="talk-btn" onClick={() => make(uid)}>New link</button>}
          </li>
        );
      })}</ul>
    </div>
  );
}

/** stories: the headlines in the carousel beside it; nav: the carousel's { at, go }; onGoto: scroll the carousel into view. */
export function Talk({ h, stories, nav, onGoto }) {
  const T = useTalk(), D = T.data;
  const [editing, setEditing] = useState(null);
  const [about, setAbout] = useState(null); // the headline a new comment is about
  const touched = useRef(false); // the author tagged or untagged it themselves
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const list = useRef(null), shown = useRef(null);
  const keys = storyKeys(stories);

  // load the thread (or show the one already loaded), then refresh it every 25 s while the tab is visible
  const editingRef = useRef(editing);
  editingRef.current = editing;
  useEffect(() => {
    if (!talk.data) loadTalk();
    const refresh = () => { if (document.visibilityState === 'visible' && editingRef.current == null) loadTalk(); };
    const every = setInterval(refresh, 25000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(every); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  // the hero lays out around the desk once it has something to show
  const on = !!D?.enabled;
  const n = D?.comments.length || 0;
  // a new comment scrolls the list to the bottom
  useLayoutEffect(() => {
    const el = list.current;
    if (el && editing == null && shown.current !== n) { el.scrollTop = el.scrollHeight; shown.current = n; }
  });
  // the edit buttons come off when their minute is up
  useEffect(() => {
    if (!D) return;
    const next = D.comments.filter((c) => c.uid === D.me).map((c) => D.editMs - (talkNow() - c.ts)).filter((x) => x > 0);
    if (!next.length) return;
    const t = setTimeout(() => tick((x) => x + 1), Math.min(...next, 10000) + 50);
    return () => clearTimeout(t);
  });

  if (!on) return <aside className="talk glass" id="talk" aria-label="League desk" hidden />;

  const headline = () => {
    const i = nav.current?.at() ?? 0, st = stories[i];
    return st ? { key: keys[i], title: st.headline } : null;
  };
  const goto = (i) => { nav.current?.go(i); onGoto(); };
  const flash = (msg) => setTalk({ flash: msg });
  const post = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      keepTalk(await talkCall({ action: 'post', week: talk.week, text, ref: about }));
      setDraft(''); setAbout(null); touched.current = false; setErr('');
      flash('');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const save = async (id, text) => {
    if (!text) return;
    try { keepTalk(await talkCall({ action: 'edit', week: viewWeek(), id, text })); setEditing(null); flash(''); }
    catch (x) { flash(x.message); }
  };
  const del = async (id) => {
    if (!confirm('Delete this comment for everyone?')) return;
    try { keepTalk(await talkCall({ action: 'delete', week: viewWeek(), id })); } catch (x) { flash(x.message); }
  };
  const signout = async () => {
    try { await talkCall({ action: 'signout' }); } catch { /* the cookie goes either way */ }
    flash(''); loadTalk();
  };
  const pickWeek = (w) => { setTalk({ view: w === talk.week ? null : w }); setEditing(null); loadTalk(); };

  // earlier weeks' threads stay readable: pick one to read back through
  const cur = talk.week, weeks = Array.from({ length: cur }, (_, i) => cur - i);
  return (
    <aside className="talk glass" id="talk" aria-label="League desk">
      <div className="talk-in">
        <div className="talk-head">
          <div className="talk-title"><h2>League desk</h2>{D.admin ? <button type="button" className="talk-btn" aria-expanded={String(!!T.invites)} onClick={() => setTalk({ invites: !T.invites })}>Invite links</button> : null}</div>
          <div className="talk-bar">
            <span className="talk-meta">
              {cur > 1
                ? <label className="talk-wk"><span>Week</span><select aria-label="Which week's thread" value={D.week} onChange={(e) => pickWeek(Number(e.target.value))}>{weeks.map((w) => <option key={w} value={w}>{`${w}${w === cur ? ', this week' : ''}`}</option>)}</select></label>
                : <span className="talk-n">{`Week ${D.week}`}</span>}
              <span className="talk-n">{`${n} comment${n === 1 ? '' : 's'}`}</span>
            </span>
            {D.me ? <span className="talk-me">Posting as <b>{DESK_PEOPLE[D.me]?.first || ''}</b><button type="button" className="tc-pill" onClick={signout}>Sign out</button></span> : null}
          </div>
        </div>
        {T.flash ? <p className="talk-flash" role="status">{T.flash}</p> : null}
        {T.invites ? <Invites h={h} /> : null}
        <ol className="talk-list" ref={list}>
          {n ? D.comments.map((c) => (
            <Comment key={c.id} c={c} D={D} h={h} keys={keys} editing={editing === c.id}
              onEdit={() => setEditing(c.id)} onCancel={() => setEditing(null)} onSave={(text) => save(c.id, text)} onDelete={() => del(c.id)} onGoto={goto} />
          )) : <li className="tc-empty">Nothing yet. Start the argument.</li>}
        </ol>
        {T.view
          ? <p className="talk-note">{`Week ${T.view}'s thread is closed. `}<button type="button" className="tc-link" onClick={() => { setTalk({ view: null }); loadTalk(); }}>{`Back to week ${cur}`}</button></p>
          : !D.me
            ? <p className="talk-note">Reading only. Ask Dan for your personal link to join in.</p>
            : (
              <form className="talk-form" onSubmit={post}>
                <div className="talk-about"><About about={about} h={h} onTag={() => { setAbout(headline()); touched.current = true; }} onUnref={() => { setAbout(null); touched.current = true; }} /></div>
                <textarea rows="3" maxLength={D.maxLen} placeholder="Say something to the league" aria-label="Your comment" value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    // the first keystroke tags the headline on screen, unless the author already chose
                    if (!touched.current && e.target.value.trim()) { touched.current = true; setAbout(headline()); }
                  }} />
                <div className="talk-row"><small className="talk-count">{`${draft.length}/${D.maxLen}`}</small><span className="talk-err" role="status">{err}</span><button type="submit" className="talk-btn primary" disabled={busy}>Post</button></div>
              </form>
            )}
      </div>
    </aside>
  );
}
