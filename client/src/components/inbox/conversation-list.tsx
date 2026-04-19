import { useEffect, useRef } from "react";
import { Inbox } from "lucide-react";
import type { ConversationRow } from "./types";
import { EmptyState, PriorityBadge, SlaBadge, StatusBadge } from "../ui";

interface ConversationListProps {
  title: string;
  conversations: ConversationRow[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}

export function ConversationList({
  title,
  conversations,
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedConversationId]);

  if (conversations.length === 0) {
    return (
      <div className="h-full border-r border-border bg-surface">
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          description="Nothing needs attention here right now. Switch views or check back later."
        />
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 w-[400px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-fg-muted">{title}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-[18px] font-medium text-fg">{conversations.length}</span>
            <span className="font-body text-[12px] text-fg-muted">open</span>
          </div>
        </div>
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
                "relative block w-full border-b border-border px-3.5 py-3 text-left transition-colors ease-ds duration-fast focus:outline-none",
                active ? "bg-surface-2" : "bg-surface hover:bg-surface-2",
              ].join(" ")}
            >
              {active ? <span className="absolute inset-y-0 left-0 w-[2px] bg-accent" /> : null}
              <div className="flex items-center gap-2">
                {conversation.unread ? (
                  <span className="h-[6px] w-[6px] rounded-full bg-accent" aria-label="Unread conversation" />
                ) : null}
                <span className="font-mono text-[11px] tracking-[0.02em] text-fg-subtle">
                  {conversation.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="flex-1" />
                <span className="font-mono text-[11px] text-fg-muted">{conversation.lastActivityLabel}</span>
              </div>
              <div
                className={[
                  "mt-1 line-clamp-2 font-body text-[13px] leading-[1.35] text-fg",
                  conversation.unread ? "font-semibold" : "font-medium",
                ].join(" ")}
              >
                {conversation.subject}
              </div>
              <div className="mt-1 line-clamp-2 font-body text-[12px] leading-[1.45] text-fg-muted">
                {conversation.preview}
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <PriorityBadge priority={conversation.priority} />
                {conversation.slaState !== "healthy" ? <SlaBadge sla={conversation.slaState} /> : null}
                <StatusBadge status={conversation.status} />
                <span className="flex-1" />
                <span className="font-mono text-[10px] text-fg-subtle">
                  {conversation.inboxLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-border bg-surface-2 px-3.5 py-2 font-body text-[11px] text-fg-muted">
        <Kbd>J</Kbd>
        <Kbd>K</Kbd>
        <span>navigate</span>
        <span className="flex-1" />
        <Kbd>⌘K</Kbd>
        <span>jump</span>
      </div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-xs border border-border bg-surface px-1.5 py-[1px] font-mono text-[10px] font-medium leading-none text-fg-muted">
      {children}
    </span>
  );
}
