// The page title leads, followed by the headline feature and a personal overview.
// One DOM order on every device keeps keyboard and screen-reader navigation natural.
import { Carousel } from './Carousel.jsx';

export function Hero({ D, h, car, head, side = null, hint = null, more = null }) {
  return <div className={`hero${side || hint ? ' with-side' : ''}`}>
    <section className="view-head hero-title">{head}</section>
    {side || hint ? <div className="hero-personal">{side || hint}</div> : null}
    {car ? <Carousel D={D} h={h} {...car} /> : null}
    {more ? <div className="hero-movers">{more}</div> : null}
  </div>;
}
