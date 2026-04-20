import type { ReactNode } from "react";
import { Redirect, Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "./lib/auth";
import DashboardPage from "./pages/dashboard";
import InboxPage from "./pages/inbox";
import LandingPage from "./pages/landing";
import LoginPage from "./pages/login";
import PlatformDashboard from "./pages/platform-dashboard";
import TenantsPage from "./pages/tenants";
import ConciergePage from "./pages/concierge";
import SettingsPage from "./pages/settings";
import SettingsGeneralPage from "./pages/settings-general";
import SettingsChannelsEmailPage from "./pages/settings-channels-email";
import SettingsInboxesPage from "./pages/settings-inboxes";
import SettingsWorkflowsPage from "./pages/settings-workflows";
import SettingsPlaceholderPage from "./pages/settings-placeholder";
import SettingsAiAutomationPage from "./pages/settings-ai-automation";
import LeasingPage from "./pages/leasing";
import CreditReviewPage from "./pages/credit-review";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg font-body text-fg-muted">
      Loading…
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;

  return <>{children}</>;
}

type SettingsStub = {
  path: string;
  title: string;
  description: string;
};

// Section landing pages (left subnav targets).
const settingsSectionStubs: readonly SettingsStub[] = [
  {
    path: "/settings/workspace",
    title: "Workspace",
    description:
      "Workspace name, teammates, brands, and security posture. The subpages in this section will hold the core tenant configuration operators edit day-to-day.",
  },
  {
    path: "/settings/subscription",
    title: "Subscription",
    description:
      "Plan, billing, invoices, and usage alerts. This section will show the current plan and let finance admins adjust limits once billing is wired up.",
  },
  {
    path: "/settings/channels",
    title: "Channels",
    description:
      "Inbound and outbound surfaces — Messenger, Email, Phone, WhatsApp, Switch, Slack. Each channel gets its own setup flow and inbox mapping.",
  },
  {
    path: "/settings/ai-automation",
    title: "AI & Automation",
    description:
      "Fin-style AI agents, suggested replies, resolution bots, and trigger-based workflows. This surface will govern which conversations are eligible for automation.",
  },
  {
    path: "/settings/integrations",
    title: "Integrations",
    description:
      "Connect LIRE to third-party tools — CRM, property systems, Slack, Zapier, webhooks, and internal APIs. OAuth apps and API keys will be managed here.",
  },
  {
    path: "/settings/data",
    title: "Data",
    description:
      "People and company attributes, events, tags, and data retention. Export and import controls for regulated data live here too.",
  },
  {
    path: "/settings/help-center",
    title: "Help Center",
    description:
      "Public knowledge base configuration — collections, articles, branding, domain, and localization. Article authoring lives in the Help Center app itself.",
  },
  {
    path: "/settings/outbound",
    title: "Outbound",
    description:
      "Proactive messages, tours, surveys, and campaigns. Use this section to configure sending identities, throttles, and audience defaults.",
  },
  {
    path: "/settings/personal",
    title: "Personal",
    description:
      "Your personal preferences — profile, notifications, appearance, keyboard shortcuts, and sessions. Changes here only affect your account.",
  },
];

// Home tile deep-links. Each tile on /settings points to one of these.
const settingsTileStubs: readonly SettingsStub[] = [
  {
    path: "/settings/workspace/teammates",
    title: "Teammates",
    description: "Manage or invite teammates and see all activity logs.",
  },
  {
    path: "/settings/workspace/office-hours",
    title: "Office hours",
    description: "Choose your office hours to manage tenant expectations.",
  },
  {
    path: "/settings/workspace/brands",
    title: "Brands",
    description: "Set up and manage your brands.",
  },
  {
    path: "/settings/workspace/security",
    title: "Security",
    description: "Configure all security settings for your workspace and data.",
  },
  {
    path: "/settings/workspace/multilingual",
    title: "Multilingual",
    description: "Set up and manage your multilingual settings.",
  },
  {
    path: "/settings/subscription/billing",
    title: "Billing",
    description: "Manage your subscription and payment details.",
  },
  {
    path: "/settings/subscription/usage",
    title: "Usage",
    description: "View your billed usage and set usage alerts and limits.",
  },
  {
    path: "/settings/channels/messenger",
    title: "Messenger",
    description: "Install and customize your messenger on web and mobile.",
  },
  {
    path: "/settings/channels/phone",
    title: "Phone",
    description: "Set up and manage phone and messenger calls.",
  },
  {
    path: "/settings/channels/whatsapp",
    title: "WhatsApp",
    description: "Install and configure WhatsApp messages from your inbox.",
  },
  {
    path: "/settings/channels/switch",
    title: "Switch",
    description: "Move tenants from phone to chat conversations.",
  },
  {
    path: "/settings/channels/slack",
    title: "Slack",
    description: "Install and configure Slack messages from your inbox.",
  },
];

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Switch>
      <Route path="/" component={LandingPage} />

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
      <Route path="/tenants">
        <RequireAuth>
          <TenantsPage />
        </RequireAuth>
      </Route>
      <Route path="/customers">
        <Redirect to="/tenants" />
      </Route>
      <Route path="/concierge">
        <RequireAuth>
          <ConciergePage />
        </RequireAuth>
      </Route>

      {/* Settings: section landing pages and per-tile deep links. Order matters — */}
      {/* more specific paths come before /settings so wouter's Switch picks them first. */}
      <Route path="/settings/workspace/general">
        <RequireAuth>
          <SettingsGeneralPage />
        </RequireAuth>
      </Route>
      <Route path="/settings/channels/email">
        <RequireAuth>
          <SettingsChannelsEmailPage />
        </RequireAuth>
      </Route>
      <Route path="/settings/inboxes">
        <RequireAuth>
          <SettingsInboxesPage />
        </RequireAuth>
      </Route>
      <Route path="/settings/workflows">
        <RequireAuth>
          <SettingsWorkflowsPage />
        </RequireAuth>
      </Route>
      <Route path="/settings/ai-automation">
        <RequireAuth>
          <SettingsAiAutomationPage />
        </RequireAuth>
      </Route>
      {settingsTileStubs.map((stub) => (
        <Route key={stub.path} path={stub.path}>
          <RequireAuth>
            <SettingsPlaceholderPage title={stub.title} description={stub.description} />
          </RequireAuth>
        </Route>
      ))}
      {settingsSectionStubs.map((stub) => (
        <Route key={stub.path} path={stub.path}>
          <RequireAuth>
            <SettingsPlaceholderPage title={stub.title} description={stub.description} />
          </RequireAuth>
        </Route>
      ))}
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
        <Redirect to="/" />
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
