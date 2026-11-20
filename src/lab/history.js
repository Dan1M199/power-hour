// The What if tool's extra data (api/history.js): the draft board and every finished week's points, fetched the first
// time the section opens and kept for the visit. The demo has none (window.__HISTORY__ stands in for tests).
import { createStore } from '../store.js';
import { morningKey } from '../../lib/newsclock.js';

// null while loading, then { body } (body null when there's nothing to read) or { body: null, error }
export const historyStore = createStore(null);
let asked = false;

export function loadHistory({ demo }) {
  if (asked) return;
  asked = true;
  if (demo) { historyStore.set({ body: window.__HISTORY__ || null, demo: true }); return; }
  fetch(`/api/history?d=${morningKey()}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} from the history`))))
    .then((body) => historyStore.set({ body }))
    .catch((e) => { asked = false; historyStore.set({ body: null, error: String(e.message || e) }); });
}
