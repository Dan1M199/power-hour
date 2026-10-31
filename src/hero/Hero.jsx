// The top of the power rankings and the Live page: the headline carousel, the page head and the league desk. With the
// desk on, .hero.with-talk puts the carousel across both rows on the left and the desk under the page head on the right.
import { useRef } from 'react';
import { Carousel } from './Carousel.jsx';
import { Talk } from './Talk.jsx';
import { useTalk } from './talk.js';

/** car: the carousel's props (stories, date, hold, night, groups), or null; head: the page head; desk: show the league desk. */
export function Hero({ D, h, car, head, desk }) {
  const nav = useRef(null); // the carousel's { at, go }, for the desk's headline chips
  const T = useTalk();
  const toCar = () => document.querySelector('.lead-car')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  return (
    <div className={`hero${desk && T.data?.enabled ? ' with-talk' : ''}`}>
      {car ? <Carousel D={D} h={h} {...car} nav={nav} /> : null}
      <section className="view-head">{head}</section>
      {desk ? <Talk h={h} stories={car?.stories || []} nav={nav} onGoto={toCar} /> : null}
    </div>
  );
}
