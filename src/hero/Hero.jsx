// The top of the power rankings and the Live page: the headline carousel and page head. On a wide screen the page's
// personal card (your rank, your week) sits under the page head beside the carousel, so the column next to the
// headlines isn't empty sky; narrower, it follows the hero as before.
import { useSyncExternalStore } from 'react';
import { Carousel } from './Carousel.jsx';

// from here the column beside the 580px carousel is wide enough (440px and up) for the head and a card together
const WIDE = '(min-width: 1100px)';
const watch = (f) => { const m = matchMedia(WIDE); m.addEventListener('change', f); return () => m.removeEventListener('change', f); };
const useWide = () => useSyncExternalStore(watch, () => matchMedia(WIDE).matches, () => true);

/**
 * car: the carousel's props (stories, date, hold, night, groups), or null; head: the page head; side: the personal card
 * (beside the carousel when wide, after the hero otherwise), or null; hint: shown in its place beside the carousel only,
 * when there's no card (no team picked); more: anything else for that column (the rankings' movers), after the card.
 */
export function Hero({ D, h, car, head, side = null, hint = null, more = null }) {
  const wide = useWide();
  const beside = car && wide ? side || hint : null;
  return <>
    <div className={`hero${beside ? ' with-side' : ''}`}>
      {car ? <Carousel D={D} h={h} {...car} /> : null}
      {beside
        ? <div className="hero-side"><section className="view-head">{head}</section>{beside}{more}</div>
        : <section className="view-head">{head}</section>}
    </div>
    {beside ? null : <>{side}{more}</>}
  </>;
}
