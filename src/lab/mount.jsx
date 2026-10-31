// How app.js puts the Nerd lab on its page: React renders straight into the page's main element (#app), synchronously,
// so the page's own entrance animations and view transitions see it. Returns the function that takes it down again,
// which app.js calls before it puts any other page there. The rest of the site is still plain JS, moving page by page.
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Lab } from './Lab.jsx';

export function mountLab(el, props) {
  const root = createRoot(el);
  flushSync(() => root.render(<StrictMode><Lab {...props} /></StrictMode>));
  return () => root.unmount();
}
