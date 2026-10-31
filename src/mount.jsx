// How app.js puts a React page on the site: straight into the page's main element (#app), synchronously, so the page's
// own entrance animations and view transitions see it. Returns the function that takes it down again, which app.js
// calls before it puts any other page there. The rest of the site is still plain JS, moving to React page by page.
import { StrictMode, createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

export function mount(el, Page, props) {
  const root = createRoot(el);
  flushSync(() => root.render(<StrictMode>{createElement(Page, props)}</StrictMode>));
  return () => root.unmount();
}
