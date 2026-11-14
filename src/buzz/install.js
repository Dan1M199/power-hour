// The site as a Home Screen app (Dan's request Nov 14), from what the browser says about how it's running:
//  - running from the Home Screen (iOS sets navigator.standalone; elsewhere display-mode: standalone) it's full screen
//    with no browser bar, and the Wire's unread count goes on the app icon itself through the Badging API
//    (navigator.setAppBadge: installed apps in Chrome and Edge; on iPhone, iOS 16.4+ only once notifications are
//    allowed, which the site never asks for, so there it quietly does nothing);
//  - in iPhone Safari, from a device's second day on the site (the streak), a sheet slides up once explaining the two
//    taps to add it (Safari has no install button a page can press); "Not now" holds it off for ten days;
//  - in Chrome and Edge the browser's own install offer (beforeinstallprompt) is kept and the same sheet's button
//    opens it.
// Off in the demo, the preview bundle and the headline desk.
import { haptic } from '../touch.js';

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* fine */ } };
const LATER_MS = 10 * 864e5;

export const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const iosSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
};

/** The app icon's badge: n unread, or cleared. Only where the site runs as an installed app. */
export function appBadge(n) {
  if (!standalone() || !('setAppBadge' in navigator)) return;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => { /* not allowed here */ });
}

let deferred = null;
/** Starts listening for the browser's install offer and, when it's time, shows the sheet. returning: a repeat visitor. */
export function initInstall({ returning, delay = 9000 }) {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', () => { deferred = null; put('ph-installed', '1'); document.querySelector('.bz-install')?.remove(); });
  if (standalone()) { put('ph-installed', '1'); return; }
  if (!returning || get('ph-installed') || Date.now() - Number(get('ph-install-later') || 0) < LATER_MS) return;
  setTimeout(() => {
    const root = document.documentElement.classList;
    if (root.contains('locked') || root.contains('admin-mode')) return; // a story, an overlay or the desk is up: next visit
    if (iosSafari()) sheet('ios');
    else if (deferred) sheet('prompt');
  }, delay);
}

const SHARE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function sheet(kind) {
  const el = document.createElement('aside');
  el.className = 'bz-install';
  el.setAttribute('aria-label', 'Add The Power Hour to your Home Screen');
  el.innerHTML = `
    <img class="bz-install-icon" src="assets/icon-192.png" alt="" width="64" height="64">
    <div class="bz-install-txt">
      <b>Add it to your Home Screen</b>
      <span>The Power Hour, full screen and one tap away, like an app${kind === 'prompt' ? ', with the Wire count on its icon' : ''}.</span>
      ${kind === 'ios' ? `<ol class="bz-install-steps"><li><i>${SHARE}</i>Tap Share in Safari's bar</li><li><i>${PLUS}</i>Then Add to Home Screen</li></ol>` : ''}
    </div>
    <div class="bz-install-btns">
      ${kind === 'prompt' ? '<button type="button" class="bz-install-go">Install</button>' : ''}
      <button type="button" class="bz-install-later">Not now</button>
    </div>`;
  document.body.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  const close = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 450); };
  el.querySelector('.bz-install-later').addEventListener('click', () => { put('ph-install-later', String(Date.now())); close(); });
  el.querySelector('.bz-install-go')?.addEventListener('click', async () => {
    haptic();
    const e = deferred;
    deferred = null;
    if (!e) return close();
    e.prompt();
    const { outcome } = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
    if (outcome !== 'accepted') put('ph-install-later', String(Date.now()));
    close();
  });
}
