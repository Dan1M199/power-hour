// The page heading and personal summary lead on a phone. The same elements sit beside the headlines on a wide screen.
import { Carousel } from './Carousel.jsx';

export function Hero({ D, h, car, head, side = null, hint = null }) {
  return (
    <div className={car ? 'hero with-side' : 'hero'}>
      <div className="hero-side">
        <section className="view-head">{head}</section>
        {side || (hint && <div className="hero-hint">{hint}</div>)}
      </div>
      {car && <Carousel D={D} h={h} {...car} />}
    </div>
  );
}
