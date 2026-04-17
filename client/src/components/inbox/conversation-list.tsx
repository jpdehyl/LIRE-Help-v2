import { useEffect, useRef } from "react";
import { Inbox } from "lucide-react";
import type { ConversationRow } from "./types";
import { Badge, EmptyState, Eyebrow, PriorityBadge, SlaBadge, StatusBadge } from "../ui";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-slate-200 bg-white px-1 font-mono text-[10px] font-semibold text-slate-500 shadow-sm">
      {children}
    </span>
  );
}

interface ConversationListProps {
  title: string;
  conversations: ConversationRow[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationList({ title, conversations, selectedConversationId, onSelectConversation }: ConversationListProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedConversationId]);

  if (conversations.length === 0) {
    return (
      <div className="h-full border-r border-slate-200 bg-white">
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          description="Nothing needs attention here right now. Switch views or check back later."
        />
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>{title}</Eyebrow>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 xl:inline-flex" aria-hidden>
              <Kbd>J</Kbd>
              <Kbd>K</Kbd>
              <span>to navigate</span>
            </span>
            <Badge tone="slate" size="md">{conversations.length} in view</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200 bg-[#f8fafb] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>Requester, company, snippet</span>
        <span>State</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const active = conversation.id === selectedConversationId;

          return (
            <button
              key={conversation.id}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onSelectConversation(conversation.id)}
              aria-current={active ? "true" : undefined}
              className={[
                "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-slate-200 px-5 py-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                active ? "bg-[#eef3f6] shadow-[inset_3px_0_0_0_rgb(15_23_42)]" : "bg-white hover:bg-[#f8fafb]",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{conversation.requesterName}</span>
                  <Badge tone="slate">{conversation.company}</Badge>
                  {conversation.unread ? <span className="h-2.5 w-2.5 rounded-full bg-slate-900" aria-label="Unread conversation" /> : null}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800">{conversation.subject}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">{conversation.preview}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{conversation.requesterEmail}</span>
                  <span>•</span>
                  <span>{conversation.inboxLabel}</span>
                  <span>•</span>
                  <span>{conversation.messageCount} messages</span>
                  <span>•</span>
                  <span>{conversation.waitingSinceLabel}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-xs font-medium text-slate-500">{conversation.lastActivityLabel}</span>
                <PriorityBadge priority={conversation.priority} />
                <StatusBadge status={conversation.status} />
                <SlaBadge sla={conversation.slaState} />
                <span className="max-w-[180px] text-xs text-slate-500">
                  {conversation.assignee ? `Owner: ${conversation.assignee}` : "Unassigned"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
