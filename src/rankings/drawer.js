// Phones: a scouting report opens by the card's own foot sliding down and uncovering it, and everything under the card
// moves with the foot, on transforms only. The foot is moved up inside its window while the report is counter-moved so it
// holds still, all on one clock. The page's layout changes once, in one go, so a long report can't stutter or reflow.

const MS = 620;
const EASE = 'cubic-bezier(0.42, 0, 0.12, 1)'; // a soft start, so you see the foot begin to move, and a soft landing
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
  change();
  const foot = li.querySelector('.detail > div');
  const body = li.querySelector('.detail-body');
  const d = body.offsetHeight;
  // anything that starts below the screen and only moves further down never shows, so it needs no layer
  const rows = below(li).filter((el) => el.getBoundingClientRect().top - d < innerHeight);
  busy = true;
  const runs = [move(foot, -d, 0), move(body, d, 0), ...rows.map((el) => move(el, -d, 0))];
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(() => { runs.forEach((r) => r.cancel()); busy = false; });
}

// toTop: closing from the foot of a long report, so bring the row's head back into view on the way. Whatever would be
// left past the end of the shorter page has to come back too.
export function closeDrawer(li, change, { toTop = false } = {}) {
  const foot = li.querySelector('.detail > div');
  const body = li.querySelector('.detail-body');
  const d = body.offsetHeight;
  const top = li.getBoundingClientRect().top;
  const headroom = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const pastEnd = scrollY - (document.documentElement.scrollHeight - d - innerHeight);
  const back = Math.max(toTop && top < 0 ? headroom - top : 0, pastEnd, 0);
  const rows = below(li).filter((el) => el.getBoundingClientRect().top - d + back < innerHeight);
  const page = back ? [document.querySelector('main'), document.querySelector('.footer')].filter(Boolean) : [];
  busy = true;
  li.classList.add('closing');
  const runs = [move(foot, 0, -d), move(body, 0, d), ...rows.map((el) => move(el, 0, -d)), ...page.map((el) => move(el, 0, back))];
  Promise.all(runs.map((r) => r.finished)).catch(() => {}).finally(() => {
    change();
    li.classList.remove('closing');
    if (back) scrollBy({ top: -back, behavior: 'instant' });
    runs.forEach((r) => r.cancel());
    busy = false;
  });
}
