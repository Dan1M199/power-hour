// The admin portal's way in: the page itself (AdminPage.jsx) is its own chunk, downloaded only when someone opens #admin.
import { lazy, Suspense } from 'react';

const AdminPage = lazy(() => import('./AdminPage.jsx').then((m) => ({ default: m.AdminPage })));
// .adm-page scopes the desk's own flat look (styles.css)
export const AdminShell = (props) => <div className="adm-page"><Suspense fallback={null}><AdminPage {...props} /></Suspense></div>;
