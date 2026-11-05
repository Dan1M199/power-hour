// Phones: a scouting report slides out from behind its card, and everything under it moves with it, on transforms only.
// The page's layout changes once, in one go, and the compositor runs the rest, so a long report can't stutter or reflow
// mid-way the way animating its height did.

const MS = 480;
const EASE = 'cubic-bezier(0.22, 0.9, 0.24, 1)';
let busy = false;

export const slides = () => matchMedia('(max-width: 760px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
export const sliding = () => busy;

// what sits below the row: the next rows, then the rest of the page
function below(li) {
  const out = [];
  for (let el = li; el && el.id !== 'app'; el = el.parentElement) {
    for (let s = el.nextElementSibling; s; s = s.nextElementSibling) out.push(s);
  }
  const foot = document.querySelector('.footer');
  if (foot) out.push(foot);
  return out;
}

const move = (el, from, to) => el.animate([{ transform: `translateY(${from}px)` }, { transform: `translateY(${to}px)` }], { duration: MS, easing: EASE, fill: 'both' });

// `change` applies the open or close to the page, synchronously
export function openDrawer(li, change) {
  const before = li.offsetHeight;
  change();
  const grew = li.offsetHeight - before;
  const inner = li.querySelector('.detail > div');
  // anything that starts below the screen and only moves further down never shows, so it needs no layer
  const rows = below(li).filter((el) => el.getBoundingClientRect().top - grew < innerHeight);
  busy = true;
  const runs = [move(inner, -inner.offsetHeight, 0), ...rows.map((el) => move(el, -grew, 0))];
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(() => { runs.forEach((r) => r.cancel()); busy = false; });
}

// toTop: closing from the foot of a long report, so bring the row's head back into view on the way. Whatever would be
// left past the end of the shorter page has to come back too.
export function closeDrawer(li, change, { toTop = false } = {}) {
  const inner = li.querySelector('.detail > div');
  const detail = li.querySelector('.detail');
  const shrink = detail.getBoundingClientRect().height + parseFloat(getComputedStyle(detail).marginTop);
  const top = li.getBoundingClientRect().top;
  const headroom = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const pastEnd = scrollY - (document.documentElement.scrollHeight - shrink - innerHeight);
  const back = Math.max(toTop && top < 0 ? headroom - top : 0, pastEnd, 0);
  const rows = below(li).filter((el) => el.getBoundingClientRect().top - shrink + back < innerHeight);
  const page = back ? [document.querySelector('main'), document.querySelector('.footer')].filter(Boolean) : [];
  busy = true;
  li.classList.add('closing');
  const runs = [move(inner, 0, -inner.offsetHeight), ...rows.map((el) => move(el, 0, -shrink)), ...page.map((el) => move(el, 0, back))];
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(() => {
    change();
    li.classList.remove('closing');
    if (back) scrollBy({ top: -back, behavior: 'instant' });
    runs.forEach((r) => r.cancel());
    busy = false;
  });
}
