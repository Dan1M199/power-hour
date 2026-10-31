// The way app.js puts the React team dashboard on its page (the rest of the site is still plain JS, moving to React
// one page at a time). Renders synchronously, so the page's own entrance animations and view transitions see it, and
// returns the function that takes it down again (app.js calls it before it replaces the page).
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { TeamDashboard } from './TeamDashboard.jsx';

export function mountTeamDashboard(el, props) {
  const root = createRoot(el);
  flushSync(() => root.render(<StrictMode><TeamDashboard {...props} /></StrictMode>));
  return () => root.unmount();
}
