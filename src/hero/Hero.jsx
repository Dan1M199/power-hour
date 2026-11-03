// The top of the power rankings and the Live page: the headline carousel, the page head and the league desk. With the
// desk on, .hero.with-talk puts the carousel across both rows on the left and the desk under the page head on the right.
// Scrolled past, the headlines run on as a ticker (Ticker.jsx).
import { useRef } from 'react';
import { Carousel } from './Carousel.jsx';
import { Talk } from './Talk.jsx';
import { Ticker } from './Ticker.jsx';
import { useTalk } from './talk.js';

/** car: the carousel's props (stories, date, hold, night, groups), or null; head: the page head; desk: show the league desk. */
export function Hero({ D, h, car, head, desk }) {
  const nav = useRef(null); // the carousel's { at, go }, for the desk's headline chips and the ticker
  const hero = useRef(null);
  const T = useTalk();
  const toCar = () => document.querySelector('.lead-car')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  return (
    <div ref={hero} className={`hero${desk && T.data?.enabled ? ' with-talk' : ''}`}>
      {car ? <Carousel D={D} h={h} {...car} nav={nav} /> : null}
      <section className="view-head">{head}</section>
      {car ? <Ticker stories={car.stories} nav={nav} hero={hero} live={!!D.liveMode} /> : null}
      {desk ? <Talk h={h} stories={car?.stories || []} nav={nav} onGoto={toCar} /> : null}
    </div>
  );
}
