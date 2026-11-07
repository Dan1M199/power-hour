// The top of the power rankings and the Live page: the headline carousel and page head. Scrolled past, the headlines
// run on as a ticker (Ticker.jsx). On a wide screen the page's personal card (your rank, your week) sits under the page
// head beside the carousel, so the column next to the headlines isn't empty sky; narrower, it follows the hero as before.
import { useRef, useSyncExternalStore } from 'react';
import { Carousel } from './Carousel.jsx';
import { Ticker } from './Ticker.jsx';

// from here the column beside the 580px carousel is wide enough (440px and up) for the head and a card together
const WIDE = '(min-width: 1100px)';
const watch = (f) => { const m = matchMedia(WIDE); m.addEventListener('change', f); return () => m.removeEventListener('change', f); };
const useWide = () => useSyncExternalStore(watch, () => matchMedia(WIDE).matches, () => true);

/**
 * car: the carousel's props (stories, date, hold, night, groups), or null; head: the page head; side: the personal card
 * (beside the carousel when wide, after the hero otherwise), or null; hint: shown in its place beside the carousel only,
 * when there's no card (no team picked).
 */
export function Hero({ D, h, car, head, side = null, hint = null }) {
  const nav = useRef(null); // the carousel's { at, go }, for the ticker
  const hero = useRef(null);
  const wide = useWide();
  const beside = car && wide ? side || hint : null;
  return <>
    <div ref={hero} className={`hero${beside ? ' with-side' : ''}`}>
      {car ? <Carousel D={D} h={h} {...car} nav={nav} /> : null}
      {beside
        ? <div className="hero-side"><section className="view-head">{head}</section>{beside}</div>
        : <section className="view-head">{head}</section>}
      {car ? <Ticker stories={car.stories} nav={nav} hero={hero} live={!!D.liveMode} /> : null}
    </div>
    {beside ? null : side}
  </>;
}
