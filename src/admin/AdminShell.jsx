// The admin portal's way in: the page itself (AdminPage.jsx) is its own chunk, downloaded only when someone opens #admin.
import { lazy, Suspense } from 'react';

const AdminPage = lazy(() => import('./AdminPage.jsx').then((m) => ({ default: m.AdminPage })));
export const AdminShell = (props) => <Suspense fallback={null}><AdminPage {...props} /></Suspense>;
