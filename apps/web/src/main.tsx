import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { GamePage } from './pages/GamePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { SubmitPage } from './pages/SubmitPage';
import { ErrorPage } from './pages/ErrorPage';
import { ReportPage } from './pages/ReportPage';
import { StatsPage } from './pages/StatsPage';
import { adminPath } from './admin-config';
import './styles.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <GamePage /> },
      { path: 'submit', element: <SubmitPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: adminPath.slice(1), element: <AdminPage /> },
      { path: 'report', element: <ReportPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
