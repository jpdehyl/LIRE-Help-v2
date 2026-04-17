import type { ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "./lib/auth";
import DashboardPage from "./pages/dashboard";
import InboxPage from "./pages/inbox";
import LoginPage from "./pages/login";
import PlatformDashboard from "./pages/platform-dashboard";
import TicketsPage from "./pages/tickets";
import CustomersPage from "./pages/customers";
import SettingsPage from "./pages/settings";
import LeasingPage from "./pages/leasing";
import CreditReviewPage from "./pages/credit-review";

function LoadingScreen() {
  return <div className="flex min-h-screen items-center justify-center text-slate-400 dark:text-slate-500">Loading...</div>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/dashboard" /> : <LoginPage />}
      </Route>

      {/* Phase 1 workspace route group: shell-backed operator surfaces */}
      <Route path="/dashboard">
        <RequireAuth>
          <DashboardPage />
        </RequireAuth>
      </Route>
      <Route path="/inbox/:viewId">
        {(params) => (
          <RequireAuth>
            <InboxPage viewId={params.viewId} />
          </RequireAuth>
        )}
      </Route>
      <Route path="/inbox">
        <RequireAuth>
          <InboxPage />
        </RequireAuth>
      </Route>
      <Route path="/tickets">
        <RequireAuth>
          <TicketsPage />
        </RequireAuth>
      </Route>
      <Route path="/customers">
        <RequireAuth>
          <CustomersPage />
        </RequireAuth>
      </Route>
      <Route path="/settings">
        <RequireAuth>
          <SettingsPage />
        </RequireAuth>
      </Route>

      {/* Berkeley pilots */}
      <Route path="/leasing">
        <RequireAuth>
          <LeasingPage />
        </RequireAuth>
      </Route>
      <Route path="/credit-review">
        <RequireAuth>
          <CreditReviewPage />
        </RequireAuth>
      </Route>

      {/* Legacy platform admin preserved during redesign */}
      <Route path="/platform-dashboard">
        <RequireAuth>
          <PlatformDashboard />
        </RequireAuth>
      </Route>

      <Route>
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
