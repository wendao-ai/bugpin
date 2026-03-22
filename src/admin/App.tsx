import React, { Suspense, lazy, type ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Spinner } from './components/ui/spinner';

// Wrapper around React.lazy that reloads the page once when a chunk fails to load.
// This handles stale tabs after deployments where old chunk filenames no longer exist.
function lazyWithRetry(
  factory: () => Promise<{ default: ComponentType }>,
): React.LazyExoticComponent<ComponentType> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      const isChunkError =
        error instanceof Error &&
        (error.message.includes('dynamically imported module') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('Loading chunk'));

      if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        return new Promise(() => {}); // Never resolves — page is reloading
      }

      sessionStorage.removeItem('chunk_reload');
      throw error;
    }),
  );
}

// Lazy load pages for code splitting
const Login = lazyWithRetry(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Dashboard = lazyWithRetry(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const Reports = lazyWithRetry(() =>
  import('./pages/Reports').then((m) => ({ default: m.Reports })),
);
const ReportDetail = lazyWithRetry(() =>
  import('./pages/ReportDetail').then((m) => ({ default: m.ReportDetail })),
);
const Projects = lazyWithRetry(() =>
  import('./pages/Projects').then((m) => ({ default: m.Projects })),
);
const Settings = lazyWithRetry(() =>
  import('./pages/globalsettings').then((m) => ({ default: m.Settings })),
);
const TestWidgetPage = lazyWithRetry(() =>
  import('./pages/TestWidgetPage').then((m) => ({ default: m.TestWidgetPage })),
);
const AcceptInvitation = lazyWithRetry(() =>
  import('./pages/AcceptInvitation').then((m) => ({ default: m.AcceptInvitation })),
);

// Loading component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" className="text-primary" />
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Admin-only route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { user } = useAuth();

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log errors in production - could be sent to error tracking service
        console.error('[App Error]', error.message, errorInfo.componentStack);
      }}
    >
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
          <Route path="/test-widget" element={<TestWidgetPage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/:id" element={<ReportDetail />} />
            <Route
              path="projects"
              element={
                <AdminRoute>
                  <Projects />
                </AdminRoute>
              }
            />
            <Route
              path="globalsettings"
              element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              }
            />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
