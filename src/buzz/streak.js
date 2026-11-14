// The streak note (Dan's request Nov 14): the first time a device opens the site on a new day (the site's day turns at
// 6am Central), a black island drops out of the top of the screen with a flame and the count, the way a phone's
// Dynamic Island shows a live activity, then tucks back after a few seconds (a tap tucks it at once). Milestone days
// (3, 7, 14, 30, ...) get a gold flame and a shower of confetti; a broken run says so, gently, once. The count itself
// lives on the Stories rail (src/buzz/Stories.jsx). The island itself is src/buzz/island.js.
import { streak } from './seen.js';
import { haptic } from '../touch.js';
import { island } from './island.js';

const FLAME = '<svg class="bz-flame" viewBox="0 0 24 24" aria-hidden="true"><path class="fl-out" d="M12 1.6c.7 3.7 6.1 6.3 6.1 12.1a6.1 6.1 0 0 1-12.2 0c0-3.1 1.7-5.2 3.3-6.5.1 2.1 1 3.3 2.1 3.8-.4-3.6-.1-6.5.7-9.4z"/><path class="fl-in" d="M12.2 11.4c.4 1.9 3 3.1 3 5.9a3.2 3.2 0 0 1-6.4 0c0-1.5.8-2.6 1.6-3.2.1 1 .5 1.6 1 1.9-.1-1.7.2-3.2.8-4.6z"/></svg>';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function words(s) {
  if (s.milestone) return [`${s.n}-day streak`, s.n >= 14 ? 'Certified league junkie. The commissioner sees you.' : `${s.n} mornings in a row. Don't break it now.`];
  if (s.lost) return ['Day 1', `Your ${s.lost}-day streak ended. Start a new one tomorrow.`];
  if (s.n === 1) return ['Day 1', 'Come back tomorrow to start a streak.'];
  return [`${s.n}-day streak`, `Back tomorrow makes it ${s.n + 1}.`];
}

/** Shows today's note once a day, a beat after the page has settled. */
export function streakNote({ delay = 900 } = {}) {
  const s = streak();
  if (!s.fresh) return;
  setTimeout(() => {
    const [big, small] = words(s);
    island({
      icon: FLAME, big, small, n: s.n > 1 ? s.n : null, gold: !!s.milestone, ms: s.milestone ? 5200 : 4200,
      onShow: () => { if (s.milestone) { haptic(); confetti(); } },
    });
  }, delay);
}

// confetti in the field's colours, falling from the island; transform and opacity only
function confetti() {
  if (calm()) return;
  const COLORS = ['#FFE01A', '#F9B000', '#BFD02A', '#3E9F46', '#8ED6F8', '#FFFFFF'];
  const box = document.createElement('div');
  box.className = 'bz-confetti';
  box.setAttribute('aria-hidden', 'true');
  document.body.append(box);
  const runs = [];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement('i');
    p.style.background = COLORS[i % COLORS.length];
    if (i % 4 === 0) p.style.borderRadius = '50%';
    box.append(p);
    const x = (Math.random() - 0.5) * Math.min(innerWidth, 700), y = innerHeight * (0.45 + Math.random() * 0.5), r = (Math.random() - 0.5) * 900;
    runs.push(p.animate([
      { transform: 'translate(-50%, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${x * 0.6}px), ${y * 0.35}px) rotate(${r * 0.4}deg)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${r}deg)`, opacity: 0 },
    ], { duration: 1800 + Math.random() * 1000, delay: Math.random() * 250, easing: 'cubic-bezier(0.15, 0.6, 0.4, 1)', fill: 'backwards' }).finished);
  }
  Promise.allSettled(runs).then(() => box.remove());
}
