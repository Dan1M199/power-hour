// How app.js puts a page on the site: one React root on the page's main element (#app), rendered synchronously on each
// route, so the page's own entrance animations and view transitions see the new page at once. Each route gets a fresh
// key, so a page always mounts anew (its lasting state lives in app.js's state objects and the stores).
import { StrictMode, createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

export function pageRoot(el) {
  el.replaceChildren(); // the loader (index.html) goes; React owns the element from here
  const root = createRoot(el);
  let n = 0;
  return (Page, props) => flushSync(() => root.render(<StrictMode>{createElement(Page, { ...props, key: ++n })}</StrictMode>));
}
