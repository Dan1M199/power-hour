// The Games page (#matchups): the game of the week, then a card per game. A card's lineup breakdown opens full width
// on desktop, and the other cards glide to their new places (FLIP, transform only) instead of jumping.
import { useLayoutEffect, useRef, useState } from 'react';
import { GameOfTheWeek } from './GameOfTheWeek.jsx';
import { MatchupCard } from './MatchupCard.jsx';
import { useVotes } from './votes.js';

export function GamesPage({ D, me, h, calm, lite }) {
  const pv = D.previews, wk = pv[0]?.week;
  const [votes, error] = useVotes();
  const [open, setOpen] = useState(() => new Set()); // breakdowns open now
  const [opened, setOpened] = useState(() => new Set()); // breakdowns built so far (kept after closing, for the fold)
  const grid = useRef(null), cards = useRef([]), flip = useRef(null);

  const toggle = (i, force) => {
    const now = force ?? !open.has(i);
    if (now === open.has(i)) return;
    // Desktop: the open card takes the whole row. Phones are one column already, so nothing moves sideways there.
    const g = grid.current, glide = g && !lite && !calm && getComputedStyle(g).gridTemplateColumns.split(' ').length > 1;
    flip.current = { i, now, first: glide ? new Map([...g.children].map((c) => [c, c.getBoundingClientRect()])) : null };
    setOpened((s) => new Set(s).add(i));
    setOpen((s) => { const n = new Set(s); if (now) n.add(i); else n.delete(i); return n; });
  };
  useLayoutEffect(() => {
    const f = flip.current;
    if (!f) return;
    flip.current = null;
    if (f.first) {
      for (const [c, a] of f.first) {
        const b = c.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }
    }
    const card = cards.current[f.i];
    if (f.scroll) card?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    else if (f.first && f.now && card) { const top = card.getBoundingClientRect().top; if (top < 90 || top > innerHeight * 0.6) card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }, [open, calm]);

  // the game of the week's button: open that card's breakdown and go to it
  const toBreakdown = (i) => {
    if (open.has(i)) { cards.current[i]?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }); return; }
    toggle(i, true);
    flip.current.scroll = true;
  };

  return <>
    <section className="view-head">
      <div>
        <h1><span className="wk">{wk ? `Week ${wk}` : 'Off week'}</span>Games</h1>
        <p>Every game this week, projected from the lineups as they stand. Open one for the slot-by-slot breakdown, and make your pick before kickoff.</p>
      </div>
    </section>
    <GameOfTheWeek D={D} h={h} onBreakdown={toBreakdown} />
    {pv.length ? <div className="matchups" ref={grid}>{pv.map((p, i) => (
      <MatchupCard key={`${p.a}-${p.b}`} D={D} p={p} i={i} me={me} h={h} votes={votes} error={error}
        open={open.has(i)} opened={opened.has(i)} onOpen={() => toggle(i)} cardRef={(el) => { cards.current[i] = el; }} />
    ))}</div> : <p className="empty glass panel">No regular-season matchups left to preview.</p>}
  </>;
}
