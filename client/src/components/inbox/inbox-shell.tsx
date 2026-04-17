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
  const error = navigationError
    ?? (conversationsQuery.error instanceof Error ? conversationsQuery.error.message : null)
    ?? (detailQuery.error instanceof Error ? detailQuery.error.message : null);

  return (
    <div className="flex h-[min(calc(100vh-11.5rem),900px)] min-h-[560px] min-w-0 overflow-hidden rounded-[32px] border border-slate-200/90 bg-white/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800/80 dark:bg-slate-900/70 dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
      <div className="hidden xl:block">
        <InboxSidebar views={views} selectedView={fallbackView?.key ?? selectedView} onSelectView={onSelectView} />
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
        {loading ? (
          <div className="grid min-w-0 flex-1 grid-cols-1 lg:col-span-2 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200 bg-[#f8fafb] px-5 py-2 dark:border-slate-800 dark:bg-slate-950/50">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-col bg-white dark:bg-slate-900">
              <div className="border-b border-slate-200 px-5 py-4 space-y-3 dark:border-slate-800">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-6 w-3/5" />
                <Skeleton className="h-3 w-4/5" />
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2 dark:border-slate-800 dark:bg-slate-900/60">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-5 py-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 dark:border-slate-800 dark:bg-slate-900">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="lg:col-span-2">
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
    </div>
  );
}
