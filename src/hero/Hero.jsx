// The top of the power rankings and the Live page: the headline carousel and page head. Scrolled past, the headlines
// run on as a ticker (Ticker.jsx).
import { useRef } from 'react';
import { Carousel } from './Carousel.jsx';
import { Ticker } from './Ticker.jsx';

/** car: the carousel's props (stories, date, hold, night, groups), or null; head: the page head. */
export function Hero({ D, h, car, head }) {
  const nav = useRef(null); // the carousel's { at, go }, for the ticker
  const hero = useRef(null);
  return (
    <div ref={hero} className="hero">
      {car ? <Carousel D={D} h={h} {...car} nav={nav} /> : null}
      <section className="view-head">{head}</section>
      {car ? <Ticker stories={car.stories} nav={nav} hero={hero} live={!!D.liveMode} /> : null}
    </div>
  );
}
