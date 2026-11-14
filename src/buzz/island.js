// The black island (2.4): a pill that drops out of the top of the screen like a phone's Dynamic Island, says one thing
// and tucks back. Notes queue, so the streak, the "since you last looked" recap and "new scores are in" never stack on
// top of each other. A note can carry an action: then a tap does it (and the note stays up longer); otherwise a tap
// tucks it away. Plain DOM on <body>; transform and opacity only.
import { haptic } from '../touch.js';

const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const queue = [];
let showing = false;

/**
 * icon: inline SVG markup; big, small: the two lines; n: a number on a yellow pill at the end; gold: the milestone
 * look; action: { label, run } turns the note into a button; ms: how long it stays; onShow: runs as it drops in.
 */
export function island(note) {
  queue.push(note);
  if (!showing) next();
}

function next() {
  const note = queue.shift();
  if (!note) { showing = false; return; }
  showing = true;
  const { icon = '', big, small = '', n = null, gold = false, action = null, ms = action ? 7000 : 4200, onShow } = note;
  const el = document.createElement(action ? 'button' : 'div');
  if (action) el.type = 'button';
  el.className = `bz-island${gold ? ' gold' : ''}${action ? ' act' : ''}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="bz-island-flame">${icon}</span><span class="bz-island-txt"><b>${esc(big)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span>`
    + (n != null ? `<span class="bz-island-n">${esc(n)}</span>` : '')
    + (action ? `<span class="bz-island-go">${esc(action.label)}</span>` : '');
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  onShow?.();
  let gone = false;
  const tuck = () => {
    if (gone) return;
    gone = true;
    el.classList.remove('on');
    setTimeout(() => { el.remove(); setTimeout(next, 250); }, calm() ? 0 : 520);
  };
  el.addEventListener('click', () => { if (action) { haptic(); action.run(); } tuck(); });
  setTimeout(tuck, ms);
}
