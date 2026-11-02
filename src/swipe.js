// Swiping around the site. A sideways swipe anywhere on a page moves to the next stop (the tabs, with the Lab's three
// sections counted separately): the page's cards follow the finger over the still field, each a little behind the one
// above it, the amber tab bead slides along in the header, and a glass tag comes in from the edge with the next stop's
// name, turning amber once letting go would commit. A swipe on a deck (src/deck.jsx) or the headline carousel moves that
// first, and only when it's at its end does the swipe go to the page. A swipe on an opened ranking row goes to the next
// team. It's all one gesture, so the three never fight. On a mouse, a trackpad's two-finger swipe moves between stops.
//
// Sideways drags are ours because main is touch-action: pan-y, so the browser keeps vertical scrolling and pinch zoom, and
// cancels the pointer the moment it claims one. Tables that scroll sideways keep scrolling: a swipe starting in one
// stays out of this. So does one starting within 18px of the window's edge, which is iPhone Safari's own back gesture.
import { deckStops } from './deck.jsx';

const COMMIT = 0.28; // of the window's width
const FLICK = 0.45; // px per ms
const HINT = 'ph-swiped';

export function initSwipe({ stops, here, go, inkAt, inkDone, phone, calm }) {
  const main = document.querySelector('main'), root = document.documentElement;
  if (!main) return { pageChanging() {} };
  const peek = document.createElement('div');
  peek.id = 'swipe-peek';
  peek.setAttribute('aria-hidden', 'true');
  peek.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12"><path d="M4 1.5 8.5 6 4 10.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><b></b>';
  document.body.append(peek);
  const peekText = peek.querySelector('b');

  const showPeek = (dir, text, p) => {
    if (peekText.textContent !== text) peekText.textContent = text;
    peek.className = `show ${dir < 0 ? 'right' : 'left'}${p >= 1 ? ' armed' : ''}`;
    peek.style.setProperty('--p', Math.min(1, p).toFixed(3));
  };
  const hidePeek = () => { peek.classList.remove('show', 'armed'); };

  // the page itself
  const setX = (x) => main.style.setProperty('--sx', `${x.toFixed(1)}px`);
  const clearPage = () => { main.classList.remove('swiping', 'settling'); main.style.removeProperty('--sx'); };
  let busy = false;
  const neighbour = (dir) => { const list = stops(), i = here(); return i < 0 ? null : list[i - dir] ?? null; }; // dir -1 is a swipe to the left: the next stop
  const dragPage = (dx, W, gain = 1) => {
    const dir = Math.sign(dx) || -1, stop = neighbour(dir), p = Math.abs(dx) / (W * COMMIT);
    main.classList.add('swiping');
    setX(stop ? dx * gain : dx * 0.28); // nothing that way: a rubber band
    if (stop) { showPeek(dir, stop.label, p); inkAt(here(), here() - dir, Math.min(1, Math.abs(dx) / W)); } else hidePeek();
    if (stop && p >= 1 && !dragPage.armed) { dragPage.armed = true; navigator.vibrate?.(8); }
    if (p < 1) dragPage.armed = false;
  };
  const release = () => {
    main.classList.add('settling');
    setX(0);
    hidePeek();
    inkDone();
    setTimeout(clearPage, 280);
  };
  const commitPage = (dir, W) => {
    const stop = neighbour(dir);
    hidePeek();
    try { localStorage.setItem(HINT, '1'); } catch { /* fine */ }
    if (calm()) { clearPage(); go(stop); return; }
    busy = true;
    main.classList.add('settling');
    setX(dir * W * 1.05);
    setTimeout(() => {
      main.classList.remove('settling');
      setX(-dir * W * 0.9); // the new page waits off the other side
      addEventListener('hashchange', () => requestAnimationFrame(() => requestAnimationFrame(() => {
        main.classList.add('settling');
        setX(0);
        setTimeout(() => { clearPage(); busy = false; }, 300);
      })), { once: true });
      go(stop);
    }, 190);
  };

  // what a sideways drag moves, decided once the finger has shown its direction
  const deckOf = (t) => {
    const d = t.closest?.('.deck, .car-track');
    if (!d || d.scrollWidth <= d.clientWidth + 2) return null;
    return d.matches('.deck') && !phone() ? null : d;
  };
  const canScroll = (el, dir) => (dir < 0 ? el.scrollLeft + el.clientWidth < el.scrollWidth - 2 : el.scrollLeft > 2);
  const sideScroller = (t) => {
    for (let n = t; n && n !== main; n = n.parentElement) {
      if (n.matches('.deck, .car-track')) continue;
      if (n.scrollWidth > n.clientWidth + 1) { const o = getComputedStyle(n).overflowX; if (o === 'auto' || o === 'scroll') return true; }
    }
    return false;
  };
  const stepRow = (li, dir) => (dir < 0 ? li.nextElementSibling : li.previousElementSibling);

  let s = null;
  main.addEventListener('pointerdown', (e) => {
    s = null;
    if (e.pointerType !== 'touch' || !e.isPrimary || busy || root.classList.contains('locked')) return;
    const W = innerWidth;
    if (e.clientX < 18 || e.clientX > W - 18) return;
    const t = e.target;
    if (t.closest('input, select, textarea, [data-noswipe]') || sideScroller(t)) return;
    s = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: e.timeStamp, v: 0, target: t, mode: null, W };
  }, { passive: true });

  main.addEventListener('pointermove', (e) => {
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    const dt = e.timeStamp - s.t;
    if (dt > 0) { s.v = 0.7 * ((e.clientX - s.x) / dt) + 0.3 * s.v; s.x = e.clientX; s.t = e.timeStamp; }
    if (!s.mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx) * 0.8) { s = null; return; }
      const dir = Math.sign(dx), deck = deckOf(s.target), row = s.target.closest('.rank.open');
      if (deck && canScroll(deck, dir)) {
        s.mode = 'deck'; s.deck = deck; s.left = deck.scrollLeft; s.stops = deckStops(deck);
        deck.classList.add('dragging');
      } else if (row) {
        s.mode = 'row'; s.row = row; s.card = row.querySelector('.rank-card');
      } else s.mode = 'page';
      s.x0 = e.clientX; // no jump at the moment it locks
    }
    const d = e.clientX - s.x0;
    if (s.mode === 'deck') s.deck.scrollLeft = s.left - d;
    else if (s.mode === 'page') dragPage(d, s.W);
    else {
      const dir = Math.sign(d) || -1, next = stepRow(s.row, dir), p = Math.abs(d) / (s.W * COMMIT);
      s.card.style.transform = `translateX(${(next ? d * 0.7 : d * 0.2).toFixed(1)}px)`;
      if (next) showPeek(dir, `No. ${next.querySelector('.jersey').textContent}, ${next.querySelector('.name').textContent}`, p); else hidePeek();
    }
  }, { passive: true });

  const up = (e, cancelled) => {
    if (!s || e.pointerId !== s.id) return;
    const { mode, v } = s, d = s.x - s.x0, W = s.W;
    const dir = Math.sign(d) || -1, flicked = Math.abs(v) > FLICK && Math.sign(v) === dir && Math.abs(d) > 30;
    const go2 = !cancelled && (Math.abs(d) > W * COMMIT || flicked);
    if (mode === 'deck') {
      const deck = s.deck, st = s.stops;
      let k = 0;
      st.forEach((x, i) => { if (Math.abs(x - s.left) < Math.abs(st[k] - s.left)) k = i; });
      if (!cancelled && (flicked || Math.abs(d) > deck.clientWidth * 0.14)) k = Math.max(0, Math.min(st.length - 1, k - dir));
      deck.scrollTo({ left: st[k], behavior: calm() ? 'auto' : 'smooth' });
      setTimeout(() => deck.classList.remove('dragging'), 420);
    } else if (mode === 'page') {
      if (go2 && neighbour(dir)) commitPage(dir, W); else release();
    } else if (mode === 'row') {
      const next = stepRow(s.row, dir), card = s.card;
      hidePeek();
      card.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
      card.style.transform = '';
      setTimeout(() => { card.style.transition = ''; }, 260);
      if (go2 && next) { card.style.transition = ''; s.row.querySelector(dir < 0 ? '.step-next' : '.step-prev')?.click(); }
    }
    if (mode) { // a drag that ends on a button isn't a tap on it
      const stop = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
      main.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => main.removeEventListener('click', stop, { capture: true }), 60);
    }
    s = null;
  };
  main.addEventListener('pointerup', (e) => up(e, false), { passive: true });
  main.addEventListener('pointercancel', (e) => up(e, true), { passive: true });

  // a trackpad's two-finger swipe, where the browser leaves it to us (overscroll-behavior-x on html)
  let wx = 0, wheelTimer = 0, cool = 0, wheelCommit = false;
  const wheelEnd = () => {
    const W = innerWidth, dir = Math.sign(wx) || -1, far = Math.abs(wx) > Math.min(240, W * 0.2);
    if (far && neighbour(dir)) {
      cool = performance.now() + 900;
      hidePeek();
      wheelCommit = true;
      go(neighbour(dir));
    } else release();
    wx = 0;
  };
  main.addEventListener('wheel', (e) => {
    if (phone() || performance.now() < cool || e.ctrlKey || root.classList.contains('locked')) return;
    if (!wx && Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.5) return;
    if (!wx && Math.abs(e.deltaX) < 3) return;
    if (sideScroller(e.target) || e.target.closest('.car-track')) return;
    wx -= e.deltaX;
    dragPage(wx * 0.75, innerWidth * 0.72, 1);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(wheelEnd, 90);
  }, { passive: true });

  return {
    // route() calls this as the new page renders: a trackpad swipe's view transition has its old picture by then
    pageChanging() { if (wheelCommit) { wheelCommit = false; clearPage(); } },
    // once per device, on a phone: the page shows that it moves, with the next stop's tag beside it
    hint() {
      let done = false;
      try { done = !!localStorage.getItem(HINT); } catch { /* fine */ }
      if (done || calm() || !phone()) return;
      setTimeout(() => {
        const stop = neighbour(-1);
        if (!stop || s || busy || scrollY > 60 || root.classList.contains('locked')) return;
        try { localStorage.setItem(HINT, '1'); } catch { /* fine */ }
        main.classList.add('swiping', 'settling');
        setX(-54);
        showPeek(-1, stop.label, 0.72);
        setTimeout(() => { hidePeek(); setX(0); setTimeout(clearPage, 300); }, 950);
      }, 1800);
    },
  };
}
