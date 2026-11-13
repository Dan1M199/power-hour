// 5.0 flowy glass (Nov 12): the motion that answers a hand. Three things, all on passive listeners and one animation
// frame loop that sleeps when nothing is moving:
// - the sky leans toward the pointer or finger (--fx, --fy on .sky, eased), and slides a little with the scroll (--sy);
// - a glass card's glint sits where the pointer is over it, or where a finger touched it (--lx, --ly; .flow-touched
//   brightens it for a moment after a touch);
// - page titles, the bubble letters, squish like jelly when pressed.
// Styles are in src/flowy.css. Reduced motion keeps the glint (it moves nothing) and drops the rest.
const GLASS = '.glass, .pp-tile, .pp-head, .wire-stats > div';
const JELLY = '.view-head .page-title, .view-head h1, .lab-head .page-title, .br-every b, .ys-rank b';

export function initFlow() {
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const sky = document.querySelector('.sky');
  let fx = 0.5, fy = 0.5, tx = 0.5, ty = 0.5, sy = 0, ty2 = 0, raf = 0;

  const step = () => {
    raf = 0;
    fx += (tx - fx) * 0.07; fy += (ty - fy) * 0.07; sy += (ty2 - sy) * 0.12;
    if (sky) {
      sky.style.setProperty('--fx', fx.toFixed(4));
      sky.style.setProperty('--fy', fy.toFixed(4));
      sky.style.setProperty('--sy', `${sy.toFixed(1)}px`);
    }
    if (Math.abs(tx - fx) > 0.001 || Math.abs(ty - fy) > 0.001 || Math.abs(ty2 - sy) > 0.2) raf = requestAnimationFrame(step);
  };
  const wake = () => { if (!raf && !calm.matches) raf = requestAnimationFrame(step); };

  // the glint: page coordinates inside the card, set straight on the card (never on the root, which would restyle
  // every element on the page)
  let lit = null, fade = 0;
  const glint = (card, e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--lx', `${Math.round(e.clientX - r.left)}px`);
    card.style.setProperty('--ly', `${Math.round(e.clientY - r.top)}px`);
  };

  addEventListener('pointermove', (e) => {
    tx = e.clientX / innerWidth; ty = e.clientY / innerHeight; wake();
    if (e.pointerType !== 'mouse') return;
    const card = e.target.closest?.(GLASS);
    if (card) glint(card, e);
  }, { passive: true });

  addEventListener('pointerdown', (e) => {
    tx = e.clientX / innerWidth; ty = e.clientY / innerHeight; wake();
    const card = e.target.closest?.(GLASS);
    if (card && !card.closest('.adm-page')) {
      glint(card, e);
      if (lit && lit !== card) lit.classList.remove('flow-touched');
      lit = card; card.classList.add('flow-touched');
      clearTimeout(fade);
      fade = setTimeout(() => { card.classList.remove('flow-touched'); if (lit === card) lit = null; }, 700);
    }
    if (calm.matches) return;
    const title = e.target.closest?.(JELLY);
    if (title && title.animate) {
      title.getAnimations().forEach((a) => a.cancel());
      title.animate([
        { scale: '1 1' }, { scale: '1.05 0.93', offset: 0.22 }, { scale: '0.97 1.04', offset: 0.48 }, { scale: '1.015 0.99', offset: 0.72 }, { scale: '1 1' },
      ], { duration: 640, easing: 'ease-out' });
    }
  }, { passive: true });

  addEventListener('scroll', () => { ty2 = Math.min(160, scrollY * 0.06); wake(); }, { passive: true });
  calm.addEventListener('change', () => { if (calm.matches && sky) { sky.style.removeProperty('--fx'); sky.style.removeProperty('--fy'); sky.style.removeProperty('--sy'); } });
}
