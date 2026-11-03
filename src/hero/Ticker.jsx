// The news ticker: once the headline card has scrolled off the top of the screen, its headlines collapse into a slim
// scoreboard strip that slides across under the nav bar (desktop) or, on phones, in the header's place beside the folded
// football (only while the header is folded, so the two never stack). Tapping a headline scrolls back up to the card,
// turned to that slide. The strip is portaled to <body> so no transformed ancestor (the page's view transition, the
// scroll reveal) can pull its fixed position out of the window. Under reduced motion it doesn't scroll by itself: it's a
// strip you can swipe.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { stampOf } from './Carousel.jsx';

const SPEED = 70; // px a second
// what the ticker says: an attention catcher and one sentence. A story can carry its own (tick: { hook, line });
// otherwise the hook is its photo stamp (or kicker) and the line is its headline's first sentence, kept short.
const MAX = 110;
function tickOf(st) {
  if (st.tick) return st.tick;
  let line = st.headline.split(/(?<=[.?!])\s+/)[0];
  if (line.length < 28) line = st.headline; // "Stop everything." isn't a summary
  if (line.length > MAX) line = `${line.slice(0, line.lastIndexOf(' ', MAX - 1))}…`;
  return { hook: stampOf(st) || st.kicker, line: /[.?!…]$/.test(line) ? line : `${line}.` };
}
const phone = () => matchMedia('(max-width: 760px)').matches;
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function Items({ stories, onPick, copy }) {
  return stories.map((st, i) => { const t = tickOf(st); return (
    <button type="button" key={`${copy}-${i}`} className="tk-item" tabIndex={copy ? -1 : 0} aria-hidden={copy ? 'true' : undefined}
      onClick={() => onPick(i)} title={st.headline}>
      <b className="tk-kick">{t.hook}</b>
      <span>{t.line}</span>
      <svg className="tk-sep" viewBox="0 0 20 12" aria-hidden="true"><ellipse cx="10" cy="6" rx="9" ry="5.2" /><path d="M7 6h6M8.5 4.6v2.8M10 4.6v2.8M11.5 4.6v2.8" /></svg>
    </button>
  ); });
}

/** stories: the carousel's headlines; nav: the carousel's { at, go }; hero: a ref to the hero holding the card; live: Live page. */
export function Ticker({ stories, nav, hero, live }) {
  const [past, setPast] = useState(false); // the card is above the screen
  const [folded, setFolded] = useState(false); // phones: the header is a football
  const [top, setTop] = useState(84);
  const track = useRef(null);

  // the card leaving the top of the screen
  useEffect(() => {
    const card = hero.current?.querySelector('.lead-car');
    if (!card) return;
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(card);
    return () => io.disconnect();
  }, [hero, stories]);

  // where the nav bar ends (desktop), and whether the phone header is folded
  useEffect(() => {
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    const place = () => setTop(12 + bar.offsetHeight + 10);
    place();
    const ro = new ResizeObserver(place);
    ro.observe(bar);
    const mo = new MutationObserver(() => setFolded(bar.classList.contains('folded')));
    mo.observe(bar, { attributes: true, attributeFilter: ['class'] });
    setFolded(bar.classList.contains('folded'));
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);

  // the loop runs at a steady speed whatever the headlines' length: one copy's width over SPEED
  useLayoutEffect(() => {
    const el = track.current;
    if (el) el.style.setProperty('--tk-dur', `${Math.max(20, el.scrollWidth / 2 / SPEED)}s`);
  }, [stories]);

  if (!stories?.length) return null;
  const on = past && (!phone() || folded);
  const pick = (i) => {
    nav.current?.go(i);
    hero.current?.querySelector('.lead-car')?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
  };
  return createPortal(
    <aside className={`ticker${on ? ' on' : ''}`} style={{ '--tk-top': `${top}px` }} aria-label="Headlines" aria-hidden={on ? undefined : 'true'} inert={on ? undefined : true}>
      <span className="tk-badge"><i aria-hidden="true" /><span className="tk-label">{live ? 'Live' : 'Headlines'}</span></span>
      <div className="tk-window">
        <div className="tk-track" ref={track}>
          <Items stories={stories} onPick={pick} copy={0} />
          <Items stories={stories} onPick={pick} copy={1} />
        </div>
      </div>
    </aside>,
    document.body,
  );
}
