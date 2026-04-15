import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { InboxShell } from "../components/inbox/inbox-shell";
import { DEFAULT_INBOX_VIEW_KEY, inboxViewKeys } from "../components/inbox/types";
import type { InboxViewKey } from "../components/inbox/types";
import { WorkspaceShell } from "../components/workspace/workspace-shell";
import { helpdeskApi } from "../lib/helpdesk";

const validViewKeys = new Set<InboxViewKey>(inboxViewKeys);

interface InboxPageProps {
  viewId?: string;
}

function coerceViewKey(viewId?: string): InboxViewKey {
  if (viewId && validViewKeys.has(viewId as InboxViewKey)) {
    return viewId as InboxViewKey;
  }
  return DEFAULT_INBOX_VIEW_KEY;
}

export default function InboxPage({ viewId }: InboxPageProps) {
  const [location, navigate] = useLocation();
  const routeView = coerceViewKey(viewId);
  const search = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const selectedConversationId = search.get("conversation");

  const navigationQuery = useQuery({
    queryKey: ["helpdesk", "inbox", "navigation"],
    queryFn: helpdeskApi.getNavigation,
  });

  const selectedView = navigationQuery.data?.views.some((view) => view.key === routeView)
    ? routeView
    : navigationQuery.data?.defaultViewKey ?? DEFAULT_INBOX_VIEW_KEY;

  const updateRoute = (view: InboxViewKey, conversationId?: string | null) => {
    const nextSearch = new URLSearchParams();
    if (conversationId) nextSearch.set("conversation", conversationId);
    const query = nextSearch.toString();
    navigate(`/inbox/${view}${query ? `?${query}` : ""}`);
  };

  return (
    <WorkspaceShell
      title="Inbox"
      subtitle="Three-pane support workspace with queue navigation, triage list, and active conversation detail."
      eyebrow="Support workspace / Inbox"
    >
      <div className="mb-4 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm xl:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Queue selection</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(navigationQuery.data?.views ?? []).map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => updateRoute(view.key, selectedConversationId)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                view.key === selectedView ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
              disabled={navigationQuery.isLoading}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <InboxShell
        views={navigationQuery.data?.views ?? []}
        navigationLoading={navigationQuery.isLoading}
        navigationError={navigationQuery.error instanceof Error ? navigationQuery.error.message : null}
        selectedView={selectedView}
        selectedConversationId={selectedConversationId}
        onSelectView={(view) => updateRoute(view, selectedConversationId)}
        onSelectConversation={(conversationId) => updateRoute(selectedView, conversationId)}
      />
    </WorkspaceShell>
  );
}
