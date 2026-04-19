import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InboxViewDefinition, InboxViewKey } from "./types";
import { InboxSidebar } from "./inbox-sidebar";
import { ConversationList } from "./conversation-list";
import { ConversationDetailPane } from "./conversation-detail";
import { helpdeskApi } from "../../lib/helpdesk";
import { ErrorState, Skeleton, SkeletonRow } from "../ui";

interface InboxShellProps {
  views: InboxViewDefinition[];
  navigationLoading: boolean;
  navigationError: string | null;
  selectedView: InboxViewKey;
  selectedConversationId: string | null;
  filterPropertyId?: string | null;
  onSelectView: (view: InboxViewKey) => void;
  onSelectConversation: (conversationId: string) => void;
}

export function InboxShell({
  views,
  navigationLoading,
  navigationError,
  selectedView,
  selectedConversationId,
  filterPropertyId,
  onSelectView,
  onSelectConversation,
}: InboxShellProps) {
  const queryClient = useQueryClient();
  const fallbackView = views.find((view) => view.key === selectedView) ?? views[0];

  const conversationsQuery = useQuery({
    queryKey: ["helpdesk", "inbox", "conversations", fallbackView?.key ?? selectedView, filterPropertyId ?? ""],
    queryFn: () => helpdeskApi.getConversations(fallbackView?.key ?? selectedView, filterPropertyId),
    enabled: Boolean(fallbackView),
  });

  const conversations = conversationsQuery.data?.conversations ?? [];
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0],
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    if (activeConversation && activeConversation.id !== selectedConversationId) {
      onSelectConversation(activeConversation.id);
    }
  }, [activeConversation, onSelectConversation, selectedConversationId]);

  useEffect(() => {
    if (conversations.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key;
      const navigate = (delta: number) => {
        const currentIndex = conversations.findIndex((c) => c.id === activeConversation?.id);
        const base = currentIndex === -1 ? 0 : currentIndex;
        const next = Math.min(Math.max(base + delta, 0), conversations.length - 1);
        if (next !== currentIndex) {
          onSelectConversation(conversations[next].id);
        }
      };

      if (key === "j" || key === "ArrowDown") {
        event.preventDefault();
        navigate(1);
      } else if (key === "k" || key === "ArrowUp") {
        event.preventDefault();
        navigate(-1);
      } else if (key === "g") {
        event.preventDefault();
        onSelectConversation(conversations[0].id);
      } else if (key === "G") {
        event.preventDefault();
        onSelectConversation(conversations[conversations.length - 1].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [conversations, activeConversation?.id, onSelectConversation]);

  const detailQuery = useQuery({
    queryKey: ["helpdesk", "inbox", "conversation", activeConversation?.id],
    queryFn: () => helpdeskApi.getConversationDetail(activeConversation!.id),
    enabled: Boolean(activeConversation?.id),
  });

  const invalidateHelpdesk = async () => {
    await queryClient.invalidateQueries({ queryKey: ["helpdesk"] });
  };

  const loading = navigationLoading || conversationsQuery.isLoading;
  const error =
    navigationError ??
    (conversationsQuery.error instanceof Error ? conversationsQuery.error.message : null) ??
    (detailQuery.error instanceof Error ? detailQuery.error.message : null);

  return (
    <div className="flex h-[calc(100vh-3.5rem-2.5rem)] min-h-[560px] min-w-0 border border-border bg-surface">
      <div className="hidden xl:block">
        <InboxSidebar views={views} selectedView={fallbackView?.key ?? selectedView} onSelectView={onSelectView} />
      </div>

      {loading ? (
        <>
          <div className="flex w-[400px] shrink-0 flex-col border-r border-border bg-surface">
            <div className="border-b border-border px-3.5 py-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-1 h-4 w-24" />
            </div>
            <div className="flex-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col bg-surface">
            <div className="border-b border-border px-5 py-3 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="min-h-0 flex-1 space-y-2 px-5 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-sm border border-border bg-surface p-4 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              ))}
            </div>
          </div>
        </>
      ) : error ? (
        <div className="flex-1">
          <ErrorState
            title="Unable to load inbox"
            description={error}
            onRetry={() => {
              void conversationsQuery.refetch();
              void detailQuery.refetch();
            }}
          />
        </div>
      ) : (
        <>
          <ConversationList
            title={fallbackView?.label ?? "Conversation list"}
            conversations={conversations}
            selectedConversationId={activeConversation?.id ?? null}
            onSelectConversation={onSelectConversation}
          />
          <ConversationDetailPane
            conversation={activeConversation}
            detail={detailQuery.data}
            detailLoading={detailQuery.isLoading}
            onMutated={invalidateHelpdesk}
          />
        </>
      )}
    </div>
  );
}
