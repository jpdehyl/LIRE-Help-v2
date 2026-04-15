import { useMemo } from "react";
import { useLocation } from "wouter";
import { InboxShell } from "../components/inbox/inbox-shell";
import { inboxScaffoldData } from "../components/inbox/mock-data";
import type { InboxViewKey } from "../components/inbox/types";
import { WorkspaceShell } from "../components/workspace/workspace-shell";

const validViewKeys = new Set<InboxViewKey>(inboxScaffoldData.views.map((view) => view.key));

interface InboxPageProps {
  viewId?: string;
}

function coerceViewKey(viewId?: string): InboxViewKey {
  if (viewId && validViewKeys.has(viewId as InboxViewKey)) {
    return viewId as InboxViewKey;
  }
  return "all";
}

export default function InboxPage({ viewId }: InboxPageProps) {
  const [location, navigate] = useLocation();
  const selectedView = coerceViewKey(viewId);
  const search = useMemo(() => new URLSearchParams(window.location.search), [location]);
  const selectedConversationId = search.get("conversation");

  const updateRoute = (view: InboxViewKey, conversationId?: string | null) => {
    const nextSearch = new URLSearchParams();
    if (conversationId) nextSearch.set("conversation", conversationId);
    const query = nextSearch.toString();
    navigate(`/inbox/${view}${query ? `?${query}` : ""}`);
  };

  return (
    <WorkspaceShell
      title="Inbox"
      subtitle="Three-pane operator workspace scaffold with queue navigation, triage list, and active conversation detail."
      eyebrow="LIRE Help workspace / Inbox"
    >
      <div className="mb-4 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm xl:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Queue selection</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {inboxScaffoldData.views.map((view) => (
            <button
              key={view.key}
              type="button"
              onClick={() => updateRoute(view.key, selectedConversationId)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                view.key === selectedView ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      <InboxShell
        selectedView={selectedView}
        selectedConversationId={selectedConversationId}
        onSelectView={(view) => updateRoute(view, selectedConversationId)}
        onSelectConversation={(conversationId) => updateRoute(selectedView, conversationId)}
      />
    </WorkspaceShell>
  );
}
