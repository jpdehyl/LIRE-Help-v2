import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus } from "lucide-react";
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
  const filterPropertyId = search.get("propertyId") ?? null;

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
    if (filterPropertyId) nextSearch.set("propertyId", filterPropertyId);
    const query = nextSearch.toString();
    navigate(`/inbox/${view}${query ? `?${query}` : ""}`);
  };

  const actions = (
    <button
      type="button"
      className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-accent px-2.5 font-body text-[12px] font-medium text-accent-ink transition-opacity ease-ds duration-fast hover:opacity-90"
    >
      <Plus className="h-3.5 w-3.5" />
      New ticket
    </button>
  );

  const selectedViewLabel =
    navigationQuery.data?.views.find((view) => view.key === selectedView)?.label ?? "Inbox";

  return (
    <WorkspaceShell title={selectedViewLabel} eyebrow="Operations / Inbox" actions={actions}>
      <InboxShell
        views={navigationQuery.data?.views ?? []}
        navigationLoading={navigationQuery.isLoading}
        navigationError={navigationQuery.error instanceof Error ? navigationQuery.error.message : null}
        selectedView={selectedView}
        selectedConversationId={selectedConversationId}
        filterPropertyId={filterPropertyId}
        onSelectView={(view) => updateRoute(view, selectedConversationId)}
        onSelectConversation={(conversationId) => updateRoute(selectedView, conversationId)}
      />
    </WorkspaceShell>
  );
}
