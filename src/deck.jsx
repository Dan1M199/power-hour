// A swipe deck: on a phone, a list of cards laid out sideways, one at a time with the next one peeking in, under a rail
// that says where you are (dots and a count, or named beads). src/swipe.js does the swiping; above 760px the rail is
// hidden and the cards lay out as they always did.
import { useEffect, useRef } from 'react';

// where a deck has to scroll to for each of its stops, left to right (a deck may have several cards in a column)
export function deckStops(el) {
  const box = el.getBoundingClientRect(), pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
  const lefts = [...el.children].map((c) => Math.round(c.getBoundingClientRect().left - box.left + el.scrollLeft - pad));
  return [...new Set(lefts)].sort((a, b) => a - b);
}

export function Deck({ as: Tag = 'div', className = '', deckRef, labels, count, noun = 'Card', children }) {
  const el = useRef(null), rail = useRef(null);
  const n = labels ? labels.length : count;
  const set = (node) => { el.current = node; if (deckRef) deckRef.current = node; };
  useEffect(() => {
    const deck = el.current;
    let queued = false;
    const mark = () => {
      queued = false;
      const stops = deckStops(deck);
      let at = 0;
      stops.forEach((s, k) => { if (Math.abs(s - deck.scrollLeft) < Math.abs(stops[at] - deck.scrollLeft)) at = k; });
      const r = rail.current;
      if (!r) return;
      r.querySelectorAll('[data-k]').forEach((b) => { const on = Number(b.dataset.k) === at; b.classList.toggle('on', on); if (labels) b.setAttribute('aria-pressed', String(on)); });
      const c = r.querySelector('.deck-count');
      if (c) c.textContent = `${noun} ${at + 1} of ${n}`;
    };
    const on = () => { if (!queued) { queued = true; requestAnimationFrame(mark); } };
    deck.addEventListener('scroll', on, { passive: true });
    mark();
    return () => deck.removeEventListener('scroll', on);
  }, [n]);
  const go = (k) => {
    const left = deckStops(el.current)[k];
    el.current.scrollTo({ left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <>
    {n > 1 ? <div ref={rail} className={`deck-rail ${labels ? 'named' : ''}`}>
      {labels
        ? labels.map((l, k) => <button key={l} type="button" data-k={k} aria-pressed={k === 0} onClick={() => go(k)}>{l}</button>)
        : <><span className="deck-count">{`${noun} 1 of ${n}`}</span><span className="deck-dots">{Array.from({ length: n }, (_, k) => <button key={k} type="button" data-k={k} aria-label={`${noun} ${k + 1}`} onClick={() => go(k)} />)}</span></>}
    </div> : null}
    <Tag ref={set} className={`deck ${className}`}>{children}</Tag>
  </>;
}
