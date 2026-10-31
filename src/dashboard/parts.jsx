// The pieces every widget shares: the tile (it rises in, in turn), its label (an accent dot and a word) and the icons.
import { useCallback, useRef } from 'react';
import { useFrame } from './clock.js';
import { TL, out, seg } from './motion.js';

// tileRef: a ref of the caller's to receive the tile element too
export function Tile({ index, className, wide = false, tileRef, children, ...rest }) {
  const own = useRef(null), el = tileRef || own;
  useFrame(useCallback((t) => {
    const n = el.current;
    if (!n) return;
    const k = seg(t, TL.enter[0] + index * TL.stagger, TL.enter[1] + index * TL.stagger, out);
    n.style.opacity = String(k);
    n.style.transform = `translateY(${(1 - k) * TL.rise}px) scale(${TL.scale + (1 - TL.scale) * k})`;
  }, [index, el]));
  return <article ref={el} className={`pp-tile ${className}${wide ? ' wide' : ''}`} style={{ '--i': index }} {...rest}>{children}</article>;
}

export const Label = ({ children }) => <div className="pp-label"><i />{children}</div>;

// small icons on a 24-unit grid, drawn in currentColor
const solid = (size, d) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
export const Prev = () => solid(20, 'M7 6h2v12H7zM20 6v12l-9-6z');
export const Pause = () => solid(20, 'M7 5h4v14H7zM13 5h4v14h-4z');
export const Play = () => solid(20, 'M8 5.5v13l10.5-6.5z');
export const Next = () => solid(20, 'M15 6h2v12h-2zM4 6v12l9-6z');
export const Bolt = () => solid(13, 'M13 2 4 14h7l-1 8 9-12h-7z');
export const Dice = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <g fill="currentColor"><circle cx="8.5" cy="8.5" r="1.4" /><circle cx="15.5" cy="15.5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="15.5" cy="8.5" r="1.4" /><circle cx="8.5" cy="15.5" r="1.4" /></g>
  </svg>
);
